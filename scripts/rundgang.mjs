// Klickt den Prototyp einmal durch und macht Bildschirmfotos. Aufruf: node scripts/rundgang.mjs <url> <ausgabeordner>
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/', aus = '.'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
const fehler = []
page.on('pageerror', (e) => fehler.push(e.message))
page.on('console', (m) => m.type() === 'error' && fehler.push(m.text()))
const reiter = (name) => page.locator('.reiter button', { hasText: name })

await page.goto(url)
await page.screenshot({ path: `${aus}/1-leere-karte.png`, fullPage: true })
await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()

// Erfassen: Autor und Titel tippen, Vorschläge aus Kartei und Katalog
await page.getByLabel('Nachname, Person 1').fill('Steiner')
await page.getByLabel('Nachname, Person 1').press('Enter')
await page.keyboard.type('Philosophie der Freiheit')
await page.locator('.vorschlag-gruppe', { hasText: 'Bibliothekskatalog' }).waitFor()
await page.locator('.vorschlag .vorschlag-anzahl').first().waitFor({ timeout: 20000 })
await page.screenshot({ path: `${aus}/2-vorschlaege.png`, fullPage: true })
const schonVorhanden = await page.locator('.marke-vorhanden').count()

// Ersten Katalogtreffer übernehmen, Ausgaben abhaken
await page.locator('.vorschlag:has(.vorschlag-anzahl)').first().click()
await page.locator('.ausgaben-wahl').waitFor()
await page.screenshot({ path: `${aus}/3-ausgaben.png`, fullPage: true })
await page.getByRole('button', { name: /als Auflagen? übernehmen/ }).click()
await page.screenshot({ path: `${aus}/4-auflagen.png`, fullPage: true })
await page.keyboard.press('Control+Enter')

// Verlagskürzel: neue Karte, "pav" tippen, Enter, Jahr des Ortswechsels
await page.getByLabel('Nachname, Person 1').fill('Testautor')
await page.getByRole('combobox', { name: 'Titel' }).fill('Testtitel')
await page.keyboard.press('Escape')
await page.getByLabel('Jahr', { exact: true }).first().fill('1923')
const verlag = page.getByLabel('Verlag', { exact: true }).first()
await verlag.fill('pav')
await verlag.press('Enter')
await page.screenshot({ path: `${aus}/5-kuerzel-warnung.png`, fullPage: true })
const ort = await page.getByLabel('Ort', { exact: true }).first().inputValue()
const warnung = await page.locator('.warnung').count()

// Kartei
await reiter('Kartei').click()
await page.locator('.kartei-karte').first().click()
await page.screenshot({ path: `${aus}/6-kartei.png`, fullPage: true })

// Liste mit Blattvorschau
await reiter('Liste').click()
await page.screenshot({ path: `${aus}/7-liste.png`, fullPage: true })
await page.getByRole('button', { name: 'Blattvorschau ansehen' }).click()
await page.screenshot({ path: `${aus}/8-blattvorschau.png`, fullPage: false })
await page.keyboard.press('Escape')

// Schmal
await page.setViewportSize({ width: 390, height: 844 })
const breiten = {}
for (const name of ['Erfassen', 'Kartei', 'Liste']) {
  await reiter(name).click()
  breiten[name] = await page.evaluate(() => document.documentElement.scrollWidth)
}
await page.screenshot({ path: `${aus}/9-telefon.png`, fullPage: false })

console.log(JSON.stringify({ schonVorhanden, ort, warnung, scrollbreiteTelefon: breiten, fehler }, null, 1))
await browser.close()
