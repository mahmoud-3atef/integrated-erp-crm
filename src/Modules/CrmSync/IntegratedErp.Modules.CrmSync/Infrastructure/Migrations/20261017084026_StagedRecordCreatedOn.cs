using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.CrmSync.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StagedRecordCreatedOn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "created_on",
                schema: "crm_sync",
                table: "staged_record",
                type: "datetime2",
                nullable: true);

            // Records copied before this column existed: their creation date is in the copied JSON.
            migrationBuilder.Sql(
                "UPDATE crm_sync.staged_record SET created_on = TRY_CONVERT(datetime2, JSON_VALUE(payload, '$.createdon'), 127) WHERE created_on IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "created_on",
                schema: "crm_sync",
                table: "staged_record");
        }
    }
}
