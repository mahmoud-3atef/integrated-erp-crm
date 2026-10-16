using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ApprovalProcesses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The route-based model of slice 0.8 is replaced. Its rows are development test data: approvals in
            // progress are removed and their requests go back to drafts so they can be sent through a process.
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_task");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_stage");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_route_version");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_route");
            migrationBuilder.Sql("DELETE FROM [workflow].[approval_task]; DELETE FROM [workflow].[approval_instance];");
            migrationBuilder.Sql("UPDATE [workflow].[internal_request] SET [status] = 'Draft' WHERE [status] = 'InApproval';");

            migrationBuilder.DropForeignKey(
                name: "fk_approval_instance_route_versions_route_version_id",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropTable(
                name: "approval_stage",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_task",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_route_version",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_route",
                schema: "workflow");

            migrationBuilder.DropColumn(
                name: "dynamic_approvers",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.RenameColumn(
                name: "stage_count",
                schema: "workflow",
                table: "approval_instance",
                newName: "version");

            migrationBuilder.RenameColumn(
                name: "route_version_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "version_id");

            migrationBuilder.RenameColumn(
                name: "document_type",
                schema: "workflow",
                table: "approval_instance",
                newName: "screen");

            migrationBuilder.RenameColumn(
                name: "document_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "record_id");

            migrationBuilder.RenameColumn(
                name: "current_stage",
                schema: "workflow",
                table: "approval_instance",
                newName: "history_count");

            migrationBuilder.RenameIndex(
                name: "ix_approval_instance_tenant_id_document_type_document_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "ix_approval_instance_tenant_id_screen_record_id");

            migrationBuilder.RenameIndex(
                name: "ix_approval_instance_route_version_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "ix_approval_instance_version_id");

            migrationBuilder.AddColumn<string>(
                name: "approver_notes",
                schema: "workflow",
                table: "internal_request",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "category",
                schema: "workflow",
                table: "internal_request",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "direct_manager_id",
                schema: "workflow",
                table: "internal_request",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cursor",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "error",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "process_id",
                schema: "workflow",
                table: "approval_instance",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "process_name_ar",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "process_name_en",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "snapshot",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "waiting_step_ar",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "waiting_step_en",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "waiting_step_id",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "approval_history",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    instance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sequence = table.Column<int>(type: "int", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    step_id = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    step_name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    step_name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    actor_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    actor_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    on_behalf_of = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    outcome = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    details = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status_before = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    status_after = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_approval_history_instances_instance_id",
                        column: x => x.instance_id,
                        principalSchema: "workflow",
                        principalTable: "approval_instance",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "approval_process",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    screen = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    priority = table.Column<int>(type: "int", nullable: false),
                    draft = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    draft_changed = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    current_version = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_process", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "approval_work_item",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    instance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    step_id = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    step_name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    step_name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    round = table.Column<int>(type: "int", nullable: false),
                    assignee_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assignee_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    delegated_from = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    due_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_work_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_approval_work_item_approval_instance_instance_id",
                        column: x => x.instance_id,
                        principalSchema: "workflow",
                        principalTable: "approval_instance",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "approval_process_version",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    process_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    definition = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    published_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_process_version", x => x.id);
                    table.ForeignKey(
                        name: "fk_approval_process_version_approval_process_process_id",
                        column: x => x.process_id,
                        principalSchema: "workflow",
                        principalTable: "approval_process",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_approval_instance_tenant_id_screen_record_id1",
                schema: "workflow",
                table: "approval_instance",
                columns: new[] { "tenant_id", "screen", "record_id" },
                unique: true,
                filter: "[status] IN ('InProgress', 'Failed')");

            migrationBuilder.CreateIndex(
                name: "ix_approval_instance_tenant_id_submitted_by_submitted_at",
                schema: "workflow",
                table: "approval_instance",
                columns: new[] { "tenant_id", "submitted_by", "submitted_at" });

            migrationBuilder.CreateIndex(
                name: "ix_approval_history_instance_id_sequence",
                schema: "workflow",
                table: "approval_history",
                columns: new[] { "instance_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_approval_history_tenant_id",
                schema: "workflow",
                table: "approval_history",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_process_tenant_id",
                schema: "workflow",
                table: "approval_process",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_process_tenant_id_screen_priority",
                schema: "workflow",
                table: "approval_process",
                columns: new[] { "tenant_id", "screen", "priority" });

            migrationBuilder.CreateIndex(
                name: "ix_approval_process_version_process_id_version",
                schema: "workflow",
                table: "approval_process_version",
                columns: new[] { "process_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_approval_process_version_tenant_id",
                schema: "workflow",
                table: "approval_process_version",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_work_item_instance_id_step_id_round",
                schema: "workflow",
                table: "approval_work_item",
                columns: new[] { "instance_id", "step_id", "round" });

            migrationBuilder.CreateIndex(
                name: "ix_approval_work_item_tenant_id",
                schema: "workflow",
                table: "approval_work_item",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_approval_work_item_tenant_id_assignee_user_id_status",
                schema: "workflow",
                table: "approval_work_item",
                columns: new[] { "tenant_id", "assignee_user_id", "status" });

            migrationBuilder.AddForeignKey(
                name: "fk_approval_instance_process_versions_version_id",
                schema: "workflow",
                table: "approval_instance",
                column: "version_id",
                principalSchema: "workflow",
                principalTable: "approval_process_version",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // Second line of tenant isolation (after the EF filter): SQL Server row-level security.
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_history");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_process");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_work_item");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "approval_process_version");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_process_version");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_work_item");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_process");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "approval_history");

            migrationBuilder.DropForeignKey(
                name: "fk_approval_instance_process_versions_version_id",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropTable(
                name: "approval_history",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_process_version",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_work_item",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "approval_process",
                schema: "workflow");

            migrationBuilder.DropIndex(
                name: "ix_approval_instance_tenant_id_screen_record_id1",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropIndex(
                name: "ix_approval_instance_tenant_id_submitted_by_submitted_at",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "approver_notes",
                schema: "workflow",
                table: "internal_request");

            migrationBuilder.DropColumn(
                name: "category",
                schema: "workflow",
                table: "internal_request");

            migrationBuilder.DropColumn(
                name: "direct_manager_id",
                schema: "workflow",
                table: "internal_request");

            migrationBuilder.DropColumn(
                name: "cursor",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "error",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "process_id",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "process_name_ar",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "process_name_en",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "snapshot",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "waiting_step_ar",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "waiting_step_en",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.DropColumn(
                name: "waiting_step_id",
                schema: "workflow",
                table: "approval_instance");

            migrationBuilder.RenameColumn(
                name: "version_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "route_version_id");

            migrationBuilder.RenameColumn(
                name: "version",
                schema: "workflow",
                table: "approval_instance",
                newName: "stage_count");

            migrationBuilder.RenameColumn(
                name: "screen",
                schema: "workflow",
                table: "approval_instance",
                newName: "document_type");

            migrationBuilder.RenameColumn(
                name: "record_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "document_id");

            migrationBuilder.RenameColumn(
                name: "history_count",
                schema: "workflow",
                table: "approval_instance",
                newName: "current_stage");

            migrationBuilder.RenameIndex(
                name: "ix_approval_instance_version_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "ix_approval_instance_route_version_id");

            migrationBuilder.RenameIndex(
                name: "ix_approval_instance_tenant_id_screen_record_id",
                schema: "workflow",
                table: "approval_instance",
                newName: "ix_approval_instance_tenant_id_document_type_document_id");

            migrationBuilder.AddColumn<string>(
                name: "dynamic_approvers",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "approval_route",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    current_version = table.Column<int>(type: "int", nullable: false),
                    document_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_approval_route", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "approval_task",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assignee_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    assignee_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    instance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_escalated = table.Column<bool>(type: "bit", nullable: false),
                    stage_name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    stage_name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    stage_order = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "approval_route_version",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    published_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    route_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false)
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
                name: "approval_stage",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    dynamic_key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    order = table.Column<int>(type: "int", nullable: false),
                    role_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
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

            migrationBuilder.AddForeignKey(
                name: "fk_approval_instance_route_versions_route_version_id",
                schema: "workflow",
                table: "approval_instance",
                column: "route_version_id",
                principalSchema: "workflow",
                principalTable: "approval_route_version",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            foreach (var table in new[] { "approval_route", "approval_route_version", "approval_stage", "approval_task" })
            {
                migrationBuilder.AddTenantSecurityPolicy("workflow", table);
            }
        }
    }
}
