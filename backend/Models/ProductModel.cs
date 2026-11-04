namespace Dpp.Api.Models;

public class ProductModel
{
    public int Id { get; set; }

    public required string Gtin { get; set; }

    public required string Name { get; set; }

    public decimal CottonPercentage { get; set; }

    public decimal ElastanePercentage { get; set; }

    public ICollection<Batch> Batches { get; set; } = [];
}
