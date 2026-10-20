using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Payslips : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payslip_print",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    count = table.Column<int>(type: "int", nullable: false),
                    person_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    draft = table.Column<bool>(type: "bit", nullable: false),
                    printed_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    printed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payslip_print", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_payslip_print_tenant_id",
                schema: "payroll",
                table: "payslip_print",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_payslip_print_tenant_id_run_id",
                schema: "payroll",
                table: "payslip_print",
                columns: new[] { "tenant_id", "run_id" });

            migrationBuilder.AddTenantSecurityPolicy("payroll", "payslip_print");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("payroll", "payslip_print");

            migrationBuilder.DropTable(
                name: "payslip_print",
                schema: "payroll");
        }
    }
}
