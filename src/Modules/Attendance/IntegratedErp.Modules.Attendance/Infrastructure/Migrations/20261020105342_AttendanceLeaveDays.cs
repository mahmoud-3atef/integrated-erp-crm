using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AttendanceLeaveDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "paid_leave_days",
                schema: "attendance",
                table: "month_line",
                type: "decimal(7,2)",
                precision: 7,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "sick_part_days",
                schema: "attendance",
                table: "month_line",
                type: "decimal(7,2)",
                precision: 7,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "unpaid_leave_days",
                schema: "attendance",
                table: "month_line",
                type: "decimal(7,2)",
                precision: 7,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "paid_leave_days",
                schema: "attendance",
                table: "month_line");

            migrationBuilder.DropColumn(
                name: "sick_part_days",
                schema: "attendance",
                table: "month_line");

            migrationBuilder.DropColumn(
                name: "unpaid_leave_days",
                schema: "attendance",
                table: "month_line");
        }
    }
}
