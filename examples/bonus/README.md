# Bonus sürüm geçmişini deneme

CSV dosyalarını frontend'den **01 → 06 sırasıyla, birer kez** yükleyin. Aşağıdaki
beklentiler, bu GTIN'lerin veritabanında daha önce bulunmadığı ilk çalıştırma içindir.
Ödevin orijinal CSV'sindeki ürünlerden farklı kimlikler kullanılır; mevcut örnek
ürünleri silmeniz gerekmez.

| Test ürünü | GTIN |
| --- | --- |
| A | `99000000010010` |
| B | `99000000010027` |
| C | `99000000010034` |

Bunlar test için oluşturulmuş, 14 rakamlı ve kontrol basamağı geçerli GTIN'lerdir;
gerçek ürünlere tahsis edildikleri iddia edilmez. Baştaki sıfırları ve sayısal
metinleri korumak için CSV'leri Excel'de açıp yeniden kaydetmeyin.

## Her yüklemeden sonra beklenen sonuç

“A geçmişi” ve “B geçmişi”, ilgili ürünün `ProductVersions` tablosundaki kayıt
sayısıdır. Tablodaki `savedCount`, API'nin kabul ettiği geçerli satır sayısıdır;
aynı değer nedeniyle DB yazması atlanan satırlar da buna dahildir.

| Dosya | savedCount | rejectedCount | A geçmişi | B geçmişi | Denenen davranış |
| --- | ---: | ---: | ---: | ---: | --- |
| `01-ilk-kayit.csv` | 2 | 0 | 0 | 0 | İki yeni ürün ve iki batch; önceki durum olmadığı için geçmiş yok. |
| `02-ayni-degerler.csv` | 2 | 0 | 0 | 0 | Kenar boşlukları ve eşdeğer ondalık yazımları gerçek değişiklik sayılmaz. |
| `03-karbon-guncelleme.csv` | 2 | 0 | 1 | 0 | A'nın karbonu 8.4 → 9.4; B aynı kalır. |
| `04-yeni-batch.csv` | 1 | 0 | 2 | 0 | A'ya ikinci batch eklenir; önceki tek batch'li durum saklanır. |
| `05-model-ve-ikinci-urun-guncelleme.csv` | 2 | 0 | 3 | 1 | A'nın adı ve elyafı, B'nin karbonu değişir. Sürüm sayacı ürün bazındadır. |
| `06-hatali-ve-gecerli-satirlar.csv` | 1 | 2 | 3 | 1 | Hatalı A/B satırları durumu ve geçmişi değiştirmez; C kaydedilir. |

### 01 — İlk kayıt

A'nın karbonu 8.4, elyafı %98 pamuk / %2 elastan. B'nin karbonu 6.2,
elyafı %100 pamuk / %0 elastandır. Her ürünün bir batch'i bulunur.
Geçmiş tablosuna kayıt eklenmemesi beklenen davranıştır.

### 02 — Aynı değerler

A'nın metinlerinde kenar boşlukları var; sayılar `98.0`, `2.00`, `8.40`
biçiminde yazılı. Normalize edilince 01 ile aynı durum oluşur. Ne ürün/batch
çoğalır ne de geçmiş oluşur. Bu dosyayı 01'in hemen ardından deneyin.

### 03 — Gerçek güncelleme

A'nın `BONUS-A-01` karbonu 9.4 olur. İlk geçmiş satırının `VersionNumber`
değeri 1, snapshot'taki eski karbon 8.4 olmalıdır. `ChangedAtUtc` güncelleme
zamanıdır. B için hâlâ geçmiş yoktur.

İsterseniz **bu aşamada 03'ü hemen bir kez daha yükleyin**: A'nın geçmişi 1'de
kalmalıdır. Aynı isteğin yeni sürüm oluşturmadığını böyle kontrol edebilirsiniz.

### 04 — Yeni batch

A artık iki partiye sahiptir:

- `BONUS-A-01`: Denizli, karbon 9.4.
- `BONUS-A-02`: Bursa, karbon 10.2.

Eklenen A sürüm 2 snapshot'ında **yalnızca eski batch** bulunmalı ve karbonu
9.4 olmalıdır. Yeni batch, değişiklik öncesinde henüz yoktu.

### 05 — Ortak model alanları ve ikinci ürünün ilk sürümü

A'nın adı `Bonus Denim A Revize`, elyafı %97 pamuk / %3 elastan olur. Bunlar
model alanı olduğu için iki batch'in ortak pasaport bilgisini değiştirir.

A sürüm 3 snapshot'ında eski ad `Bonus Denim A`, eski elyaf %98/%2 ve **iki
batch'in de** önceki verileri bulunmalıdır. Geçmişin yalnızca güncellenen batch'i
değil, ürünün bütün batch'lerini sakladığını kontrol edin.

B'nin karbonu 6.2 → 7.2 olur. B'nin ilk geçmiş kaydı sürüm 1'dir; A'da sürüm 3
oluştu diye B'de sürüm 4'e atlamamalıdır.

### 06 — Hatalı kayıtların etkisiz kalması

- CSV satırı **2**: A'nın elyaf toplamı 95 + 3 = 98; reddedilir.
- CSV satırı **3**: B'nin karbonu -1; reddedilir.
- CSV satırı **4**: C geçerlidir; sıfır karbonla kaydedilir.

A/B için verilen “Kaydedilmemesi Gereken” adları, Ankara üretim yeri ve karbon
değişiklikleri kaydedilmemelidir. Geçmiş sayıları da değişmemelidir.

## Pasaporttan güncel durumu kontrol etme

Varsayılan frontend portunda, 06 sonrasında:

