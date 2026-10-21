using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Settlements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "settlement",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    settlement_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    party = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    person_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    person_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    department_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    department_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    job_title_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    job_title_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    reason = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    term = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    contract_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    leave_request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    leave_request_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    leave_from = table.Column<DateOnly>(type: "date", nullable: true),
                    leave_to = table.Column<DateOnly>(type: "date", nullable: true),
                    hire_date = table.Column<DateOnly>(type: "date", nullable: false),
                    last_day = table.Column<DateOnly>(type: "date", nullable: false),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    wage = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    unpaid_from = table.Column<DateOnly>(type: "date", nullable: true),
                    unpaid_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    excluded_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_years = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    leave_days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    award_full = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    award_factor = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    deduct_full_advance = table.Column<bool>(type: "bit", nullable: false),
                    other_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    custody = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    other_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    total_additions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total_deductions = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    net = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    calculated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    paid_on = table.Column<DateOnly>(type: "date", nullable: true),
                    payment_method = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    payment_reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    paid_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_settlement", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settlement_line",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    settlement_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_no = table.Column<int>(type: "int", nullable: false),
                    side = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    days = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    rate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    source_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    source_kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    reference = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    source_period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_settlement_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_settlement_line_settlement_settlement_id",
                        column: x => x.settlement_id,
                        principalSchema: "payroll",
                        principalTable: "settlement",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_settlement_tenant_id",
                schema: "payroll",
                table: "settlement",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_tenant_id_leave_request_id",
                schema: "payroll",
                table: "settlement",
                columns: new[] { "tenant_id", "leave_request_id" });

            migrationBuilder.CreateIndex(
                name: "ix_settlement_tenant_id_person_id_kind",
                schema: "payroll",
                table: "settlement",
                columns: new[] { "tenant_id", "person_id", "kind" });

            migrationBuilder.CreateIndex(
                name: "ix_settlement_tenant_id_settlement_no",
                schema: "payroll",
                table: "settlement",
                columns: new[] { "tenant_id", "settlement_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_settlement_line_settlement_id",
                schema: "payroll",
                table: "settlement_line",
                column: "settlement_id");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_line_tenant_id",
                schema: "payroll",
                table: "settlement_line",
                column: "tenant_id");

            migrationBuilder.AddTenantSecurityPolicy("payroll", "settlement");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "settlement_line");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("payroll", "settlement_line");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "settlement");

            migrationBuilder.DropTable(
                name: "settlement_line",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "settlement",
                schema: "payroll");
        }
    }
}
