using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Billing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LegacyTimesheetPerInvoice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_timesheet_tenant_id_project_id_month",
                schema: "billing",
                table: "timesheet");

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_tenant_id_project_id_month",
                schema: "billing",
                table: "timesheet",
                columns: new[] { "tenant_id", "project_id", "month" },
                unique: true,
                filter: "[legacy_invoice_crm_id] IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_timesheet_tenant_id_project_id_month",
                schema: "billing",
                table: "timesheet");

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_tenant_id_project_id_month",
                schema: "billing",
                table: "timesheet",
                columns: new[] { "tenant_id", "project_id", "month" },
                unique: true);
        }
    }
}
