using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DecisionIdempotencyKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "decision_key",
                schema: "workflow",
                table: "approval_work_item",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "decision_key",
                schema: "workflow",
                table: "approval_work_item");
        }
    }
}
