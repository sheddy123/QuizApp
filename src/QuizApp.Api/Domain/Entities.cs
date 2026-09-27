namespace QuizApp.Api.Domain;

public class QuestionSet
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? SourceFile { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Question> Questions { get; set; } = new();
}

public class Question
{
    public int Id { get; set; }
    public int QuestionSetId { get; set; }
    public QuestionSet? QuestionSet { get; set; }

    /// <summary>Original number in the source document, kept so you can trace a question back.</summary>
    public int Number { get; set; }
    public string Stem { get; set; } = "";
    public string? Explanation { get; set; }
    public string? Reference { get; set; }

    /// <summary>True when more than one option is correct. Drives checkbox vs radio in the UI.</summary>
    public bool MultiSelect { get; set; }

    /// <summary>Set by the importer or by you, for questions whose given answer looks wrong.</summary>
    public bool NeedsReview { get; set; }
    public string? ReviewNote { get; set; }

    public List<Option> Options { get; set; } = new();
}

public class Option
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public Question? Question { get; set; }

    /// <summary>Label as printed in the source ("A"). Display only - never use it to grade.</summary>
    public string Label { get; set; } = "";
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
    public int SortOrder { get; set; }
}

public class Attempt
{
    public int Id { get; set; }
    public int QuestionSetId { get; set; }
    public QuestionSet? QuestionSet { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }

    /// <summary>Seed used to shuffle questions and options, so an attempt can be re-rendered identically.</summary>
    public int ShuffleSeed { get; set; }
    public bool PartialCredit { get; set; }
    public double? Score { get; set; }
    public int? CorrectCount { get; set; }

    public List<AttemptItem> Items { get; set; } = new();
}

public class AttemptItem
{
    public int Id { get; set; }
    public int AttemptId { get; set; }
    public Attempt? Attempt { get; set; }
    public int QuestionId { get; set; }
    public Question? Question { get; set; }
    public int PresentedOrder { get; set; }

    /// <summary>Null until graded.</summary>
    public bool? IsCorrect { get; set; }
    public double? Points { get; set; }

    public List<AttemptAnswer> Answers { get; set; } = new();
}

public class AttemptAnswer
{
    public int Id { get; set; }
    public int AttemptItemId { get; set; }
    public AttemptItem? AttemptItem { get; set; }
    public int OptionId { get; set; }
    public Option? Option { get; set; }
}
