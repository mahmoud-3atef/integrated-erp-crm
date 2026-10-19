using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Staff.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StaffActions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "acting_allowance",
                schema: "staff",
                table: "employee",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "acting_position_id",
                schema: "staff",
                table: "employee",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "acting_until",
                schema: "staff",
                table: "employee",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ended_on",
                schema: "staff",
                table: "employee",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "action",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    action_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    new_legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    new_department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    new_position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    new_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    new_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    new_food = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    new_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    new_mobile = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    new_project = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    new_other = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    acting_allowance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    acting_until = table.Column<DateOnly>(type: "date", nullable: true),
                    new_probation_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    new_contract_kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    new_contract_months = table.Column<int>(type: "int", nullable: true),
                    new_contract_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    old_legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    old_department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    old_position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    old_salary_total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    old_probation_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    old_contract_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    applied_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_action", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "contract",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: false),
                    months = table.Column<int>(type: "int", nullable: true),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    probation_days = table.Column<int>(type: "int", nullable: false),
                    notice_days = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    renews_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    action_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contract", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_action_tenant_id",
                schema: "staff",
                table: "action",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_action_tenant_id_action_no",
                schema: "staff",
                table: "action",
                columns: new[] { "tenant_id", "action_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_action_tenant_id_employee_id",
                schema: "staff",
                table: "action",
                columns: new[] { "tenant_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "ix_contract_tenant_id",
                schema: "staff",
                table: "contract",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_contract_tenant_id_employee_id_starts_on",
                schema: "staff",
                table: "contract",
                columns: new[] { "tenant_id", "employee_id", "starts_on" });

            migrationBuilder.AddTenantSecurityPolicy("staff", "contract");
            migrationBuilder.AddTenantSecurityPolicy("staff", "action");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("staff", "action");
            migrationBuilder.DropTenantSecurityPolicy("staff", "contract");

            migrationBuilder.DropTable(
                name: "action",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "contract",
                schema: "staff");

            migrationBuilder.DropColumn(
                name: "acting_allowance",
                schema: "staff",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "acting_position_id",
                schema: "staff",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "acting_until",
                schema: "staff",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "ended_on",
                schema: "staff",
                table: "employee");
        }
    }
}
