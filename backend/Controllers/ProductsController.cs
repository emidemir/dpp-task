using System.Globalization;
using CsvHelper;
using Dpp.Api.Dtos;
using Dpp.Api.Validators;
using Microsoft.AspNetCore.Mvc;

namespace Dpp.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Import([FromForm] IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new
            {
                message = "Lütfen boş olmayan bir CSV dosyası yükleyin."
            });
        }

        using var reader = new StreamReader(file.OpenReadStream());
        using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);

        try
        {
            if (!await csv.ReadAsync())
            {
                return BadRequest(new
                {
                    message = "CSV dosyası başlık satırı içermelidir."
                });
            }

            csv.ReadHeader();
            csv.ValidateHeader<ProductCsvRow>();

            var rows = new List<ProductCsvRow>();
            var errors = new List<CsvRowError>();
            var rowCount = 0;

            while (await csv.ReadAsync())
            {
                var row = csv.GetRecord<ProductCsvRow>();
                row.RowNumber = csv.Parser.Row;
                rowCount++;

                var gtinError = GtinValidator.GetError(row.Gtin);

                if (gtinError is not null)
                {
                    errors.Add(new CsvRowError
                    {
                        RowNumber = row.RowNumber,
                        Messages = [gtinError]
                    });

                    continue;
                }

                rows.Add(row);
            }

            return Ok(new
            {
                message = "GTIN doğrulaması tamamlandı. Diğer alanlar henüz doğrulanmadı; kayıt yapılmadı.",
                rowCount,
                validGtinCount = rows.Count,
                rejectedCount = errors.Count,
                rows,
                errors
            });
        }
        catch (HeaderValidationException)
        {
            return BadRequest(new
            {
                message = "CSV başlıkları eksik veya hatalı. Örnek dosyadaki sütun adlarını kullanın."
            });
        }
        catch (CsvHelperException)
        {
            return BadRequest(new
            {
                rowNumber = csv.Parser.Row,
                message = "CSV satırı okunamadı. Alan sayısını ve tırnak kullanımını kontrol edin."
            });
        }
    }
}
