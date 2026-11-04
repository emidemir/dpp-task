namespace Dpp.Api.Models;

public class Batch
{
    public int Id { get; set; }

    public required string BatchNumber { get; set; }

    public required string ProductionPlace { get; set; }

    public decimal CarbonKgCo2e { get; set; }

    public int ProductModelId { get; set; }

    public required ProductModel ProductModel { get; set; }
}
