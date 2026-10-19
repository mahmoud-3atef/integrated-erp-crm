using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PayrollRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "payroll");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    entity_type = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    entity_id = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    action = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    changes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    user_id = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    user_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    trace_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "payroll",
                columns: table => new
                {
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sequence_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    scope_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    period = table.Column<int>(type: "int", nullable: false),
                    next_value = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_number_sequence", x => new { x.tenant_id, x.sequence_key, x.scope_key, x.period });
                    table.CheckConstraint("ck_number_sequence_next_value", "next_value >= 1");
                });

            migrationBuilder.CreateTable(
                name: "outbox_message",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    attempts = table.Column<int>(type: "int", nullable: false),
                    last_error = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outbox_message", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "payroll_run",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    group = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    legal_entity_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
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
                    total_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_base = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_excluded = table.Column<int>(type: "int", nullable: false),
                    total_food = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_net = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_other_allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_paid_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_workers = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payroll_run", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sponsor_registration",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sponsor = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sponsor_registration", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "payroll_exclusion",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    reference = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payroll_exclusion", x => x.id);
                    table.ForeignKey(
                        name: "fk_payroll_exclusion_payroll_run_run_id",
                        column: x => x.run_id,
                        principalSchema: "payroll",
                        principalTable: "payroll_run",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payroll_line",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    status_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    status_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    projects = table.Column<int>(type: "int", nullable: false),
                    monthly_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    paid_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    absence_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    @base = table.Column<decimal>(name: "base", type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    food = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    other_allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    internal_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    allowances = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    customer_loans = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    internal_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    net = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    notes = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payroll_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_payroll_line_payroll_run_run_id",
                        column: x => x.run_id,
                        principalSchema: "payroll",
                        principalTable: "payroll_run",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payroll_line_source",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    timesheet_line_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    timesheet_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    timesheet_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    line_from = table.Column<DateOnly>(type: "date", nullable: false),
                    line_to = table.Column<DateOnly>(type: "date", nullable: false),
                    work_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    day_divisor = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    absence_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    pay_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_part = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime_hours = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    customer_loans = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    internal_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    internal_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    net = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payroll_line_source", x => x.id);
                    table.ForeignKey(
                        name: "fk_payroll_line_source_payroll_line_line_id",
                        column: x => x.line_id,
                        principalSchema: "payroll",
                        principalTable: "payroll_line",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "payroll",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "payroll",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "payroll",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_payroll_exclusion_run_id",
                schema: "payroll",
                table: "payroll_exclusion",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "ix_payroll_exclusion_tenant_id",
                schema: "payroll",
                table: "payroll_exclusion",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_payroll_line_run_id_project_crm_id",
                schema: "payroll",
                table: "payroll_line",
                columns: new[] { "run_id", "project_crm_id" });

            migrationBuilder.CreateIndex(
                name: "ix_payroll_line_run_id_worker_id",
                schema: "payroll",
                table: "payroll_line",
                columns: new[] { "run_id", "worker_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payroll_line_tenant_id",
                schema: "payroll",
                table: "payroll_line",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_payroll_line_source_line_id",
                schema: "payroll",
                table: "payroll_line_source",
                column: "line_id");

            migrationBuilder.CreateIndex(
                name: "ix_payroll_line_source_run_id",
                schema: "payroll",
                table: "payroll_line_source",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "ix_payroll_line_source_tenant_id",
                schema: "payroll",
                table: "payroll_line_source",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_payroll_line_source_tenant_id_timesheet_line_id",
                schema: "payroll",
                table: "payroll_line_source",
                columns: new[] { "tenant_id", "timesheet_line_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payroll_run_tenant_id",
                schema: "payroll",
                table: "payroll_run",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_payroll_run_tenant_id_group_legal_entity_id_from",
                schema: "payroll",
                table: "payroll_run",
                columns: new[] { "tenant_id", "group", "legal_entity_id", "from" });

            migrationBuilder.CreateIndex(
                name: "ix_payroll_run_tenant_id_run_no",
                schema: "payroll",
                table: "payroll_run",
                columns: new[] { "tenant_id", "run_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sponsor_registration_tenant_id",
                schema: "payroll",
                table: "sponsor_registration",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_sponsor_registration_tenant_id_sponsor",
                schema: "payroll",
                table: "sponsor_registration",
                columns: new[] { "tenant_id", "sponsor" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("payroll", "payroll_run");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "payroll_line");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "payroll_line_source");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "payroll_exclusion");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "sponsor_registration");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("payroll", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "sponsor_registration");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "payroll_exclusion");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "payroll_line_source");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "payroll_line");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "payroll_run");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_exclusion",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_line_source",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "sponsor_registration",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_line",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_run",
                schema: "payroll");
        }
    }
}
