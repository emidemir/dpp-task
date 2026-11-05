# Mini DPP

CSV'den ürün verisi alan, geçerli satırları SQLite'a kaydeden ve HTML, JSON-LD,
PNG QR çıktıları üreten dijital ürün pasaportu uygulaması. Bonus olarak önceki
ürün sürümleri saklanır.

**Teknolojiler:** ASP.NET Core / .NET 10, EF Core + SQLite, CsvHelper, QRCoder;
React + TypeScript + Vite, Docker Compose ve Nginx.

## Kurulum ve çalıştırma

### Docker

Docker ve Compose kurulu olmalıdır. Depo kökünde:

```bash
docker compose up --build -d
```

- Arayüz: <http://localhost:5173>
- Doğrudan API: <http://localhost:5228>
- Migration'lar başlangıçta uygulanır. SQLite verisi `backend_data` volume'ünde
  kalır; yerel `backend/dpp.db` dosyasından ayrıdır.
- Portlar isteğe bağlı `.env` dosyasında değiştirilebilir; bkz. [.env.example](.env.example).
- `docker compose down` verileri korur; `docker compose down -v` volume'ü siler.

### Yerel geliştirme

Gereksinimler: .NET 10 SDK, Node.js 24 veya üzeri. Depo kökünden backend'i başlatın:

```bash
dotnet tool restore
cd backend
dotnet ef database update
dotnet run --launch-profile http
```

İkinci terminalde, depo kökünden frontend'i başlatın:

```bash
cd frontend
npm ci
npm run dev
```

Arayüz 5173, backend 5228 portunu kullanır. Vite `/api` ve `/dpp` isteklerini
backend'e iletir. Yerel DB yolu çalışma dizinine bağlıdır; backend komutlarını
`backend/` içinden çalıştırın. Docker ve yerel sunucuları aynı portlarda eşzamanlı açmayın.

## CSV içe aktarma

Arayüzden dosya seçin veya sürükleyip bırakın. Alternatif olarak, depo kökünden:

```bash
curl -i -F "file=@urunler_duzeltilmis_test.csv" http://localhost:5173/api/products/import
```

Endpoint: `POST /api/products/import`; dosya `multipart/form-data` içindeki
`file` alanında gönderilir. Gerekli başlıklar:

```csv
gtin,model_adi,batch_no,elyaf_pamuk_yuzde,elyaf_elastan_yuzde,uretim_yeri,karbon_kg_co2e
```

GTIN 14 rakamlı ve GS1 kontrol basamağı geçerli olmalıdır. Elyaf yüzdeleri ayrı
ayrı 0–100, toplamları 100; karbon sayısal ve sıfır veya pozitif olmalıdır.
Model adı, batch numarası ve üretim yeri zorunludur. Ondalık ayırıcı noktadır;
GTIN'leri korumak için CSV'yi Excel'de yeniden kaydetmeyin.

Örnek dosyanın sonucu **5 satır, 3 kabul, 2 ret**: 4. satırda GTIN boş,
5. satırda elyaf toplamı 98'dir. Okunabilir dosyalarda geçerli satırlar kaydedilir;
hatalar `errors` içinde satır numarası ve nedenleriyle döner. Başlık 1. satırdır.
`savedCount`, değişmeyenler dahil geçerli satır sayısıdır. Dosya/başlık veya
okunamayan CSV yapısı hatalarında HTTP 400 döner.

## Örnek URL'ler

Örnek CSV yüklendikten sonra:

| Çıktı | URL |
| --- | --- |
| HTML | <http://localhost:5173/dpp/08690000000012> |
| Yetkili HTML | <http://localhost:5173/dpp/08690000000012?rol=yetkili> |
| JSON-LD | <http://localhost:5173/dpp/08690000000012.jsonld> |
| Yetkili JSON-LD | <http://localhost:5173/dpp/08690000000012.jsonld?rol=yetkili> |
| PNG QR | <http://localhost:5173/dpp/08690000000012/qr.png> |

Aynı yollar doğrudan backend'in 5228 portunda da kullanılabilir.

## Tasarım varsayımları

- GTIN metin ve benzersizdir. Bir `ProductModel`, GTIN ile tanımlanan ürün tipini;
  ona bağlı birden fazla `Batch`, üretim partilerini temsil eder. Ad ve elyaf
  modelde, üretim yeri ve karbon batch'te tutulur.
- Import, ürünü GTIN; batch'i ürün + batch numarasıyla eşleştirir. Olmayanı ekler,
  mevcut olanı günceller. Aynı GTIN için son geçerli satır ortak model alanlarını
  belirler; import batch silmez.
- Karbon varsayılan HTML/JSON-LD'de bulunmaz; yalnızca `rol=yetkili` ile görünür.
  Bu demo parametresidir, kullanıcı hesabı/JWT ile yetkilendirme değildir.
- Bonus: gerçek değişiklikten önce model ve bütün batch'lerin JSON kopyası,
  ürün bazında sürüm numarası ve UTC güncelleme zamanı saklanır. Değişmeyen
  satır yeni sürüm üretmez. Eski sürüm ve güncel değişiklik aynı kaydetme
  işleminde yazılır; bütün CSV tek transaction değildir.
- QR, tüketici HTML pasaportunun URL'sini taşır ve istek sırasında üretilir.
  Telefonda denemek için `localhost` yerine bilgisayarın erişilebilir ağ adresiyle üretin.

## Testler ve ek örnekler

Backend testleri Python 3, .NET SDK ve yukarıdaki yerel EF aracını gerektirir;
ayrı bir geçici DB kullanır. Depo kökünden:

```bash
python3 tests/test_backend.py
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Backend'de 14 entegrasyon testi, frontend'de alt senaryolar dahil 18 istemci testi
bulunur. Bonus için [01–06 CSV senaryoları ve beklenen sonuçlar](examples/bonus/README.md),
arayüz ayrıntıları için [frontend rehberi](frontend/README.md) kullanılabilir.
