namespace QuizApp.Parsing;

/// <summary>A question as the parser understood it. Not yet trusted - the user reviews these before they are saved.</summary>
public sealed class ParsedQuestion
{
    public int Number { get; set; }
    public string Stem { get; set; } = "";
    public List<ParsedOption> Options { get; set; } = new();
    public string? Explanation { get; set; }
    public string? Reference { get; set; }

    /// <summary>Raw answer text as found in the source, e.g. "B, D" or "AB". Kept for the review screen.</summary>
    public string? RawAnswer { get; set; }

    /// <summary>Anything the user should look at before saving.</summary>
    public List<string> Warnings { get; set; } = new();

    public bool MultiSelect => Options.Count(o => o.IsCorrect) > 1;
    public bool NeedsReview => Warnings.Count > 0;
}

public sealed class ParsedOption
{
    public string Label { get; set; } = "";
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
}
