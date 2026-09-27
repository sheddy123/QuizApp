using QuizApp.Api.Domain;

namespace QuizApp.Api.Services;

public sealed class GradingService
{
    /// <summary>
    /// Grades one question. All-or-nothing by default, which is how the real exams score
    /// multi-answer questions; partial credit is available for gentler practice.
    /// </summary>
    public (bool IsCorrect, double Points) Grade(Question question, IReadOnlyCollection<int> selectedOptionIds, bool partialCredit)
    {
        var correct = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToHashSet();
        var selected = selectedOptionIds.ToHashSet();

        var exact = correct.SetEquals(selected);
        if (!partialCredit || correct.Count == 0)
            return (exact, exact ? 1d : 0d);

        var hits = selected.Count(correct.Contains);
        var misses = selected.Count - hits;
        var points = Math.Clamp((hits - misses) / (double)correct.Count, 0d, 1d);
        return (exact, points);
    }

    /// <summary>Deterministic shuffle so an attempt renders the same way if the page is reloaded.</summary>
    public static List<T> Shuffle<T>(IEnumerable<T> source, int seed)
    {
        var list = source.ToList();
        var rng = new Random(seed);
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }
}
