using QuizApp.Parsing;
using Xunit;

namespace QuizApp.Parsing.Tests;

public class QuestionParserTests
{
    private readonly QuestionParser _parser = new();

    [Fact]
    public void Parses_a_single_answer_question()
    {
        const string text = """
            3) Where is the proxy service hosted?
            A. Microsoft Azure
            B. Amazon Web Service
            C. Google Cloud Platform
            D. Self hosted
            Correct Answer: A
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.Equal(3, q.Number);
        Assert.Equal("Where is the proxy service hosted?", q.Stem);
        Assert.Equal(4, q.Options.Count);
        Assert.True(q.Options[0].IsCorrect);
        Assert.False(q.MultiSelect);
        Assert.Empty(q.Warnings);
    }

    [Theory]
    [InlineData("Answer: B, D")]
    [InlineData("Correct Answer: BD")]
    [InlineData("Answer(s): B,D")]
    public void Understands_multi_answer_formats(string answerLine)
    {
        var text = $"""
            7) Pick two.
            A. First
            B. Second
            C. Third
            D. Fourth
            {answerLine}
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.True(q.MultiSelect);
        Assert.Equal(new[] { "B", "D" }, q.Options.Where(o => o.IsCorrect).Select(o => o.Label));
    }

    [Fact]
    public void Joins_wrapped_stem_and_option_lines()
    {
        const string text = """
            12) What practices enhance the quality of suggestions
            provided by GitHub Copilot?
            A. Clearly defining the problem
            or task
            B. Something else
            Answer: A
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.Equal("What practices enhance the quality of suggestions provided by GitHub Copilot?", q.Stem);
        Assert.Equal("Clearly defining the problem or task", q.Options[0].Text);
    }

    [Fact]
    public void Captures_explanation_and_reference()
    {
        const string text = """
            5) A question?
            A. Yes
            B. No
            Answer: A
            Explanation:
            Because of reasons.
            Reference:
            GitHub Copilot documentation.
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.Equal("Because of reasons.", q.Explanation);
        Assert.Equal("GitHub Copilot documentation.", q.Reference);
    }

    [Fact]
    public void Splits_consecutive_questions()
    {
        const string text = """
            1) First question?
            A. One
            B. Two
            Answer: A
            2) Second question?
            A. Three
            B. Four
            Answer: B
            """;

        var questions = _parser.Parse(text);
        Assert.Equal(2, questions.Count);
        Assert.Equal("Second question?", questions[1].Stem);
    }

    [Fact]
    public void Warns_when_the_answer_line_is_missing()
    {
        const string text = """
            9) A question with no answer?
            A. One
            B. Two
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.True(q.NeedsReview);
        Assert.Contains(q.Warnings, w => w.Contains("No answer line"));
    }

    [Fact]
    public void Warns_when_choose_two_disagrees_with_the_answer()
    {
        const string text = """
            4) Pick the right ones. (Choose two.)
            A. One
            B. Two
            C. Three
            Answer: A
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.Contains(q.Warnings, w => w.Contains("asks for 2 answers"));
    }

    [Fact]
    public void Warns_when_the_answer_names_an_unknown_option()
    {
        const string text = """
            6) A question?
            A. One
            B. Two
            Answer: D
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.Contains(q.Warnings, w => w.Contains("option D"));
    }

    [Fact]
    public void Drops_watermark_and_page_number_noise()
    {
        const string text = """
            2) A question?
            https://www.shapingpixel.com
            A. One
            B. Two
            Page 14
            Answer: B
            """;

        var q = Assert.Single(_parser.Parse(text));
        Assert.Equal(2, q.Options.Count);
        Assert.DoesNotContain("shapingpixel", q.Options[0].Text);
    }
}
