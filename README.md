# Mini DPP

CSV dosyalarından ürün verilerini içe aktarmak ve dijital ürün pasaportları
üretmek için geliştirilmekte olan uygulama.

Bonus sürüm geçmişini denemek için [örnek CSV senaryolarını](examples/bonus/README.md)
01–06 sırasıyla yükleyebilirsiniz. Her adımın beklenen API ve geçmiş sonuçları
aynı rehberde açıklanmıştır.

## Docker ile çalıştırma

Docker Desktop ve Docker Compose hazırken depo kökünde çalıştırın:

```bash
docker compose config --quiet
docker compose up --build -d
```

İlk komut Compose yapılandırmasını doğrular. İkinci komut backend ve frontend
image'larını derler ve container'ları arka planda başlatır. Bilgisayarda ayrıca
.NET veya Node.js kurulması gerekmez; derleme Docker içinde yapılır.

- Frontend: <http://localhost:5173>
- Doğrudan backend: <http://localhost:5228>
- Frontend üzerinden API: `http://localhost:5173/api/products/import`
- Frontend üzerinden pasaport: `http://localhost:5173/dpp/{gtin}`

Frontend, CSV yükleme ve sonuç ekranını sunar. Bu kurulum derlenmiş dosyaları sunar;
kod değişikliklerinden sonra aynı `docker compose up --build -d` komutu gerekir.

### Container'ların görevleri

- `backend/Dockerfile`: .NET 10 SDK ile uygulamayı derler, yalnızca yayın
  çıktısını ASP.NET Core runtime image'ına kopyalar. Uygulama root olmayan
  kullanıcıyla, container içinde 8080 portunda çalışır.
- `frontend/Dockerfile`: Node.js 24 ile `npm ci` ve `npm run build` çalıştırır;
  oluşan `dist` dosyalarını Nginx ile container içinde 80 portunda sunar.
- `frontend/nginx.conf`: `/api/` ve `/dpp/` isteklerini Compose ağındaki
  `backend:8080` adresine iletir. Frontend kodu `/api/products/import` gibi
  göreli URL'ler kullanabilir. İsteklerin dışarıdan kullanılan host ve portu
  korunduğu için QR adresine container'ın servis adı yazılmaz. Nginx üzerinden
  istek gövdesi sınırı 10 MB'dır.
- `.dockerignore` dosyaları yerel bağımlılıkları, derleme çıktılarını, ortam
  dosyalarını ve SQLite dosyalarını build context'inden çıkarır.

Portlar için `.env` dosyasına isteğe bağlı `BACKEND_PORT` ve `FRONTEND_PORT`
değerleri yazılabilir; örnekler `.env.example` içindedir. Dosya boşsa yukarıdaki
varsayılan portlar kullanılır. Yerel backend veya Vite sunucusu aynı portta
çalışıyorsa önce onu durdurun veya Docker portlarını değiştirin.

### SQLite ve migration'lar

Compose, `ConnectionStrings__DefaultConnection` ayarını
`Data Source=/app/data/dpp.db` yapar. Bu dizin `backend_data` adlı kalıcı
volume'e bağlıdır. Docker'daki veritabanı yerel `backend/dpp.db` dosyasından
ayrıdır; ilk çalıştırmada boş olur.

`Database__MigrateOnStartup=true`, `Program.cs` içindeki başlangıç adımını
etkinleştirir: HTTP sunucusu açılmadan önce mevcut EF migration'ları uygulanır.
Bu, tek backend container'lı demo kurulumunda ilk açılışı kolaylaştırır;
container içinde ayrıca `dotnet ef` çalıştırmak gerekmez. Yerel çalıştırmada
bu ayar varsayılan olarak kapalıdır ve mevcut `dotnet ef database update`
akışı geçerlidir.

Docker hazır olduktan sonra, depo kökünden örnek veriyi yükleyin:

```bash
curl -i -F "file=@urunler_duzeltilmis_test.csv" http://localhost:5173/api/products/import
```

Beklenen sonuç `savedCount: 3`, `rejectedCount: 2` değerleridir. Ardından açın:

```text
http://localhost:5173/dpp/08690000000012
http://localhost:5173/dpp/08690000000012.jsonld?rol=yetkili
http://localhost:5173/dpp/08690000000012/qr.png
```

Container durumunu ve kayıtlarını görmek için:

```bash
docker compose ps
docker compose logs -f backend frontend
```

Durdurmak için:

```bash
docker compose down
```

Bu komut SQLite volume'ünü korur. `docker compose down -v` ise volume'ü ve
içindeki ürün/sürüm verilerini siler.

