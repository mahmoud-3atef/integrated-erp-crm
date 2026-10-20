using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Leave.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialLeave : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "leave");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "leave",
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
                name: "balance_entry",
                schema: "leave",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    leave_type_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    days = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_balance_entry", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "leave_type",
                schema: "leave",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    pay = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    has_balance = table.Column<bool>(type: "bit", nullable: false),
                    days_per_year = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: true),
                    senior_days_per_year = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: true),
                    senior_after_years = table.Column<int>(type: "int", nullable: true),
                    max_days_per_request = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: true),
                    once_per_service = table.Column<bool>(type: "bit", nullable: false),
                    day_count = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    needs_attachment = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_leave_type", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "leave",
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
                schema: "leave",
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
                name: "request",
                schema: "leave",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    leave_type_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: false),
                    days = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    substitute_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    substitute_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ticket = table.Column<bool>(type: "bit", nullable: false),
                    manager_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_request", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "setting",
                schema: "leave",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    carry_over_limit = table.Column<int>(type: "int", nullable: true),
                    permission_minutes_per_month = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_setting", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "leave",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "leave",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_balance_entry_tenant_id",
                schema: "leave",
                table: "balance_entry",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_balance_entry_tenant_id_employee_id_leave_type_id_date",
                schema: "leave",
                table: "balance_entry",
                columns: new[] { "tenant_id", "employee_id", "leave_type_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_balance_entry_tenant_id_employee_id_leave_type_id_period",
                schema: "leave",
                table: "balance_entry",
                columns: new[] { "tenant_id", "employee_id", "leave_type_id", "period" },
                unique: true,
                filter: "[period] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_leave_type_tenant_id",
                schema: "leave",
                table: "leave_type",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_leave_type_tenant_id_code",
                schema: "leave",
                table: "leave_type",
                columns: new[] { "tenant_id", "code" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "leave",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_request_tenant_id",
                schema: "leave",
                table: "request",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_request_tenant_id_employee_id_from",
                schema: "leave",
                table: "request",
                columns: new[] { "tenant_id", "employee_id", "from" });

            migrationBuilder.CreateIndex(
                name: "ix_request_tenant_id_request_no",
                schema: "leave",
                table: "request",
                columns: new[] { "tenant_id", "request_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_setting_tenant_id",
                schema: "leave",
                table: "setting",
                column: "tenant_id",
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("leave", "setting");
            migrationBuilder.AddTenantSecurityPolicy("leave", "leave_type");
            migrationBuilder.AddTenantSecurityPolicy("leave", "balance_entry");
            migrationBuilder.AddTenantSecurityPolicy("leave", "request");
            migrationBuilder.AddTenantSecurityPolicy("leave", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("leave", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("leave", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("leave", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("leave", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("leave", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("leave", "request");
            migrationBuilder.DropTenantSecurityPolicy("leave", "balance_entry");
            migrationBuilder.DropTenantSecurityPolicy("leave", "leave_type");
            migrationBuilder.DropTenantSecurityPolicy("leave", "setting");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "leave");

            migrationBuilder.DropTable(
                name: "balance_entry",
                schema: "leave");

            migrationBuilder.DropTable(
                name: "leave_type",
                schema: "leave");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "leave");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "leave");

            migrationBuilder.DropTable(
                name: "request",
                schema: "leave");

            migrationBuilder.DropTable(
                name: "setting",
                schema: "leave");
        }
    }
}
