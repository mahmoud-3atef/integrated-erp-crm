using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Deductions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeductionsPayroll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "deducted_amount",
                schema: "deduction",
                table: "penalty",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deducted_in",
                schema: "deduction",
                table: "penalty",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "deferrals",
                schema: "deduction",
                table: "penalty",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "deducted_in",
                schema: "deduction",
                table: "advance_installment",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "deducted_amount",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "deducted_in",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "deferrals",
                schema: "deduction",
                table: "penalty");

            migrationBuilder.DropColumn(
                name: "deducted_in",
                schema: "deduction",
                table: "advance_installment");
        }
    }
}
