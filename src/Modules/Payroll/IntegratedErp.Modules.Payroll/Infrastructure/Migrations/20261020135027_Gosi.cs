using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Gosi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "total_gosi_employee",
                schema: "payroll",
                table: "payroll_run",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "total_gosi_employer",
                schema: "payroll",
                table: "payroll_run",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "gosi_base",
                schema: "payroll",
                table: "payroll_line",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "gosi_category",
                schema: "payroll",
                table: "payroll_line",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "gosi_employee",
                schema: "payroll",
                table: "payroll_line",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "gosi_employer",
                schema: "payroll",
                table: "payroll_line",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "gosi_invoice",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    period = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    entered_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    entered_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gosi_invoice", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "gosi_member",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    person_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    registered_wage = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    registered_on = table.Column<DateOnly>(type: "date", nullable: true),
                    excluded_on = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gosi_member", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "gosi_task",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    old_wage = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    new_wage = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    event_on = table.Column<DateOnly>(type: "date", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    done_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    done_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    done_on = table.Column<DateOnly>(type: "date", nullable: true),
                    reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gosi_task", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "saudization_setting",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    full_wage = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saudization_setting", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "saudization_target",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    required_percent = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saudization_target", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_gosi_invoice_tenant_id",
                schema: "payroll",
                table: "gosi_invoice",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_gosi_invoice_tenant_id_legal_entity_id_period",
                schema: "payroll",
                table: "gosi_invoice",
                columns: new[] { "tenant_id", "legal_entity_id", "period" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_gosi_member_tenant_id",
                schema: "payroll",
                table: "gosi_member",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_gosi_member_tenant_id_kind_person_id",
                schema: "payroll",
                table: "gosi_member",
                columns: new[] { "tenant_id", "kind", "person_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_gosi_task_tenant_id",
                schema: "payroll",
                table: "gosi_task",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_gosi_task_tenant_id_employee_id",
                schema: "payroll",
                table: "gosi_task",
                columns: new[] { "tenant_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "ix_gosi_task_tenant_id_status_kind",
                schema: "payroll",
                table: "gosi_task",
                columns: new[] { "tenant_id", "status", "kind" });

            migrationBuilder.CreateIndex(
                name: "ix_saudization_setting_tenant_id",
                schema: "payroll",
                table: "saudization_setting",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_saudization_target_tenant_id",
                schema: "payroll",
                table: "saudization_target",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_saudization_target_tenant_id_legal_entity_id",
                schema: "payroll",
                table: "saudization_target",
                columns: new[] { "tenant_id", "legal_entity_id" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("payroll", "gosi_member");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "gosi_task");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "gosi_invoice");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "saudization_setting");
            migrationBuilder.AddTenantSecurityPolicy("payroll", "saudization_target");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("payroll", "saudization_target");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "saudization_setting");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "gosi_invoice");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "gosi_task");
            migrationBuilder.DropTenantSecurityPolicy("payroll", "gosi_member");

            migrationBuilder.DropTable(
                name: "gosi_invoice",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "gosi_member",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "gosi_task",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "saudization_setting",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "saudization_target",
                schema: "payroll");

            migrationBuilder.DropColumn(
                name: "total_gosi_employee",
                schema: "payroll",
                table: "payroll_run");

            migrationBuilder.DropColumn(
                name: "total_gosi_employer",
                schema: "payroll",
                table: "payroll_run");

            migrationBuilder.DropColumn(
                name: "gosi_base",
                schema: "payroll",
                table: "payroll_line");

            migrationBuilder.DropColumn(
                name: "gosi_category",
                schema: "payroll",
                table: "payroll_line");

            migrationBuilder.DropColumn(
                name: "gosi_employee",
                schema: "payroll",
                table: "payroll_line");

            migrationBuilder.DropColumn(
                name: "gosi_employer",
                schema: "payroll",
                table: "payroll_line");
        }
    }
}
