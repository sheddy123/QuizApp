using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Data;
using QuizApp.Api.Endpoints;
using QuizApp.Api.Services;
using QuizApp.Parsing;

var builder = WebApplication.CreateBuilder(args);

// SQLite by default. For MSSQL: install Microsoft.EntityFrameworkCore.SqlServer,
// change this to UseSqlServer(...) and point the connection string at your instance.
builder.Services.AddDbContext<QuizDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddSingleton<QuestionParser>();
builder.Services.AddSingleton<GradingService>();
builder.Services.AddSingleton<ITextExtractor, PdfTextExtractor>();
builder.Services.AddSingleton<ITextExtractor, PlainTextExtractor>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// Single-user local app: create the file on first run. Switch to migrations when the schema settles.
using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<QuizDbContext>().Database.Migrate();

app.UseCors();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapImportEndpoints();
app.MapQuizEndpoints();
app.MapGet("/api/health", () => new { status = "ok" });

app.Run();
