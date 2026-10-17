using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkerPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "worker_period",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: false),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    source_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    source_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    source_line_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    source_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    closed_by_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
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
                    table.PrimaryKey("pk_worker_period", x => x.id);
                    table.ForeignKey(
                        name: "fk_worker_period_worker_worker_id",
                        column: x => x.worker_id,
                        principalSchema: "workforce",
                        principalTable: "worker",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_worker_period_tenant_id",
                schema: "workforce",
                table: "worker_period",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_period_tenant_id_source_line_id",
                schema: "workforce",
                table: "worker_period",
                columns: new[] { "tenant_id", "source_line_id" },
                unique: true,
                filter: "[source_line_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_worker_period_tenant_id_worker_id_starts_on",
                schema: "workforce",
                table: "worker_period",
                columns: new[] { "tenant_id", "worker_id", "starts_on" });

            migrationBuilder.CreateIndex(
                name: "ix_worker_period_worker_id",
                schema: "workforce",
                table: "worker_period",
                column: "worker_id");

            migrationBuilder.CreateIndex(
                name: "ux_worker_period_open",
                schema: "workforce",
                table: "worker_period",
                columns: new[] { "tenant_id", "worker_id" },
                unique: true,
                filter: "[ends_on] IS NULL");

            migrationBuilder.AddTenantSecurityPolicy("workforce", "worker_period");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workforce", "worker_period");

            migrationBuilder.DropTable(
                name: "worker_period",
                schema: "workforce");
        }
    }
}
