using System.Text;
using UglyToad.PdfPig;

namespace QuizApp.Parsing;

public interface ITextExtractor
{
    bool CanHandle(string fileName);
    string Extract(Stream stream, string fileName);
}

/// <summary>Reads the text layer of a PDF. Throws a useful message when the PDF is really images.</summary>
public sealed class PdfTextExtractor : ITextExtractor
{
    /// <summary>Below this many characters per page, we assume the page is a scan or screenshot.</summary>
    private const int MinCharsPerPage = 80;

    public bool CanHandle(string fileName) =>
        fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);

    public string Extract(Stream stream, string fileName)
    {
        // PdfPig needs a seekable stream.
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        buffer.Position = 0;

        var sb = new StringBuilder();
        var pages = 0;
        using (var document = PdfDocument.Open(buffer))
        {
            foreach (var page in document.GetPages())
            {
                pages++;
                sb.AppendLine(page.Text);
                sb.AppendLine();
            }
        }

        var text = sb.ToString();
        if (pages > 0 && text.Count(char.IsLetterOrDigit) / pages < MinCharsPerPage)
            throw new NoTextLayerException(
                "This PDF has almost no selectable text, so it is probably scans or screenshots. " +
                "Run it through OCR first (see README), then upload the result or paste the text.");

        return text;
    }
}

public sealed class PlainTextExtractor : ITextExtractor
{
    private static readonly string[] Extensions = { ".txt", ".md" };

    public bool CanHandle(string fileName) =>
        Extensions.Any(e => fileName.EndsWith(e, StringComparison.OrdinalIgnoreCase));

    public string Extract(Stream stream, string fileName)
    {
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}

public sealed class NoTextLayerException(string message) : Exception(message);
