using IntegratedErp.BuildingBlocks.Persistence;
﻿using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StatusValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "status_value",
                schema: "workflow",
                table: "approval_instance",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "status_value",
                schema: "workflow",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    screen = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    code = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_status_value", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_status_value_tenant_id",
                schema: "workflow",
                table: "status_value",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_status_value_tenant_id_screen_code",
                schema: "workflow",
                table: "status_value",
                columns: new[] { "tenant_id", "screen", "code" },
                unique: true);

            migrationBuilder.AddTenantSecurityPolicy("workflow", "status_value");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workflow", "status_value");

            migrationBuilder.DropTable(
                name: "status_value",
                schema: "workflow");

            migrationBuilder.DropColumn(
                name: "status_value",
                schema: "workflow",
                table: "approval_instance");
        }
    }
}
