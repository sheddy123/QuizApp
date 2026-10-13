using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Data;
using QuizApp.Api.Domain;
using QuizApp.Api.Dtos;

namespace QuizApp.Api.Endpoints;

/// <summary>Batch runs: a set split into several smaller attempts, scored separately and totalled at the end.</summary>
public static class RunEndpoints
{
    public static void MapRunEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/runs");

        // Creates every batch up front, so each question lands in exactly one batch.
        group.MapPost("/", async (StartRunRequest request, QuizDbContext db) =>
        {
            var set = await db.QuestionSets
                .Include(s => s.Questions)
                .FirstOrDefaultAsync(s => s.Id == request.QuestionSetId);
            if (set is null) return Results.NotFound(new { error = "Question set not found." });

            var seed = Random.Shared.Next();
            var pool = await QuizEndpoints.OrderPoolAsync(db, set, request.OnlyPreviouslyWrong, request.ShuffleQuestions, seed);
            if (pool.Count == 0) return Results.BadRequest(new { error = "No previously missed questions in this set." });
            if (request.BatchCount < 2 || request.BatchCount > pool.Count)
                return Results.BadRequest(new { error = $"Choose between 2 and {pool.Count} batches." });

            var run = new BatchRun { QuestionSetId = set.Id };
            var offset = 0;
            for (var b = 0; b < request.BatchCount; b++)
            {
                // Spread the remainder over the first batches: 116 in 3 gives 39, 39, 38.
                var size = pool.Count / request.BatchCount + (b < pool.Count % request.BatchCount ? 1 : 0);
                var attempt = QuizEndpoints.NewAttempt(
                    set.Id, pool.GetRange(offset, size), seed + b, request.ShuffleOptions, request.PartialCredit);
                attempt.BatchNumber = b + 1;
                run.Attempts.Add(attempt);
                offset += size;
            }

            db.BatchRuns.Add(run);
            await db.SaveChangesAsync();
            return Results.Ok(await BuildRunAsync(db, run.Id));
        });

        group.MapGet("/", async (QuizDbContext db) =>
            await db.BatchRuns
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new RunSummary(
                    r.Id, r.QuestionSetId, r.CreatedAt,
                    r.Attempts.Count,
                    r.Attempts.Count(a => a.SubmittedAt != null)))
                .ToListAsync());

        group.MapGet("/{id:int}", async (int id, QuizDbContext db) =>
            await BuildRunAsync(db, id) is { } run ? Results.Ok(run) : Results.NotFound());

        group.MapDelete("/{id:int}", async (int id, QuizDbContext db) =>
        {
            var run = await db.BatchRuns.FindAsync(id);
            if (run is null) return Results.NotFound();
            db.BatchRuns.Remove(run);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static async Task<RunView?> BuildRunAsync(QuizDbContext db, int id)
    {
        var run = await db.BatchRuns
            .Include(r => r.QuestionSet)
            .Include(r => r.Attempts).ThenInclude(a => a.Items)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return null;

        var batches = run.Attempts
            .OrderBy(a => a.BatchNumber)
            .Select(a => new BatchStatus(
                a.BatchNumber ?? 0, a.Id, a.Items.Count,
                a.SubmittedAt is not null, a.Score, a.CorrectCount, a.SubmittedAt))
            .ToList();

        RunTotal? total = null;
        if (run.Attempts.All(a => a.SubmittedAt is not null))
        {
            // Weight by question, not by batch, so a smaller batch doesn't count for more.
            var items = run.Attempts.SelectMany(a => a.Items).ToList();
            total = new RunTotal(
                items.Count == 0 ? 0 : items.Sum(i => i.Points ?? 0) / items.Count,
                items.Count(i => i.IsCorrect == true),
                items.Count);
        }

        return new RunView(run.Id, run.QuestionSetId, run.QuestionSet!.Name, run.CreatedAt, batches, total);
    }
}
