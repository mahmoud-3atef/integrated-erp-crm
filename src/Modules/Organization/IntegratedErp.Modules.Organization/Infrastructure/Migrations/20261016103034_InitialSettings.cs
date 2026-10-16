using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Organization.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "organization");

            migrationBuilder.CreateTable(
                name: "setting",
                schema: "organization",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    scope_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    scope_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    value = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_setting", x => x.id);
                    table.CheckConstraint("ck_setting_effective_range", "effective_to IS NULL OR effective_to > effective_from");
                    table.CheckConstraint("ck_setting_scope_shape", "(scope_type = 'System' AND tenant_id IS NULL AND scope_id IS NULL) OR (scope_type = 'Tenant' AND tenant_id IS NOT NULL AND scope_id IS NULL) OR (scope_type IN ('LegalEntity','Customer','Contract','Project') AND tenant_id IS NOT NULL AND scope_id IS NOT NULL)");
                });

            migrationBuilder.CreateIndex(
                name: "ix_setting_key_scope_type_tenant_id_scope_id_effective_from",
                schema: "organization",
                table: "setting",
                columns: new[] { "key", "scope_type", "tenant_id", "scope_id", "effective_from" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "setting",
                schema: "organization");
        }
    }
}