## Frontend

React + TypeScript ekranı CSV seçme/sürükleyip bırakma, örnek dosya indirme,
kabul/ret özeti, satır bazında hata listesi ve ürün pasaportu bağlantılarını içerir.
Tüketici/yetkili seçimi HTML ve JSON-LD bağlantılarına uygulanır; QR bağlantısı
tüketici görünümünde kalır. Kayıtlı bir ürün GTIN ile doğrudan açılabilir.

Backend `http://localhost:5228` adresinde çalışırken, `frontend/` dizininde:

```bash
npm ci
npm run dev
```

Node.js 24 veya daha yeni bir sürüm önerilir. Arayüz `http://localhost:5173`
adresindedir. Vite geliştirme ve preview sunucuları `/api` ve `/dpp` isteklerini
backend'e iletir; Docker'da bu işi Nginx yapar. Ekrandaki rapor son yüklemeye
aittir; sayfa yenilenince rapor sıfırlanır, veritabanındaki kayıtlar korunur.

Frontend kontrolleri, `frontend/` dizininden:

```bash
npm run lint
npm test
npm run build
```

Alt senaryolar dahil 18 istemci testi bulunur. Ayrıntılar ve dosya haritası
[frontend/README.md](frontend/README.md) içindedir. Backend'i anlamak ve mülakata
hazırlanmak için [BACKEND_REHBERI.md](BACKEND_REHBERI.md) dosyasını okuyun.

## Backend

- .NET 10 / ASP.NET Core Web API
- Entity Framework Core 10.0.14 ve SQLite sağlayıcısı
- CsvHelper 33.1.0
- QRCoder 1.8.1

### Geliştirme araçları

`dotnet-ef` 10.0.14, depo kökündeki `dotnet-tools.json` dosyasında yerel
araç olarak tanımlıdır. Depoyu ilk kez indirdikten sonra kök dizinde çalıştırın:

```bash
dotnet tool restore
```

### Veri modeli

- `ProductModel`: GTIN, model adı ve elyaf yüzdeleri.
- `Batch`: batch numarası, üretim yeri ve karbon değeri.
- `ProductVersion`: önceki ürün durumu için sürüm numarası, değişiklik
  zamanı ve JSON kopyası. Mevcut ürünün bilgileri değişmeden önce oluşturulur.
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
  üretim yeri ve karbon değeri güncellenir. Mevcut ürünün durumu değişiyorsa
  önceki model ve bütün batch bilgileri sürüm geçmişine kaydedilir.

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
değeri doğrulanır. Geçerli satırlar SQLite veritabanına kaydedilir.
`GET /dpp/{gtin}` HTML ürün pasaportunu, `GET /dpp/{gtin}.jsonld` JSON-LD
çıktısını sunar. Her iki çıktıda `?rol=yetkili` ile karbon değeri gösterilir.
`GET /dpp/{gtin}/qr.png`, tüketici HTML pasaportuna yönlendiren PNG QR kodu
üretir. Bonus sürüm geçmişi, içe aktarmadaki gerçek değişiklikleri kaydeder;
güncel değerlerle aynı satırların tekrar yüklenmesi yeni sürüm oluşturmaz.
Frontend CSV yükleme, raporlama ve pasaport açma akışlarını sunar.

### Kapsam notu

- Kullanıcı hesabı ve JWT entegrasyonu ödev kapsamında beklenmiyor.
  `?rol=yetkili`, demo amaçlı görünürlük parametresidir.

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

`AddProductVersionHistory` migration'ı ise `ProductVersions` tablosunu,
ürün ilişkisini ve `(ProductModelId, VersionNumber)` benzersiz indeksini
ekler. Aynı `dotnet ef database update` komutu, bu migration'ı da uygular;
mevcut ürün ve batch kayıtları korunur.

Migration dosyaları, model snapshot'ı ve `dotnet-tools.json` Git'e dahil edilir;
yerel `dpp.db` dosyası dahil edilmez. Depoyu indiren biri, mevcut ilk migration'ı
yeniden oluşturmak yerine `dotnet ef database update` komutunu çalıştırmalıdır.

### Backend'i çalıştırma

`backend/` dizininde çalıştırın:

```bash
dotnet run --launch-profile http
```

HTTP profili varsayılan olarak `http://localhost:5228` adresini kullanır.

### Otomatik backend testleri

Depo kökünde çalıştırın:

```bash
python3 tests/test_backend.py
```

