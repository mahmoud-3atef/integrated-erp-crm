using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Deductions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialDeductions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "deduction");

            migrationBuilder.CreateTable(
                name: "advance",
                schema: "deduction",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    advance_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    months = table.Column<int>(type: "int", nullable: false),
                    first_period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    above_cap = table.Column<bool>(type: "bit", nullable: false),
                    salary_at_request = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    manager_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    paid_on = table.Column<DateOnly>(type: "date", nullable: true),
                    paid_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    payment_method = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    payment_reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_advance", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "deduction",
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
                schema: "deduction",
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
                schema: "deduction",
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
                name: "penalty",
                schema: "deduction",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    penalty_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    category = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    penalty_type_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    effect = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    violation_date = table.Column<DateOnly>(type: "date", nullable: false),
                    description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    statement = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    days = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: true),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    above_cap = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_penalty", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "penalty_type",
                schema: "deduction",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    effect = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_penalty_type", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "setting",
                schema: "deduction",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    advance_cap_percent = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    advance_max_months = table.Column<int>(type: "int", nullable: false),
                    advance_after_probation = table.Column<bool>(type: "bit", nullable: false),
                    advance_min_service_months = table.Column<int>(type: "int", nullable: false),
                    advance_one_open = table.Column<bool>(type: "bit", nullable: false),
                    penalty_max_days_per_violation = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    penalty_max_days_per_month = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    suspension_max_days_per_month = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    monthly_cap_percent = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_setting", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "advance_installment",
                schema: "deduction",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    advance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    deducted = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_advance_installment", x => x.id);
                    table.ForeignKey(
                        name: "fk_advance_installment_advance_advance_id",
                        column: x => x.advance_id,
                        principalSchema: "deduction",
                        principalTable: "advance",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_advance_tenant_id",
                schema: "deduction",
                table: "advance",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_advance_tenant_id_advance_no",
                schema: "deduction",
                table: "advance",
                columns: new[] { "tenant_id", "advance_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_advance_tenant_id_employee_id",
                schema: "deduction",
                table: "advance",
                columns: new[] { "tenant_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "ix_advance_installment_advance_id",
                schema: "deduction",
                table: "advance_installment",
                column: "advance_id");

            migrationBuilder.CreateIndex(
                name: "ix_advance_installment_tenant_id",
                schema: "deduction",
                table: "advance_installment",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_advance_installment_tenant_id_period",
                schema: "deduction",
                table: "advance_installment",
                columns: new[] { "tenant_id", "period" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "deduction",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "deduction",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "deduction",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_penalty_tenant_id",
                schema: "deduction",
                table: "penalty",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_penalty_tenant_id_employee_id_period",
                schema: "deduction",
                table: "penalty",
                columns: new[] { "tenant_id", "employee_id", "period" });

            migrationBuilder.CreateIndex(
                name: "ix_penalty_tenant_id_penalty_no",
                schema: "deduction",
                table: "penalty",
                columns: new[] { "tenant_id", "penalty_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_penalty_type_tenant_id",
                schema: "deduction",
                table: "penalty_type",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_setting_tenant_id",
                schema: "deduction",
                table: "setting",
                column: "tenant_id",
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("deduction", "setting");
            migrationBuilder.AddTenantSecurityPolicy("deduction", "penalty_type");
            migrationBuilder.AddTenantSecurityPolicy("deduction", "advance");
            migrationBuilder.AddTenantSecurityPolicy("deduction", "advance_installment");
            migrationBuilder.AddTenantSecurityPolicy("deduction", "penalty");
            migrationBuilder.AddTenantSecurityPolicy("deduction", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("deduction", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("deduction", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("deduction", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("deduction", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("deduction", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("deduction", "penalty");
            migrationBuilder.DropTenantSecurityPolicy("deduction", "advance_installment");
            migrationBuilder.DropTenantSecurityPolicy("deduction", "advance");
            migrationBuilder.DropTenantSecurityPolicy("deduction", "penalty_type");
            migrationBuilder.DropTenantSecurityPolicy("deduction", "setting");

            migrationBuilder.DropTable(
                name: "advance_installment",
                schema: "deduction");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "deduction");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "deduction");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "deduction");

            migrationBuilder.DropTable(
                name: "penalty",
                schema: "deduction");

            migrationBuilder.DropTable(
                name: "penalty_type",
                schema: "deduction");

            migrationBuilder.DropTable(
                name: "setting",
                schema: "deduction");

            migrationBuilder.DropTable(
                name: "advance",
                schema: "deduction");
        }
    }
}
