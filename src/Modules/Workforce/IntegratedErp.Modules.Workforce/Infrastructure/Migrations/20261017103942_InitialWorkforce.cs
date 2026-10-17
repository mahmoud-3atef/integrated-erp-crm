using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialWorkforce : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "workforce");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "workforce",
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
                name: "crm_import",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_run_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    summary = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crm_import", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "workforce",
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
                schema: "workforce",
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
                name: "person",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    nationality_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    marital_status = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_person", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "person_identifier",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    person_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    expires_on = table.Column<DateOnly>(type: "date", nullable: true),
                    is_current = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_person_identifier", x => x.id);
                    table.ForeignKey(
                        name: "fk_person_identifier_person_person_id",
                        column: x => x.person_id,
                        principalSchema: "workforce",
                        principalTable: "person",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "worker",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    person_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    iqama_profession_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    profession_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    iqama_profession_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    crm_status = table.Column<int>(type: "int", nullable: true),
                    placement = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    lifecycle = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    sponsor = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    recruitment_agent = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    project_joined_on = table.Column<DateOnly>(type: "date", nullable: true),
                    arrived_on = table.Column<DateOnly>(type: "date", nullable: true),
                    crm_created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    removed_in_crm = table.Column<bool>(type: "bit", nullable: false),
                    contract_ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    contract_months = table.Column<int>(type: "int", nullable: true),
                    contract_starts_on = table.Column<DateOnly>(type: "date", nullable: true),
                    leave_annual_days = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_balance = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_consumed = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_old_consumed = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    leave_remaining = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    salary_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_food = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_hardship = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_other = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_project = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    salary_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_worker", x => x.id);
                    table.ForeignKey(
                        name: "fk_worker_person_person_id",
                        column: x => x.person_id,
                        principalSchema: "workforce",
                        principalTable: "person",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "workforce",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "workforce",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_crm_import_tenant_id",
                schema: "workforce",
                table: "crm_import",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "workforce",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_person_tenant_id",
                schema: "workforce",
                table: "person",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_person_identifier_person_id",
                schema: "workforce",
                table: "person_identifier",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "ix_person_identifier_tenant_id",
                schema: "workforce",
                table: "person_identifier",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_person_identifier_tenant_id_number",
                schema: "workforce",
                table: "person_identifier",
                columns: new[] { "tenant_id", "number" });

            migrationBuilder.CreateIndex(
                name: "ux_person_identifier_current_number",
                schema: "workforce",
                table: "person_identifier",
                columns: new[] { "tenant_id", "type", "number" },
                unique: true,
                filter: "[is_current] = 1");

            migrationBuilder.CreateIndex(
                name: "ix_worker_person_id",
                schema: "workforce",
                table: "worker",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_tenant_id",
                schema: "workforce",
                table: "worker",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_tenant_id_crm_id",
                schema: "workforce",
                table: "worker",
                columns: new[] { "tenant_id", "crm_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_worker_tenant_id_placement",
                schema: "workforce",
                table: "worker",
                columns: new[] { "tenant_id", "placement" });

            migrationBuilder.CreateIndex(
                name: "ix_worker_tenant_id_worker_no",
                schema: "workforce",
                table: "worker",
                columns: new[] { "tenant_id", "worker_no" });

            // Second line of tenant isolation (after the EF filter): SQL Server row-level security.
            migrationBuilder.AddTenantSecurityPolicy("workforce", "person");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "person_identifier");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "worker");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "crm_import");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workforce", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "crm_import");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "worker");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "person_identifier");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "person");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "crm_import",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "person_identifier",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "worker",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "person",
                schema: "workforce");
        }
    }
}
