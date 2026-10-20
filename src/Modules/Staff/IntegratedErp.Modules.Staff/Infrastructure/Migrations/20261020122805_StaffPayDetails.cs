using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Staff.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StaffPayDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "account_holder",
                schema: "staff",
                table: "employee",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bank_name",
                schema: "staff",
                table: "employee",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "gosi_since",
                schema: "staff",
                table: "employee",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "iban",
                schema: "staff",
                table: "employee",
                type: "nvarchar(34)",
                maxLength: 34,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "account_holder",
                schema: "staff",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "bank_name",
                schema: "staff",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "gosi_since",
                schema: "staff",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "iban",
                schema: "staff",
                table: "employee");
        }
    }
}
