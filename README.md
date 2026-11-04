# Mini DPP

CSV dosyalarından ürün verilerini içe aktarmak ve dijital ürün pasaportları
üretmek için geliştirilmekte olan uygulama.

## Backend

- .NET 10 / ASP.NET Core Web API
- Entity Framework Core 10.0.14 ve SQLite sağlayıcısı
- CsvHelper 33.1.0

### Geliştirme araçları

`dotnet-ef` 10.0.14, depo kökündeki `dotnet-tools.json` dosyasında yerel
araç olarak tanımlıdır. Depoyu ilk kez indirdikten sonra kök dizinde çalıştırın:

```bash
dotnet tool restore
```

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
`DbContext` kaydı yapılandırıldı. `InitialCreate` migration'ı oluşturuldu.
Veritabanını hazırlamak için aşağıdaki migration uygulama komutunu çalıştırın.
`POST /api/products/import` endpoint'i CSV başlıklarını kontrol eder ve kayıtları
satır numaralarıyla okur. GTIN ve elyaf yüzdelerinin doğrulanması uygulanmıştır;
diğer alanların doğrulanması, veritabanına kayıt ve DPP çıktıları henüz uygulanmadı.

### Veritabanı yapılandırması

- Bağlantı metni `backend/appsettings.json` içindeki
  `ConnectionStrings:DefaultConnection` ayarında bulunur.
- `Program.cs`, bu ayarı okuyup `AddDbContext<AppDbContext>` ve `UseSqlite`
  ile context'i uygulamaya kaydeder.
- `Data Source=dpp.db`, çalışma dizinine göre SQLite dosyasının yoludur.
  Veritabanıyla ilgili migration ve çalıştırma komutları `backend/` dizininden
  yürütülerek aynı dosyanın kullanılması sağlanmalıdır.
- Yerel veritabanı ve yardımcı dosyaları Git tarafından yok sayılır.

### Veritabanını oluşturma veya güncelleme

`InitialCreate` migration'ı, `backend/Migrations/` altında bulunur. Mevcut
migration'ları SQLite veritabanına uygulamak için `backend/` dizininde çalıştırın:

```bash
dotnet ef database update
```

Bu komut, yoksa `dpp.db` dosyasını oluşturur ve uygulanmamış migration'ları
çalıştırır. İlk migration, `ProductModels` ve `Batches` tablolarını, foreign key'i
ve GTIN için benzersiz indeksi oluşturur. EF Core, uygulanan migration'ları
`__EFMigrationsHistory` tablosunda takip eder.

Migration dosyaları, model snapshot'ı ve `dotnet-tools.json` Git'e dahil edilir;
yerel `dpp.db` dosyası dahil edilmez. Depoyu indiren biri, mevcut ilk migration'ı
yeniden oluşturmak yerine `dotnet ef database update` komutunu çalıştırmalıdır.

### Backend'i çalıştırma

`backend/` dizininde çalıştırın:

```bash
dotnet run --launch-profile http
```

HTTP profili varsayılan olarak `http://localhost:5228` adresini kullanır.

### CSV dosyası yükleme

Uygulama çalışırken ikinci bir terminalde, `backend/` dizininden istek gönderin:

```bash
curl -i -F "file=@../urunler_duzeltilmis_test.csv" http://localhost:5228/api/products/import
```

Endpoint, `multipart/form-data` isteğinde `file` alanını kabul eder. CSV'de şu
başlıkların bulunması gerekir:

```text
gtin,model_adi,batch_no,elyaf_pamuk_yuzde,elyaf_elastan_yuzde,uretim_yeri,karbon_kg_co2e
```

Dosya eksikse, boşsa, gerekli başlıkları içermiyorsa veya CSV yapısı
okunamıyorsa HTTP 400 döner. CSV okunabildiğinde HTTP 200 döner. Yanıtta:

- `rowCount`: Okunan toplam veri kaydı sayısı.
- `validCount`: Mevcut GTIN ve elyaf kontrollerini geçen kayıt sayısı.
- `rejectedCount`: Bu kontroller nedeniyle reddedilen kayıt sayısı.
- `rows`: Mevcut kontrolleri geçen kayıtlar.
- `errors`: Hatalı kayıtların `rowNumber` ve `messages` alanları.

Başlık satırı 1. satırdır. Örnek dosyada 5 kayıt okunur; 3 kayıt kontrolleri geçer.
4. satırdaki boş GTIN ve 5. satırdaki yüzde toplamının 98 olması nedeniyle
2 kayıt reddedilir. Bir satırdaki GTIN ve elyaf hataları aynı `messages`
listesinde toplanır. Hatalı satırlar diğer kayıtların işlenmesini durdurmaz.

`Dtos/ProductCsvRow.cs`, CSV sütunlarını C# alanlarına eşler. Sayısal alanlar
dahil bütün CSV değerleri bu aşamada metin olarak tutulur; GTIN'in başındaki
sıfırlar korunur. Veritabanına kayıt yapılmaz. Model adı, batch numarası,
üretim yeri ve karbon değeri henüz doğrulanmadığından mevcut kontrolleri
geçen bir kayıt tüm ödev kurallarını geçmiş sayılmaz.

### GTIN doğrulaması

`Validators/GtinValidator.cs`, GTIN'in boş olmamasını, tam olarak 14 adet
ASCII rakamından (`0`–`9`) oluşmasını ve GS1 kontrol basamağını doğrular.
GTIN metni sayıya dönüştürülmez ve baştaki sıfırlar korunur.

GTIN-14'ün ilk 13 rakamı soldan sırayla 3 ve 1 ile çarpılarak toplanır.
Beklenen son rakam `(10 - toplam % 10) % 10` formülüyle hesaplanır ve
14. rakamla karşılaştırılır. Algoritma, [GS1 kontrol basamağı
açıklamasını](https://www.gs1uk.org/knowledge-hub/standards/what-is-a-check-digit)
temel alır.

### Elyaf yüzdelerinin doğrulanması

`Validators/FiberCompositionValidator.cs`, pamuk ve elastan yüzdelerinin
sayısal olmasını, her birinin 0–100 aralığında kalmasını ve toplamlarının
100 olmasını kontrol eder. Sayı dönüşümlerinde `decimal.TryParse` ve
`InvariantCulture` kullanılır; ondalık ayırıcı noktadır. Binlik ayırıcı kabul
edilmez. Sayı veya aralık hatası varsa toplam kontrolü yapılmaz.
