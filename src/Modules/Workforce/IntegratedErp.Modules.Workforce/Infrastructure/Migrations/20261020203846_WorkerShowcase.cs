using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkerShowcase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "worker_photo",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    content_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    size = table.Column<long>(type: "bigint", nullable: false),
                    storage_key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    uploaded_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    uploaded_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_worker_photo", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "worker_profile",
                schema: "workforce",
                columns: table => new
                {
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    specialty = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    skills = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    languages = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    gender = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: true),
                    religion = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    education = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    prior_experience_years = table.Column<int>(type: "int", nullable: true),
                    bio_ar = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true),
                    bio_en = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true),
                    updated_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_worker_profile", x => x.worker_id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_worker_photo_tenant_id",
                schema: "workforce",
                table: "worker_photo",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_photo_tenant_id_worker_id_sort_order",
                schema: "workforce",
                table: "worker_photo",
                columns: new[] { "tenant_id", "worker_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_worker_profile_tenant_id",
                schema: "workforce",
                table: "worker_profile",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_worker_profile_tenant_id_specialty",
                schema: "workforce",
                table: "worker_profile",
                columns: new[] { "tenant_id", "specialty" });

            migrationBuilder.AddTenantSecurityPolicy("workforce", "worker_profile");
            migrationBuilder.AddTenantSecurityPolicy("workforce", "worker_photo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workforce", "worker_photo");
            migrationBuilder.DropTenantSecurityPolicy("workforce", "worker_profile");

            migrationBuilder.DropTable(
                name: "worker_photo",
                schema: "workforce");

            migrationBuilder.DropTable(
                name: "worker_profile",
                schema: "workforce");
        }
    }
}
