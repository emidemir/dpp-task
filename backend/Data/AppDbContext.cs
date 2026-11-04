using Dpp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Dpp.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<ProductModel> ProductModels => Set<ProductModel>(); // DbSet is similar to django objects manager

    public DbSet<Batch> Batches => Set<Batch>(); // DbSet is similar to django objects manager

    protected override void OnModelCreating(ModelBuilder modelBuilder) // OnModelCreating is similar to Django model class's class Meta.
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ProductModel>()
            .HasIndex(model => model.Gtin)
            .IsUnique();

        // One ProductModel has many Batches; each Batch belongs to one ProductModel.
        modelBuilder.Entity<Batch>()
            .HasOne(batch => batch.ProductModel)
            .WithMany(model => model.Batches)
            .HasForeignKey(batch => batch.ProductModelId);
    }
}
