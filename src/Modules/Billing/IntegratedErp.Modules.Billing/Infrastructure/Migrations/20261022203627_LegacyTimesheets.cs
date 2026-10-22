using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Billing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LegacyTimesheets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "legacy_invoice_crm_id",
                schema: "billing",
                table: "timesheet",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "legacy_invoice_no",
                schema: "billing",
                table: "timesheet",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "legacy_status",
                schema: "billing",
                table: "timesheet",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_timesheet_tenant_id_legacy_invoice_crm_id",
                schema: "billing",
                table: "timesheet",
                columns: new[] { "tenant_id", "legacy_invoice_crm_id" },
                unique: true,
                filter: "[legacy_invoice_crm_id] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_timesheet_tenant_id_legacy_invoice_crm_id",
                schema: "billing",
                table: "timesheet");

            migrationBuilder.DropColumn(
                name: "legacy_invoice_crm_id",
                schema: "billing",
                table: "timesheet");

            migrationBuilder.DropColumn(
                name: "legacy_invoice_no",
                schema: "billing",
                table: "timesheet");

            migrationBuilder.DropColumn(
                name: "legacy_status",
                schema: "billing",
                table: "timesheet");
        }
    }
}
