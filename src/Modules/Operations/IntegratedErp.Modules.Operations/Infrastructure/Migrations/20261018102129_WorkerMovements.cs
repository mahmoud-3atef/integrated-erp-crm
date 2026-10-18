using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Operations.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkerMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "worker_movement",
                schema: "operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    movement_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    worker_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    iqama_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    from_placement = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    from_project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    from_project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    effective_on = table.Column<DateOnly>(type: "date", nullable: false),
                    expected_return_on = table.Column<DateOnly>(type: "date", nullable: true),
                    vacation_kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    return_to = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_crm_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    package_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    salary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    service_fee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    housing_billable = table.Column<bool>(type: "bit", nullable: false),
                    transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    transport_billable = table.Column<bool>(type: "bit", nullable: false),
                    is_special_price = table.Column<bool>(type: "bit", nullable: false),
                    special_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    pay_salary = table.Column<bool>(type: "bit", nullable: false),
                    suspension_reason = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    exit_kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    place = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    delay_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    executed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    executed_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_worker_movement", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_worker_movement_tenant_id",
                schema: "operations",
                table: "worker_movement",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_movement_tenant_id_movement_no",
                schema: "operations",
                table: "worker_movement",
                columns: new[] { "tenant_id", "movement_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_worker_movement_tenant_id_type_status",
                schema: "operations",
                table: "worker_movement",
                columns: new[] { "tenant_id", "type", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_worker_movement_tenant_id_worker_id",
                schema: "operations",
                table: "worker_movement",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.AddTenantSecurityPolicy("operations", "worker_movement");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("operations", "worker_movement");

            migrationBuilder.DropTable(
                name: "worker_movement",
                schema: "operations");
        }
    }
}
