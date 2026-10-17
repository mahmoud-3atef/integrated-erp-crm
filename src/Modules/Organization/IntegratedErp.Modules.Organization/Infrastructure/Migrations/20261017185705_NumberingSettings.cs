using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Organization.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NumberingSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "numbering_setting",
                schema: "organization",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    pattern = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    reset = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    start_at = table.Column<long>(type: "bigint", nullable: false),
                    updated_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_numbering_setting", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_numbering_setting_tenant_id",
                schema: "organization",
                table: "numbering_setting",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_numbering_setting_tenant_id_key",
                schema: "organization",
                table: "numbering_setting",
                columns: new[] { "tenant_id", "key" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("organization", "numbering_setting");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("organization", "numbering_setting");

            migrationBuilder.DropTable(
                name: "numbering_setting",
                schema: "organization");
        }
    }
}
