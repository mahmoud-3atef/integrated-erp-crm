using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Commercial.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProjectManagerLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "manager_login",
                schema: "commercial",
                table: "project",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_project_tenant_id_manager_login",
                schema: "commercial",
                table: "project",
                columns: new[] { "tenant_id", "manager_login" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_project_tenant_id_manager_login",
                schema: "commercial",
                table: "project");

            migrationBuilder.DropColumn(
                name: "manager_login",
                schema: "commercial",
                table: "project");
        }
    }
}
