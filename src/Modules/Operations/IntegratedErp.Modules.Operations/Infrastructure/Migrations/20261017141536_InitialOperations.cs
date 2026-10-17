using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Operations.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "operations");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "operations",
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
                name: "crm_import",
                schema: "operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    orders_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    work_starts_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crm_import", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "delivery_order",
                schema: "operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    source = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    crm_status = table.Column<int>(type: "int", nullable: true),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    customer_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    project_manager = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    contract_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    deliver_on = table.Column<DateOnly>(type: "date", nullable: true),
                    start_on = table.Column<DateOnly>(type: "date", nullable: true),
                    receiver_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    receiver_title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    delay_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    delivered_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    delivered_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_delivery_order", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "operations",
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
                schema: "operations",
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
                name: "delivery_line",
                schema: "operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_no = table.Column<int>(type: "int", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    worker_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    iqama_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    package_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_fee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing_billable = table.Column<bool>(type: "bit", nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport_billable = table.Column<bool>(type: "bit", nullable: false),
                    total_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    is_special_price = table.Column<bool>(type: "bit", nullable: false),
                    special_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    start_on = table.Column<DateOnly>(type: "date", nullable: true),
                    started_on = table.Column<DateOnly>(type: "date", nullable: true),
                    work_start_no = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_delivery_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_delivery_line_delivery_order_order_id",
                        column: x => x.order_id,
                        principalSchema: "operations",
                        principalTable: "delivery_order",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "operations",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "operations",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_crm_import_tenant_id",
                schema: "operations",
                table: "crm_import",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_delivery_line_order_id",
                schema: "operations",
                table: "delivery_line",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_line_tenant_id",
                schema: "operations",
                table: "delivery_line",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_line_tenant_id_worker_id",
                schema: "operations",
                table: "delivery_line",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_delivery_order_tenant_id",
                schema: "operations",
                table: "delivery_order",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_order_tenant_id_crm_id",
                schema: "operations",
                table: "delivery_order",
                columns: new[] { "tenant_id", "crm_id" },
                unique: true,
                filter: "[crm_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_order_tenant_id_order_no",
                schema: "operations",
                table: "delivery_order",
                columns: new[] { "tenant_id", "order_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_delivery_order_tenant_id_status",
                schema: "operations",
                table: "delivery_order",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "operations",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.AddTenantSecurityPolicy("operations", "delivery_order");
            migrationBuilder.AddTenantSecurityPolicy("operations", "delivery_line");
            migrationBuilder.AddTenantSecurityPolicy("operations", "crm_import");
            migrationBuilder.AddTenantSecurityPolicy("operations", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("operations", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("operations", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("operations", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("operations", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("operations", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("operations", "crm_import");
            migrationBuilder.DropTenantSecurityPolicy("operations", "delivery_line");
            migrationBuilder.DropTenantSecurityPolicy("operations", "delivery_order");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "crm_import",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "delivery_line",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "delivery_order",
                schema: "operations");
        }
    }
}
