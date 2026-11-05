import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { importProducts, passportUrl } from '../src/api/products.ts'

const row = {
  rowNumber: 2, gtin: '08690000000012', modelName: 'Slim Denim 501',
  batchNumber: 'B2027-01', cottonPercentage: '98', elastanePercentage: '2',
  productionPlace: 'Denizli', carbonKgCo2e: '12.4',
}
const partialResult = {
  message: 'CSV işlendi.', rowCount: 2, validCount: 1, savedCount: 1, rejectedCount: 1,
  rows: [row], errors: [{ rowNumber: 3, messages: ['GTIN boş olamaz.'] }],
}
const file = new File(['csv content'], 'urunler.csv', { type: 'text/csv' })
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

test('uploads the file as multipart without overriding the browser boundary', async (t) => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/products/import')
    assert.equal(options.method, 'POST')
    assert.equal(options.signal, controller.signal)
    assert.equal(options.headers, undefined)
    assert.ok(options.body instanceof FormData)
    assert.equal(options.body.get('file').name, file.name)
    assert.equal(await options.body.get('file').text(), 'csv content')
    return jsonResponse(partialResult)
  })
  assert.deepEqual(await importProducts(file, controller.signal), partialResult)
})

test('keeps partial success, line numbers and leading zeroes', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(partialResult))
  const result = await importProducts(file)
  assert.equal(result.rows[0].gtin, '08690000000012')
  assert.equal(result.errors[0].rowNumber, 3)
  assert.equal(result.validCount, 1)
  assert.equal(result.rejectedCount, 1)
})

test('accepts header-only and entirely rejected import reports', async (t) => {
  for (const result of [
    { ...partialResult, rowCount: 0, validCount: 0, savedCount: 0, rejectedCount: 0, rows: [], errors: [] },
    { ...partialResult, rowCount: 1, validCount: 0, savedCount: 0, rows: [] },
  ]) {
    await t.test(`rows=${result.rowCount}`, async (child) => {
      child.mock.method(globalThis, 'fetch', async () => jsonResponse(result))
      assert.deepEqual(await importProducts(file), result)
    })
  }
})

test('shows backend CSV errors with their line number', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({
    rowNumber: 4, message: 'CSV satırı okunamadı.',
  }, 400))
  await assert.rejects(importProducts(file), /CSV satırı 4: CSV satırı okunamadı/)
})

test('understands ProblemDetails errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ title: 'Dosya hatalı.' }, 400))
  await assert.rejects(importProducts(file), /Dosya hatalı/)
})

test('explains upload size errors even if the proxy returns HTML', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Too large</html>', { status: 413 }))
  await assert.rejects(importProducts(file), /yükleme sınırını aşıyor/)
})

test('handles unavailable backends and non-JSON server errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Bad Gateway', { status: 502 }))
  await assert.rejects(importProducts(file), /HTTP 502/)
})

test('explains network failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(importProducts(file), /Sunucuya ulaşılamadı/)
})

test('rejects malformed successful responses instead of showing false success', async (t) => {
  for (const invalid of [null, {}, { ...partialResult, rows: [null] },
    { ...partialResult, errors: [{ rowNumber: 3, messages: 'wrong type' }] }]) {
    await t.test(JSON.stringify(invalid), async (child) => {
      child.mock.method(globalThis, 'fetch', async () => jsonResponse(invalid))
      await assert.rejects(importProducts(file), /Sunucu yanıtı doğrulanamadı/)
    })
  }
})

test('preserves an intentional abort', async (t) => {
  const controller = new AbortController()
  const aborted = new DOMException('Aborted', 'AbortError')
  t.mock.method(globalThis, 'fetch', async () => { controller.abort(); throw aborted })
  await assert.rejects(importProducts(file, controller.signal), (cause) => cause === aborted)
})

test('creates role-aware passport links and keeps QR consumer-only', () => {
  const path = '/dpp/08690000000012'
  assert.equal(passportUrl(row.gtin, 'html'), path)
  assert.equal(passportUrl(row.gtin, 'jsonld'), path + '.jsonld')
  assert.equal(passportUrl(row.gtin, 'html', 'yetkili'), path + '?rol=yetkili')
  assert.equal(passportUrl(row.gtin, 'jsonld', 'yetkili'), path + '.jsonld?rol=yetkili')
  assert.equal(passportUrl(row.gtin, 'qr', 'yetkili'), path + '/qr.png')
})

test('downloadable sample matches the assignment CSV exactly', async () => {
  const [original, downloadable] = await Promise.all([
    readFile(new URL('../../urunler_duzeltilmis_test.csv', import.meta.url), 'utf8'),
    readFile(new URL('../public/ornek-urunler.csv', import.meta.url), 'utf8'),
  ])
  assert.equal(downloadable, original)
})
