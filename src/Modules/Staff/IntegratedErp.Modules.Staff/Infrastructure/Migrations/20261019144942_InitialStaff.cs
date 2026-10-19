using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Staff.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialStaff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "staff");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    entity_type = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    entity_id = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    action = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    changes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    user_id = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    user_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    trace_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "department",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    parent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    name_ar = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    cost_center = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    manager_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_department", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "employee",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    person_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    employee_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    id_number = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    nationality_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: true),
                    mobile = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    gosi_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    hire_date = table.Column<DateOnly>(type: "date", nullable: true),
                    probation_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    legal_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    branch_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    contract_starts_on = table.Column<DateOnly>(type: "date", nullable: true),
                    contract_months = table.Column<int>(type: "int", nullable: true),
                    contract_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    annual_leave_days = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_balance = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_consumed = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_old_consumed = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_remaining = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    legacy_status_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    legacy_status_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    sponsor = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    imported_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_employee", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "grade",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    min_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    max_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_grade", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "job_title",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    occupation_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job_title", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "staff",
                columns: table => new
                {
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sequence_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    scope_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    period = table.Column<int>(type: "int", nullable: false),
                    next_value = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_number_sequence", x => new { x.tenant_id, x.sequence_key, x.scope_key, x.period });
                    table.CheckConstraint("ck_number_sequence_next_value", "next_value >= 1");
                });

            migrationBuilder.CreateTable(
                name: "outbox_message",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    attempts = table.Column<int>(type: "int", nullable: false),
                    last_error = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outbox_message", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "position",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    job_title_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    grade_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reports_to_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    seats = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_position", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "salary",
                schema: "staff",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    food = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    mobile = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    project = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    other = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_salary", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "staff",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "staff",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_department_tenant_id",
                schema: "staff",
                table: "department",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_department_tenant_id_parent_id",
                schema: "staff",
                table: "department",
                columns: new[] { "tenant_id", "parent_id" });

            migrationBuilder.CreateIndex(
                name: "ix_employee_tenant_id",
                schema: "staff",
                table: "employee",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_employee_tenant_id_department_id",
                schema: "staff",
                table: "employee",
                columns: new[] { "tenant_id", "department_id" });

            migrationBuilder.CreateIndex(
                name: "ix_employee_tenant_id_employee_no",
                schema: "staff",
                table: "employee",
                columns: new[] { "tenant_id", "employee_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_employee_tenant_id_position_id",
                schema: "staff",
                table: "employee",
                columns: new[] { "tenant_id", "position_id" });

            migrationBuilder.CreateIndex(
                name: "ix_employee_tenant_id_worker_id",
                schema: "staff",
                table: "employee",
                columns: new[] { "tenant_id", "worker_id" },
                unique: true,
                filter: "[worker_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_grade_tenant_id",
                schema: "staff",
                table: "grade",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_grade_tenant_id_code",
                schema: "staff",
                table: "grade",
                columns: new[] { "tenant_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_job_title_tenant_id",
                schema: "staff",
                table: "job_title",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "staff",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_position_tenant_id",
                schema: "staff",
                table: "position",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_position_tenant_id_department_id",
                schema: "staff",
                table: "position",
                columns: new[] { "tenant_id", "department_id" });

            migrationBuilder.CreateIndex(
                name: "ix_salary_tenant_id",
                schema: "staff",
                table: "salary",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_salary_tenant_id_employee_id_effective_from",
                schema: "staff",
                table: "salary",
                columns: new[] { "tenant_id", "employee_id", "effective_from" });

            migrationBuilder.AddTenantSecurityPolicy("staff", "department");
            migrationBuilder.AddTenantSecurityPolicy("staff", "job_title");
            migrationBuilder.AddTenantSecurityPolicy("staff", "grade");
            migrationBuilder.AddTenantSecurityPolicy("staff", "position");
            migrationBuilder.AddTenantSecurityPolicy("staff", "employee");
            migrationBuilder.AddTenantSecurityPolicy("staff", "salary");
            migrationBuilder.AddTenantSecurityPolicy("staff", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("staff", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("staff", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("staff", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("staff", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("staff", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("staff", "salary");
            migrationBuilder.DropTenantSecurityPolicy("staff", "employee");
            migrationBuilder.DropTenantSecurityPolicy("staff", "position");
            migrationBuilder.DropTenantSecurityPolicy("staff", "grade");
            migrationBuilder.DropTenantSecurityPolicy("staff", "job_title");
            migrationBuilder.DropTenantSecurityPolicy("staff", "department");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "department",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "employee",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "grade",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "job_title",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "position",
                schema: "staff");

            migrationBuilder.DropTable(
                name: "salary",
                schema: "staff");
        }
    }
}
