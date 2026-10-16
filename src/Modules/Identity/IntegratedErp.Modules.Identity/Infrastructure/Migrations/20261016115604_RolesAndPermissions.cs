using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RolesAndPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "role",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_role", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "role_assignment",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    membership_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_role_assignment", x => x.id);
                    table.ForeignKey(
                        name: "fk_role_assignment_membership_membership_id",
                        column: x => x.membership_id,
                        principalSchema: "identity",
                        principalTable: "membership",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_role_assignment_roles_role_id",
                        column: x => x.role_id,
                        principalSchema: "identity",
                        principalTable: "role",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "role_permission",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    permission_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_role_permission", x => x.id);
                    table.ForeignKey(
                        name: "fk_role_permission_role_role_id",
                        column: x => x.role_id,
                        principalSchema: "identity",
                        principalTable: "role",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_role_tenant_id",
                schema: "identity",
                table: "role",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_role_tenant_id_code",
                schema: "identity",
                table: "role",
                columns: new[] { "tenant_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_role_assignment_membership_id_role_id_legal_entity_id",
                schema: "identity",
                table: "role_assignment",
                columns: new[] { "membership_id", "role_id", "legal_entity_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_role_assignment_role_id",
                schema: "identity",
                table: "role_assignment",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_role_assignment_tenant_id",
                schema: "identity",
                table: "role_assignment",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_role_permission_role_id_permission_code",
                schema: "identity",
                table: "role_permission",
                columns: new[] { "role_id", "permission_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_role_permission_tenant_id",
                schema: "identity",
                table: "role_permission",
                column: "tenant_id");

            // Second line of tenant isolation (after the EF filter): SQL Server row-level security.
            migrationBuilder.AddTenantSecurityPolicy("identity", "role");
            migrationBuilder.AddTenantSecurityPolicy("identity", "role_permission");
            migrationBuilder.AddTenantSecurityPolicy("identity", "role_assignment");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("identity", "role_assignment");
            migrationBuilder.DropTenantSecurityPolicy("identity", "role_permission");
            migrationBuilder.DropTenantSecurityPolicy("identity", "role");

            migrationBuilder.DropTable(
                name: "role_assignment",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "role_permission",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "role",
                schema: "identity");
        }
    }
}
