using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Commercial.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCommercial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "commercial");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "commercial",
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
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    customers_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    projects_watermark = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crm_import", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "customer",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    customer_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    commercial_registration = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    vat_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    mobile = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    city = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    contact_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    labor_office_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    crm_created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    removed_in_crm = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_customer", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "commercial",
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
                schema: "commercial",
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
                name: "contract",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    contract_no = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    customer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: true),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contract", x => x.id);
                    table.ForeignKey(
                        name: "fk_contract_customers_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "commercial",
                        principalTable: "customer",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "project",
                schema: "commercial",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    contract_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    customer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    customer_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    manager = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    commercial_registration = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    city = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    sector = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    contact_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    contact_mobile = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    contact_emails = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    crm_created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    removed_in_crm = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project", x => x.id);
                    table.ForeignKey(
                        name: "fk_project_contract_contract_id",
                        column: x => x.contract_id,
                        principalSchema: "commercial",
                        principalTable: "contract",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_project_customer_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "commercial",
                        principalTable: "customer",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "commercial",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "commercial",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_contract_customer_id",
                schema: "commercial",
                table: "contract",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_contract_tenant_id",
                schema: "commercial",
                table: "contract",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_contract_tenant_id_ends_on",
                schema: "commercial",
                table: "contract",
                columns: new[] { "tenant_id", "ends_on" });

            migrationBuilder.CreateIndex(
                name: "ix_contract_tenant_id_project_crm_id",
                schema: "commercial",
                table: "contract",
                columns: new[] { "tenant_id", "project_crm_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_crm_import_tenant_id",
                schema: "commercial",
                table: "crm_import",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_customer_tenant_id",
                schema: "commercial",
                table: "customer",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_customer_tenant_id_crm_id",
                schema: "commercial",
                table: "customer",
                columns: new[] { "tenant_id", "crm_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "commercial",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_project_contract_id",
                schema: "commercial",
                table: "project",
                column: "contract_id");

            migrationBuilder.CreateIndex(
                name: "ix_project_customer_id",
                schema: "commercial",
                table: "project",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_project_tenant_id",
                schema: "commercial",
                table: "project",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_project_tenant_id_code",
                schema: "commercial",
                table: "project",
                columns: new[] { "tenant_id", "code" });

            migrationBuilder.CreateIndex(
                name: "ix_project_tenant_id_crm_id",
                schema: "commercial",
                table: "project",
                columns: new[] { "tenant_id", "crm_id" },
                unique: true);

            // Second line of tenant isolation (after the EF filter): SQL Server row-level security.
            migrationBuilder.AddTenantSecurityPolicy("commercial", "customer");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "contract");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "project");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "crm_import");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("commercial", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("commercial", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "crm_import");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "project");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "contract");
            migrationBuilder.DropTenantSecurityPolicy("commercial", "customer");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "crm_import",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "project",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "contract",
                schema: "commercial");

            migrationBuilder.DropTable(
                name: "customer",
                schema: "commercial");
        }
    }
}
