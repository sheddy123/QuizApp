using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Data;
using QuizApp.Api.Domain;
using QuizApp.Api.Dtos;
using QuizApp.Api.Services;

namespace QuizApp.Api.Endpoints;

public static class QuizEndpoints
{
    public static void MapQuizEndpoints(this IEndpointRouteBuilder app)
    {
        MapSets(app.MapGroup("/api/sets"));
        MapAttempts(app.MapGroup("/api/attempts"));
    }

    private static void MapSets(RouteGroupBuilder group)
    {
        group.MapGet("/", async (QuizDbContext db) =>
            // Order before projecting: EF cannot translate an ordering key read off the
            // constructed SetSummary.
            await db.QuestionSets
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => new SetSummary(
                    s.Id, s.Name, s.Questions.Count, s.CreatedAt,
                    db.Attempts.Count(a => a.QuestionSetId == s.Id && a.SubmittedAt != null)))
                .ToListAsync());

        // Full set including answers - for browsing and editing, never used while taking a quiz.
        group.MapGet("/{id:int}", async (int id, QuizDbContext db) =>
        {
            var set = await db.QuestionSets
                .Include(s => s.Questions).ThenInclude(q => q.Options)
                .FirstOrDefaultAsync(s => s.Id == id);
            return set is null ? Results.NotFound() : Results.Ok(set);
        });

