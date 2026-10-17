using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Commercial.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PricePackages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "price_package",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    contract_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    basis = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    total_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    service_fee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    workers = table.Column<int>(type: "int", nullable: false),
                    special_workers = table.Column<int>(type: "int", nullable: false),
                    since = table.Column<DateOnly>(type: "date", nullable: true),
                    derived_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_price_package", x => x.id);
                    table.ForeignKey(
                        name: "fk_price_package_contract_contract_id",
                        column: x => x.contract_id,
                        principalSchema: "commercial",
                        principalTable: "contract",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_price_package_projects_project_id",
                        column: x => x.project_id,
                        principalSchema: "commercial",
                        principalTable: "project",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pricing_import",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    derived_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pricing_import", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "worker_price",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    work_start_no = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    started_on = table.Column<DateOnly>(type: "date", nullable: true),
                    from_worker_default = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_worker_price", x => x.id);
                    table.ForeignKey(
                        name: "fk_worker_price_price_package_package_id",
                        column: x => x.package_id,
                        principalSchema: "commercial",
                        principalTable: "price_package",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_worker_price_project_project_id",
                        column: x => x.project_id,
                        principalSchema: "commercial",
                        principalTable: "project",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_price_package_contract_id",
                schema: "commercial",
                table: "price_package",
                column: "contract_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_package_project_id",
                schema: "commercial",
                table: "price_package",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_package_tenant_id",
                schema: "commercial",
                table: "price_package",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_package_tenant_id_project_id_profession_code_nationality_code",
                schema: "commercial",
                table: "price_package",
                columns: new[] { "tenant_id", "project_id", "profession_code", "nationality_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pricing_import_tenant_id",
                schema: "commercial",
                table: "pricing_import",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_worker_price_package_id",
                schema: "commercial",
                table: "worker_price",
                column: "package_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_price_project_id",
                schema: "commercial",
                table: "worker_price",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_price_tenant_id",
                schema: "commercial",
                table: "worker_price",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_price_tenant_id_project_id",
                schema: "commercial",
                table: "worker_price",
                columns: new[] { "tenant_id", "project_id" });

            migrationBuilder.CreateIndex(
                name: "ix_worker_price_tenant_id_worker_crm_id",
                schema: "commercial",
                table: "worker_price",
                columns: new[] { "tenant_id", "worker_crm_id" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("commercial", "price_package");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "worker_price");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "pricing_import");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("commercial", "pricing_import");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "worker_price");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "price_package");

            migrationBuilder.DropTable(
                name: "pricing_import",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "worker_price",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "price_package",
                schema: "commercial");
        }
    }
}
