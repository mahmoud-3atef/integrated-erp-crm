using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Workforce.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkerSalaryChange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "salary_change",
                schema: "workforce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    change_no = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    worker_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    requested_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    requested_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ended_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    new_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_food = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_hardship = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_other = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_project = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    new_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_basic = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_food = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_hardship = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_housing = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_other = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_overtime = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_project = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    old_transport = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_salary_change", x => x.id);
                    table.ForeignKey(
                        name: "fk_salary_change_worker_worker_id",
                        column: x => x.worker_id,
                        principalSchema: "workforce",
                        principalTable: "worker",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_salary_change_tenant_id",
                schema: "workforce",
                table: "salary_change",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_salary_change_tenant_id_change_no",
                schema: "workforce",
                table: "salary_change",
                columns: new[] { "tenant_id", "change_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_salary_change_tenant_id_worker_id",
                schema: "workforce",
                table: "salary_change",
                columns: new[] { "tenant_id", "worker_id" });

            migrationBuilder.CreateIndex(
                name: "ix_salary_change_worker_id",
                schema: "workforce",
                table: "salary_change",
                column: "worker_id");

            migrationBuilder.AddTenantSecurityPolicy("workforce", "salary_change");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("workforce", "salary_change");

            migrationBuilder.DropTable(
                name: "salary_change",
                schema: "workforce");
        }
    }
}
