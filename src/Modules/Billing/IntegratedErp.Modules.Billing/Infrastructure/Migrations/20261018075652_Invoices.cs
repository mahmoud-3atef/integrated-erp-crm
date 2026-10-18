using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Billing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Invoices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "invoice",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    invoice_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    timesheet_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    timesheet_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    original_invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    original_invoice_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    contract_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    customer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    customer_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    customer_name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    customer_vat_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    customer_registration = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    customer_city = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    month = table.Column<DateOnly>(type: "date", nullable: false),
                    period_from = table.Column<DateOnly>(type: "date", nullable: false),
                    period_to = table.Column<DateOnly>(type: "date", nullable: false),
                    invoice_date = table.Column<DateOnly>(type: "date", nullable: false),
                    payment_term_days = table.Column<int>(type: "int", nullable: true),
                    due_date = table.Column<DateOnly>(type: "date", nullable: false),
                    vat_rate = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    vat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    issued_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    issued_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    seller_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    seller_name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    seller_vat_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    seller_registration = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "invoice_item",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_no = table.Column<int>(type: "int", nullable: false),
                    component = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_item_invoice_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "billing",
                        principalTable: "invoice",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoice_worker",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    timesheet_line_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    period_key = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    iqama_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    line_from = table.Column<DateOnly>(type: "date", nullable: false),
                    line_to = table.Column<DateOnly>(type: "date", nullable: false),
                    work_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    monthly_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    absence_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    absence_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_fees = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    due_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime_hours = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    client_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    customer_loans = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    other_costs = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    gosi = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    vat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_worker", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_worker_invoice_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "billing",
                        principalTable: "invoice",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_tenant_id",
                schema: "billing",
                table: "invoice",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_tenant_id_invoice_no",
                schema: "billing",
                table: "invoice",
                columns: new[] { "tenant_id", "invoice_no" },
                unique: true,
                filter: "[invoice_no] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_tenant_id_month",
                schema: "billing",
                table: "invoice",
                columns: new[] { "tenant_id", "month" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_tenant_id_original_invoice_id",
                schema: "billing",
                table: "invoice",
                columns: new[] { "tenant_id", "original_invoice_id" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_tenant_id_timesheet_id",
                schema: "billing",
                table: "invoice",
                columns: new[] { "tenant_id", "timesheet_id" },
                unique: true,
                filter: "[timesheet_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_item_invoice_id",
                schema: "billing",
                table: "invoice_item",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_item_tenant_id",
                schema: "billing",
                table: "invoice_item",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_worker_invoice_id",
                schema: "billing",
                table: "invoice_worker",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_worker_tenant_id",
                schema: "billing",
                table: "invoice_worker",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_worker_tenant_id_worker_id",
                schema: "billing",
                table: "invoice_worker",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.AddTenantSecurityPolicy("billing", "invoice");
            migrationBuilder.AddTenantSecurityPolicy("billing", "invoice_item");
            migrationBuilder.AddTenantSecurityPolicy("billing", "invoice_worker");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("billing", "invoice_worker");
            migrationBuilder.DropTenantSecurityPolicy("billing", "invoice_item");
            migrationBuilder.DropTenantSecurityPolicy("billing", "invoice");

            migrationBuilder.DropTable(
                name: "invoice_item",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "invoice_worker",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "invoice",
                schema: "billing");
        }
    }
}
