using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Billing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InternalAdjustments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "internal_additions",
                schema: "billing",
                table: "timesheet_line",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "internal_deductions",
                schema: "billing",
                table: "timesheet_line",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "internal_additions",
                schema: "billing",
                table: "timesheet_line");

            migrationBuilder.DropColumn(
                name: "internal_deductions",
                schema: "billing",
                table: "timesheet_line");
        }
    }
}
