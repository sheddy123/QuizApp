using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class BatchRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BatchNumber",
                table: "Attempts",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BatchRunId",
                table: "Attempts",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShuffleOptions",
                table: "Attempts",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "BatchRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    QuestionSetId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BatchRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BatchRuns_QuestionSets_QuestionSetId",
                        column: x => x.QuestionSetId,
                        principalTable: "QuestionSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_BatchRunId",
                table: "Attempts",
                column: "BatchRunId");

            migrationBuilder.CreateIndex(
                name: "IX_BatchRuns_QuestionSetId",
                table: "BatchRuns",
                column: "QuestionSetId");

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_BatchRuns_BatchRunId",
                table: "Attempts",
                column: "BatchRunId",
                principalTable: "BatchRuns",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_BatchRuns_BatchRunId",
                table: "Attempts");

            migrationBuilder.DropTable(
                name: "BatchRuns");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_BatchRunId",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "BatchNumber",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "BatchRunId",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "ShuffleOptions",
                table: "Attempts");
        }
    }
}
