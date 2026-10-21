using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OvertimeAmendments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "amend_note",
                schema: "attendance",
                table: "overtime",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "amended_at",
                schema: "attendance",
                table: "overtime",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "amended_by_name",
                schema: "attendance",
                table: "overtime",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "canceled_at",
                schema: "attendance",
                table: "overtime",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "canceled_by_name",
                schema: "attendance",
                table: "overtime",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "amend_note",
                schema: "attendance",
                table: "overtime");

            migrationBuilder.DropColumn(
                name: "amended_at",
                schema: "attendance",
                table: "overtime");

            migrationBuilder.DropColumn(
                name: "amended_by_name",
                schema: "attendance",
                table: "overtime");

            migrationBuilder.DropColumn(
                name: "canceled_at",
                schema: "attendance",
                table: "overtime");

            migrationBuilder.DropColumn(
                name: "canceled_by_name",
                schema: "attendance",
                table: "overtime");
        }
    }
}
