using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Operations.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReturnOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "housing_orders_watermark",
                schema: "operations",
                table: "crm_import",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "return_order",
                schema: "operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    source = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    crm_status = table.Column<int>(type: "int", nullable: true),
                    entry = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    worker_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    profession_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    nationality_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    iqama_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    work_started_on = table.Column<DateOnly>(type: "date", nullable: true),
                    arrived_on = table.Column<DateOnly>(type: "date", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    reason_notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    customer_wish = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    stop_salary = table.Column<bool>(type: "bit", nullable: false),
                    housing_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    delay_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    completed_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_return_order", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_return_order_tenant_id",
                schema: "operations",
                table: "return_order",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_return_order_tenant_id_crm_id",
                schema: "operations",
                table: "return_order",
                columns: new[] { "tenant_id", "crm_id" },
                unique: true,
                filter: "[crm_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_return_order_tenant_id_order_no",
                schema: "operations",
                table: "return_order",
                columns: new[] { "tenant_id", "order_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_return_order_tenant_id_status",
                schema: "operations",
                table: "return_order",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_return_order_tenant_id_worker_id",
                schema: "operations",
                table: "return_order",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.AddTenantSecurityPolicy("operations", "return_order");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("operations", "return_order");

            migrationBuilder.DropTable(
                name: "return_order",
                schema: "operations");

            migrationBuilder.DropColumn(
                name: "housing_orders_watermark",
                schema: "operations",
                table: "crm_import");
        }
    }
}
