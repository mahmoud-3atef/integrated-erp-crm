using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Expenses.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "expense");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "expense",
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
                name: "expense",
                schema: "expense",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    expense_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    spent_on = table.Column<DateOnly>(type: "date", nullable: false),
                    category = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    worker_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    worker_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    vat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    months = table.Column<int>(type: "int", nullable: false),
                    paid_to = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    cancel_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_expense", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "expense",
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
                schema: "expense",
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

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "expense",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "expense",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_expense_tenant_id",
                schema: "expense",
                table: "expense",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_expense_tenant_id_expense_no",
                schema: "expense",
                table: "expense",
                columns: new[] { "tenant_id", "expense_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_expense_tenant_id_project_crm_id",
                schema: "expense",
                table: "expense",
                columns: new[] { "tenant_id", "project_crm_id" });

            migrationBuilder.CreateIndex(
                name: "ix_expense_tenant_id_spent_on",
                schema: "expense",
                table: "expense",
                columns: new[] { "tenant_id", "spent_on" });

            migrationBuilder.CreateIndex(
                name: "ix_expense_tenant_id_worker_id",
                schema: "expense",
                table: "expense",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "expense",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.AddTenantSecurityPolicy("expense", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("expense", "expense");
            migrationBuilder.AddTenantSecurityPolicy("expense", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("expense", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("expense", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("expense", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("expense", "expense");
            migrationBuilder.DropTenantSecurityPolicy("expense", "audit_log");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "expense");

            migrationBuilder.DropTable(
                name: "expense",
                schema: "expense");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "expense");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "expense");
        }
    }
}
