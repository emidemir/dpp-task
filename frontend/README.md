# Mini DPP frontend

React + TypeScript + Vite ile hazırlanmış Türkçe CSV içe aktarma ekranı.
Ek UI, router veya HTTP istemci paketi kullanılmaz.

## Yerel geliştirme

Node.js 24 veya daha yeni bir sürüm kullanın. Backend, `http://localhost:5228`
adresinde çalışmalı ve migration'ları uygulanmış olmalıdır. Backend kurulumu
için kökteki [README](../README.md) dosyasına bakın.

`frontend/` dizininde:

```bash
npm ci
npm run dev
```

Uygulama `http://localhost:5173` adresinde açılır. Vite `/api` ve `/dpp`
isteklerini backend'e iletir. Port doluysa başka porta sessizce geçmez.
Farklı bir backend adresi için:

```bash
API_PROXY_TARGET=http://127.0.0.1:5230 npm run dev
```

Bu değişken Vite yapılandırması içindir; tarayıcıya gizli bir anahtar aktarılmaz.
Docker'da yönlendirmeyi `nginx.conf` yapar; bu ayarı değiştirmek gerekmez.

## Ekranın davranışı

- CSV seçme veya sürükleyip bırakma, boş dosya kontrolü ve örnek CSV indirme.
- Gerçek `POST /api/products/import` çağrısı; yükleme sürerken tekrar gönderim engellenir.
- Okunan/kabul edilen/reddedilen satır sayıları; kısmi başarı ve yalnızca başlık durumu.
- CSV satır numaralarıyla bütün doğrulama hataları.
- Kabul edilen satırların GTIN'e göre gruplandığı HTML, JSON-LD ve QR bağlantıları.
  Parti sayısı yalnızca o yüklemede gelen farklı batch numaralarını gösterir.
- Tüketici/yetkili seçimi HTML ve JSON-LD bağlantılarını değiştirir. Yetkili modu
  demo amaçlıdır; giriş sistemi değildir. QR her zaman tüketici pasaportuna gider.
- Daha önce kaydedilmiş bir ürünü, 14 haneli GTIN ile doğrudan açma.
- Sunucu, dosya boyutu ve beklenmedik yanıt hataları için açıklayıcı mesajlar.

Sonuç ekranı son yüklemeye aittir; genel ürün kataloğu değildir. Sayfa yenilenince
ekrandaki rapor sıfırlanır, backend'deki veriler korunur. Pasaport bul alanı ve
doğrudan `/dpp/{gtin}` adresleri kayıtlı veriye erişmeye devam eder.

İndirilen `public/ornek-urunler.csv`, kökteki ödev CSV'sinin kopyasıdır. Test,
iki dosyanın aynı kaldığını doğrular. Beklenen sonuç 5 satırdan 3 kabul, 2 ret;
hata satırları 4 ve 5'tir.

## Kontroller

`frontend/` dizininde:

```bash
npm run lint
npm test
npm run build
```

Node'un yerleşik test çalıştırıcısı kullanılır. Alt senaryolar dahil 18 test;
multipart yükleme, kısmi başarı, hatalı API yanıtı, HTTP 400/413/502, bağlantı
hatası, istek iptali, rol bağlantıları ve örnek dosya eşitliğini kapsar.

`npm run build`, TypeScript kontrolü yapıp `dist/` üretir. `npm run preview`,
derlenmiş çıktıyı yerel olarak açar; backend proxy'si bu modda da tanımlıdır.

## Dosyalar

- `src/App.tsx`: dosya seçimi, rapor ve pasaport açma akışları.
- `src/api/products.ts`: API tipleri, yanıt doğrulaması ve URL oluşturma.
- `src/components/Icon.tsx`: yerel SVG ikonları.
- `src/App.css`, `src/index.css`: responsive ekran ve temel stiller.
- `tests/products.test.mjs`: ek test paketi gerektirmeyen API istemcisi testleri.

Docker ile iki servisi birlikte başlatmak için depo kökünde:

```bash
docker compose up --build -d
```
