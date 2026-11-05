export interface ProductCsvRow {
  rowNumber: number
  gtin: string
  modelName: string
  batchNumber: string
  cottonPercentage: string
  elastanePercentage: string
  productionPlace: string
  carbonKgCo2e: string
}

export interface CsvRowError {
  rowNumber: number
  messages: string[]
}

export interface ImportResult {
  message: string
  rowCount: number
  validCount: number
  savedCount: number
  rejectedCount: number
  rows: ProductCsvRow[]
  errors: CsvRowError[]
}

export type PassportRole = 'tuketici' | 'yetkili'
export type PassportFormat = 'html' | 'jsonld' | 'qr'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isProductRow(value: unknown): value is ProductCsvRow {
  return isRecord(value)
    && isCount(value.rowNumber)
    && ['gtin', 'modelName', 'batchNumber', 'cottonPercentage',
      'elastanePercentage', 'productionPlace', 'carbonKgCo2e']
      .every((key) => typeof value[key] === 'string')
}

function isRowError(value: unknown): value is CsvRowError {
  return isRecord(value)
    && isCount(value.rowNumber)
    && Array.isArray(value.messages)
    && value.messages.every((message) => typeof message === 'string')
}

function isImportResult(value: unknown): value is ImportResult {
  return isRecord(value)
    && typeof value.message === 'string'
    && ['rowCount', 'validCount', 'savedCount', 'rejectedCount']
      .every((key) => isCount(value[key]))
    && Array.isArray(value.rows) && value.rows.every(isProductRow)
    && Array.isArray(value.errors) && value.errors.every(isRowError)
}

function errorMessage(body: unknown, status: number): string {
  if (status === 413) {
    return 'Dosya yükleme sınırını aşıyor. Daha küçük bir CSV dosyası seçin.'
  }
  if (isRecord(body)) {
    const message = typeof body.message === 'string' ? body.message : body.title
    if (typeof message === 'string' && message.trim()) {
      return isCount(body.rowNumber)
        ? `CSV satırı ${body.rowNumber}: ${message}`
        : message
    }
  }
  return `Dosya işlenemedi (HTTP ${status}). Sunucu bağlantısını kontrol edip tekrar deneyin.`
}

export async function importProducts(file: File, signal?: AbortSignal): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  let response: Response
  try {
    // Multipart Content-Type ve boundary değerini tarayıcı oluşturur.
    response = await fetch('/api/products/import', { method: 'POST', body: form, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Sunucuya ulaşılamadı. Backend’in çalıştığını ve bağlantınızı kontrol edin.')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorMessage(body, response.status))
  if (!isImportResult(body)) {
    throw new Error('Sunucu yanıtı doğrulanamadı. Dosyayı yeniden yüklemeden önce kayıtları kontrol edin.')
  }
  return body
}

export function passportUrl(gtin: string, format: PassportFormat, role: PassportRole = 'tuketici'): string {
  const path = `/dpp/${encodeURIComponent(gtin)}`
  if (format === 'qr') return `${path}/qr.png`
  const suffix = format === 'jsonld' ? '.jsonld' : ''
  return `${path}${suffix}${role === 'yetkili' ? '?rol=yetkili' : ''}`
}
