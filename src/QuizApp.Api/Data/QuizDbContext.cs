using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Domain;

namespace QuizApp.Api.Data;

public class QuizDbContext(DbContextOptions<QuizDbContext> options) : DbContext(options)
{
    public DbSet<QuestionSet> QuestionSets => Set<QuestionSet>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Option> Options => Set<Option>();
    public DbSet<Attempt> Attempts => Set<Attempt>();
    public DbSet<AttemptItem> AttemptItems => Set<AttemptItem>();
    public DbSet<AttemptAnswer> AttemptAnswers => Set<AttemptAnswer>();
    public DbSet<BatchRun> BatchRuns => Set<BatchRun>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<QuestionSet>(e =>
        {
            e.Property(x => x.Name).IsRequired().HasMaxLength(200);
            e.HasMany(x => x.Questions)
             .WithOne(x => x.QuestionSet!)
             .HasForeignKey(x => x.QuestionSetId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Question>(e =>
        {
            e.Property(x => x.Stem).IsRequired();
            e.HasIndex(x => new { x.QuestionSetId, x.Number });
            e.HasMany(x => x.Options)
             .WithOne(x => x.Question!)
             .HasForeignKey(x => x.QuestionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Option>(e =>
        {
            e.Property(x => x.Label).IsRequired().HasMaxLength(4);
            e.Property(x => x.Text).IsRequired();
        });

        b.Entity<Attempt>(e =>
        {
            e.HasMany(x => x.Items)
             .WithOne(x => x.Attempt!)
             .HasForeignKey(x => x.AttemptId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<BatchRun>(e =>
        {
            e.HasOne(x => x.QuestionSet)
             .WithMany()
             .HasForeignKey(x => x.QuestionSetId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Attempts)
             .WithOne(x => x.BatchRun)
             .HasForeignKey(x => x.BatchRunId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AttemptItem>(e =>
        {
            e.HasIndex(x => new { x.AttemptId, x.QuestionId }).IsUnique();
            e.HasOne(x => x.Question)
             .WithMany()
             .HasForeignKey(x => x.QuestionId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Answers)
             .WithOne(x => x.AttemptItem!)
             .HasForeignKey(x => x.AttemptItemId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AttemptAnswer>(e =>
        {
            e.HasIndex(x => new { x.AttemptItemId, x.OptionId }).IsUnique();
            e.HasOne(x => x.Option)
             .WithMany()
             .HasForeignKey(x => x.OptionId)
             .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
