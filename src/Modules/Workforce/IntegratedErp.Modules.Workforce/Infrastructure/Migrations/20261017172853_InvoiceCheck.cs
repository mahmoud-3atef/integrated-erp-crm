using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceCheck : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "invoice_check",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    month = table.Column<DateOnly>(type: "date", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    worker_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    invoice_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: false),
                    month_days = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: false),
                    working_days = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    absent_days = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    invoiced_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ledger_days = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    ledger_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ledger_sources = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    result = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    details = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_check", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "invoice_check_import",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoices_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    lines_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ledger_signature = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    built_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_check_import", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_check_tenant_id",
                schema: "workforce",
                table: "invoice_check",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_check_tenant_id_month_result",
                schema: "workforce",
                table: "invoice_check",
                columns: new[] { "tenant_id", "month", "result" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_check_tenant_id_worker_id",
                schema: "workforce",
                table: "invoice_check",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_check_import_tenant_id",
                schema: "workforce",
                table: "invoice_check_import",
                column: "tenant_id",
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("workforce", "invoice_check");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "invoice_check_import");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workforce", "invoice_check_import");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "invoice_check");

            migrationBuilder.DropTable(
                name: "invoice_check",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "invoice_check_import",
                schema: "workforce");
        }
    }
}
