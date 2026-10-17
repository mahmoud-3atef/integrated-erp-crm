using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class HousingPeriodSalary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "pay_salary",
                schema: "workforce",
                table: "worker_period",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "pay_salary",
                schema: "workforce",
                table: "worker_period");
        }
    }
}
