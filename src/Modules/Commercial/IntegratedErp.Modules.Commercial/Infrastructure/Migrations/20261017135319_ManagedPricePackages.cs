using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Commercial.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ManagedPricePackages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The derived packages of the first version become suggestions (rebuilt after every sync), and
            // price_package becomes the packages the users create: the old table is dropped, not altered.
            migrationBuilder.DropTenantSecurityPolicy("commercial", "price_package");

            migrationBuilder.DropForeignKey(
                name: "fk_worker_price_price_package_package_id",
                schema: "commercial",
                table: "worker_price");

            migrationBuilder.DropIndex(
                name: "ix_worker_price_package_id",
                schema: "commercial",
                table: "worker_price");

            migrationBuilder.DropColumn(
                name: "kind",
                schema: "commercial",
                table: "worker_price");

            migrationBuilder.DropColumn(
                name: "package_id",
                schema: "commercial",
                table: "worker_price");

            migrationBuilder.DropTable(
                name: "price_package",
                schema: "commercial");

            migrationBuilder.CreateTable(
                name: "price_package",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    package_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_fee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing_billable = table.Column<bool>(type: "bit", nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport_billable = table.Column<bool>(type: "bit", nullable: false),
                    total_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    valid_from = table.Column<DateOnly>(type: "date", nullable: false),
                    valid_to = table.Column<DateOnly>(type: "date", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_price_package", x => x.id);
                    table.ForeignKey(
                        name: "fk_price_package_projects_project_id",
                        column: x => x.project_id,
                        principalSchema: "commercial",
                        principalTable: "project",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "price_suggestion",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    total_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    fee_above_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    workers = table.Column<int>(type: "int", nullable: false),
                    other_prices = table.Column<int>(type: "int", nullable: false),
                    without_price = table.Column<int>(type: "int", nullable: false),
                    since = table.Column<DateOnly>(type: "date", nullable: true),
                    derived_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_price_suggestion", x => x.id);
                    table.ForeignKey(
                        name: "fk_price_suggestion_projects_project_id",
                        column: x => x.project_id,
                        principalSchema: "commercial",
                        principalTable: "project",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

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
                name: "ix_price_package_tenant_id_package_no",
                schema: "commercial",
                table: "price_package",
                columns: new[] { "tenant_id", "package_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_price_package_tenant_id_profession_code_project_id",
                schema: "commercial",
                table: "price_package",
                columns: new[] { "tenant_id", "profession_code", "project_id" });

            migrationBuilder.CreateIndex(
                name: "ix_price_suggestion_project_id",
                schema: "commercial",
                table: "price_suggestion",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_suggestion_tenant_id",
                schema: "commercial",
                table: "price_suggestion",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_suggestion_tenant_id_project_id_profession_code_nationality_code",
                schema: "commercial",
                table: "price_suggestion",
                columns: new[] { "tenant_id", "project_id", "profession_code", "nationality_code" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("commercial", "price_package");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "price_suggestion");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Back to the first version: its derived packages are rebuilt by the next sync.
            migrationBuilder.DropTenantSecurityPolicy("commercial", "price_suggestion");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "price_package");

            migrationBuilder.DropTable(
                name: "price_suggestion",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "price_package",
                schema: "commercial");

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

            migrationBuilder.AddColumn<string>(
                name: "kind",
                schema: "commercial",
                table: "worker_price",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "package_id",
                schema: "commercial",
                table: "worker_price",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_worker_price_package_id",
                schema: "commercial",
                table: "worker_price",
                column: "package_id");

            migrationBuilder.AddForeignKey(
                name: "fk_worker_price_price_package_package_id",
                schema: "commercial",
                table: "worker_price",
                column: "package_id",
                principalSchema: "commercial",
                principalTable: "price_package",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddTenantSecurityPolicy("commercial", "price_package");
        }
    }
}
