using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Data;
using QuizApp.Api.Domain;
using QuizApp.Api.Dtos;
using QuizApp.Parsing;

namespace QuizApp.Api.Endpoints;

public static class ImportEndpoints
{
    public static void MapImportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/imports");

        // Parse pasted text. Saves nothing - the browser shows the draft for review.
        group.MapPost("/text", (TextImportRequest request, QuestionParser parser) =>
        {
            var parsed = parser.Parse(request.Text);
            return Results.Ok(ToResponse(parsed));
        });

        // Parse an uploaded file (.pdf, .txt, .md). Also saves nothing.
        group.MapPost("/file", async (IFormFile file, QuestionParser parser, IEnumerable<ITextExtractor> extractors) =>
        {
            if (file.Length == 0) return Results.BadRequest(new { error = "The file is empty." });

            var extractor = extractors.FirstOrDefault(e => e.CanHandle(file.FileName));
            if (extractor is null)
                return Results.BadRequest(new { error = $"No extractor handles '{Path.GetExtension(file.FileName)}'." });

            string text;
            try
            {
                await using var stream = file.OpenReadStream();
                text = extractor.Extract(stream, file.FileName);
            }
            catch (NoTextLayerException ex)
            {
                return Results.BadRequest(new { error = ex.Message, needsOcr = true });
            }

            return Results.Ok(ToResponse(parser.Parse(text)));
        }).DisableAntiforgery();

        // Commit a reviewed draft. This is the only path that writes questions.
        group.MapPost("/commit", async (CreateSetRequest request, QuizDbContext db) =>
        {
            if (request.Questions.Count == 0)
                return Results.BadRequest(new { error = "No questions to save." });

            var set = new QuestionSet
            {
                Name = request.Name,
                SourceFile = request.SourceFile,
                Questions = request.Questions.Select(q => new Question
                {
                    Number = q.Number,
                    Stem = q.Stem.Trim(),
                    Explanation = q.Explanation,
                    Reference = q.Reference,
                    MultiSelect = q.Options.Count(o => o.IsCorrect) > 1,
                    NeedsReview = q.Warnings.Count > 0,
                    ReviewNote = q.Warnings.Count > 0 ? string.Join(" ", q.Warnings) : null,
                    Options = q.Options.Select((o, i) => new Option
                    {
                        Label = o.Label,
                        Text = o.Text.Trim(),
                        IsCorrect = o.IsCorrect,
                        SortOrder = i
                    }).ToList()
                }).ToList()
            };

            db.QuestionSets.Add(set);
            await db.SaveChangesAsync();
            return Results.Created($"/api/sets/{set.Id}", new { set.Id, set.Name, QuestionCount = set.Questions.Count });
        });
    }

    private static ParseResponse ToResponse(IReadOnlyList<ParsedQuestion> parsed) =>
        new(parsed.Select(q => new DraftQuestion(
                q.Number,
                q.Stem,
                q.Options.Select(o => new DraftOption(o.Label, o.Text, o.IsCorrect)).ToList(),
                q.Explanation,
                q.Reference,
                q.RawAnswer,
                q.Warnings)).ToList(),
            parsed.Count(q => q.Warnings.Count > 0));
}

public record TextImportRequest(string Text);
