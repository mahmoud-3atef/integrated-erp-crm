using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "attendance");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "attendance",
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
                name: "day",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    device_in = table.Column<TimeOnly>(type: "time", nullable: true),
                    device_out = table.Column<TimeOnly>(type: "time", nullable: true),
                    device_status = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    device_mark = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    device_permission_minutes = table.Column<int>(type: "int", nullable: false),
                    device_late_minutes = table.Column<int>(type: "int", nullable: true),
                    device_early_minutes = table.Column<int>(type: "int", nullable: true),
                    import_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    manual_in = table.Column<TimeOnly>(type: "time", nullable: true),
                    manual_out = table.Column<TimeOnly>(type: "time", nullable: true),
                    manual_status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    deduction = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    edited_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    edited_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_day", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "employee_setting",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    badge_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    exempt = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_employee_setting", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "holiday",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_holiday", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "import",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: false),
                    rows = table.Column<int>(type: "int", nullable: false),
                    accepted = table.Column<int>(type: "int", nullable: false),
                    rejected = table.Column<int>(type: "int", nullable: false),
                    employees = table.Column<int>(type: "int", nullable: false),
                    problems = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_import", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "attendance",
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
                schema: "attendance",
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
                name: "setting",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    match_by = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    columns = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    cycle_start_day = table.Column<int>(type: "int", nullable: false),
                    use_device_minutes = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_setting", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "shift",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    starts_at = table.Column<TimeOnly>(type: "time", nullable: false),
                    ends_at = table.Column<TimeOnly>(type: "time", nullable: false),
                    break_minutes = table.Column<int>(type: "int", nullable: false),
                    grace_minutes = table.Column<int>(type: "int", nullable: false),
                    late_from = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    rest_days = table.Column<int>(type: "int", nullable: false),
                    ramadan_starts_at = table.Column<TimeOnly>(type: "time", nullable: true),
                    ramadan_ends_at = table.Column<TimeOnly>(type: "time", nullable: true),
                    is_default = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shift", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "shift_assignment",
                schema: "attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shift_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    from = table.Column<DateOnly>(type: "date", nullable: false),
                    to = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shift_assignment", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "attendance",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "attendance",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_day_tenant_id",
                schema: "attendance",
                table: "day",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_day_tenant_id_date",
                schema: "attendance",
                table: "day",
                columns: new[] { "tenant_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_day_tenant_id_employee_id_date",
                schema: "attendance",
                table: "day",
                columns: new[] { "tenant_id", "employee_id", "date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_employee_setting_tenant_id",
                schema: "attendance",
                table: "employee_setting",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_employee_setting_tenant_id_badge_no",
                schema: "attendance",
                table: "employee_setting",
                columns: new[] { "tenant_id", "badge_no" },
                unique: true,
                filter: "[badge_no] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_employee_setting_tenant_id_employee_id",
                schema: "attendance",
                table: "employee_setting",
                columns: new[] { "tenant_id", "employee_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_holiday_tenant_id",
                schema: "attendance",
                table: "holiday",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_holiday_tenant_id_from",
                schema: "attendance",
                table: "holiday",
                columns: new[] { "tenant_id", "from" });

            migrationBuilder.CreateIndex(
                name: "ix_import_tenant_id",
                schema: "attendance",
                table: "import",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_import_tenant_id_from_to",
                schema: "attendance",
                table: "import",
                columns: new[] { "tenant_id", "from", "to" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "attendance",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_setting_tenant_id",
                schema: "attendance",
                table: "setting",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_shift_tenant_id",
                schema: "attendance",
                table: "shift",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_shift_assignment_tenant_id",
                schema: "attendance",
                table: "shift_assignment",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_shift_assignment_tenant_id_shift_id",
                schema: "attendance",
                table: "shift_assignment",
                columns: new[] { "tenant_id", "shift_id" });

            migrationBuilder.AddTenantSecurityPolicy("attendance", "shift");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "shift_assignment");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "holiday");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "employee_setting");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "setting");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "day");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "import");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("attendance", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("attendance", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "import");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "day");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "setting");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "employee_setting");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "holiday");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "shift_assignment");
            migrationBuilder.DropTenantSecurityPolicy("attendance", "shift");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "day",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "employee_setting",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "holiday",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "import",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "setting",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "shift",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "shift_assignment",
                schema: "attendance");
        }
    }
}
