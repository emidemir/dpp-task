using System.Globalization;
using CsvHelper;
using Dpp.Api.Data;
using Dpp.Api.Dtos;
using Dpp.Api.Models;
using Dpp.Api.Validators;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dpp.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }

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

                var rowErrors = ProductCsvRowValidator.GetErrors(row);

                if (rowErrors.Count > 0)
                {
                    errors.Add(new CsvRowError
                    {
                        RowNumber = row.RowNumber,
                        Messages = rowErrors
                    });

                    continue;
                }

                rows.Add(row);
            }

            foreach (var row in rows)
            {
                await SaveRowAsync(row);
            }

            return Ok(new
            {
                message = "CSV işlendi. Geçerli kayıtlar veritabanına kaydedildi.",
                rowCount,
                validCount = rows.Count,
                savedCount = rows.Count,
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

    private async Task SaveRowAsync(ProductCsvRow row)
    {
        var model = await _context.ProductModels
            .Include(model => model.Batches)
            .SingleOrDefaultAsync(model => model.Gtin == row.Gtin);

        if (model is null)
        {
            model = new ProductModel
            {
                Gtin = row.Gtin,
                Name = row.ModelName.Trim()
            };

            _context.ProductModels.Add(model);
        }

        model.Name = row.ModelName.Trim();
        model.CottonPercentage = decimal.Parse(
            row.CottonPercentage, NumberStyles.Float, CultureInfo.InvariantCulture);
        model.ElastanePercentage = decimal.Parse(
            row.ElastanePercentage, NumberStyles.Float, CultureInfo.InvariantCulture);

        var batchNumber = row.BatchNumber.Trim();
        var batch = model.Batches.SingleOrDefault(batch => batch.BatchNumber == batchNumber);

        if (batch is null)
        {
            batch = new Batch
            {
                BatchNumber = batchNumber,
                ProductionPlace = row.ProductionPlace.Trim(),
                ProductModel = model
            };

            model.Batches.Add(batch);
        }

        batch.ProductionPlace = row.ProductionPlace.Trim();
        batch.CarbonKgCo2e = decimal.Parse(
            row.CarbonKgCo2e, NumberStyles.Float, CultureInfo.InvariantCulture);

        await _context.SaveChangesAsync();
    }
}
