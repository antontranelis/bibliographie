// Vollen Browserspeicher in einer Seite simulieren und wieder aufheben (für Browser-Prüfungen). Wie beim echten
// Quota-Fehler nimmt die Datenbank den Auftrag an und bricht die Transaktion danach ab.
export const speicherVoll = (page) =>
  page.evaluate(() => {
    const echt = IDBObjectStore.prototype.put
    window.__echtesPut = echt
    IDBObjectStore.prototype.put = function (...a) {
      const anfrage = echt.apply(this, a)
      const t = this.transaction
      queueMicrotask(() => {
        try {
          t.abort()
        } catch {
          /* schon beendet */
        }
      })
      return anfrage
    }
  })
export const speicherFrei = (page) =>
  page.evaluate(() => {
    if (window.__echtesPut) IDBObjectStore.prototype.put = window.__echtesPut
  })