Test dosyası Python 3'ün standart `unittest` kütüphanesini kullanır; ek Python
paketi gerektirmez. .NET 10 SDK ve yukarıda açıklanan yerel `dotnet-ef` aracı
hazır olmalıdır. Test çalıştırıcısı macOS/Linux içindir.

Testler backend kaynaklarını geçici bir dizine kopyalar, derler ve gerçek EF
migration'larını ayrı bir SQLite veritabanına uygular. Geçici sunucu boş bir
yerel portta başlatılır; gerçek HTTP istekleri ve veritabanı sorgularıyla kontrol
edilir. Her test boş veriyle başlar. Mevcut `backend/dpp.db` kullanılmaz; test
sunucusu ve geçici dosyalar çalışma sonunda temizlenir. Backend'i ayrıca
başlatmanız gerekmez.

14 test yöntemi, alt senaryolarıyla birlikte şunları kapsar:

- Örnek CSV: 5 satırdan 3 kabul, 2 ret; hata satırları 4 ve 5.
- GTIN, elyaf, zorunlu alan ve karbon kuralları; aynı satırdaki bütün hatalar.
- Eksik/boş dosya, yanlış başlık, yalnızca başlık içeren dosya ve bozuk CSV.
- Eksik/fazla sütunlu satırların reddedilip diğer geçerli satırların kaydedilmesi.
- Tekrar yüklemede kayıtların çoğalmaması; sıfır ve sınır değerlerinin kabulü.
- HTML ve JSON-LD içerikleri, baştaki sıfırlar, rol ayrımı ve HTTP 404 yanıtları.
- QR yanıtının PNG imzası, boyutları, CRC kontrolleri, sıkıştırılmış görüntü verisi
  ve HTML indirme bağlantısı. QR içindeki adresin kamerayla/decoder ile okunması
  bu otomatik testin kapsamına dahil değildir.
- Güncellemede eski durumun, artan sürüm numarasının ve UTC zamanının saklanması;
  aynı değerlerin tekrar yüklenmesinde yeni sürüm oluşturulmaması.
- Çoklu batch, Türkçe karakterler, tırnaklı CSV alanları ve HTML escaping.

Başarılı çalışmanın sonunda `Ran 14 tests` ve `OK` görülür. Bir kontrol
başarısızsa komut sıfırdan farklı çıkış koduyla tamamlanır.

### Bonus sürüm geçmişi

`Models/ProductVersion.cs`, bir ürünün güncellenmeden önceki durumunu saklamak
için eklendi. Her geçmiş kaydı bir `ProductModel` kaydına bağlıdır.

- `VersionNumber`: Saklanan önceki durumun sürüm numarası.
- `ChangedAtUtc`: Bu durumu değiştiren güncellemenin UTC zamanı. Eski durumun
  ilk oluşturulma tarihi değildir.
- `SnapshotJson`: Model bilgileri ve bütün batch'lerinin değişiklik öncesi
  değerlerini içeren JSON metni. Güncel batch kayıtları değiştiğinde geçmiş
  kopyası değişmez.

Ürün kimliği ve sürüm numarası birlikte benzersiz olacak şekilde
yapılandırılmıştır. Farklı ürünler aynı sürüm numarasına sahip olabilir.
Mevcut tabloların alanları değiştirilmez; `AddProductVersionHistory` migration'ı
yeni `ProductVersions` tablosunu ve ilişkisini oluşturur. Uygulamak için
`backend/` dizininden `dotnet ef database update` çalıştırılır. Bu aşamada
tablo hazırlandıktan sonra aşağıdaki kayıt mantığı kullanılabilir.

`ProductsController.SaveRowAsync`, doğrulanmış satırdaki sayıları `decimal`
tipine çevirir ve metinlerin başındaki/sonundaki boşlukları temizler. Mevcut
model alanlarını ve ilgili batch'i gelen değerlerle karşılaştırır:

- İlk kez oluşturulan ürünün saklanacak önceki durumu yoktur; geçmiş kaydı yazılmaz.
- Mevcut üründe model adı, elyaf yüzdeleri, üretim yeri veya karbon değişiyorsa
  değişiklik öncesi durum saklanır. Mevcut ürüne yeni batch eklenmesi de değişikliktir.
- Aynı değerler tekrar gelirse `SaveChangesAsync` çağrısı ve geçmiş kaydı atlanır.
  `12.4` ve `12.40` gibi aynı sayıyı ifade eden metinler değişiklik sayılmaz.
