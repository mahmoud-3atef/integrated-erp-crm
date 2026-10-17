using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Billing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "billing");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "billing",
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
                schema: "billing",
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
                schema: "billing",
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
                name: "project_setting",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    cycle_start_day = table.Column<int>(type: "int", nullable: false),
                    day_basis = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    overtime_multiplier = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false),
                    monthly_hours = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    overtime_hourly_rate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    max_overtime_hours = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    gosi_rate = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false),
                    vat_rate = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_setting", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "timesheet",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    timesheet_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    customer_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    contract_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    month = table.Column<DateOnly>(type: "date", nullable: false),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: false),
                    day_basis = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    generated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    generated_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_timesheet", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "timesheet_adjustment",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    timesheet_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_timesheet_adjustment", x => x.id);
                    table.ForeignKey(
                        name: "fk_timesheet_adjustment_timesheets_timesheet_id",
                        column: x => x.timesheet_id,
                        principalSchema: "billing",
                        principalTable: "timesheet",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "timesheet_line",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    timesheet_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    period_key = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    iqama_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    source = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    supplier_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    line_from = table.Column<DateOnly>(type: "date", nullable: false),
                    line_to = table.Column<DateOnly>(type: "date", nullable: false),
                    work_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    day_divisor = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    package_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    bill_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing_billable = table.Column<bool>(type: "bit", nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport_billable = table.Column<bool>(type: "bit", nullable: false),
                    is_special_price = table.Column<bool>(type: "bit", nullable: false),
                    pay_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    basic_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    source_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    source_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    from_old_system = table.Column<bool>(type: "bit", nullable: false),
                    absence_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime_hours = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    customer_loans = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    fee_days_adjust = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    other_costs = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    fee_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    absence_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_fees = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    gosi = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    invoice_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    vat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    invoice_total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    pay_due_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    pay_absence = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    worker_net = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_timesheet_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_timesheet_line_timesheet_timesheet_id",
                        column: x => x.timesheet_id,
                        principalSchema: "billing",
                        principalTable: "timesheet",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "billing",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "billing",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "billing",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_project_setting_tenant_id",
                schema: "billing",
                table: "project_setting",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_project_setting_tenant_id_project_id",
                schema: "billing",
                table: "project_setting",
                columns: new[] { "tenant_id", "project_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_tenant_id",
                schema: "billing",
                table: "timesheet",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_tenant_id_project_id_month",
                schema: "billing",
                table: "timesheet",
                columns: new[] { "tenant_id", "project_id", "month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_tenant_id_timesheet_no",
                schema: "billing",
                table: "timesheet",
                columns: new[] { "tenant_id", "timesheet_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_adjustment_tenant_id",
                schema: "billing",
                table: "timesheet_adjustment",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_adjustment_tenant_id_timesheet_id_worker_id",
                schema: "billing",
                table: "timesheet_adjustment",
                columns: new[] { "tenant_id", "timesheet_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_adjustment_timesheet_id",
                schema: "billing",
                table: "timesheet_adjustment",
                column: "timesheet_id");

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_line_tenant_id",
                schema: "billing",
                table: "timesheet_line",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_line_tenant_id_worker_id",
                schema: "billing",
                table: "timesheet_line",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_line_timesheet_id",
                schema: "billing",
                table: "timesheet_line",
                column: "timesheet_id");

            migrationBuilder.AddTenantSecurityPolicy("billing", "timesheet");
            migrationBuilder.AddTenantSecurityPolicy("billing", "timesheet_line");
            migrationBuilder.AddTenantSecurityPolicy("billing", "timesheet_adjustment");
            migrationBuilder.AddTenantSecurityPolicy("billing", "project_setting");
            migrationBuilder.AddTenantSecurityPolicy("billing", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("billing", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("billing", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("billing", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("billing", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("billing", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("billing", "project_setting");
            migrationBuilder.DropTenantSecurityPolicy("billing", "timesheet_adjustment");
            migrationBuilder.DropTenantSecurityPolicy("billing", "timesheet_line");
            migrationBuilder.DropTenantSecurityPolicy("billing", "timesheet");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "project_setting",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "timesheet_adjustment",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "timesheet_line",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "timesheet",
                schema: "billing");
        }
    }
}
