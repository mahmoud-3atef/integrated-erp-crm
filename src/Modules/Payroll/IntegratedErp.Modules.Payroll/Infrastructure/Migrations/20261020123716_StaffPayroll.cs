using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StaffPayroll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gosi_rate",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    category = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    employee_percent = table.Column<decimal>(type: "decimal(6,3)", precision: 6, scale: 3, nullable: false),
                    employer_percent = table.Column<decimal>(type: "decimal(6,3)", precision: 6, scale: 3, nullable: false),
                    min_base = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    max_base = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gosi_rate", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staff_adjustment",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_adjustment", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staff_pay_setting",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    overtime_premium_percent = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: false),
                    hours_per_day = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    late_mode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_pay_setting", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staff_run",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    legal_entity_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    calculated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    total_absence = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_advances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_deferred = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_employees = table.Column<int>(type: "int", nullable: false),
                    total_gosi_employee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_gosi_employer = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_joiners = table.Column<int>(type: "int", nullable: false),
                    total_leavers = table.Column<int>(type: "int", nullable: false),
                    total_net = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_no_salary = table.Column<int>(type: "int", nullable: false),
                    total_other_allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_other_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_paid_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_penalties = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_without_iban = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_run", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staff_line",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    department_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    department_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    job_title_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    job_title_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    monthly_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    monthly_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    paid_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    unpaid_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    late_minutes = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    sick_part_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime_hours = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    other_allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    gross = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    absence = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    late = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    sick_part = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    penalties = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    advances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    other_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    gosi_category = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    gosi_base = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    gosi_employee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    gosi_employer = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    deferred = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    cap_limit = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    net = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    bank_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    iban = table.Column<string>(type: "nvarchar(34)", maxLength: 34, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_staff_line_staff_run_run_id",
                        column: x => x.run_id,
                        principalSchema: "payroll",
                        principalTable: "staff_run",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "staff_item",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    source_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reference = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    days = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    due = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    deducted = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    deferred = table.Column<bool>(type: "bit", nullable: false),
                    above_cap = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_staff_item_staff_line_line_id",
                        column: x => x.line_id,
                        principalSchema: "payroll",
                        principalTable: "staff_line",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_gosi_rate_tenant_id",
                schema: "payroll",
                table: "gosi_rate",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_gosi_rate_tenant_id_category_effective_from",
                schema: "payroll",
                table: "gosi_rate",
                columns: new[] { "tenant_id", "category", "effective_from" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_adjustment_run_id_employee_id",
                schema: "payroll",
                table: "staff_adjustment",
                columns: new[] { "run_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "ix_staff_adjustment_tenant_id",
                schema: "payroll",
                table: "staff_adjustment",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_item_line_id",
                schema: "payroll",
                table: "staff_item",
                column: "line_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_item_run_id",
                schema: "payroll",
                table: "staff_item",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_item_tenant_id",
                schema: "payroll",
                table: "staff_item",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_line_run_id_department_id",
                schema: "payroll",
                table: "staff_line",
                columns: new[] { "run_id", "department_id" });

            migrationBuilder.CreateIndex(
                name: "ix_staff_line_run_id_employee_id",
                schema: "payroll",
                table: "staff_line",
                columns: new[] { "run_id", "employee_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_line_tenant_id",
                schema: "payroll",
                table: "staff_line",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_pay_setting_tenant_id",
                schema: "payroll",
                table: "staff_pay_setting",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_run_tenant_id",
                schema: "payroll",
                table: "staff_run",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_run_tenant_id_legal_entity_id_period",
                schema: "payroll",
                table: "staff_run",
                columns: new[] { "tenant_id", "legal_entity_id", "period" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_run_tenant_id_run_no",
                schema: "payroll",
                table: "staff_run",
                columns: new[] { "tenant_id", "run_no" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("payroll", "staff_run");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "staff_line");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "staff_item");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "staff_adjustment");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "staff_pay_setting");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "gosi_rate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("payroll", "gosi_rate");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "staff_pay_setting");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "staff_adjustment");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "staff_item");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "staff_line");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "staff_run");

            migrationBuilder.DropTable(
                name: "gosi_rate",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "staff_adjustment",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "staff_item",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "staff_pay_setting",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "staff_line",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "staff_run",
                schema: "payroll");
        }
    }
}
