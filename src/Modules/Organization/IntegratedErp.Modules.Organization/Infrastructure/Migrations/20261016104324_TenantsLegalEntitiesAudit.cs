using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Organization.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TenantsLegalEntitiesAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "organization",
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
                name: "tenant",
                schema: "organization",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "legal_entity",
                schema: "organization",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    commercial_registration_no = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    vat_number = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_legal_entity", x => x.id);
                    table.ForeignKey(
                        name: "fk_legal_entity_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "organization",
                        principalTable: "tenant",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "organization",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "organization",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_legal_entity_tenant_id",
                schema: "organization",
                table: "legal_entity",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_legal_entity_tenant_id_code",
                schema: "organization",
                table: "legal_entity",
                columns: new[] { "tenant_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tenant_code",
                schema: "organization",
                table: "tenant",
                column: "code",
                unique: true);
        
            // Row-level security: other tenants' rows are invisible and cannot be written.
            migrationBuilder.AddTenantSecurityPolicy("organization", "legal_entity");
            migrationBuilder.AddTenantSecurityPolicy("organization", "audit_log");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("organization", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("organization", "legal_entity");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "organization");

            migrationBuilder.DropTable(
                name: "legal_entity",
                schema: "organization");

            migrationBuilder.DropTable(
                name: "tenant",
                schema: "organization");
        }
    }
}
