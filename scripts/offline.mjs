// Prüft, dass das Programm nach dem ersten Besuch ohne Internet startet. Aufruf: node scripts/offline.mjs <url>
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const kontext = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true })
const page = await kontext.newPage()
page.on('pageerror', (e) => fehler.push(e.message))
await page.goto(url)
await page.evaluate(() => navigator.serviceWorker.ready)
// Zweiter Aufruf: jetzt steuert der Service Worker die Seite
await page.reload()
pruefe('Service Worker steuert die Seite', await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))

await page.getByLabel('Nachname, Person 1').fill('Steiner')
await page.getByRole('combobox', { name: 'Titel' }).fill('Offline geschrieben')
await page.keyboard.press('Escape')
await page.getByLabel('Jahr', { exact: true }).first().fill('1920')
await page.getByLabel('Ort', { exact: true }).first().fill('Dornach')
await page.waitForTimeout(600)

await kontext.setOffline(true)
await page.reload()
pruefe('Startet ohne Internet', (await page.locator('.reiter button', { hasText: 'Kartei' }).count()) === 1)
await page.locator('.reiter button', { hasText: 'Kartei' }).click()
pruefe('Karten sind offline da', (await page.locator('.kartei-karte', { hasText: 'Offline geschrieben' }).count()) === 1)

await page.locator('.reiter button', { hasText: 'Liste' }).click()
const laden = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
await page.getByRole('button', { name: 'Als Word-Datei speichern' }).first().click()
const datei = await laden
pruefe('Word-Datei entsteht auch offline', Boolean(datei), datei?.suggestedFilename() ?? '')

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
