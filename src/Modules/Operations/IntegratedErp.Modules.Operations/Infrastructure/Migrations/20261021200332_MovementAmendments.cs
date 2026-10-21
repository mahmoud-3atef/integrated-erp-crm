using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Operations.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MovementAmendments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "operations",
                table: "worker_movement",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<string>(
                name: "amend_note",
                schema: "operations",
                table: "worker_movement",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "amended_at",
                schema: "operations",
                table: "worker_movement",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "amended_by_name",
                schema: "operations",
                table: "worker_movement",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "canceled_at",
                schema: "operations",
                table: "worker_movement",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "canceled_by_name",
                schema: "operations",
                table: "worker_movement",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "amend_note",
                schema: "operations",
                table: "worker_movement");

            migrationBuilder.DropColumn(
                name: "amended_at",
                schema: "operations",
                table: "worker_movement");

            migrationBuilder.DropColumn(
                name: "amended_by_name",
                schema: "operations",
                table: "worker_movement");

            migrationBuilder.DropColumn(
                name: "canceled_at",
                schema: "operations",
                table: "worker_movement");

            migrationBuilder.DropColumn(
                name: "canceled_by_name",
                schema: "operations",
                table: "worker_movement");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "operations",
                table: "worker_movement",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(30)",
                oldMaxLength: 30);
        }
    }
}
