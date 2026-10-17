using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkerHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "history_import",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    work_starts_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    housing_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    vacations_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    workers_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    built_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_history_import", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "history_issue",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    on = table.Column<DateOnly>(type: "date", nullable: true),
                    details = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    source_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_history_issue", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "history_period",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: false),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    place = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    source_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    source_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    source_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    rate_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    rate_housing_billable = table.Column<bool>(type: "bit", nullable: false),
                    rate_is_special_price = table.Column<bool>(type: "bit", nullable: false),
                    rate_package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    rate_package_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    rate_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    rate_service_fee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    rate_total_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    rate_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    rate_transport_billable = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_history_period", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_history_import_tenant_id",
                schema: "workforce",
                table: "history_import",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_history_issue_tenant_id",
                schema: "workforce",
                table: "history_issue",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_history_issue_tenant_id_code",
                schema: "workforce",
                table: "history_issue",
                columns: new[] { "tenant_id", "code" });

            migrationBuilder.CreateIndex(
                name: "ix_history_issue_tenant_id_worker_id",
                schema: "workforce",
                table: "history_issue",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_history_period_tenant_id",
                schema: "workforce",
                table: "history_period",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_history_period_tenant_id_worker_id_starts_on",
                schema: "workforce",
                table: "history_period",
                columns: new[] { "tenant_id", "worker_id", "starts_on" });

            migrationBuilder.AddTenantSecurityPolicy("workforce", "history_period");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "history_issue");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "history_import");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workforce", "history_import");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "history_issue");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "history_period");

            migrationBuilder.DropTable(
                name: "history_import",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "history_issue",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "history_period",
                schema: "workforce");
        }
    }
}