        group.MapDelete("/{id:int}", async (int id, QuizDbContext db) =>
        {
            var set = await db.QuestionSets.FindAsync(id);
            if (set is null) return Results.NotFound();
            db.QuestionSets.Remove(set);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Edit one question in place - for fixing a wrong answer you spotted mid-practice.
        group.MapPut("/questions/{questionId:int}", async (int questionId, UpdateQuestionRequest request, QuizDbContext db) =>
        {
            var question = await db.Questions.Include(q => q.Options).FirstOrDefaultAsync(q => q.Id == questionId);
            if (question is null) return Results.NotFound();

            question.Stem = request.Stem;
            question.Explanation = request.Explanation;
            question.ReviewNote = request.ReviewNote;
            question.NeedsReview = request.NeedsReview;

            foreach (var option in question.Options)
                option.IsCorrect = request.CorrectOptionIds.Contains(option.Id);
            question.MultiSelect = request.CorrectOptionIds.Count > 1;

            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static void MapAttempts(RouteGroupBuilder group)
    {
        group.MapPost("/", async (StartAttemptRequest request, QuizDbContext db) =>
        {
            var set = await db.QuestionSets
                .Include(s => s.Questions).ThenInclude(q => q.Options)
                .FirstOrDefaultAsync(s => s.Id == request.QuestionSetId);
            if (set is null) return Results.NotFound(new { error = "Question set not found." });

            var seed = Random.Shared.Next();
            var ordered = await OrderPoolAsync(db, set, request.OnlyPreviouslyWrong, request.ShuffleQuestions, seed);
            if (ordered.Count == 0) return Results.BadRequest(new { error = "No previously missed questions in this set." });
            if (request.QuestionCount is > 0)
                ordered = ordered.Take(request.QuestionCount.Value).ToList();

            var attempt = NewAttempt(set.Id, ordered, seed, request.ShuffleOptions, request.PartialCredit);
            db.Attempts.Add(attempt);
            await db.SaveChangesAsync();

            return Results.Ok(BuildView(attempt, set.Name, ordered, null));
        });

        group.MapGet("/{id:int}", async (int id, QuizDbContext db) =>
        {
            var attempt = await db.Attempts
                .Include(a => a.QuestionSet)
                .Include(a => a.Items).ThenInclude(i => i.Question!).ThenInclude(q => q.Options)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (attempt is null) return Results.NotFound();

            var questions = attempt.Items.OrderBy(i => i.PresentedOrder).Select(i => i.Question!).ToList();
            return Results.Ok(BuildView(attempt, attempt.QuestionSet!.Name, questions, await BatchInfoAsync(db, attempt)));
        });

        group.MapPost("/{id:int}/submit", async (int id, SubmitRequest request, QuizDbContext db, GradingService grader) =>
        {
            var attempt = await db.Attempts
                .Include(a => a.QuestionSet)
                .Include(a => a.Items).ThenInclude(i => i.Answers)
                .Include(a => a.Items).ThenInclude(i => i.Question!).ThenInclude(q => q.Options)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (attempt is null) return Results.NotFound();
            if (attempt.SubmittedAt is not null) return Results.Conflict(new { error = "This attempt was already submitted." });

            var byQuestion = request.Answers.ToDictionary(a => a.QuestionId, a => a.OptionIds);

            foreach (var item in attempt.Items)
            {
                var selected = byQuestion.TryGetValue(item.QuestionId, out var ids) ? ids : new List<int>();
                var valid = selected.Where(oid => item.Question!.Options.Any(o => o.Id == oid)).ToList();

                item.Answers.Clear();
                foreach (var optionId in valid)
                    item.Answers.Add(new AttemptAnswer { OptionId = optionId });

                var (isCorrect, points) = grader.Grade(item.Question!, valid, attempt.PartialCredit);
                item.IsCorrect = isCorrect;
                item.Points = points;
            }

            attempt.SubmittedAt = DateTime.UtcNow;
            attempt.CorrectCount = attempt.Items.Count(i => i.IsCorrect == true);
            attempt.Score = attempt.Items.Count == 0 ? 0 : attempt.Items.Sum(i => i.Points ?? 0) / attempt.Items.Count;
            await db.SaveChangesAsync();

            return Results.Ok(BuildResult(attempt, await BatchInfoAsync(db, attempt)));
        });

        group.MapGet("/{id:int}/result", async (int id, QuizDbContext db) =>
        {
            var attempt = await db.Attempts
                .Include(a => a.QuestionSet)
                .Include(a => a.Items).ThenInclude(i => i.Answers)
                .Include(a => a.Items).ThenInclude(i => i.Question!).ThenInclude(q => q.Options)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (attempt is null) return Results.NotFound();
            if (attempt.SubmittedAt is null) return Results.BadRequest(new { error = "This attempt has not been submitted." });
            return Results.Ok(BuildResult(attempt, await BatchInfoAsync(db, attempt)));
        });

        group.MapGet("/", async (QuizDbContext db) =>
            await db.Attempts
                .Where(a => a.SubmittedAt != null)
                .OrderByDescending(a => a.SubmittedAt)
                .Select(a => new
                {
                    a.Id,
                    SetName = a.QuestionSet!.Name,
                    a.SubmittedAt,
                    a.Score,
                    a.CorrectCount,
                    QuestionCount = a.Items.Count
                })
                .Take(50)
                .ToListAsync());
    }

    /// <summary>
    /// The questions an attempt (or batch run) draws from, in presentation order.
    /// Empty only when <paramref name="onlyPreviouslyWrong"/> finds nothing.
    /// </summary>
    internal static async Task<List<Question>> OrderPoolAsync(
        QuizDbContext db, QuestionSet set, bool onlyPreviouslyWrong, bool shuffle, int seed)
    {
        IEnumerable<Question> pool = set.Questions;

        if (onlyPreviouslyWrong)
        {
            var wrongIds = await db.AttemptItems
                .Where(i => i.Attempt!.QuestionSetId == set.Id && i.IsCorrect == false)
                .Select(i => i.QuestionId)
                .Distinct()
                .ToListAsync();
            pool = pool.Where(q => wrongIds.Contains(q.Id));
        }

        return shuffle
            ? GradingService.Shuffle(pool.OrderBy(q => q.Id), seed)
            : pool.OrderBy(q => q.Number).ToList();
    }

    internal static Attempt NewAttempt(int setId, List<Question> questions, int seed, bool shuffleOptions, bool partialCredit) => new()
    {
        QuestionSetId = setId,
        ShuffleSeed = seed,
        ShuffleOptions = shuffleOptions,
        PartialCredit = partialCredit,
        Items = questions.Select((q, i) => new AttemptItem { QuestionId = q.Id, PresentedOrder = i }).ToList()
    };

    private static async Task<BatchInfo?> BatchInfoAsync(QuizDbContext db, Attempt attempt)
    {
        if (attempt.BatchRunId is not { } runId) return null;
        var count = await db.Attempts.CountAsync(a => a.BatchRunId == runId);
        return new BatchInfo(runId, attempt.BatchNumber ?? 0, count);
    }

    private static AttemptView BuildView(Attempt attempt, string setName, List<Question> questions, BatchInfo? batch)
    {
        var quizQuestions = questions.Select((q, i) =>
        {
            var options = q.Options.OrderBy(o => o.SortOrder).ToList();
            if (attempt.ShuffleOptions) options = GradingService.Shuffle(options, attempt.ShuffleSeed + q.Id);
            // Derived from the answer key rather than the stored flag, which sets imported
            // by older versions of the importer never had set.
            var multiSelect = q.Options.Count(o => o.IsCorrect) > 1;
            return new QuizQuestion(q.Id, i, q.Stem, multiSelect,
                options.Select(o => new QuizOption(o.Id, o.Label, o.Text)).ToList());
        }).ToList();

        return new AttemptView(attempt.Id, setName, attempt.StartedAt, quizQuestions, batch);
    }

    private static AttemptResult BuildResult(Attempt attempt, BatchInfo? batch)
    {
        var questions = attempt.Items.OrderBy(i => i.PresentedOrder).Select(item =>
        {
            var selected = item.Answers.Select(a => a.OptionId).ToHashSet();
            var q = item.Question!;
            return new QuestionResult(
                q.Id, q.Number, q.Stem,
                item.IsCorrect ?? false,
                item.Points ?? 0,
                q.Options.OrderBy(o => o.SortOrder)
                    .Select(o => new OptionResult(o.Id, o.Label, o.Text, o.IsCorrect, selected.Contains(o.Id)))
                    .ToList(),
                q.Explanation, q.Reference, q.NeedsReview, q.ReviewNote);
        }).ToList();

        return new AttemptResult(
            attempt.Id,
            attempt.QuestionSet!.Name,
            attempt.Score ?? 0,
            attempt.CorrectCount ?? 0,
            attempt.Items.Count,
            attempt.SubmittedAt!.Value,
            questions,
            batch);
    }
}

public record UpdateQuestionRequest(
    string Stem,
    string? Explanation,
    List<int> CorrectOptionIds,
    bool NeedsReview,
    string? ReviewNote);
