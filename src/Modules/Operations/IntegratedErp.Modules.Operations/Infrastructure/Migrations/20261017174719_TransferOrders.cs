using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Operations.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TransferOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "transfer_order",
                schema: "operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    project_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    customer_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    project_manager = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    contract_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    transfer_on = table.Column<DateOnly>(type: "date", nullable: false),
                    receiver_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    receiver_title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    delay_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    transferred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    transferred_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_transfer_order", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "transfer_line",
                schema: "operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_no = table.Column<int>(type: "int", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    iqama_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    from_project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    from_project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    from_project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    from_started_on = table.Column<DateOnly>(type: "date", nullable: true),
                    package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    package_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_fee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing_billable = table.Column<bool>(type: "bit", nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport_billable = table.Column<bool>(type: "bit", nullable: false),
                    total_price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    is_special_price = table.Column<bool>(type: "bit", nullable: false),
                    special_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_transfer_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_transfer_line_transfer_order_order_id",
                        column: x => x.order_id,
                        principalSchema: "operations",
                        principalTable: "transfer_order",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_transfer_line_order_id",
                schema: "operations",
                table: "transfer_line",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_transfer_line_tenant_id",
                schema: "operations",
                table: "transfer_line",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_transfer_line_tenant_id_worker_id",
                schema: "operations",
                table: "transfer_line",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_transfer_order_tenant_id",
                schema: "operations",
                table: "transfer_order",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_transfer_order_tenant_id_order_no",
                schema: "operations",
                table: "transfer_order",
                columns: new[] { "tenant_id", "order_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_transfer_order_tenant_id_status",
                schema: "operations",
                table: "transfer_order",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.AddTenantSecurityPolicy("operations", "transfer_order");
            migrationBuilder.AddTenantSecurityPolicy("operations", "transfer_line");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("operations", "transfer_line");
            migrationBuilder.DropTenantSecurityPolicy("operations", "transfer_order");

            migrationBuilder.DropTable(
                name: "transfer_line",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "transfer_order",
                schema: "operations");
        }
    }
}