- İlk değişiklikte önceki durum `VersionNumber: 1` ile, sonraki değişikliklerde
  2, 3, ... numaralarıyla saklanır. Güncel durumun sürümü, geçmişteki en büyük
  sürüm numarasının bir fazlasıdır; geçmiş yoksa güncel sürüm 1 kabul edilir.
- Aynı yüklemede aynı ürünü değiştiren birden fazla geçerli satır varsa her
  satır ayrı bir değişiklik olarak işlenir.

`AddPreviousVersionAsync`, yalnızca gereken değerleri seçerek JSON üretir;
entity ilişkileri ve önceki sürümler JSON'a eklenmez. Eski durum kopyası ve
güncel model/batch değişiklikleri aynı `SaveChangesAsync` çağrısıyla, EF Core'un
transaction'ı içinde birlikte kaydedilir.

#### Sürüm geçmişini kontrol etme

Uygulamayı yeniden başlattıktan sonra aynı örnek CSV'yi tekrar yüklemek,
veritabanındaki değerler zaten aynıysa geçmiş sayısını artırmamalıdır.
`backend/` dizininden mevcut sayıyı kontrol edebilirsiniz:

```bash
sqlite3 dpp.db "SELECT COUNT(*) FROM ProductVersions;"
```

Örnek CSV yüklenmişken aşağıdaki istek `B2027-01` karbon değerini 12.4'ten
13.4'e değiştirir. Önceki durumun JSON kopyasında 12.4 korunmalıdır:

```bash
curl -i -F "file=@-;filename=version-test.csv" http://localhost:5228/api/products/import <<'CSV'
gtin,model_adi,batch_no,elyaf_pamuk_yuzde,elyaf_elastan_yuzde,uretim_yeri,karbon_kg_co2e
08690000000012,Slim Denim 501,B2027-01,98,2,Denizli,13.4
CSV
```

Bu isteği aynı içerikle tekrar göndermek ek geçmiş kaydı oluşturmamalıdır.
Saklanan eski durumları görmek için:

```bash
sqlite3 -header -column dpp.db "SELECT VersionNumber, ChangedAtUtc, SnapshotJson FROM ProductVersions WHERE ProductModelId = (SELECT Id FROM ProductModels WHERE Gtin = '08690000000012') ORDER BY VersionNumber;"
```

Bu test güncel karbon değerini 13.4 yapar. Örnek CSV'yi yeniden yükleyerek
12.4'e dönmek de gerçek bir değişikliktir ve bir geçmiş kaydı daha oluşturur.

### HTML ürün pasaportu

Örnek CSV içe aktarıldıktan sonra tarayıcıda açın:

```text
http://localhost:5228/dpp/08690000000012
```

`Controllers/DppController.cs`, GTIN ile modeli ve bağlı bütün batch'leri
okur. Model bulunamazsa HTTP 404 döner. `Views/Dpp/Details.cshtml`, Razor
şablonuyla model adını, GTIN'i, elyaf yüzdelerini ve batch/üretim yeri
bilgilerini HTML olarak sunar. Birden fazla batch varsa hepsi listelenir.
Karbon alanı bu tüketici görünümünün HTML çıktısında bulunmaz.

View desteği `Program.cs` içinde `AddControllersWithViews` ile etkinleştirilir.
HTML için veritabanı şemasında değişiklik veya ek NuGet paketi gerekmez.

### JSON-LD ürün pasaportu

Örnek ürünün makine tarafından okunabilir çıktısı:

```text
http://localhost:5228/dpp/08690000000012.jsonld
```

Yanıtı HTTP başlıklarıyla kontrol etmek için:

```bash
curl -i http://localhost:5228/dpp/08690000000012.jsonld
```

Başarılı yanıtın içerik türü `application/ld+json` olur. Ürün bulunamazsa
HTTP 404 döner. HTML ve JSON-LD aynı `FindProductAsync` sorgusunu kullanır.
HTML pasaportunda JSON-LD çıktısına bağlantı bulunur.

