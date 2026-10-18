using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Alerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "alert_digest_run",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    day = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alert_digest_run", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "alert_dismissal",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    until = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alert_dismissal", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "alert_notice",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    notified_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alert_notice", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "alert_setting",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    enabled = table.Column<bool>(type: "bit", nullable: false),
                    days = table.Column<int>(type: "int", nullable: false),
                    updated_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alert_setting", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_alert_digest_run_tenant_id",
                schema: "workflow",
                table: "alert_digest_run",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_alert_digest_run_tenant_id_day",
                schema: "workflow",
                table: "alert_digest_run",
                columns: new[] { "tenant_id", "day" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_alert_dismissal_tenant_id",
                schema: "workflow",
                table: "alert_dismissal",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_alert_dismissal_tenant_id_user_id_code_key",
                schema: "workflow",
                table: "alert_dismissal",
                columns: new[] { "tenant_id", "user_id", "code", "key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_alert_notice_tenant_id",
                schema: "workflow",
                table: "alert_notice",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_alert_notice_tenant_id_code_key",
                schema: "workflow",
                table: "alert_notice",
                columns: new[] { "tenant_id", "code", "key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_alert_setting_tenant_id",
                schema: "workflow",
                table: "alert_setting",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_alert_setting_tenant_id_code",
                schema: "workflow",
                table: "alert_setting",
                columns: new[] { "tenant_id", "code" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("workflow", "alert_setting");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "alert_dismissal");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "alert_notice");
            migrationBuilder.AddTenantSecurityPolicy("workflow", "alert_digest_run");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workflow", "alert_digest_run");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "alert_notice");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "alert_dismissal");
            migrationBuilder.DropTenantSecurityPolicy("workflow", "alert_setting");

            migrationBuilder.DropTable(
                name: "alert_digest_run",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "alert_dismissal",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "alert_notice",
                schema: "workflow");

            migrationBuilder.DropTable(
                name: "alert_setting",
                schema: "workflow");
        }
    }
}
