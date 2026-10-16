using System;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedErp.Modules.Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "identity");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "identity",
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
                name: "number_sequence",
                schema: "identity",
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
                schema: "identity",
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
                name: "sign_in_attempt",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    provider = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    user_account_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    result = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ip_address = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sign_in_attempt", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_account",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_platform_admin = table.Column<bool>(type: "bit", nullable: false),
                    mfa_secret_protected = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    mfa_enabled = table.Column<bool>(type: "bit", nullable: false),
                    mfa_last_time_step = table.Column<long>(type: "bigint", nullable: true),
                    failed_attempts = table.Column<int>(type: "int", nullable: false),
                    locked_until = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_sign_in_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_account", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "external_login",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_account_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    provider = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    subject = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    user_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_external_login", x => x.id);
                    table.ForeignKey(
                        name: "fk_external_login_users_user_account_id",
                        column: x => x.user_account_id,
                        principalSchema: "identity",
                        principalTable: "user_account",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "membership",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_account_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_membership", x => x.id);
                    table.ForeignKey(
                        name: "fk_membership_users_user_account_id",
                        column: x => x.user_account_id,
                        principalSchema: "identity",
                        principalTable: "user_account",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recovery_code",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_account_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recovery_code", x => x.id);
                    table.ForeignKey(
                        name: "fk_recovery_code_users_user_account_id",
                        column: x => x.user_account_id,
                        principalSchema: "identity",
                        principalTable: "user_account",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_occurred_at",
                schema: "identity",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_id_occurred_at",
                schema: "identity",
                table: "audit_log",
                columns: new[] { "tenant_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_external_login_provider_subject",
                schema: "identity",
                table: "external_login",
                columns: new[] { "provider", "subject" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_external_login_user_account_id",
                schema: "identity",
                table: "external_login",
                column: "user_account_id");

            migrationBuilder.CreateIndex(
                name: "ix_membership_tenant_id",
                schema: "identity",
                table: "membership",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_membership_user_account_id_tenant_id",
                schema: "identity",
                table: "membership",
                columns: new[] { "user_account_id", "tenant_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_outbox_message_processed_at_occurred_at",
                schema: "identity",
                table: "outbox_message",
                columns: new[] { "processed_at", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_recovery_code_user_account_id",
                schema: "identity",
                table: "recovery_code",
                column: "user_account_id");

            migrationBuilder.CreateIndex(
                name: "ix_sign_in_attempt_user_name_occurred_at",
                schema: "identity",
                table: "sign_in_attempt",
                columns: new[] { "user_name", "occurred_at" });
        
            migrationBuilder.AddTenantSecurityPolicy("identity", "membership");
            migrationBuilder.AddTenantSecurityPolicy("identity", "audit_log");
            migrationBuilder.AddTenantSecurityPolicy("identity", "number_sequence");
            migrationBuilder.AddTenantSecurityPolicy("identity", "outbox_message");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTenantSecurityPolicy("identity", "outbox_message");
            migrationBuilder.DropTenantSecurityPolicy("identity", "number_sequence");
            migrationBuilder.DropTenantSecurityPolicy("identity", "audit_log");
            migrationBuilder.DropTenantSecurityPolicy("identity", "membership");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "external_login",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "membership",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "number_sequence",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "outbox_message",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "recovery_code",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "sign_in_attempt",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "user_account",
                schema: "identity");
        }
    }
}
