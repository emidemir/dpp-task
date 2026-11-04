using System.Globalization;

namespace Dpp.Api.Validators;

public static class FiberCompositionValidator
{
    public static List<string> GetErrors(string? cottonPercentage, string? elastanePercentage)
    {
        var errors = new List<string>();

        var cottonIsNumber = decimal.TryParse(
            cottonPercentage, NumberStyles.Float, CultureInfo.InvariantCulture, out var cotton);

        var elastaneIsNumber = decimal.TryParse(
            elastanePercentage, NumberStyles.Float, CultureInfo.InvariantCulture, out var elastane);

        if (!cottonIsNumber)
        {
            errors.Add("Pamuk yüzdesi sayısal olmalıdır.");
        }
        else if (cotton < 0 || cotton > 100)
        {
            errors.Add("Pamuk yüzdesi 0–100 aralığında olmalıdır.");
        }

        if (!elastaneIsNumber)
        {
            errors.Add("Elastan yüzdesi sayısal olmalıdır.");
        }
        else if (elastane < 0 || elastane > 100)
        {
            errors.Add("Elastan yüzdesi 0–100 aralığında olmalıdır.");
        }

        if (errors.Count == 0 && cotton + elastane != 100)
        {
            errors.Add("Pamuk ve elastan yüzdelerinin toplamı 100 olmalıdır.");
        }

        return errors;
    }
}
