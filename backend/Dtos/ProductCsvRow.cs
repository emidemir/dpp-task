using CsvHelper.Configuration.Attributes;

namespace Dpp.Api.Dtos;

public class ProductCsvRow
{
    [Ignore]
    public int RowNumber { get; set; }

    [Name("gtin")]
    public string Gtin { get; set; } = string.Empty;

    [Name("model_adi")]
    public string ModelName { get; set; } = string.Empty;

    [Name("batch_no")]
    public string BatchNumber { get; set; } = string.Empty;

    [Name("elyaf_pamuk_yuzde")]
    public string CottonPercentage { get; set; } = string.Empty;

    [Name("elyaf_elastan_yuzde")]
    public string ElastanePercentage { get; set; } = string.Empty;

    [Name("uretim_yeri")]
    public string ProductionPlace { get; set; } = string.Empty;

    [Name("karbon_kg_co2e")]
    public string CarbonKgCo2e { get; set; } = string.Empty;
}
