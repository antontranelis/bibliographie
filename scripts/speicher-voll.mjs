// Vollen Browserspeicher in einer Seite simulieren und wieder aufheben (für Browser-Prüfungen)
export const speicherVoll = (page) =>
  page.evaluate(() => {
    const echt = IDBObjectStore.prototype.put
    window.__echtesPut = echt
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Speicher voll', 'QuotaExceededError')
    }
  })
export const speicherFrei = (page) =>
  page.evaluate(() => {
    if (window.__echtesPut) IDBObjectStore.prototype.put = window.__echtesPut
  })
