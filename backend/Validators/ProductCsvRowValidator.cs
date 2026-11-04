using System.Globalization;
using Dpp.Api.Dtos;

namespace Dpp.Api.Validators;

public static class ProductCsvRowValidator
{
    public static List<string> GetErrors(ProductCsvRow row)
    {
        var errors = new List<string>();
        var gtinError = GtinValidator.GetError(row.Gtin);

        if (gtinError is not null)
        {
            errors.Add(gtinError);
        }

        errors.AddRange(FiberCompositionValidator.GetErrors(
            row.CottonPercentage, row.ElastanePercentage));

        if (string.IsNullOrWhiteSpace(row.ModelName))
        {
            errors.Add("Model adı boş olamaz.");
        }

        if (string.IsNullOrWhiteSpace(row.BatchNumber))
        {
            errors.Add("Batch numarası boş olamaz.");
        }

        if (string.IsNullOrWhiteSpace(row.ProductionPlace))
        {
            errors.Add("Üretim yeri boş olamaz.");
        }

        if (!decimal.TryParse(row.CarbonKgCo2e, NumberStyles.Float,
                CultureInfo.InvariantCulture, out var carbon))
        {
            errors.Add("Karbon değeri sayısal olmalıdır.");
        }
        else if (carbon < 0)
        {
            errors.Add("Karbon değeri negatif olamaz.");
        }

        return errors;
    }
}