```text
http://localhost:5173/dpp/99000000010010?rol=yetkili
http://localhost:5173/dpp/99000000010027.jsonld?rol=yetkili
http://localhost:5173/dpp/99000000010034?rol=yetkili
```

Yerel backend'e doğrudan erişirken port 5228'dir. Portları değiştirdiyseniz
URL'leri buna göre uyarlayın. A'nın iki batch'i ve revize adı, B'nin 7.2 karbonu,
C'nin 0 karbonu görülmelidir. Tüketici görünümünde karbon alanı bulunmamalıdır.

**Pasaport güncel durumu gösterir.** Bonusun eski durumu gerçekten sakladığını
kanıtlamak için `ProductVersions` tablosunu da inceleyin; geçmişi gösteren bir
HTTP endpoint'i henüz yoktur.

## Yerel SQLite'ta geçmişi kontrol etme

Bu bölüm `backend/dpp.db` kullanan **yerel backend** içindir. Depo kökünden,
sqlite3 kuruluysa:

```bash
sqlite3 -readonly -header -column backend/dpp.db "SELECT m.Gtin, COUNT(v.Id) AS GecmisKaydi, COALESCE(MAX(v.VersionNumber), 0) + 1 AS GuncelSurum FROM ProductModels m LEFT JOIN ProductVersions v ON v.ProductModelId = m.Id WHERE m.Gtin IN ('99000000010010', '99000000010027', '99000000010034') GROUP BY m.Id, m.Gtin ORDER BY m.Gtin;"
```

06 sonrasında, senaryo ilk kez ve sırayla çalıştırıldıysa:

```text
Gtin            GecmisKaydi  GuncelSurum
99000000010010  3            4
99000000010027  1            2
99000000010034  0            1
```

`GuncelSurum` sorguda hesaplanır; ürün tablosunda böyle bir sütun yoktur.
Eski JSON kopyalarını görmek için:

```bash
sqlite3 -readonly backend/dpp.db "SELECT m.Gtin, v.VersionNumber, v.ChangedAtUtc, v.SnapshotJson FROM ProductVersions v JOIN ProductModels m ON m.Id = v.ProductModelId WHERE m.Gtin IN ('99000000010010', '99000000010027', '99000000010034') ORDER BY m.Gtin, v.VersionNumber;"
```

Beklenen eski durumlar:

| Ürün | Saklanan sürüm | Eski ad / elyaf | Snapshot'taki batch ve karbon |
| --- | ---: | --- | --- |
| A | 1 | Bonus Denim A, %98/%2 | A-01: 8.4 |
| A | 2 | Bonus Denim A, %98/%2 | A-01: 9.4 |
| A | 3 | Bonus Denim A, %98/%2 | A-01: 9.4, A-02: 10.2 |
| B | 1 | Bonus Denim B, %100/%0 | B-01: 6.2 |

Tablodaki batch adları kısa gösterilmiştir; JSON'da `BONUS-A-01` gibi tam adları
bulunur. Daha sonraki yüklemeler ilk snapshot'ları değiştirmemelidir.

## Docker kullanıyorsanız

Docker'ın veritabanı ayrı volume'dedir; yerel `backend/dpp.db` dosyasını sorgulamak
Docker'da yüklediğiniz ürünleri göstermez. Backend container'ı çalışırken, depo
kökünden aşağıdaki isteğe bağlı komut geçmişi **salt okunur** inceler:

```bash
docker run --rm -i \
  --volumes-from "$(docker compose ps -q backend):ro" \
  python:3.14-alpine python - <<'PY'
from contextlib import closing
import json
import sqlite3

query = """
SELECT m.Gtin, v.VersionNumber, v.ChangedAtUtc, v.SnapshotJson
FROM ProductVersions v
JOIN ProductModels m ON m.Id = v.ProductModelId
WHERE m.Gtin IN ('99000000010010', '99000000010027', '99000000010034')
ORDER BY m.Gtin, v.VersionNumber
"""
with closing(sqlite3.connect('file:/app/data/dpp.db?mode=ro', uri=True)) as db:
    rows = db.execute(query).fetchall()
for gtin, version, changed_at, snapshot in rows:
    print(f'\nGTIN: {gtin} | Eski sürüm: {version} | UTC: {changed_at}')
    print(json.dumps(json.loads(snapshot), ensure_ascii=False, indent=2))
print(f'\nBu test ürünlerine ait toplam geçmiş kaydı: {len(rows)}')
PY
```

Komut geçici bir Python container'ı açar; ilk kullanımda resmî Python image'ını
indirir. Uygulamanın image'ına paket kurmaz. Hem volume bağlantısı hem SQLite
bağlantısı salt okunurdur. Beklenen toplam **4 geçmiş kaydı**dır. C için eski
sürüm olmadığından burada satır yazdırılmaz.

## Senaryoyu tekrar çalıştırma

Tablodaki sayılar ilk çalıştırma içindir. 05'ten sonra 01'i yüklemek eski
değerlere **gerçek bir geri dönüş** yapar ve yeni sürüm oluşturur. Bu hata değildir.
01 ayrıca sonradan eklenen ikinci batch'i silmez; import'ta batch silme davranışı yoktur.

Tekrar test etmek için ilgili adımdaki dosyayı hemen yeniden yükleyerek “değişiklik
yok” durumunu deneyebilirsiniz. Tam senaryoyu yeniden başlatacaksanız daha önce
kullanılmamış, kontrol basamağı geçerli GTIN'ler veya ayrı bir test veritabanı
kullanın. Mevcut veritabanınızı sıfırlamanız gerekmez.
