using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkerCosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "supplier_cost_package",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    supplier = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    monthly_cost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    method = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    updated_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_supplier_cost_package", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "worker_cost_card",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    supplier = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    monthly_cost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    method = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    created_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_worker_cost_card", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_supplier_cost_package_tenant_id",
                schema: "workforce",
                table: "supplier_cost_package",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_supplier_cost_package_tenant_id_supplier_effective_from",
                schema: "workforce",
                table: "supplier_cost_package",
                columns: new[] { "tenant_id", "supplier", "effective_from" });

            migrationBuilder.CreateIndex(
                name: "ix_worker_cost_card_tenant_id",
                schema: "workforce",
                table: "worker_cost_card",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_cost_card_tenant_id_worker_id_effective_from",
                schema: "workforce",
                table: "worker_cost_card",
                columns: new[] { "tenant_id", "worker_id", "effective_from" });

            migrationBuilder.AddTenantSecurityPolicy("workforce", "supplier_cost_package");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "worker_cost_card");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workforce", "worker_cost_card");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "supplier_cost_package");

            migrationBuilder.DropTable(
                name: "supplier_cost_package",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "worker_cost_card",
                schema: "workforce");
        }
    }
}
