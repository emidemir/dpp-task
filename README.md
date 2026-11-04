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
- İçe aktarmada model GTIN ile, batch ise bağlı olduğu model ve batch
  numarasıyla eşleştirilir. Olmayan kayıt oluşturulur; mevcut kayıt güncellenir.
  Aynı dosyanın sıralı tekrar yüklemeleri yeni model veya batch satırları üretmez.
- Aynı GTIN için son geçerli CSV satırı model adını ve elyaf yüzdelerini
  belirler. Bu alanlar modelin bütün batch'leri için ortaktır. Mevcut batch'in
  üretim yeri ve karbon değeri güncellenir. Önceki sürümler saklanmaz.

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
satır numaralarıyla okur. GTIN, elyaf yüzdeleri, zorunlu metin alanları ve karbon
değeri doğrulanır. Geçerli satırlar SQLite veritabanına kaydedilir. DPP çıktıları
henüz uygulanmadı.

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
- `validCount`: Alan doğrulamalarını geçen kayıt sayısı.
- `savedCount`: Model ve batch bilgileri kaydedilen geçerli satır sayısı;
  yeni eklenen kayıt sayısı değildir, mevcut kayıtlar da bu sayıya dahildir.
- `rejectedCount`: Bu kontroller nedeniyle reddedilen kayıt sayısı.
- `rows`: Mevcut kontrolleri geçen kayıtlar.
- `errors`: Hatalı kayıtların `rowNumber` ve `messages` alanları.

Başlık satırı 1. satırdır. Örnek dosyada 5 kayıt okunur; 3 kayıt kontrolleri geçer.
4. satırdaki boş GTIN ve 5. satırdaki yüzde toplamının 98 olması nedeniyle
2 kayıt reddedilir. Bir satırdaki bütün alan hataları aynı `messages`
listesinde toplanır. Hatalı satırlar diğer kayıtların işlenmesini durdurmaz.

`Dtos/ProductCsvRow.cs`, CSV sütunlarını C# alanlarına eşler. Sayısal alanlar
dahil bütün CSV değerleri bu aşamada metin olarak tutulur; GTIN'in başındaki
sıfırlar korunur. Doğrulama bittikten sonra geçerli satırlar model ve batch
entity'lerine dönüştürülerek kaydedilir. Metin alanlarının başındaki ve sonundaki
boşluklar temizlenir; GTIN aynen korunur. Sayısal değerler doğrulamayla aynı
`NumberStyles.Float` ve `InvariantCulture` ayarlarıyla `decimal` tipine çevrilir.
Her satırın model ve batch değişiklikleri aynı `SaveChangesAsync` çağrısında
kaydedilir. Yanıt `rows` alanında CSV'den okunan metin değerlerini gösterir.
CSV yapısı okunamazsa HTTP 400 dönülür ve bu yüklemeden kayıt yapılmaz.

Boş bir veritabanında örnek CSV'nin ilk yüklemesi 3 model ve 3 batch oluşturur;
`savedCount: 3` ve `rejectedCount: 2` döner. Aynı CSV tekrar yüklendiğinde
bu sayılar değişmez; mevcut model ve batch'ler kullanılır.

SQLite komut satırı aracı kuruluysa, `backend/` dizininden kayıt sayılarını
kontrol edebilirsiniz:

```bash
sqlite3 dpp.db "SELECT (SELECT COUNT(*) FROM ProductModels) AS models, (SELECT COUNT(*) FROM Batches) AS batches;"
```

Yalnızca örnek CSV yüklendiyse beklenen sonuç `3|3` değeridir. Uygulama yeniden
başlatıldığında kayıtlar korunur.

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

### Zorunlu alanlar ve karbon doğrulaması

`Validators/ProductCsvRowValidator.cs`, satırdaki tüm alan kontrollerini bir
araya getirir. GTIN ve elyaf doğrulayıcılarına ek olarak model adı, batch
numarası ve üretim yerinin boş veya yalnızca boşluklardan oluşmadığını
kontrol eder. Karbon değeri, `InvariantCulture` ile `decimal` olarak
okunabilmeli ve negatif olmamalıdır; sıfır kabul edilir. Geçersiz bir alan,
aynı satırdaki diğer alanların kontrol edilmesini engellemez.

Yeni kontrolleri denemek için, uygulama çalışırken aşağıdaki isteği gönderin.
CSV, terminalden gönderilir; örnek CSV dosyası değiştirilmez:

```bash
curl -i -F "file=@-;filename=validation-test.csv" http://localhost:5228/api/products/import <<'CSV'
gtin,model_adi,batch_no,elyaf_pamuk_yuzde,elyaf_elastan_yuzde,uretim_yeri,karbon_kg_co2e
08690000000012,   ,   ,98,2,   ,abc
08690000000012,Slim Denim 501,B-NEG,98,2,Denizli,-1
08690000000012,Slim Denim 501,B-ZERO,98,2,Denizli,0
CSV
```

Beklenen sonuç: `rowCount: 3`, `validCount: 1`, `rejectedCount: 2`.
2. satırda üç zorunlu alan ve sayısal olmayan karbon için dört hata,
3. satırda negatif karbon için bir hata döner. 4. satırdaki sıfır karbon
değeri kabul edilir ve `B-ZERO` batch'iyle veritabanına kaydedilir. Bu nedenle
bu test de çalıştırıldıysa toplam batch sayısı, yalnızca örnek CSV'nin
yüklendiği durumdan farklı olur.
