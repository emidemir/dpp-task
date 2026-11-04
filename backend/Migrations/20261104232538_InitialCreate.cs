using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dpp.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductModels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Gtin = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CottonPercentage = table.Column<decimal>(type: "TEXT", nullable: false),
                    ElastanePercentage = table.Column<decimal>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductModels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Batches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BatchNumber = table.Column<string>(type: "TEXT", nullable: false),
                    ProductionPlace = table.Column<string>(type: "TEXT", nullable: false),
                    CarbonKgCo2e = table.Column<decimal>(type: "TEXT", nullable: false),
                    ProductModelId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Batches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Batches_ProductModels_ProductModelId",
                        column: x => x.ProductModelId,
                        principalTable: "ProductModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Batches_ProductModelId",
                table: "Batches",
                column: "ProductModelId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductModels_Gtin",
                table: "ProductModels",
                column: "Gtin",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Batches");

            migrationBuilder.DropTable(
                name: "ProductModels");
        }
    }
}
