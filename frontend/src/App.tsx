import { useEffect, useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { importProducts, passportUrl } from './api/products'
import type { ImportResult, PassportRole } from './api/products'
import { Icon } from './components/Icon'
import './App.css'

const number = new Intl.NumberFormat('tr-TR')

function uniqueProducts(result: ImportResult | null) {
  const products = new Map<string, { gtin: string; name: string; batches: Set<string> }>()
  for (const row of result?.rows ?? []) {
    const batches = products.get(row.gtin)?.batches ?? new Set<string>()
    batches.add(row.batchNumber.trim())
    products.set(row.gtin, { gtin: row.gtin, name: row.modelName.trim(), batches })
  }
  return [...products.values()]
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importedFile, setImportedFile] = useState('')
  const [role, setRole] = useState<PassportRole>('tuketici')
  const [gtin, setGtin] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const dragDepth = useRef(0)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const products = uniqueProducts(result)

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { if (result) resultsHeading.current?.focus() }, [result])

  function chooseFile(selected: File | null) {
    if (busy) return
    setError(null)
    if (selected?.size === 0) {
      setFile(null)
      setError('Seçtiğiniz dosya boş. Veri içeren bir CSV dosyası seçin.')
      return
    }
    setFile(selected)
  }

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (busy) return
    if (event.dataTransfer.files.length !== 1) {
      setError('Lütfen her seferinde tek bir CSV dosyası seçin.')
      return
    }
    chooseFile(event.dataTransfer.files.item(0))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const response = await importProducts(file, controller.signal)
      if (!controller.signal.aborted) {
        setImportedFile(file.name)
        setResult(response)
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Beklenmeyen bir hata oluştu.')
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setBusy(false)
      }
    }
  }

  function openPassport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = gtin.trim()
    if (!/^[0-9]{14}$/.test(value)) {
      setLookupError('GTIN, baştaki sıfırlar dahil 14 rakam olmalıdır.')
      return
    }
    setLookupError(null)
    window.open(passportUrl(value, 'html', role), '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <a className="skip-link" href="#main">İçeriğe geç</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Mini DPP ana sayfa">
            <span className="brand-mark"><Icon name="layers" size={23} /></span>
            <span>mini<span className="brand-emphasis">dpp</span><span className="brand-dot">.</span></span>
          </a>
          <nav aria-label="Ana gezinme">
            <a href="#ice-aktar">İçe aktar</a>
            <a href="#pasaport-bul">Pasaport bul <Icon name="external" size={14} /></a>
          </nav>
          <span className="header-label">DİJİTAL ÜRÜN PASAPORTU</span>
        </div>
      </header>

      <main id="main" className="workspace">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span /> ÜRÜN VERİ YÖNETİMİ</p>
            <h1 id="page-title">Ürün verisinden<br /><span>dijital pasaporta.</span></h1>
            <p className="intro-description">CSV dosyanızı yükleyin, verilerinizi doğrulayın.<br className="desktop-break" />
              Her geçerli ürün için paylaşılabilir bir pasaport oluşturun.</p>
          </div>
          <div className="intro-note" aria-label="Üç pasaport çıktısı">
            <span className="intro-note-icon"><Icon name="qr" size={32} /></span>
            <span>Tek veri kaynağı.<strong>Üç farklı çıktı.</strong><small>HTML · JSON-LD · QR</small></span>
          </div>
        </section>

        <div className="workspace-grid">
          <section id="ice-aktar" className="panel upload-panel" aria-labelledby="upload-title">
            <div className="panel-heading">
              <span className="step-number">01</span>
              <div><h2 id="upload-title">CSV dosyası yükle</h2><p>Ürün ve üretim partisi bilgilerinizi içe aktarın.</p></div>
            </div>
            <form onSubmit={submit} aria-busy={busy}>
              <label htmlFor="csv-file" className={`dropzone${dragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}${busy ? ' is-busy' : ''}`}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy' }}
                onDragEnter={(event) => { event.preventDefault(); dragDepth.current++; if (!busy) setDragging(true) }}
                onDragLeave={(event) => { event.preventDefault(); dragDepth.current--; if (dragDepth.current <= 0) setDragging(false) }}
                onDrop={dropFile}>
                <input id="csv-file" className="visually-hidden" type="file" accept=".csv,text/csv" disabled={busy}
                  aria-describedby="file-hint" onChange={(event) => {
                    chooseFile(event.currentTarget.files?.item(0) ?? null)
                    event.currentTarget.value = ''
                  }} />
                <span className="upload-icon"><Icon name={file ? 'file' : 'upload'} size={27} /></span>
                <strong>{dragging ? 'Dosyanızı buraya bırakın' : file ? file.name : 'Dosya seçin veya buraya sürükleyin'}</strong>
                <span className="dropzone-description">{file ? `${number.format(Math.max(1, Math.ceil(file.size / 1024)))} KB · Değiştirmek için tıklayın` : 'Virgülle ayrılmış CSV dosyası'}</span>
                <span className="file-type">.CSV</span>
              </label>
              <div className="upload-meta">
                <p id="file-hint">GTIN değerlerini korumak için dosyayı Excel’de kaydetmeyin.</p>
                {file && <button type="button" className="text-button" disabled={busy} onClick={() => chooseFile(null)}><Icon name="close" size={14} /> Kaldır</button>}
              </div>
              {error && <div className="notice notice-error" role="alert"><Icon name="alert" /><p>{error}</p></div>}
              <div className="upload-actions">
                <a className="sample-link" href="/ornek-urunler.csv" download><Icon name="download" size={17} /> Örnek CSV indir</a>
                <button className="button button-primary" type="submit" disabled={!file || busy}>
                  {busy ? <><span className="spinner" /> İşleniyor…</> : <>Doğrula ve içe aktar <Icon name="arrow" size={18} /></>}
                </button>
              </div>
              <p className="processing-status" role="status" aria-live="polite">{busy ? 'Dosyanız yükleniyor ve doğrulanıyor. Lütfen bu sayfayı açık tutun.' : ''}</p>
            </form>
            <details className="format-details">
              <summary>CSV biçimi ve doğrulama kuralları <span aria-hidden="true">+</span></summary>
              <div><p>İlk satır aşağıdaki sütun başlıklarını içermelidir. Ondalık ayırıcı noktadır.</p>
                <code>gtin,model_adi,batch_no,elyaf_pamuk_yuzde,elyaf_elastan_yuzde,uretim_yeri,karbon_kg_co2e</code>
                <ul><li>GTIN: 14 rakam ve geçerli GS1 kontrol basamağı.</li><li>Pamuk ve elastan: ayrı ayrı %0–100, toplam %100.</li><li>Model adı, batch numarası ve üretim yeri boş bırakılamaz.</li><li>Karbon: sıfır veya pozitif bir sayı.</li></ul>
              </div>
            </details>
          </section>

          <aside className="sidebar">
            <section id="pasaport-bul" className="panel lookup-panel" aria-labelledby="lookup-title">
              <div className="sidebar-heading"><Icon name="qr" size={21} /><h2 id="lookup-title">Pasaport bul</h2></div>
              <p>Kayıtlı bir ürünün GTIN’i ile pasaportunu doğrudan açın.</p>
              <fieldset className="role-selector"><legend>Pasaport görünümü</legend>
                <div className="segmented-control">
                  <label><input type="radio" name="role" value="tuketici" checked={role === 'tuketici'} onChange={() => setRole('tuketici')} /><span>Tüketici</span></label>
                  <label><input type="radio" name="role" value="yetkili" checked={role === 'yetkili'} onChange={() => setRole('yetkili')} /><span>Yetkili</span></label>
                </div>
                <p className="role-hint">{role === 'yetkili' ? 'Karbon bilgisi gösterilir. Demo görünümüdür; giriş gerektirmez.' : 'Karbon bilgisi pasaportta gösterilmez.'}</p>
              </fieldset>
              <form onSubmit={openPassport} noValidate>
                <label className="field-label" htmlFor="gtin">Ürün GTIN’i</label>
                <div className="lookup-input"><input id="gtin" type="text" inputMode="numeric" maxLength={14} placeholder="Ör. 08690000000012" value={gtin}
                  aria-invalid={lookupError ? true : undefined} aria-describedby={lookupError ? 'lookup-error' : undefined}
                  onChange={(event) => { setGtin(event.target.value); setLookupError(null) }} />
                  <button type="submit" aria-label="Ürün pasaportunu yeni sekmede aç"><Icon name="arrow" size={19} /></button>
                </div>
                {lookupError && <p id="lookup-error" className="field-error" role="alert">{lookupError}</p>}
              </form>
            </section>
            <section className="how-it-works" aria-labelledby="how-title">
              <p className="eyebrow" id="how-title">KÜÇÜK BİR AKIŞ, TAM BİR PASAPORT</p>
              <ol><li><span>1</span><div><strong>Veriyi yükleyin</strong><p>Ürün bilgilerini tek bir CSV’de toplayın.</p></div></li><li><span>2</span><div><strong>Sonuçları kontrol edin</strong><p>Geçerli satırlar kaydedilir, hatalar açıklanır.</p></div></li><li><span>3</span><div><strong>Pasaportu paylaşın</strong><p>HTML, JSON-LD veya PNG QR çıktısını açın.</p></div></li></ol>
            </section>
          </aside>
        </div>

        {result && <section className="results-section" aria-labelledby="results-title">
          <div className="section-heading"><div><p className="eyebrow">İÇE AKTARMA SONUCU</p><h2 id="results-title" tabIndex={-1} ref={resultsHeading}>Dosyanız işlendi.</h2><p className="result-filename">{importedFile}</p></div>
            <span className={`status-badge ${result.rejectedCount > 0 || result.rowCount === 0 ? 'status-warning' : 'status-success'}`}><Icon name={result.rejectedCount > 0 || result.rowCount === 0 ? 'alert' : 'check'} size={15} />{result.rowCount === 0 ? 'Veri satırı yok' : result.validCount === 0 ? 'Düzeltme gerekli' : result.rejectedCount > 0 ? 'Kısmen tamamlandı' : 'Tamamlandı'}</span>
          </div>
          <div className="metrics" aria-label="Yükleme özeti">
            <div className="metric"><span>OKUNAN SATIR</span><strong>{number.format(result.rowCount)}</strong><p>Başlık satırı hariç</p></div>
            <div className="metric metric-success"><span>KABUL EDİLEN</span><strong>{number.format(result.validCount)}</strong><p>Geçerli ürün verisi</p></div>
            <div className={`metric${result.rejectedCount > 0 ? ' metric-warning' : ''}`}><span>REDDEDİLEN</span><strong>{number.format(result.rejectedCount)}</strong><p>Düzeltilmesi gereken satır</p></div>
          </div>
          {result.rowCount === 0 && <div className="notice notice-info" role="status"><Icon name="file" /><p>Dosya yalnızca başlık içeriyor. Ürün satırlarını ekleyip yeniden yükleyin.</p></div>}
          {result.errors.length > 0 && <section className="panel errors-panel" aria-labelledby="errors-title">
            <div className="results-panel-heading"><div><h3 id="errors-title">Düzeltilmesi gereken satırlar</h3><p>Başlık satırı 1. satırdır. Hatalı satırlar kaydedilmedi.</p></div><span className="count-pill">{number.format(result.errors.length)} satır</span></div>
            <ul className="error-list">{result.errors.map((row) => <li key={row.rowNumber}><span className="row-label">Satır {number.format(row.rowNumber)}</span><ul>{row.messages.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul></li>)}</ul>
          </section>}
          {products.length > 0 && <section className="panel products-panel" aria-labelledby="products-title">
            <div className="results-panel-heading"><div><h3 id="products-title">Ürün pasaportları</h3><p>Bu yüklemede kabul edilen {number.format(products.length)} farklı ürün.</p></div><span className="view-badge">{role === 'yetkili' ? 'Yetkili görünümü · demo' : 'Tüketici görünümü'}</span></div>
            <div className="table-scroll" role="region" aria-label="Ürün pasaportları tablosu" tabIndex={0}>
              <table><caption className="visually-hidden">Bu yüklemede kabul edilen ürünler ve pasaport bağlantıları</caption>
                <thead><tr><th scope="col">ÜRÜN</th><th scope="col">GTIN</th><th scope="col">BU YÜKLEMEDE</th><th scope="col">ÇIKTILAR</th></tr></thead>
                <tbody>{products.map((product) => <tr key={product.gtin}><td><span className="product-name">{product.name}</span></td><td><span className="gtin-code">{product.gtin}</span></td><td><span className="batch-count">{number.format(product.batches.size)} parti</span></td>
                  <td><div className="output-links"><a className="passport-link" href={passportUrl(product.gtin, 'html', role)} target="_blank" rel="noopener noreferrer" aria-label={`${product.name} HTML pasaportunu yeni sekmede aç`}>Pasaport <Icon name="external" size={13} /></a><a href={passportUrl(product.gtin, 'jsonld', role)} target="_blank" rel="noopener noreferrer" aria-label={`${product.name} JSON-LD çıktısını yeni sekmede aç`}>JSON-LD</a><a href={passportUrl(product.gtin, 'qr')} download={`${product.gtin}.png`} aria-label={`${product.name} QR kodunu indir`}><Icon name="qr" size={16} /> QR</a></div></td>
                </tr>)}</tbody>
              </table>
            </div>
            <p className="table-note">Mevcut değerlerle aynı olan satırlar kabul edilir; yeniden yazılmaz ve ek sürüm oluşturmaz.</p>
          </section>}
        </section>}

        <footer className="page-footer"><span>mini<strong>dpp</strong>.</span><p>Veriden pasaporta, açık ve izlenebilir.</p><span>HTML <span aria-hidden="true">/</span> JSON-LD <span aria-hidden="true">/</span> QR</span></footer>
      </main>
    </>
  )
}

export default App
