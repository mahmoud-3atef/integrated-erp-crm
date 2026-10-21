using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Leave.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LeaveAmendments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "amend_note",
                schema: "leave",
                table: "request",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "amended_at",
                schema: "leave",
                table: "request",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "amended_by_name",
                schema: "leave",
                table: "request",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "canceled_at",
                schema: "leave",
                table: "request",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "canceled_by_name",
                schema: "leave",
                table: "request",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "amend_note",
                schema: "leave",
                table: "request");

            migrationBuilder.DropColumn(
                name: "amended_at",
                schema: "leave",
                table: "request");

            migrationBuilder.DropColumn(
                name: "amended_by_name",
                schema: "leave",
                table: "request");

            migrationBuilder.DropColumn(
                name: "canceled_at",
                schema: "leave",
                table: "request");

            migrationBuilder.DropColumn(
                name: "canceled_by_name",
                schema: "leave",
                table: "request");
        }
    }
}
