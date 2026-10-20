using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PayslipEmails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payslip_email",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    outgoing_email_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    queued_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    queued_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payslip_email", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_payslip_email_tenant_id",
                schema: "payroll",
                table: "payslip_email",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_payslip_email_tenant_id_run_id_employee_id",
                schema: "payroll",
                table: "payslip_email",
                columns: new[] { "tenant_id", "run_id", "employee_id" });

            migrationBuilder.AddTenantSecurityPolicy("payroll", "payslip_email");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("payroll", "payslip_email");

            migrationBuilder.DropTable(
                name: "payslip_email",
                schema: "payroll");
        }
    }
}
