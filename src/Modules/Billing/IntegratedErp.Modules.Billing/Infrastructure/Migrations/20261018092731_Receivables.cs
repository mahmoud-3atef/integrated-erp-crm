using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Billing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Receivables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bank_account",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    bank_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    account_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    iban = table.Column<string>(type: "nvarchar(34)", maxLength: 34, nullable: true),
                    label = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_bank_account", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "opening_balance",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoice_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    invoice_date = table.Column<DateOnly>(type: "date", nullable: false),
                    due_date = table.Column<DateOnly>(type: "date", nullable: false),
                    total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_opening_balance", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "receipt",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    receipt_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    customer_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    receipt_date = table.Column<DateOnly>(type: "date", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    method = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    bank_account_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    bank_account_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    approved_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_receipt", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "receipt_allocation",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    receipt_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    target_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_receipt_allocation", x => x.id);
                    table.ForeignKey(
                        name: "fk_receipt_allocation_receipts_receipt_id",
                        column: x => x.receipt_id,
                        principalSchema: "billing",
                        principalTable: "receipt",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_bank_account_tenant_id",
                schema: "billing",
                table: "bank_account",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_opening_balance_tenant_id",
                schema: "billing",
                table: "opening_balance",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_opening_balance_tenant_id_crm_id",
                schema: "billing",
                table: "opening_balance",
                columns: new[] { "tenant_id", "crm_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_opening_balance_tenant_id_project_crm_id",
                schema: "billing",
                table: "opening_balance",
                columns: new[] { "tenant_id", "project_crm_id" });

            migrationBuilder.CreateIndex(
                name: "ix_receipt_tenant_id",
                schema: "billing",
                table: "receipt",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_receipt_tenant_id_project_crm_id",
                schema: "billing",
                table: "receipt",
                columns: new[] { "tenant_id", "project_crm_id" });

            migrationBuilder.CreateIndex(
                name: "ix_receipt_tenant_id_receipt_date",
                schema: "billing",
                table: "receipt",
                columns: new[] { "tenant_id", "receipt_date" });

            migrationBuilder.CreateIndex(
                name: "ix_receipt_tenant_id_receipt_no",
                schema: "billing",
                table: "receipt",
                columns: new[] { "tenant_id", "receipt_no" },
                unique: true,
                filter: "[receipt_no] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_receipt_allocation_receipt_id",
                schema: "billing",
                table: "receipt_allocation",
                column: "receipt_id");

            migrationBuilder.CreateIndex(
                name: "ix_receipt_allocation_tenant_id",
                schema: "billing",
                table: "receipt_allocation",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_receipt_allocation_tenant_id_kind_target_id",
                schema: "billing",
                table: "receipt_allocation",
                columns: new[] { "tenant_id", "kind", "target_id" });

            migrationBuilder.AddTenantSecurityPolicy("billing", "bank_account");
            migrationBuilder.AddTenantSecurityPolicy("billing", "opening_balance");
            migrationBuilder.AddTenantSecurityPolicy("billing", "receipt");
            migrationBuilder.AddTenantSecurityPolicy("billing", "receipt_allocation");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("billing", "receipt_allocation");
            migrationBuilder.DropTenantSecurityPolicy("billing", "receipt");
            migrationBuilder.DropTenantSecurityPolicy("billing", "opening_balance");
            migrationBuilder.DropTenantSecurityPolicy("billing", "bank_account");

            migrationBuilder.DropTable(
                name: "bank_account",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "opening_balance",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "receipt_allocation",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "receipt",
                schema: "billing");
        }
    }
}
