using System.Text;
using System.Text.RegularExpressions;

namespace QuizApp.Parsing;

/// <summary>
/// Turns plain text into questions. Deliberately forgiving: it guesses, records warnings,
/// and leaves the final say to the human on the review screen.
/// </summary>
public sealed partial class QuestionParser
{
    // "12)" or "12." at the start of a line begins a new question.
    [GeneratedRegex(@"^(\d{1,3})\s*[\).]\s*(.*)$")]
    private static partial Regex QuestionStart();

    // "A." / "A)" / "A -" begins an option. Only A-F to avoid eating prose.
    [GeneratedRegex(@"^([A-F])\s*[\).\-,]\s+(.*)$")]
    private static partial Regex OptionStart();

    // "Answer: B" / "Correct Answer: B,D" / "Answer(s) : AB"
    [GeneratedRegex(@"^(?:correct\s+)?answer(?:\(s\))?\s*[:;\-]\s*(.*)$", RegexOptions.IgnoreCase)]
    private static partial Regex AnswerLine();

    [GeneratedRegex(@"^explanation\s*[:;\-]?\s*(.*)$", RegexOptions.IgnoreCase)]
    private static partial Regex ExplanationLine();

    [GeneratedRegex(@"^reference[s]?\s*[:;\-]?\s*(.*)$", RegexOptions.IgnoreCase)]
    private static partial Regex ReferenceLine();

    /// <summary>Lines matching these are dropped: watermarks, page numbers, site URLs.</summary>
    public List<string> NoisePatterns { get; } = new()
    {
        @"^\s*page\s+\d+\s*$",
        @"^\s*\d{1,3}\s*$",
        @"^\s*https?://\S+\s*$",
        @"(?i)watermark",
    };

    private enum State { Stem, Options, Explanation, Reference }

    public IReadOnlyList<ParsedQuestion> Parse(string text)
    {
        var results = new List<ParsedQuestion>();
        ParsedQuestion? current = null;
        var state = State.Stem;
        var stem = new StringBuilder();
        var explanation = new StringBuilder();
        var reference = new StringBuilder();

        void Flush()
        {
            if (current is null) return;
            current.Stem = Collapse(stem.ToString());
            current.Explanation = Blank(explanation.ToString());
            current.Reference = Blank(reference.ToString());
            Validate(current);
            results.Add(current);
            stem.Clear();
            explanation.Clear();
            reference.Clear();
        }

        foreach (var raw in text.Replace("\r\n", "\n").Split('\n'))
        {
            var line = CleanLine(raw);
            if (line.Length == 0) continue;
            if (IsNoise(line)) continue;

            // A numbered line starts a new question - but only when we are not mid-options,
            // because option text can legitimately wrap onto a line starting with a digit.
            var qm = QuestionStart().Match(line);
            if (qm.Success && (state != State.Options || LooksLikeQuestion(qm.Groups[2].Value)))
            {
                Flush();
                current = new ParsedQuestion { Number = int.Parse(qm.Groups[1].Value) };
                stem.Append(qm.Groups[2].Value);
                state = State.Stem;
                continue;
            }

            if (current is null) continue; // preamble before the first question

            var am = AnswerLine().Match(line);
            if (am.Success)
            {
                current.RawAnswer = am.Groups[1].Value.Trim();
                ApplyAnswer(current, current.RawAnswer);
                state = State.Explanation;
                continue;
            }

            var om = OptionStart().Match(line);
            if (om.Success && state is State.Stem or State.Options)
            {
                current.Options.Add(new ParsedOption { Label = om.Groups[1].Value, Text = om.Groups[2].Value.Trim() });
                state = State.Options;
                continue;
            }

            if (ExplanationLine().IsMatch(line) && state == State.Explanation)
            {
                var rest = ExplanationLine().Match(line).Groups[1].Value;
                if (rest.Length > 0) explanation.AppendLine(rest);
                continue;
            }

            var rm = ReferenceLine().Match(line);
            if (rm.Success && state is State.Explanation or State.Reference)
            {
                if (rm.Groups[1].Value.Length > 0) reference.AppendLine(rm.Groups[1].Value);
                state = State.Reference;
                continue;
            }

            // Continuation of whatever we are currently inside.
            switch (state)
            {
                case State.Stem: stem.Append(' ').Append(line); break;
                case State.Options: current.Options[^1].Text += " " + line; break;
                case State.Explanation: explanation.AppendLine(line); break;
                case State.Reference: reference.AppendLine(line); break;
            }
        }

        Flush();
        return results;
    }

    /// <summary>Marks options correct from an answer string like "B, D", "BD" or "B and D".</summary>
    private static void ApplyAnswer(ParsedQuestion q, string rawAnswer)
    {
        var letters = rawAnswer.ToUpperInvariant().Where(c => c is >= 'A' and <= 'F').Distinct().ToHashSet();
        foreach (var option in q.Options)
            option.IsCorrect = letters.Contains(option.Label[0]);

        foreach (var letter in letters)
            if (q.Options.All(o => o.Label[0] != letter))
                q.Warnings.Add($"Answer names option {letter}, which was not found in the option list.");
    }

    private static void Validate(ParsedQuestion q)
    {
        if (q.Stem.Length < 10) q.Warnings.Add("The question text looks too short - it may have been cut off.");
        if (q.Options.Count < 2) q.Warnings.Add($"Only {q.Options.Count} option(s) were found.");
        if (q.RawAnswer is null) q.Warnings.Add("No answer line was found.");
        else if (!q.Options.Any(o => o.IsCorrect)) q.Warnings.Add("No option was marked correct.");

        var expected = 'A';
        foreach (var option in q.Options)
        {
            if (option.Label[0] != expected) { q.Warnings.Add("Option labels are not in sequence."); break; }
            expected++;
        }

        // "Choose two" in the stem should agree with the number of correct options.
        var m = Regex.Match(q.Stem, @"choose\s+(two|three|2|3)|select\s+(two|three|2|3)", RegexOptions.IgnoreCase);
        if (m.Success)
        {
            var word = m.Value.ToLowerInvariant();
            var wanted = word.Contains("two") || word.Contains('2') ? 2 : 3;
            var actual = q.Options.Count(o => o.IsCorrect);
            if (actual != wanted)
                q.Warnings.Add($"The question asks for {wanted} answers but {actual} are marked correct.");
        }
    }

    private static bool LooksLikeQuestion(string rest) =>
        rest.Length > 15 && (rest.Contains('?') || char.IsUpper(rest.FirstOrDefault()));

    private bool IsNoise(string line) =>
        NoisePatterns.Any(p => Regex.IsMatch(line, p));

    private static string CleanLine(string s) => s
        .Replace('\u2018', '\'').Replace('\u2019', '\'')
        .Replace('\u201C', '"').Replace('\u201D', '"')
        .Replace('\u00A0', ' ')
        .Trim()
        .TrimStart('\'', '`', '*');

    private static string Collapse(string s) => Regex.Replace(s, @"\s+", " ").Trim();

    private static string? Blank(string s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
