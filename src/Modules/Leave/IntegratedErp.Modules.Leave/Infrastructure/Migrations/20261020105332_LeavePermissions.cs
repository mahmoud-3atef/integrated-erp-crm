using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Leave.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LeavePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "return_note",
                schema: "leave",
                table: "request",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "returned_on",
                schema: "leave",
                table: "request",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "permission",
                schema: "leave",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_no = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    employee_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    from_time = table.Column<TimeOnly>(type: "time", nullable: false),
                    to_time = table.Column<TimeOnly>(type: "time", nullable: false),
                    minutes = table.Column<int>(type: "int", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    manager_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    awaiting_approval = table.Column<bool>(type: "bit", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_permission", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_permission_tenant_id",
                schema: "leave",
                table: "permission",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_permission_tenant_id_employee_id_date",
                schema: "leave",
                table: "permission",
                columns: new[] { "tenant_id", "employee_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_permission_tenant_id_request_no",
                schema: "leave",
                table: "permission",
                columns: new[] { "tenant_id", "request_no" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("leave", "permission");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("leave", "permission");

            migrationBuilder.DropTable(
                name: "permission",
                schema: "leave");

            migrationBuilder.DropColumn(
                name: "return_note",
                schema: "leave",
                table: "request");

            migrationBuilder.DropColumn(
                name: "returned_on",
                schema: "leave",
                table: "request");
        }
    }
}
