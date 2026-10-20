// Vollen Browserspeicher in einer Seite simulieren und wieder aufheben (für Browser-Prüfungen)
export const speicherVoll = (page) =>
  page.evaluate(() => {
    const echt = Storage.prototype.setItem
    window.__echtesSetItem = echt
    Storage.prototype.setItem = function (k, v) {
      if (k === 'bibliographie:datenstamm:v1') throw new DOMException('Speicher voll', 'QuotaExceededError')
      return echt.call(this, k, v)
    }
  })
export const speicherFrei = (page) =>
  page.evaluate(() => {
    if (window.__echtesSetItem) Storage.prototype.setItem = window.__echtesSetItem
  })
