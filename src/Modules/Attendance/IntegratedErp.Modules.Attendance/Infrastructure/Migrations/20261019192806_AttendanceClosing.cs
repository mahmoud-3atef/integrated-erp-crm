using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AttendanceClosing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "minutes_source",
                schema: "attendance",
                table: "shift",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Company");

            migrationBuilder.CreateTable(
                name: "month",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    submitted_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    closed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_month", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "overtime",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    minutes = table.Column<int>(type: "int", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_overtime", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "month_line",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    month_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    department_ar = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    department_en = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    shift_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    shift_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    work_days = table.Column<int>(type: "int", nullable: false),
                    present = table.Column<int>(type: "int", nullable: false),
                    absent = table.Column<int>(type: "int", nullable: false),
                    leave = table.Column<int>(type: "int", nullable: false),
                    excused = table.Column<int>(type: "int", nullable: false),
                    late_minutes = table.Column<int>(type: "int", nullable: false),
                    early_minutes = table.Column<int>(type: "int", nullable: false),
                    missing_punches = table.Column<int>(type: "int", nullable: false),
                    deduction_days = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    overtime_minutes = table.Column<int>(type: "int", nullable: false),
                    state = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_month_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_month_line_month_month_id",
                        column: x => x.month_id,
                        principalSchema: "attendance",
                        principalTable: "month",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_month_tenant_id",
                schema: "attendance",
                table: "month",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_month_tenant_id_period",
                schema: "attendance",
                table: "month",
                columns: new[] { "tenant_id", "period" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_month_line_month_id",
                schema: "attendance",
                table: "month_line",
                column: "month_id");

            migrationBuilder.CreateIndex(
                name: "ix_month_line_tenant_id",
                schema: "attendance",
                table: "month_line",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_month_line_tenant_id_month_id_employee_id",
                schema: "attendance",
                table: "month_line",
                columns: new[] { "tenant_id", "month_id", "employee_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_overtime_tenant_id",
                schema: "attendance",
                table: "overtime",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_overtime_tenant_id_employee_id_date",
                schema: "attendance",
                table: "overtime",
                columns: new[] { "tenant_id", "employee_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_overtime_tenant_id_request_no",
                schema: "attendance",
                table: "overtime",
                columns: new[] { "tenant_id", "request_no" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("attendance", "month");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "month_line");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "overtime");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("attendance", "overtime");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "month_line");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "month");

            migrationBuilder.DropTable(
                name: "month_line",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "overtime",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "month",
                schema: "attendance");

            migrationBuilder.DropColumn(
                name: "minutes_source",
                schema: "attendance",
                table: "shift");
        }
    }
}
