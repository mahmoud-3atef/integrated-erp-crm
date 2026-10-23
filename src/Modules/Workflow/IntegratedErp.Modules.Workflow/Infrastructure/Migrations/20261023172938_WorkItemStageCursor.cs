using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkItemStageCursor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "stage_cursor",
                schema: "workflow",
                table: "approval_work_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "stage_status_value",
                schema: "workflow",
                table: "approval_work_item",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "stage_cursor",
                schema: "workflow",
                table: "approval_work_item");

            migrationBuilder.DropColumn(
                name: "stage_status_value",
                schema: "workflow",
                table: "approval_work_item");
        }
    }
}
