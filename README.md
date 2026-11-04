# Mini DPP

CSV dosyalarından ürün verilerini içe aktarmak ve dijital ürün pasaportları
üretmek için geliştirilmekte olan uygulama.

## Backend

- .NET 10 / ASP.NET Core Web API
- Entity Framework Core 10.0.14 ve SQLite sağlayıcısı

### Veri modeli

- `ProductModel`: GTIN, model adı ve elyaf yüzdeleri.
- `Batch`: batch numarası, üretim yeri ve karbon değeri.
- Bir ürün modeline birden fazla batch bağlanabilir. Her batch,
  `ProductModelId` alanıyla bir modele bağlanır.
- GTIN, baştaki sıfırların korunması için metin olarak tutulur.
- `Data/AppDbContext.cs`, entity kümelerini ve model–batch ilişkisini
  tanımlar. GTIN için benzersiz indeks yapılandırılmıştır.

### Tasarım varsayımları

- Ödev, model ve batch/lot bilgilerinin ayrı ilişkili tablolarda tutulmasını
  ister; ilişkinin bire bir veya bire çok olacağını açıkça belirtmez.
- Bu uygulamada `ProductModel`, tek bir GTIN ile tanımlanan ticari ürün
  tipini temsil eder; tek bir fiziksel ürünü veya tüm beden ve renkleri
  kapsayan model ailesini temsil etmez.
- Aynı GTIN farklı üretim partilerinde kullanılabileceği için model–batch
  ilişkisi bire çok kurulmuştur. Batch, ilgili ürün tipinin üretim partisidir.

### Derleme

.NET 10 SDK kurulu olmalıdır. Depo kökünde çalıştırın:

```bash
dotnet build backend/Dpp.Api.csproj
```

Komut, NuGet bağımlılıklarını restore eder ve backend'i derler.
Uygulamayı başlatmaz veya veritabanına migration uygulamaz.

### Mevcut durum

Entity sınıfları ve `AppDbContext` eklendi. SQLite bağlantısı ve uygulamaya
`DbContext` kaydı yapılandırıldı. Migration ve veritabanı tabloları henüz
oluşturulmadı. CSV içe aktarma ve DPP endpoint'leri sonraki adımlarda eklenecek.

### Veritabanı yapılandırması

- Bağlantı metni `backend/appsettings.json` içindeki
  `ConnectionStrings:DefaultConnection` ayarında bulunur.
- `Program.cs`, bu ayarı okuyup `AddDbContext<AppDbContext>` ve `UseSqlite`
  ile context'i uygulamaya kaydeder.
- `Data Source=dpp.db`, çalışma dizinine göre SQLite dosyasının yoludur.
  Veritabanıyla ilgili migration ve çalıştırma komutları `backend/` dizininden
  yürütülerek aynı dosyanın kullanılması sağlanmalıdır.
- Yerel veritabanı ve yardımcı dosyaları Git tarafından yok sayılır.
