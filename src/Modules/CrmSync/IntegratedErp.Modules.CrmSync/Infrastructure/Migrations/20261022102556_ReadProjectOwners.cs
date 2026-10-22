using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.CrmSync.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReadProjectOwners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Projects now carry their owner's (manager's) Windows account: read them all again on the next sync.
            migrationBuilder.Sql("UPDATE crm_sync.sync_state SET watermark_modified_on = NULL, watermark_id = NULL WHERE entity = 'new_project';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
