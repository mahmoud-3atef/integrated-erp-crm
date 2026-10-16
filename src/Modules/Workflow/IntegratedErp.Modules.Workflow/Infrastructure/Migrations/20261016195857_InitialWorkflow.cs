using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "workflow");

            migrationBuilder.CreateTable(
                name: "approval_route",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    document_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    current_version = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_route", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "workflow",
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
                name: "internal_request",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    number = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    subject = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    details = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    last_comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_internal_request", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "workflow",
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
                schema: "workflow",
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
                name: "approval_route_version",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    route_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    published_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_route_version", x => x.id);
                    table.ForeignKey(
                        name: "fk_approval_route_version_approval_route_route_id",
                        column: x => x.route_id,
                        principalSchema: "workflow",
                        principalTable: "approval_route",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "approval_instance",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    document_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    document_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    route_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    stage_count = table.Column<int>(type: "int", nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    dynamic_approvers = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    submitted_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    submitted_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    current_stage = table.Column<int>(type: "int", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_instance", x => x.id);
                    table.ForeignKey(
                        name: "fk_approval_instance_route_versions_route_version_id",
                        column: x => x.route_version_id,
                        principalSchema: "workflow",
                        principalTable: "approval_route_version",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "approval_stage",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order = table.Column<int>(type: "int", nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    role_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    dynamic_key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_stage", x => x.id);
                    table.ForeignKey(
                        name: "fk_approval_stage_approval_route_version_version_id",
                        column: x => x.version_id,
                        principalSchema: "workflow",
                        principalTable: "approval_route_version",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "approval_task",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    instance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    stage_order = table.Column<int>(type: "int", nullable: false),
                    stage_name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    stage_name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    assignee_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assignee_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    is_escalated = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_task", x => x.id);
                    table.ForeignKey(
                        name: "fk_approval_task_approval_instance_instance_id",
                        column: x => x.instance_id,
                        principalSchema: "workflow",
                        principalTable: "approval_instance",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_approval_instance_route_version_id",
                schema: "workflow",
                table: "approval_instance",
                column: "route_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_instance_tenant_id",
                schema: "workflow",
                table: "approval_instance",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_instance_tenant_id_document_type_document_id",
                schema: "workflow",
                table: "approval_instance",
                columns: new[] { "tenant_id", "document_type", "document_id" });

            migrationBuilder.CreateIndex(
                name: "ix_approval_route_tenant_id",
                schema: "workflow",
                table: "approval_route",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_route_tenant_id_document_type",
                schema: "workflow",
                table: "approval_route",
                columns: new[] { "tenant_id", "document_type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_approval_route_version_route_id_version",
                schema: "workflow",
                table: "approval_route_version",
                columns: new[] { "route_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_approval_route_version_tenant_id",
                schema: "workflow",
                table: "approval_route_version",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_stage_tenant_id",
                schema: "workflow",
                table: "approval_stage",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_stage_version_id_order",
                schema: "workflow",
                table: "approval_stage",
                columns: new[] { "version_id", "order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_approval_task_instance_id",
                schema: "workflow",
                table: "approval_task",
                column: "instance_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_task_tenant_id",
                schema: "workflow",
                table: "approval_task",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_task_tenant_id_assignee_user_id_status",
                schema: "workflow",
                table: "approval_task",
                columns: new[] { "tenant_id", "assignee_user_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "workflow",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "workflow",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_internal_request_tenant_id",
                schema: "workflow",
                table: "internal_request",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_internal_request_tenant_id_created_by",
                schema: "workflow",
                table: "internal_request",
                columns: new[] { "tenant_id", "created_by" });

            migrationBuilder.CreateIndex(
                name: "ix_internal_request_tenant_id_number",
                schema: "workflow",
                table: "internal_request",
                columns: new[] { "tenant_id", "number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "workflow",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            // Second line of tenant isolation (after the EF filter): SQL Server row-level security.
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_route");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "internal_request");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "outbox_message");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_route_version");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_instance");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_stage");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_task");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_task");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_stage");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_instance");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_route_version");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "internal_request");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_route");

            migrationBuilder.DropTable(
                name: "approval_stage",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_task",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "internal_request",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_instance",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_route_version",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_route",
                schema: "workflow");
        }
    }
}
