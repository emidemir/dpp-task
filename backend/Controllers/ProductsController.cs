using Microsoft.AspNetCore.Mvc;

namespace Dpp.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public IActionResult Import([FromForm] IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new
            {
                message = "Lütfen boş olmayan bir CSV dosyası yükleyin."
            });
        }

        return Ok(new
        {
            message = "Dosya alındı. CSV içeriği henüz işlenmedi.",
            fileName = file.FileName,
            size = file.Length
        });
    }
}
