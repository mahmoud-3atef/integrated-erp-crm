using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Operations.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TransferFromProject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "from_project_crm_id",
                schema: "operations",
                table: "transfer_order",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "from_project_id",
                schema: "operations",
                table: "transfer_order",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "from_project_name",
                schema: "operations",
                table: "transfer_order",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "from_project_crm_id",
                schema: "operations",
                table: "transfer_order");

            migrationBuilder.DropColumn(
                name: "from_project_id",
                schema: "operations",
                table: "transfer_order");

            migrationBuilder.DropColumn(
                name: "from_project_name",
                schema: "operations",
                table: "transfer_order");
        }
    }
}
