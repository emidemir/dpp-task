namespace Dpp.Api.Validators;

public static class GtinValidator
{
    public static string? GetError(string? gtin)
    {
        if (string.IsNullOrWhiteSpace(gtin))
        {
            return "GTIN boş olamaz.";
        }

        if (gtin.Length != 14)
        {
            return "GTIN tam olarak 14 haneli olmalıdır.";
        }

        if (gtin.Any(character => character < '0' || character > '9'))
        {
            return "GTIN yalnızca 0–9 rakamlarından oluşmalıdır.";
        }

        var sum = 0;

        for (var index = 0; index < 13; index++)
        {
            var digit = gtin[index] - '0';
            var weight = index % 2 == 0 ? 3 : 1;
            sum += digit * weight;
        }

        var expectedCheckDigit = (10 - sum % 10) % 10;
        var actualCheckDigit = gtin[13] - '0';

        if (actualCheckDigit != expectedCheckDigit)
        {
            return "GTIN GS1 kontrol basamağı geçersiz.";
        }

        return null;
    }
}
