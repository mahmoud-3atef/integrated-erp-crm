using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Housing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialHousing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "housing");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "housing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    entity_type = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    entity_id = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    action = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    changes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    user_id = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    user_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    trace_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "building",
                schema: "housing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    city = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    project_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    project_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_building", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "number_sequence",
                schema: "housing",
                columns: table => new
                {
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sequence_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    scope_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    period = table.Column<int>(type: "int", nullable: false),
                    next_value = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_number_sequence", x => new { x.tenant_id, x.sequence_key, x.scope_key, x.period });
                    table.CheckConstraint("ck_number_sequence_next_value", "next_value >= 1");
                });

            migrationBuilder.CreateTable(
                name: "outbox_message",
                schema: "housing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    attempts = table.Column<int>(type: "int", nullable: false),
                    last_error = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outbox_message", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "room",
                schema: "housing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    building_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    number = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    floor = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    capacity = table.Column<int>(type: "int", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_room", x => x.id);
                    table.ForeignKey(
                        name: "fk_room_building_building_id",
                        column: x => x.building_id,
                        principalSchema: "housing",
                        principalTable: "building",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "room_assignment",
                schema: "housing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    room_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    worker_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: false),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    source_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    source_no = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    assigned_by_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    assigned_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_room_assignment", x => x.id);
                    table.ForeignKey(
                        name: "fk_room_assignment_rooms_room_id",
                        column: x => x.room_id,
                        principalSchema: "housing",
                        principalTable: "room",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "housing",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "housing",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_building_tenant_id",
                schema: "housing",
                table: "building",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_building_tenant_id_name",
                schema: "housing",
                table: "building",
                columns: new[] { "tenant_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "housing",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_room_building_id",
                schema: "housing",
                table: "room",
                column: "building_id");

            migrationBuilder.CreateIndex(
                name: "ix_room_tenant_id",
                schema: "housing",
                table: "room",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_room_tenant_id_building_id_number",
                schema: "housing",
                table: "room",
                columns: new[] { "tenant_id", "building_id", "number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_room_assignment_room_id",
                schema: "housing",
                table: "room_assignment",
                column: "room_id");

            migrationBuilder.CreateIndex(
                name: "ix_room_assignment_tenant_id",
                schema: "housing",
                table: "room_assignment",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_room_assignment_tenant_id_room_id_ends_on",
                schema: "housing",
                table: "room_assignment",
                columns: new[] { "tenant_id", "room_id", "ends_on" });

            migrationBuilder.CreateIndex(
                name: "ix_room_assignment_tenant_id_worker_id",
                schema: "housing",
                table: "room_assignment",
                columns: new[] { "tenant_id", "worker_id" },
                unique: true,
                filter: "[ends_on] IS NULL");

            migrationBuilder.AddTenantSecurityPolicy("housing", "building");
            migrationBuilder.AddTenantSecurityPolicy("housing", "room");
            migrationBuilder.AddTenantSecurityPolicy("housing", "room_assignment");
            migrationBuilder.AddTenantSecurityPolicy("housing", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("housing", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("housing", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("housing", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("housing", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("housing", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("housing", "room_assignment");
            migrationBuilder.DropTenantSecurityPolicy("housing", "room");
            migrationBuilder.DropTenantSecurityPolicy("housing", "building");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "housing");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "housing");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "housing");

            migrationBuilder.DropTable(
                name: "room_assignment",
                schema: "housing");

            migrationBuilder.DropTable(
                name: "room",
                schema: "housing");

            migrationBuilder.DropTable(
                name: "building",
                schema: "housing");
        }
    }
}
