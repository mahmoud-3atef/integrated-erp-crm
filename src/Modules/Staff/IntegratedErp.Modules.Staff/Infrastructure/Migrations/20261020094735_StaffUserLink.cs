using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Staff.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StaffUserLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "user_id",
                schema: "staff",
                table: "employee",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_employee_tenant_id_user_id",
                schema: "staff",
                table: "employee",
                columns: new[] { "tenant_id", "user_id" },
                unique: true,
                filter: "[user_id] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_employee_tenant_id_user_id",
                schema: "staff",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "user_id",
                schema: "staff",
                table: "employee");
        }
    }
}
