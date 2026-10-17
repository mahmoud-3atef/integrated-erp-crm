using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Operations.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryApprovalFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "operations",
                table: "delivery_order",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<bool>(
                name: "awaiting_approval",
                schema: "operations",
                table: "delivery_order",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // New statuses: a draft is now "under preparation"; approved orders waited for a delivery confirmation that no
            // longer exists, so they go back to the operations manager's stage name.
            migrationBuilder.Sql("UPDATE operations.delivery_order SET status = 'UnderPreparation' WHERE status = 'Draft';");
            migrationBuilder.Sql("UPDATE operations.delivery_order SET status = 'SentToOperationsManager' WHERE status = 'Approved';");
            migrationBuilder.Sql("UPDATE operations.delivery_order SET awaiting_approval = 1 WHERE source = 'System' AND status IN ('InApproval', 'SentToOperationsManager');");
            migrationBuilder.Sql("UPDATE operations.delivery_order SET status = 'UnderPreparation' WHERE source = 'Crm' AND crm_status = 279640000;");
            migrationBuilder.Sql("UPDATE operations.delivery_order SET status = 'SentToOperationsManager' WHERE source = 'Crm' AND crm_status = 279640011;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "awaiting_approval",
                schema: "operations",
                table: "delivery_order");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "operations",
                table: "delivery_order",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(30)",
                oldMaxLength: 30);
        }
    }
}
