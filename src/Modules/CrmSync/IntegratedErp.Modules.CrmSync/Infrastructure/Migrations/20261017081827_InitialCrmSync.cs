using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.CrmSync.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCrmSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "crm_sync");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "crm_sync",
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
                schema: "crm_sync",
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
                schema: "crm_sync",
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
                name: "reference_mapping",
                schema: "crm_sync",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    entity = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    crm_name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    crm_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    list_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    item_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    rule = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    usage = table.Column<int>(type: "int", nullable: false),
                    mapped_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reference_mapping", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staged_record",
                schema: "crm_sync",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    entity = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    modified_on = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    state_code = table.Column<int>(type: "int", nullable: true),
                    payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    payload_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    last_seen_run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    first_synced_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    last_synced_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staged_record", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sync_run",
                schema: "crm_sync",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    mode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    requested_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    requested_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    finished_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    results = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sync_run", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sync_state",
                schema: "crm_sync",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    entity = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    watermark_modified_on = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    watermark_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    last_succeeded_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_failed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sync_state", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "crm_sync",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "crm_sync",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "crm_sync",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_reference_mapping_tenant_id",
                schema: "crm_sync",
                table: "reference_mapping",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_reference_mapping_tenant_id_entity_crm_id",
                schema: "crm_sync",
                table: "reference_mapping",
                columns: new[] { "tenant_id", "entity", "crm_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_reference_mapping_tenant_id_list_code_item_code",
                schema: "crm_sync",
                table: "reference_mapping",
                columns: new[] { "tenant_id", "list_code", "item_code" });

            migrationBuilder.CreateIndex(
                name: "ix_staged_record_tenant_id",
                schema: "crm_sync",
                table: "staged_record",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_staged_record_tenant_id_entity_crm_id",
                schema: "crm_sync",
                table: "staged_record",
                columns: new[] { "tenant_id", "entity", "crm_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staged_record_tenant_id_entity_last_seen_run_id",
                schema: "crm_sync",
                table: "staged_record",
                columns: new[] { "tenant_id", "entity", "last_seen_run_id" });

            migrationBuilder.CreateIndex(
                name: "ix_sync_run_tenant_id",
                schema: "crm_sync",
                table: "sync_run",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_sync_run_tenant_id_requested_at",
                schema: "crm_sync",
                table: "sync_run",
                columns: new[] { "tenant_id", "requested_at" });

            migrationBuilder.CreateIndex(
                name: "ix_sync_state_tenant_id",
                schema: "crm_sync",
                table: "sync_state",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_sync_state_tenant_id_entity",
                schema: "crm_sync",
                table: "sync_state",
                columns: new[] { "tenant_id", "entity" },
                unique: true);

            // Second line of tenant isolation (after the EF filter): SQL Server row-level security.
            migrationBuilder.AddTenantSecurityPolicy("crm_sync", "staged_record");
            migrationBuilder.AddTenantSecurityPolicy("crm_sync", "sync_state");
            migrationBuilder.AddTenantSecurityPolicy("crm_sync", "sync_run");
            migrationBuilder.AddTenantSecurityPolicy("crm_sync", "reference_mapping");
            migrationBuilder.AddTenantSecurityPolicy("crm_sync", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("crm_sync", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("crm_sync", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("crm_sync", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("crm_sync", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("crm_sync", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("crm_sync", "reference_mapping");
            migrationBuilder.DropTenantSecurityPolicy("crm_sync", "sync_run");
            migrationBuilder.DropTenantSecurityPolicy("crm_sync", "sync_state");
            migrationBuilder.DropTenantSecurityPolicy("crm_sync", "staged_record");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "crm_sync");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "crm_sync");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "crm_sync");

            migrationBuilder.DropTable(
                name: "reference_mapping",
                schema: "crm_sync");

            migrationBuilder.DropTable(
                name: "staged_record",
                schema: "crm_sync");

            migrationBuilder.DropTable(
                name: "sync_run",
                schema: "crm_sync");

            migrationBuilder.DropTable(
                name: "sync_state",
                schema: "crm_sync");
        }
    }
}
