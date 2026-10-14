# QuizApp

A local practice-test app. Import questions from a file or pasted text, review what the parser
found, take the test, get graded, and see exactly what you got wrong.

- **API:** ASP.NET Core 8, minimal APIs, EF Core
- **Database:** SQLite (one file, no server). MSSQL is a two-line change
- **Frontend:** React 18 + TypeScript + Vite
- **Parsing:** its own class library with unit tests, because this is the part that needs tuning

## Running it

You need the [.NET SDK](https://dotnet.microsoft.com/download) and Node 18+.

The solution is `QuizApp.slnx`, the XML solution format. It needs Visual Studio 2022 17.14+,
JetBrains Rider 2024.3+, or the .NET 9 SDK (`dotnet build QuizApp.slnx`). `QuizApp.sln` is kept
alongside it for older tooling - if you edit one, mirror the change or delete the one you don't use.

```bash
# terminal 1 - API on http://localhost:5210
cd src/QuizApp.Api
dotnet run

# terminal 2 - UI on http://localhost:5173
cd web
npm install
npm run dev
```

The database file (`quizapp.db`) is created next to the API on first run. Delete it to start clean.
Swagger is at http://localhost:5210/swagger.

## Android app (offline)

The same React UI also builds as an Android app that needs no server. In that build, `web/src/api.ts`
swaps the HTTP client for `web/src/offline/localApi.ts`: a TypeScript port of the endpoints, grading and
parser that stores everything on the phone (IndexedDB). The GH-300 set is loaded on first launch.

```bash
cd web
npm run build:android      # vite build --mode android, then copies it into web/android
npx cap open android       # opens Android Studio: Build > Build APK(s), or Run on a plugged-in phone
```

Needs Android Studio (or the Android SDK) and JDK 17. Capacitor is pinned to 6 for that reason - 7 needs JDK 21.

`web/src/offline/parser.ts` mirrors `QuestionParser.cs`. A fix to one belongs in the other.

## Loading the GH-300 questions

`data/gh-300.json` holds all 116 questions already extracted, in the exact shape the commit
endpoint expects:

```bash
curl -X POST http://localhost:5210/api/imports/commit \
  -H "Content-Type: application/json" \
  -d @data/gh-300.json
```

`data/gh-300.txt` is the same content as plain text. Paste it into the import page to exercise the
parser end to end.

## Project layout

```
QuizApp.slnx                Solution (XML format)
QuizApp.sln                 Same solution, classic format
src/QuizApp.Api/            Web API
  Domain/Entities.cs        EF entities
  Data/QuizDbContext.cs     Model configuration
  Dtos/Contracts.cs         Request/response shapes
  Services/GradingService.cs
  Endpoints/                Route definitions
src/QuizApp.Parsing/        Text extraction + the question parser
tests/QuizApp.Parsing.Tests/
web/                        React frontend
data/                       Sample question sets
```

## How importing works

Three stages, and nothing is saved until you say so:

1. **Extract.** A PDF's text layer (PdfPig) or the text you pasted.
2. **Parse.** `QuestionParser` walks the lines as a state machine: `1)` starts a question, `A.`
   starts an option, `Answer: B, D` ends it. Everything after that is explanation. It records
   warnings rather than guessing silently — missing answer lines, option labels out of sequence, an
   answer naming an option that doesn't exist, or a "Choose two" whose answer only has one letter.
3. **Review.** The UI shows the draft with warnings flagged. You fix the text, tick the correct
   options, name the set, and save. Only then does anything reach the database.

When you hit a source the parser handles badly, add a case to `QuestionParserTests` first, then fix
the parser. That keeps you out of the click-through-the-UI-to-test loop.

## Scanned and screenshot PDFs

The GH-300 source was screenshots pasted into Word, and no amount of PDF parsing will read those —
there is no text to read. The API detects this (fewer than 80 characters of text per page) and
returns a clear error instead of importing nothing.

To handle those, OCR the file first:

```bash
# easiest: ocrmypdf adds a text layer, then upload the output normally
ocrmypdf --force-ocr input.pdf output.pdf
```

To do it in-app instead, add `Tesseract` and `PDFtoImage` to `QuizApp.Parsing`, write an
`OcrTextExtractor : ITextExtractor` that renders each page to an image and runs Tesseract over it,
and register it in `Program.cs` alongside the others. The `ITextExtractor` interface exists for
exactly this. Expect OCR output to need more cleanup on the review screen — it confuses `l`/`1`,
mangles arrows, and picks up watermark text, which is what `NoisePatterns` in the parser is for.

## Grading

A question is correct when the set of selected option IDs exactly matches the set of correct ones.
That matches how the real exams score multi-answer questions. Ticking "partial credit" when
starting an attempt scores `(hits - misses) / correct count` instead, floored at zero.

Two details worth keeping if you rework this:

- Correctness lives on the option, and answers are stored as option IDs. Letters are display only,
  so shuffling options can never break grading.
- `GET /api/attempts/{id}` returns a DTO with no `isCorrect` anywhere. If you ever hand back the
  entity directly, the answers show up in the browser's network tab.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/imports/text` | Parse pasted text, save nothing |
| POST | `/api/imports/file` | Parse an uploaded `.pdf`/`.txt`/`.md`, save nothing |
| POST | `/api/imports/commit` | Save a reviewed draft as a question set |
| GET | `/api/sets` | List sets |
| GET | `/api/sets/{id}` | One set including answers |
| PUT | `/api/sets/questions/{id}` | Fix a question's text or correct options |
| DELETE | `/api/sets/{id}` | Delete a set |
| POST | `/api/attempts` | Start an attempt (count, shuffle, partial credit, wrong-only) |
| GET | `/api/attempts/{id}` | The questions, without answers |
| POST | `/api/attempts/{id}/submit` | Grade and return the result |
| GET | `/api/attempts/{id}/result` | Re-read a graded attempt |

## Database notes

`EnsureCreated()` builds the schema on startup, which is right for a single-user local app with no
data worth preserving. Once the schema settles, switch to migrations:

```bash
dotnet tool install --global dotnet-ef
cd src/QuizApp.Api
dotnet ef migrations add Initial
dotnet ef database update
```

Then replace `EnsureCreated()` with `Database.Migrate()`.

For MSSQL: install `Microsoft.EntityFrameworkCore.SqlServer`, change `UseSqlite` to `UseSqlServer`
in `Program.cs`, and point the connection string at your instance. No entity changes are needed,
since nothing here uses provider-specific SQL.

## Worth adding next

- **Tags on questions**, so you can practise one topic at a time. Add `Tag`/`QuestionTag` and a
  filter on `StartAttemptRequest`.
- **A timer**, storing the limit on the attempt and counting down in `QuizPage`.
- **"I disagree with this answer"**, a flag on the question. Your GH-300 set has several where the
  given answer looks wrong; `NeedsReview` and `ReviewNote` are already there for it.
- **Stats per set** — accuracy over time, the questions you miss most.
