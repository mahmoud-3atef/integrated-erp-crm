using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Staff.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ActionAmendments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "amend_note",
                schema: "staff",
                table: "action",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "amended_at",
                schema: "staff",
                table: "action",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "amended_by_name",
                schema: "staff",
                table: "action",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "canceled_at",
                schema: "staff",
                table: "action",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "canceled_by_name",
                schema: "staff",
                table: "action",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "prior_file",
                schema: "staff",
                table: "action",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "amend_note",
                schema: "staff",
                table: "action");

            migrationBuilder.DropColumn(
                name: "amended_at",
                schema: "staff",
                table: "action");

            migrationBuilder.DropColumn(
                name: "amended_by_name",
                schema: "staff",
                table: "action");

            migrationBuilder.DropColumn(
                name: "canceled_at",
                schema: "staff",
                table: "action");

            migrationBuilder.DropColumn(
                name: "canceled_by_name",
                schema: "staff",
                table: "action");

            migrationBuilder.DropColumn(
                name: "prior_file",
                schema: "staff",
                table: "action");
        }
    }
}
