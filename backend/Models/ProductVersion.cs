namespace Dpp.Api.Models;

public class ProductVersion
{
    public int Id { get; set; }

    public int ProductModelId { get; set; }

    public required ProductModel ProductModel { get; set; }

    public int VersionNumber { get; set; }

    public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

    public required string SnapshotJson { get; set; }
}
