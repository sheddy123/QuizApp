namespace QuizApp.Api.Dtos;

// ---------- Import ----------

public record ParseResponse(List<DraftQuestion> Questions, int WarningCount);

public record DraftQuestion(
    int Number,
    string Stem,
    List<DraftOption> Options,
    string? Explanation,
    string? Reference,
    string? RawAnswer,
    List<string> Warnings);

public record DraftOption(string Label, string Text, bool IsCorrect);

public record CreateSetRequest(string Name, string? SourceFile, List<DraftQuestion> Questions);

public record SetSummary(int Id, string Name, int QuestionCount, DateTime CreatedAt, int AttemptCount);

// ---------- Taking a quiz ----------

public record StartAttemptRequest(
    int QuestionSetId,
    int? QuestionCount = null,
    bool ShuffleQuestions = true,
    bool ShuffleOptions = false,
    bool PartialCredit = false,
    bool OnlyPreviouslyWrong = false);

/// <summary>What the browser receives while taking the quiz. Deliberately has no IsCorrect anywhere.</summary>
public record QuizQuestion(int QuestionId, int Order, string Stem, bool MultiSelect, List<QuizOption> Options);

public record QuizOption(int OptionId, string Label, string Text);

/// <summary>Where an attempt sits in a batch run; null on standalone attempts.</summary>
public record BatchInfo(int RunId, int BatchNumber, int BatchCount);

public record AttemptView(int AttemptId, string SetName, DateTime StartedAt, List<QuizQuestion> Questions, BatchInfo? Batch);

public record SubmitRequest(List<AnswerInput> Answers);

public record AnswerInput(int QuestionId, List<int> OptionIds);

// ---------- Results ----------

public record AttemptResult(
    int AttemptId,
    string SetName,
    double Score,
    int CorrectCount,
    int QuestionCount,
    DateTime SubmittedAt,
    List<QuestionResult> Questions,
    BatchInfo? Batch);

public record QuestionResult(
    int QuestionId,
    int Number,
    string Stem,
    bool IsCorrect,
    double Points,
    List<OptionResult> Options,
    string? Explanation,
    string? Reference,
    bool NeedsReview,
    string? ReviewNote);

public record OptionResult(int OptionId, string Label, string Text, bool IsCorrect, bool WasSelected);

// ---------- Batch runs ----------

public record StartRunRequest(
    int QuestionSetId,
    int BatchCount,
    bool ShuffleQuestions = true,
    bool ShuffleOptions = false,
    bool PartialCredit = false,
    bool OnlyPreviouslyWrong = false);

public record BatchStatus(
    int BatchNumber,
    int AttemptId,
    int QuestionCount,
    bool Submitted,
    double? Score,
    int? CorrectCount,
    DateTime? SubmittedAt);

/// <summary>Combined score across all batches. Only present once every batch is submitted.</summary>
public record RunTotal(double Score, int CorrectCount, int QuestionCount);

public record RunView(
    int RunId,
    int QuestionSetId,
    string SetName,
    DateTime CreatedAt,
    List<BatchStatus> Batches,
    RunTotal? Total);

public record RunSummary(int RunId, int QuestionSetId, DateTime CreatedAt, int BatchCount, int SubmittedCount);
