using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Organization.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BranchesAndReferenceLists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "branch",
                schema: "organization",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    city = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_branch", x => x.id);
                    table.ForeignKey(
                        name: "fk_branch_legal_entities_legal_entity_id",
                        column: x => x.legal_entity_id,
                        principalSchema: "organization",
                        principalTable: "legal_entity",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "reference_item",
                schema: "organization",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    list_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_system = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reference_item", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_branch_legal_entity_id",
                schema: "organization",
                table: "branch",
                column: "legal_entity_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_tenant_id",
                schema: "organization",
                table: "branch",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_tenant_id_code",
                schema: "organization",
                table: "branch",
                columns: new[] { "tenant_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_reference_item_tenant_id",
                schema: "organization",
                table: "reference_item",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_reference_item_tenant_id_list_code_code",
                schema: "organization",
                table: "reference_item",
                columns: new[] { "tenant_id", "list_code", "code" },
                unique: true);

            // Second line of tenant isolation (after the EF filter): SQL Server row-level security.
            migrationBuilder.AddTenantSecurityPolicy("organization", "branch");
            migrationBuilder.AddTenantSecurityPolicy("organization", "reference_item");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("organization", "reference_item");
            migrationBuilder.DropTenantSecurityPolicy("organization", "branch");

            migrationBuilder.DropTable(
                name: "branch",
                schema: "organization");

            migrationBuilder.DropTable(
                name: "reference_item",
                schema: "organization");
        }
    }
}
