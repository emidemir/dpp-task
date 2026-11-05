using System.Globalization;
using System.Text.Json;
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
            var expectedColumnCount = csv.HeaderRecord!.Length;

            var rows = new List<ProductCsvRow>();
            var errors = new List<CsvRowError>();
            var rowCount = 0;

            while (await csv.ReadAsync())
            {
                rowCount++;
                var columnCount = csv.Parser.Record!.Length;

                if (columnCount != expectedColumnCount)
                {
                    errors.Add(new CsvRowError
                    {
                        RowNumber = csv.Parser.Row,
                        Messages =
                        [
                            $"Satır {expectedColumnCount} sütun içermelidir; {columnCount} sütun bulundu."
                        ]
                    });

                    continue;
                }

                var row = csv.GetRecord<ProductCsvRow>();
                row.RowNumber = csv.Parser.Row;
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
        var name = row.ModelName.Trim();
        var batchNumber = row.BatchNumber.Trim();
        var productionPlace = row.ProductionPlace.Trim();
        var cotton = decimal.Parse(
            row.CottonPercentage, NumberStyles.Float, CultureInfo.InvariantCulture);
        var elastane = decimal.Parse(
            row.ElastanePercentage, NumberStyles.Float, CultureInfo.InvariantCulture);
        var carbon = decimal.Parse(
            row.CarbonKgCo2e, NumberStyles.Float, CultureInfo.InvariantCulture);

        var model = await _context.ProductModels
            .Include(product => product.Batches)
            .SingleOrDefaultAsync(product => product.Gtin == row.Gtin);

        var batch = model?.Batches.SingleOrDefault(candidate => candidate.BatchNumber == batchNumber);

        if (model is null)
        {
            model = new ProductModel
            {
                Gtin = row.Gtin,
                Name = name
            };

            _context.ProductModels.Add(model);
        }
        else
        {
            var modelChanged = model.Name != name
                || model.CottonPercentage != cotton
                || model.ElastanePercentage != elastane;

            var batchChanged = batch is null
                || batch.ProductionPlace != productionPlace
                || batch.CarbonKgCo2e != carbon;

            if (!modelChanged && !batchChanged)
            {
                return;
            }

            await AddPreviousVersionAsync(model);
        }

        model.Name = name;
        model.CottonPercentage = cotton;
        model.ElastanePercentage = elastane;

        if (batch is null)
        {
            batch = new Batch
            {
                BatchNumber = batchNumber,
                ProductionPlace = productionPlace,
                ProductModel = model
            };

            model.Batches.Add(batch);
        }

        batch.ProductionPlace = productionPlace;
        batch.CarbonKgCo2e = carbon;

        await _context.SaveChangesAsync();
    }

    private async Task AddPreviousVersionAsync(ProductModel model)
    {
        var previousVersionNumber = await _context.ProductVersions
            .Where(version => version.ProductModelId == model.Id)
            .MaxAsync(version => (int?)version.VersionNumber) ?? 0;

        var snapshot = new
        {
            model.Gtin,
            model.Name,
            model.CottonPercentage,
            model.ElastanePercentage,
            Batches = model.Batches
                .OrderBy(batch => batch.BatchNumber)
                .Select(batch => new
                {
                    batch.BatchNumber,
                    batch.ProductionPlace,
                    batch.CarbonKgCo2e
                })
                .ToArray()
        };

        _context.ProductVersions.Add(new ProductVersion
        {
            ProductModel = model,
            VersionNumber = previousVersionNumber + 1,
            SnapshotJson = JsonSerializer.Serialize(snapshot)
        });
    }
}
