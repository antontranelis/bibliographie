// Prüft, dass nur ein Fenster schreibt und die Übergabe nichts verliert. Aufruf: node scripts/fenster.mjs <url>
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const kontext = await browser.newContext()
const seite = async () => {
  const p = await kontext.newPage()
  p.on('pageerror', (e) => fehler.push(e.message))
  await p.goto(url)
  await p.waitForTimeout(400)
  return p
}
const gesperrt = (p) => p.getByRole('dialog', { name: 'In einem anderen Fenster geöffnet' })
const karte = async (p, titel) => {
  await p.locator('.reiter button', { hasText: 'Erfassen' }).click()
  await p.getByLabel('Nachname, Person 1').fill('Steiner')
  await p.getByRole('combobox', { name: 'Titel' }).fill(titel)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(600)
}
const inKartei = async (p, titel) => {
  await p.locator('.reiter button', { hasText: 'Kartei' }).click()
  return (await p.locator('.kartei-karte', { hasText: titel }).count()) === 1
}
const gespeichert = (p) => p.evaluate(() => localStorage.getItem('bibliographie:datenstamm:v1') ?? '')

const a = await seite()
pruefe('Erstes Fenster schreibt', (await gesperrt(a).count()) === 0)
const b = await seite()
pruefe('Zweites Fenster ist gesperrt', await gesperrt(b).isVisible())

await karte(a, 'Aus Fenster A')
pruefe('Karte aus A gespeichert', (await gespeichert(a)).includes('Aus Fenster A'))

await b.getByRole('button', { name: 'Hier weiterarbeiten' }).click()
await gesperrt(b).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
pruefe('B übernimmt, A ist gesperrt', (await gesperrt(b).count()) === 0 && (await gesperrt(a).isVisible()))
pruefe('B sieht die Karte aus A', await inKartei(b, 'Aus Fenster A'))

await karte(b, 'Aus Fenster B')
await b.close()
await gesperrt(a).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
pruefe('B geschlossen: A schreibt wieder von selbst', (await gesperrt(a).count()) === 0)
pruefe('A sieht beide Karten', (await inKartei(a, 'Aus Fenster A')) && (await inKartei(a, 'Aus Fenster B')))

// Gesperrtes Fenster schreibt nie, auch nicht beim Schließen
const c = await seite()
await c.close()
pruefe('Schließen eines gesperrten Fensters verliert nichts', (await gespeichert(a)).includes('Aus Fenster B'))

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
