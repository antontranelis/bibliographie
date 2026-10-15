// Prüft Lage und Tastaturbedienung der Verlagsvorschläge. Aufruf: node scripts/verlagmenue.mjs <url> [ausgabeordner]
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/', aus] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const verlage = Array.from({ length: 14 }, (_, i) => ({
  id: `v${i}`, kuerzel: `v${i}`, namen: [{ abJahr: '', name: `Verlag Nummer ${String(i + 1).padStart(2, '0')}` }],
  orte: [{ abJahr: '', ort: 'Stuttgart', wechselImJahr: false }], schreibweisen: [],
}))

for (const [breite, hoehe] of [[1360, 900], [390, 844], [1024, 560]]) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } })
  const fehler = []
  page.on('pageerror', (e) => fehler.push(e.message))
  await page.route('https://lobid.org/**', (r) => r.abort())
  await page.route('https://services.dnb.de/**', (r) => r.abort())
  await page.goto(url)
  await page.evaluate((v) => localStorage.setItem('bibliographie:datenstamm:v1', JSON.stringify({ werke: [], verlage: v })), verlage)
  await page.reload()
  const feld = page.getByLabel('Verlag', { exact: true }).first()
  // Feld an den unteren Fensterrand scrollen
  await feld.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom - window.innerHeight + 40))
  await feld.click()
  await feld.pressSequentially('verlag')
  const menue = page.locator('.verlag-menue')
  await menue.waitFor({ timeout: 3000 })
  const box = await menue.boundingBox()
  const innen = box.x >= 0 && box.y >= 0 && box.x + box.width <= breite && box.y + box.height <= hoehe
  pruefe(`${breite}×${hoehe}: Liste ganz im Fenster`, innen, `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}`)
  for (let i = 0; i < 7; i++) await feld.press('ArrowDown')
  const sichtbar = await page.evaluate(() => {
    const opt = document.querySelector('.verlag-menue [aria-selected="true"]')
    const liste = document.querySelector('.verlag-menue ul')
    if (!opt || !liste) return false
    const o = opt.getBoundingClientRect()
    const l = liste.getBoundingClientRect()
    return o.top >= l.top - 1 && o.bottom <= l.bottom + 1
  })
  const markiert = await page.locator('.verlag-menue [aria-selected="true"]').innerText()
  pruefe(`${breite}×${hoehe}: markierte Option bleibt sichtbar`, sichtbar, markiert.split('\n')[0])
  await feld.press('Enter')
  pruefe(`${breite}×${hoehe}: Enter übernimmt die markierte`, (await feld.inputValue()) === markiert.split('\n')[0])
  if (aus) await page.screenshot({ path: `${aus}/verlagmenue-${breite}.png` })
  if (fehler.length) pruefe(`${breite}×${hoehe}: keine Seitenfehler`, false, fehler.join('; '))
  await page.close()
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
process.exit(ergebnisse.every((e) => e.ok) ? 0 : 1)