Çıktı, [schema.org/Product](https://schema.org/Product) yapısını temel alır:

- `@context`: `https://schema.org` sözlüğünü belirtir.
- `@type`: `Product`.
- `gtin14`: GTIN metni; baştaki sıfırlar korunur.
- `name`: Ürün modelinin adı.
- `additionalProperty`: Elyaf yüzdeleri ve bütün batch'lerin bilgileri.

Ek özellikler [PropertyValue](https://schema.org/PropertyValue) nesneleriyle
sunulur. Elyaf yüzdelerinin değerleri JSON sayısıdır ve `unitText` alanları
`%` değerindedir. Her batch'in `batch_no` özelliğinin `valueReference` alanı,
o batch'in `uretim_yeri` özelliğini içerir; böylece parti ve üretim yeri
ilişkisi korunur. Karbon alanı bu tüketici çıktısında bulunmaz.

### Demo rol görünürlüğü

Varsayılan tüketici görünümünde karbon alanı hem HTML'den hem JSON-LD'den
tamamen çıkarılır. Karbon değeri yalnızca `rol` sorgu parametresinin değeri
tam olarak `yetkili` olduğunda gösterilir. Parametre eksikse, boşsa veya
başka bir değerse tüketici görünümü kullanılır.

Örnek URL'ler:

```text
http://localhost:5228/dpp/08690000000012
http://localhost:5228/dpp/08690000000012?rol=yetkili
http://localhost:5228/dpp/08690000000012.jsonld
http://localhost:5228/dpp/08690000000012.jsonld?rol=yetkili
```

`DppController.ShouldShowCarbon`, her iki çıktının kullandığı ortak karardır.
HTML şablonuna `ViewData["ShowCarbon"]` ile aktarılır. Yetkili HTML sayfasında
her batch için karbon sütunu eklenir. JSON-LD'de ilgili batch'in
`valueReference` listesine `karbon_kg_co2e` adlı `PropertyValue` eklenir;
değeri JSON sayısı, birimi `kg CO2e` olur. Sıfır karbon da gösterilir.
HTML sayfasındaki JSON-LD bağlantısı seçili görünümü korur.

Örnek CSV'deki `B2027-01` batch'i için yetkili çıktılarında 12.4 değeri,
tüketici çıktılarında ise karbon alanının hiç bulunmaması beklenir. Bu ayrım
ödevin istediği demo davranışıdır; kullanıcı hesabı veya JWT doğrulaması değildir.

### PNG QR kod

Örnek ürünün QR görselini tarayıcıda açın:

```text
http://localhost:5228/dpp/08690000000012/qr.png
```

Endpoint, ürünün kayıtlı olduğunu kontrol eder; bulunamazsa HTTP 404 döner.
Kayıtlı ürün için `image/png` içerik türüyle PNG baytlarını döndürür. Görsel
QRCoder'ın `PngByteQRCode` renderer'ı ile istek sırasında bellekte üretilir;
veritabanı şeması değiştirilmez ve PNG dosyası sunucuda kalıcı olarak saklanmaz.
HTML ürün pasaportunda QR görseli ve PNG indirme bağlantısı bulunur.

QR, `Url.ActionLink` ile oluşturulan mutlak HTML pasaport adresini içerir.
HTTP/HTTPS, sunucu ve port bilgileri QR isteğinden alınır. `rol=yetkili`
parametresi QR hedefine eklenmez; QR varsayılan tüketici görünümüne yönlendirir.

Yanıt başlıklarını görseli terminale yazdırmadan kontrol etmek için:

```bash
curl -sS -D - -o /dev/null http://localhost:5228/dpp/08690000000012/qr.png
```

Beklenen sonuç HTTP 200 ve `Content-Type: image/png` başlığıdır. QR çözüldüğünde
bu örnekte `http://localhost:5228/dpp/08690000000012` adresi görülmelidir.

Telefonda `localhost`, bilgisayarı değil telefonun kendisini ifade eder.
Telefondan açılışı denemek için sunucu ağdan erişilebilir şekilde çalışmalı ve
QR görseli bilgisayarın yerel ağ IP adresi üzerinden alınmalıdır; böylece QR
hedefine de bu adres yazılır.

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
  yeni eklenen kayıt sayısı değildir. Mevcut değerleriyle aynı olduğundan
  yeniden yazılmayan geçerli satırlar da bu sayıya dahildir.
- `rejectedCount`: Bu kontroller nedeniyle reddedilen kayıt sayısı.
- `rows`: Mevcut kontrolleri geçen kayıtlar.
- `errors`: Hatalı kayıtların `rowNumber` ve `messages` alanları.

Başlık satırı 1. satırdır. Örnek dosyada 5 kayıt okunur; 3 kayıt kontrolleri geçer.
4. satırdaki boş GTIN ve 5. satırdaki yüzde toplamının 98 olması nedeniyle
2 kayıt reddedilir. Bir satırdaki bütün alan hataları aynı `messages`
listesinde toplanır. Hatalı satırlar diğer kayıtların işlenmesini durdurmaz.
Bir veri satırının sütun sayısı başlıkla uyuşmuyorsa beklenen ve bulunan sütun
sayılarıyla satır hatası döner; diğer satırların işlenmesi devam eder.

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
