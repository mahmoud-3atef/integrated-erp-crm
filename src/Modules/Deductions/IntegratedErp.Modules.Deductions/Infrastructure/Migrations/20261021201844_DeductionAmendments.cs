using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Deductions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeductionAmendments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "amend_note",
                schema: "deduction",
                table: "penalty",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "amended_at",
                schema: "deduction",
                table: "penalty",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "amended_by_name",
                schema: "deduction",
                table: "penalty",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "canceled_at",
                schema: "deduction",
                table: "penalty",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "canceled_by_name",
                schema: "deduction",
                table: "penalty",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "amend_note",
                schema: "deduction",
                table: "advance",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "amended_at",
                schema: "deduction",
                table: "advance",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "amended_by_name",
                schema: "deduction",
                table: "advance",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "canceled_at",
                schema: "deduction",
                table: "advance",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "canceled_by_name",
                schema: "deduction",
                table: "advance",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "amend_note",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "amended_at",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "amended_by_name",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "canceled_at",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "canceled_by_name",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "amend_note",
                schema: "deduction",
                table: "advance");

            migrationBuilder.DropColumn(
                name: "amended_at",
                schema: "deduction",
                table: "advance");

            migrationBuilder.DropColumn(
                name: "amended_by_name",
                schema: "deduction",
                table: "advance");

            migrationBuilder.DropColumn(
                name: "canceled_at",
                schema: "deduction",
                table: "advance");

            migrationBuilder.DropColumn(
                name: "canceled_by_name",
                schema: "deduction",
                table: "advance");
        }
    }
}
