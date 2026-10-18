// Prüft gespeicherte Listen im Browser. Aufruf: node scripts/listen.mjs <url> [ausgabeordner]
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/', aus] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const kontext = await browser.newContext({ viewport: { width: 1360, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await kontext.newPage()
page.on('pageerror', (e) => fehler.push(e.message))
page.on('dialog', (d) => d.accept())
await page.route('https://lobid.org/**', (r) => r.abort())
await page.route('https://services.dnb.de/**', (r) => r.abort())
await page.goto(url)
await page.evaluate(() => localStorage.clear())
await page.reload()
const daten = () => page.evaluate(() => JSON.parse(localStorage.getItem('bibliographie:datenstamm:v1') ?? '{"werke":[],"verlage":[],"listen":[]}'))
const reiter = (name) => page.locator('.reiter button', { hasText: name })
const eintraege = () => page.locator('.eintraege .eintrag').allInnerTexts()

// Beispiele bringen eine Liste nach Person mit
await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()
await reiter('Liste').click()
pruefe('Beispielliste nach Person', (await page.locator('#listen-name').inputValue()) === 'Rudolf Steiner' && (await eintraege()).length === 2, String((await eintraege()).length))

// Neue Liste nur von Hand
await page.getByRole('button', { name: '+ Neue Liste' }).click()
await page.locator('#listen-name').fill('Freiheit')
await page.getByLabel(/von\s+selbst aufnehmen/).uncheck()
pruefe('Liste ohne Regel ist leer', (await eintraege()).length === 0)

// Karte über die Karteikarte aufnehmen
await reiter('Kartei').click()
await page.locator('.kartei-karte', { hasText: 'Die Philosophie der Freiheit' }).dblclick()
await page.getByLabel('In Liste aufnehmen').selectOption({ label: 'Freiheit' })
await reiter('Liste').click()
await page.locator('.listen-wahl select').selectOption({ label: 'Freiheit' })
pruefe('Von Hand aufgenommene Karte steht in der Liste', (await eintraege()).length === 1)

// Kapitel anlegen und die Karte hineinlegen
await page.getByRole('button', { name: '+ Kapitel' }).click()
await page.getByLabel('Kapitel 1', { exact: true }).fill('Frühwerk')
await page.getByLabel('Kapitel', { exact: true }).selectOption({ label: '1 Frühwerk' })
await page.getByRole('button', { name: 'Blattvorschau ansehen' }).click()
const blatt = await page.locator('.blatt').innerText()
pruefe('Blatt zeigt Kapitel mit Nummer und Eintrag darunter', /1 Frühwerk\s*\n\s*Rudolf Steiner: Die Philosophie der Freiheit/.test(blatt), blatt.slice(0, 120).replace(/\n/g, ' | '))
if (aus) await page.screenshot({ path: `${aus}/listen-blatt.png` })
await page.keyboard.press('Escape')

// Bleibt nach dem Neuladen erhalten
await page.reload()
await reiter('Liste').click()
await page.locator('.listen-wahl select').selectOption({ label: 'Freiheit' })
const l = (await daten()).listen.find((x) => x.name === 'Freiheit')
pruefe('Liste mit Kapitel und Eintrag gespeichert', l && l.regel === null && l.kapitel[0]?.titel === 'Frühwerk' && l.eintraege[0]?.kapitelId === l.kapitel[0].id)
pruefe('Kapitel erscheint nach dem Neuladen', (await page.locator('.kapitel-kopf input').inputValue()) === 'Frühwerk')
if (aus) await page.screenshot({ path: `${aus}/listen.png`, fullPage: true })

// Zeile kopieren
await page.locator('.eintraege .eintrag').first().hover()
await page.getByRole('button', { name: 'kopieren' }).first().click()
await page.getByRole('button', { name: 'kopiert' }).waitFor({ timeout: 5000 }).catch(() => {})
const kopie = await page.evaluate(() => navigator.clipboard.readText())
const html = await page.evaluate(async () => { const [i] = await navigator.clipboard.read(); return i.types.includes('text/html') ? (await i.getType('text/html')).text() : '' })
pruefe('Zeile in der Zwischenablage', kopie.startsWith('Rudolf Steiner: Die Philosophie der Freiheit'), kopie.slice(0, 60))
pruefe('Titel fett in der Zwischenablage', html.includes('<b>Die Philosophie der Freiheit</b>'), html.slice(0, 80))

// Aus der Kartei eine Liste nach Schlagwort anlegen
await reiter('Kartei').click()
await page.getByRole('button', { name: 'Schlagwörter' }).click().catch(() => {})
const daraus = page.getByRole('button', { name: 'Liste daraus' }).first()
if (await daraus.count()) {
  await daraus.click()
  pruefe('„Liste daraus“ legt eine neue gespeicherte Liste an', (await daten()).listen.length === 3)
}

// Löschen
await page.getByRole('button', { name: 'Liste löschen' }).click()
pruefe('Liste gelöscht, Karten bleiben', (await daten()).listen.length === 2 && (await daten()).werke.length === 2)

// Schmal
await page.setViewportSize({ width: 390, height: 844 })
pruefe('Liste ohne Querscrollen auf dem Telefon', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
