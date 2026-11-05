"""Gerçek HTTP + SQLite entegrasyon testleri. Çalıştırma: python3 tests/test_backend.py"""

import csv
from contextlib import closing
from datetime import datetime, timezone
import html
import io
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import sqlite3
import struct
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import uuid
import zlib


ROOT = Path(__file__).resolve().parents[1]
HEADERS = [
    "gtin", "model_adi", "batch_no", "elyaf_pamuk_yuzde",
    "elyaf_elastan_yuzde", "uretim_yeri", "karbon_kg_co2e",
]
PRODUCT = ["08690000000012", "Slim Denim 501", "B2027-01", "98", "2", "Denizli", "12.4"]


def csv_bytes(*rows):
    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(HEADERS)
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8")


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Kaynak kod ve migration'lar kopyalanır; kullanıcının DB'si kopyalanmaz.
        cls.temp = tempfile.TemporaryDirectory(prefix="dpp-tests-")
        cls.addClassCleanup(cls.temp.cleanup)
        # macOS'taki /var -> /private/var bağlantısını çöz: Razor derleme yolları
        # ile uygulamanın çalışma dizini aynı fiziksel yolu kullanmalıdır.
        workspace = Path(cls.temp.name).resolve()
        backend = workspace / "backend"
        shutil.copytree(
            ROOT / "backend", backend,
            ignore=shutil.ignore_patterns("bin", "obj", "*.db", "*.db-*"),
        )
        shutil.copy2(ROOT / "dotnet-tools.json", workspace / "dotnet-tools.json")
        cls.db = workspace / "test.db"
        env = os.environ.copy()
        env.update({
            "ConnectionStrings__DefaultConnection": f"Data Source={cls.db}",
            "ASPNETCORE_ENVIRONMENT": "Production",
            "DOTNET_ENVIRONMENT": "Production",
            "Logging__LogLevel__Default": "Warning",
        })

        def run(*args):
            process = subprocess.Popen(
                args, cwd=workspace, env=env, text=True,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True,
            )
            try:
                output, _ = process.communicate(timeout=120)
            except subprocess.TimeoutExpired:
                # dotnet'in başlattığı alt süreçler de açık kalmamalıdır.
                os.killpg(process.pid, signal.SIGKILL)
                output, _ = process.communicate()
                raise RuntimeError(f"Komut zaman aşımına uğradı: {' '.join(args)}\n{output}")
            if process.returncode:
                raise RuntimeError(f"{' '.join(args)}\n{output}")

        print("Backend geçici dizinde derleniyor...", flush=True)
        run("dotnet", "build", str(backend / "Dpp.Api.csproj"),
            "--disable-build-servers", "--ignore-failed-sources", "-p:NuGetAudit=false")
        print("Migration'lar geçici veritabanına uygulanıyor...", flush=True)
        run("dotnet", "ef", "database", "update", "--no-build",
            "--project", str(backend / "Dpp.Api.csproj"))

        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        cls.base_url = f"http://127.0.0.1:{port}"
        cls.server_log = workspace / "server.log"
        log = cls.server_log.open("w+")
        cls.addClassCleanup(log.close)
        cls.server = subprocess.Popen(
            ["dotnet", str(backend / "bin/Debug/net10.0/Dpp.Api.dll"),
             "--urls", cls.base_url],
            cwd=backend, env=env, stdout=log, stderr=subprocess.STDOUT,
        )
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if cls.server.poll() is not None:
                break
            try:
                with urlopen(cls.base_url + "/dpp/not-found", timeout=1):
                    return
            except HTTPError as response:
                status = response.code
                response.close()
                if status == 404:
                    return
            except (URLError, TimeoutError):
                pass
            time.sleep(0.1)
        log.flush()
        log.seek(0)
        raise RuntimeError(f"Test sunucusu başlatılamadı:\n{log.read()}")

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        try:
            cls.server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait()

    def setUp(self):
        # Her test aynı boş şemayla başlar; test sırasına bağımlılık yoktur.
        with closing(sqlite3.connect(self.db)) as connection:
            with connection:
                connection.execute("PRAGMA foreign_keys = ON")
                connection.execute("DELETE FROM ProductVersions")
                connection.execute("DELETE FROM Batches")
                connection.execute("DELETE FROM ProductModels")

    def sql(self, query, parameters=()):
        with closing(sqlite3.connect(self.db)) as connection:
            return connection.execute(query, parameters).fetchall()

    def request(self, path, data=None, headers=None):
        request = Request(self.base_url + path, data=data, headers=headers or {})
        try:
            response = urlopen(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            body = response.read()
            if response.status >= 500:
                self.fail(f"HTTP {response.status}: {path}\n{self.server_log.read_text()[-10000:]}")
            return response.status, response.headers, body

    def upload(self, content, field="file", status=200):
        boundary = uuid.uuid4().hex
        body = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; '
            'filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n'
        ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
        actual, _, response = self.request(
            "/api/products/import", body,
            {"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        self.assertEqual(actual, status, response.decode(errors="replace"))
        return json.loads(response)

    def seed(self):
        self.upload(csv_bytes(PRODUCT))

    def history(self):
        return self.sql(
            "SELECT VersionNumber, ChangedAtUtc, SnapshotJson "
            "FROM ProductVersions ORDER BY VersionNumber"
        )

    def test_sample_partial_success_and_repeat_upload(self):
        content = (ROOT / "urunler_duzeltilmis_test.csv").read_bytes()
        for _ in range(2):
            result = self.upload(content)
            self.assertEqual(
                [result[key] for key in ("rowCount", "validCount", "savedCount", "rejectedCount")],
                [5, 3, 3, 2],
            )
            self.assertEqual([error["rowNumber"] for error in result["errors"]], [4, 5])
            self.assertIn("GTIN", result["errors"][0]["messages"][0])
            self.assertIn("toplamı 100", result["errors"][1]["messages"][0])
            self.assertEqual([row["rowNumber"] for row in result["rows"]], [2, 3, 6])
            self.assertEqual(self.sql("SELECT COUNT(*) FROM ProductModels"), [(3,)])
            self.assertEqual(self.sql("SELECT COUNT(*) FROM Batches"), [(3,)])
            self.assertEqual(self.history(), [])
        self.assertEqual(self.sql("SELECT Gtin FROM ProductModels ORDER BY Gtin"), [
            ("08690000000012",), ("08690000000029",), ("08690000000050",),
        ])

    def test_validation_rules_reject_bad_row_and_continue(self):
        cases = [
            (0, "", "GTIN boş"),
            (0, "8690000000012", "14 haneli"),
            (0, "0869000000001x", "rakamlarından"),
            (0, "０８６９００００００００１２", "rakamlarından"),
            (0, "08690000000013", "kontrol basamağı"),
            (1, "  ", "Model adı"),
            (2, "  ", "Batch numarası"),
            (5, "  ", "Üretim yeri"),
            (3, "abc", "Pamuk yüzdesi sayısal"),
            (4, "NaN", "Elastan yüzdesi sayısal"),
            (3, "-1", "0–100"),
            (4, "101", "0–100"),
            (3, "95", "toplamı 100"),
            (3, "1,000", "sayısal"),
            (6, "abc", "Karbon değeri sayısal"),
            (6, "NaN", "Karbon değeri sayısal"),
            (6, "1e100", "Karbon değeri sayısal"),
            (6, "-0.01", "negatif olamaz"),
        ]
        for index, value, message in cases:
            with self.subTest(column=HEADERS[index], value=value):
                bad = PRODUCT.copy()
                bad[index] = value
                result = self.upload(csv_bytes(bad, PRODUCT))
                self.assertEqual(result["rowCount"], 2)
                self.assertEqual(result["validCount"], 1)
                self.assertEqual(result["rejectedCount"], 1)
                self.assertEqual(result["errors"][0]["rowNumber"], 2)
                self.assertIn(message, " ".join(result["errors"][0]["messages"]))
                self.assertEqual(self.sql("SELECT COUNT(*) FROM ProductModels"), [(1,)])
                self.assertEqual(self.sql("SELECT CAST(CarbonKgCo2e AS REAL) FROM Batches"), [(12.4,)])
        self.assertEqual(self.history(), [])

    def test_all_errors_in_one_row_are_reported(self):
        result = self.upload(csv_bytes(["", " ", " ", "abc", "101", " ", "-1"]))
        self.assertEqual(result["rejectedCount"], 1)
        self.assertEqual(len(result["errors"][0]["messages"]), 7)
        self.assertEqual(self.sql("SELECT COUNT(*) FROM ProductModels"), [(0,)])

    def test_missing_empty_and_invalid_header_files(self):
        for content, field in [(b"", "file"), (csv_bytes(PRODUCT), "wrong-field"),
                               (b"wrong,headers\na,b\n", "file")]:
            with self.subTest(content=content, field=field):
                result = self.upload(content, field=field, status=400)
                self.assertTrue(result["message"])
        self.assertEqual(self.sql("SELECT COUNT(*) FROM ProductModels"), [(0,)])

    def test_header_only_file(self):
        result = self.upload(csv_bytes())
        self.assertEqual(result["rowCount"], 0)
        self.assertEqual(result["savedCount"], 0)
        self.assertEqual(result["errors"], [])

    def test_wrong_column_counts_do_not_block_valid_rows(self):
        other = PRODUCT.copy()
        other[0] = "08690000000029"
        result = self.upload(csv_bytes(PRODUCT, PRODUCT[:-1], PRODUCT + ["extra"], other))
        self.assertEqual(result["rowCount"], 4)
        self.assertEqual(result["savedCount"], 2)
        self.assertEqual(result["rejectedCount"], 2)
        self.assertEqual([error["rowNumber"] for error in result["errors"]], [3, 4])
        for error, found in zip(result["errors"], (6, 8)):
            self.assertIn(f"7 sütun içermelidir; {found} sütun bulundu", error["messages"][0])
        self.assertEqual(self.sql("SELECT COUNT(*) FROM ProductModels"), [(2,)])

    def test_unreadable_csv_returns_400_without_saving_partial_file(self):
        # Kapanmayan tırnakta sonraki kayıt sınırı güvenilir şekilde bulunamaz.
        content = csv_bytes(PRODUCT) + b'08690000000029,"Unclosed name,B-2,98,2,Denizli,12.4\n'
        result = self.upload(content, status=400)
        self.assertEqual(result["rowNumber"], 3)
        self.assertTrue(result["message"])
        self.assertEqual(self.sql("SELECT COUNT(*) FROM ProductModels"), [(0,)])

    def test_numeric_boundaries_and_text_normalization(self):
        row = [PRODUCT[0], "  Slim Denim 501  ", "  B2027-01  ", "100", "0", "  Denizli  ", "0"]
        self.upload(csv_bytes(row))
        self.assertEqual(self.sql("SELECT Name, CAST(CottonPercentage AS REAL), CAST(ElastanePercentage AS REAL) FROM ProductModels"),
                         [("Slim Denim 501", 100, 0)])
        self.assertEqual(self.sql("SELECT BatchNumber, ProductionPlace, CAST(CarbonKgCo2e AS REAL) FROM Batches"),
                         [("B2027-01", "Denizli", 0)])
        row[3:5] = ["0", "100"]
        self.upload(csv_bytes(row))
        self.assertEqual(self.sql("SELECT CAST(CottonPercentage AS REAL), CAST(ElastanePercentage AS REAL) FROM ProductModels"),
                         [(0, 100)])

    def test_consumer_and_authorized_passports(self):
        self.seed()
        for role in ("", "?rol=", "?rol=tuketici", "?rol=unknown", "?rol=Yetkili", "?rol=yetkili"):
            with self.subTest(role=role):
                authorized = role == "?rol=yetkili"
                status, headers, body = self.request(f"/dpp/{PRODUCT[0]}{role}")
                self.assertEqual(status, 200)
                self.assertEqual(headers.get_content_type(), "text/html")
                page = html.unescape(body.decode())
                for value in (PRODUCT[0], PRODUCT[1], PRODUCT[2], PRODUCT[5]):
                    self.assertIn(value, page)
                self.assertEqual("Karbon" in page, authorized)
                self.assertEqual(bool(re.search(r"\b12[.,]4\b", page)), authorized)
                self.assertIn(f'/dpp/{PRODUCT[0]}.jsonld' + ("?rol=yetkili" if authorized else '"'), page)

                status, headers, body = self.request(f"/dpp/{PRODUCT[0]}.jsonld{role}")
                self.assertEqual(status, 200)
                self.assertEqual(headers.get_content_type(), "application/ld+json")
                document = json.loads(body)
                self.assertEqual(document["@context"], "https://schema.org")
                self.assertEqual(document["@type"], "Product")
                self.assertEqual(document["gtin14"], PRODUCT[0])
                self.assertEqual(document["name"], PRODUCT[1])
                properties = {p["name"]: p for p in document["additionalProperty"]}
                self.assertEqual(properties["elyaf_pamuk_yuzde"]["value"], 98)
                self.assertEqual(properties["elyaf_elastan_yuzde"]["value"], 2)
                self.assertEqual(properties["elyaf_pamuk_yuzde"]["unitText"], "%")
                batch = properties["batch_no"]
                self.assertEqual(batch["value"], PRODUCT[2])
                batch_properties = {p["name"]: p for p in batch["valueReference"]}
                self.assertEqual(batch_properties["uretim_yeri"]["value"], "Denizli")
                self.assertEqual("karbon_kg_co2e" in batch_properties, authorized)
                self.assertEqual(b"karbon_kg_co2e" in body, authorized)
                if authorized:
                    self.assertEqual(batch_properties["karbon_kg_co2e"]["value"], 12.4)
                    self.assertEqual(batch_properties["karbon_kg_co2e"]["unitText"], "kg CO2e")
                else:
                    self.assertNotIn(b"12.4", body)

    def test_unknown_product_returns_404_for_all_outputs(self):
        for suffix in ("", ".jsonld", "/qr.png"):
            with self.subTest(suffix=suffix):
                self.assertEqual(self.request("/dpp/00000000000000" + suffix)[0], 404)

    def test_qr_is_valid_png_and_download_link_exists(self):
        self.seed()
        path = f"/dpp/{PRODUCT[0]}/qr.png"
        status, headers, png = self.request(path)
        self.assertEqual(status, 200)
        self.assertEqual(headers.get_content_type(), "image/png")
        self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
        offset, compressed, chunks = 8, b"", []
        while offset < len(png):
            length = struct.unpack_from(">I", png, offset)[0]
            kind = png[offset + 4:offset + 8]
            data = png[offset + 8:offset + 8 + length]
            crc = struct.unpack_from(">I", png, offset + 8 + length)[0]
            self.assertEqual(zlib.crc32(kind + data), crc)
            chunks.append(kind)
            if kind == b"IHDR":
                width, height = struct.unpack_from(">II", data)
                self.assertEqual(width, height)
                self.assertGreater(width, 100)
            if kind == b"IDAT":
                compressed += data
            offset += length + 12
        self.assertEqual(chunks[0], b"IHDR")
        self.assertEqual(chunks[-1], b"IEND")
        self.assertTrue(zlib.decompress(compressed))
        self.assertEqual(self.request(path + "?rol=yetkili")[2], png)
        page = self.request(f"/dpp/{PRODUCT[0]}")[2].decode()
        self.assertIn(f'src="{path}"', page)
        self.assertIn(f'href="{path}"', page)
        self.assertIn(f'download="{PRODUCT[0]}.png"', page)

    def test_version_history_preserves_old_state_and_skips_equal_values(self):
        self.seed()
        self.assertEqual(self.history(), [])
        before = datetime.now(timezone.utc)
        changed = PRODUCT.copy()
        changed[6] = "13.4"
        self.upload(csv_bytes(changed))
        first = self.history()
        self.assertEqual(len(first), 1)
        number, timestamp, snapshot = first[0]
        self.assertEqual(number, 1)
        moment = datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc)
        self.assertGreaterEqual(moment, before)
        self.assertLessEqual(moment, datetime.now(timezone.utc))
        old = json.loads(snapshot)
        self.assertEqual(old["Gtin"], PRODUCT[0])
        self.assertEqual(old["Name"], PRODUCT[1])
        self.assertEqual(old["Batches"][0]["CarbonKgCo2e"], 12.4)
        self.assertEqual(self.sql("SELECT CAST(CarbonKgCo2e AS REAL) FROM Batches"), [(13.4,)])

        self.upload(csv_bytes(changed))
        changed[1], changed[6] = "  Slim Denim 501  ", "13.40"
        self.upload(csv_bytes(changed))
        self.assertEqual(self.history(), first)

        self.upload(csv_bytes(PRODUCT))
        history = self.history()
        self.assertEqual([entry[0] for entry in history], [1, 2])
        self.assertEqual(history[0], first[0])
        self.assertEqual(json.loads(history[1][2])["Batches"][0]["CarbonKgCo2e"], 13.4)

    def test_model_and_batch_changes_capture_the_whole_previous_product(self):
        self.seed()
        second = PRODUCT.copy()
        second[2], second[5], second[6] = "B2027-02", "Bursa", "0"
        self.upload(csv_bytes(second))
        self.assertEqual(self.sql("SELECT COUNT(*) FROM ProductModels"), [(1,)])
        self.assertEqual(self.sql("SELECT COUNT(*) FROM Batches"), [(2,)])
        self.assertEqual(len(json.loads(self.history()[0][2])["Batches"]), 1)

        second[1], second[3], second[4], second[5] = "New model", "97", "3", "İzmir"
        self.upload(csv_bytes(second))
        history = self.history()
        self.assertEqual([entry[0] for entry in history], [1, 2])
        previous = json.loads(history[1][2])
        self.assertEqual(previous["Name"], PRODUCT[1])
        self.assertEqual(previous["CottonPercentage"], 98)
        self.assertEqual(len(previous["Batches"]), 2)
        self.assertEqual(previous["Batches"][1]["ProductionPlace"], "Bursa")
        document = json.loads(self.request(f"/dpp/{PRODUCT[0]}.jsonld?rol=yetkili")[2])
        self.assertEqual(document["name"], "New model")
        batches = [p for p in document["additionalProperty"] if p["name"] == "batch_no"]
        self.assertEqual([p["value"] for p in batches], ["B2027-01", "B2027-02"])
        self.assertEqual(batches[1]["valueReference"][1]["value"], 0)
        page = html.unescape(self.request(f"/dpp/{PRODUCT[0]}")[2].decode())
        for value in ("B2027-01", "B2027-02", "Denizli", "İzmir"):
            self.assertIn(value, page)

    def test_csv_quoting_utf8_and_html_escaping(self):
        row = PRODUCT.copy()
        row[1] = '<script>alert("x")</script>, Özel Ürün'
        self.upload(csv_bytes(row))
        page = self.request(f"/dpp/{PRODUCT[0]}")[2].decode()
        self.assertNotIn("<script>", page)
        self.assertIn(row[1], html.unescape(page))
        document = json.loads(self.request(f"/dpp/{PRODUCT[0]}.jsonld")[2])
        self.assertEqual(document["name"], row[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
