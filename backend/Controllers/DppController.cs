using Dpp.Api.Data;
using Dpp.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QRCoder;

namespace Dpp.Api.Controllers;

[Route("dpp")]
public class DppController : Controller
{
    private readonly AppDbContext _context;

    public DppController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{gtin}")]
    public async Task<IActionResult> Details(string gtin, [FromQuery] string? rol)
    {
        var model = await FindProductAsync(gtin);

        if (model is null)
        {
            return NotFound("Ürün bulunamadı.");
        }

        ViewData["ShowCarbon"] = ShouldShowCarbon(rol);
        return View(model);
    }

    [HttpGet("{gtin}.jsonld")]
    public async Task<IActionResult> JsonLd(string gtin, [FromQuery] string? rol)
    {
        var model = await FindProductAsync(gtin);

        if (model is null)
        {
            return NotFound("Ürün bulunamadı.");
        }

        var showCarbon = ShouldShowCarbon(rol);

        var properties = new List<Dictionary<string, object>>
        {
            CreatePropertyValue("elyaf_pamuk_yuzde", model.CottonPercentage, "%"),
            CreatePropertyValue("elyaf_elastan_yuzde", model.ElastanePercentage, "%")
        };

        foreach (var batch in model.Batches.OrderBy(batch => batch.BatchNumber))
        {
            var batchProperties = new List<Dictionary<string, object>>
            {
                CreatePropertyValue("uretim_yeri", batch.ProductionPlace)
            };

            if (showCarbon)
            {
                batchProperties.Add(CreatePropertyValue(
                    "karbon_kg_co2e", batch.CarbonKgCo2e, "kg CO2e"));
            }

            var batchProperty = CreatePropertyValue("batch_no", batch.BatchNumber);
            batchProperty["valueReference"] = batchProperties;
            properties.Add(batchProperty);
        }

        var document = new Dictionary<string, object>
        {
            ["@context"] = "https://schema.org",
            ["@type"] = "Product",
            ["gtin14"] = model.Gtin,
            ["name"] = model.Name,
            ["additionalProperty"] = properties
        };

        return new JsonResult(document)
        {
            ContentType = "application/ld+json"
        };
    }

    [HttpGet("{gtin}/qr.png")]
    public async Task<IActionResult> QrCode(string gtin)
    {
        var exists = await _context.ProductModels.AnyAsync(model => model.Gtin == gtin);

        if (!exists)
        {
            return NotFound("Ürün bulunamadı.");
        }

        var passportUrl = Url.ActionLink(nameof(Details), "Dpp", new { gtin })
            ?? throw new InvalidOperationException("Ürün pasaportu adresi oluşturulamadı.");

        using var data = QRCodeGenerator.GenerateQrCode(passportUrl, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(data);
        var png = qrCode.GetGraphic(pixelsPerModule: 10);

        return File(png, "image/png");
    }

    private static bool ShouldShowCarbon(string? role)
    {
        return role == "yetkili";
    }

    private Task<ProductModel?> FindProductAsync(string gtin)
    {
        return _context.ProductModels
            .AsNoTracking()
            .Include(model => model.Batches)
            .SingleOrDefaultAsync(model => model.Gtin == gtin);
    }

    private static Dictionary<string, object> CreatePropertyValue(
        string name, object value, string? unitText = null)
    {
        var property = new Dictionary<string, object>
        {
            ["@type"] = "PropertyValue",
            ["name"] = name,
            ["value"] = value
        };

        if (unitText is not null)
        {
            property["unitText"] = unitText;
        }

        return property;
    }
}
