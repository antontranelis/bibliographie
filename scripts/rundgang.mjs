// Klickt den Prototyp einmal durch und macht Bildschirmfotos. Aufruf: node scripts/rundgang.mjs <url> <ausgabeordner>
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/', aus = '.'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
const fehler = []
page.on('pageerror', (e) => fehler.push(e.message))
page.on('console', (m) => m.type() === 'error' && fehler.push(m.text()))

await page.goto(url)
await page.getByRole('button', { name: 'Beispielkarten laden' }).click()
await page.screenshot({ path: `${aus}/1-karte.png`, fullPage: true })

// Katalogsuche: neue Karte aus dem Katalog
await page.getByRole('button', { name: 'Im Katalog suchen' }).click()
await page.getByLabel('Autor (Nachname)').fill('Steiner')
await page.getByLabel('Titelwörter').fill('Philosophie der Freiheit')
await page.getByRole('button', { name: 'Suchen', exact: true }).click()
await page.locator('.gruppe').first().waitFor({ timeout: 20000 })
await page.locator('.gruppe-kopf').first().click()
await page.screenshot({ path: `${aus}/2-katalog.png`, fullPage: true })
await page.getByRole('button', { name: /Als neue Karte übernehmen/ }).first().click()
await page.screenshot({ path: `${aus}/3-aus-katalog.png`, fullPage: true })

// Verlagskürzel: neue Karte, "goe" tippen, Enter
await page.getByRole('button', { name: '+ Neue Karte' }).click()
await page.getByLabel('Titel', { exact: true }).fill('Testtitel')
await page.getByLabel('Jahr', { exact: true }).first().fill('1923')
const verlag = page.getByLabel(/Verlag/).first()
await verlag.fill('pav')
await verlag.press('Enter')
await page.screenshot({ path: `${aus}/4-kuerzel-warnung.png`, fullPage: true })
const ort = await page.getByLabel('Ort', { exact: true }).first().inputValue()
const warnung = await page.locator('.warnung').count()

// Liste
await page.getByRole('button', { name: 'Liste', exact: true }).click()
await page.screenshot({ path: `${aus}/5-liste.png`, fullPage: true })

// Schmal
await page.setViewportSize({ width: 390, height: 844 })
await page.getByRole('button', { name: 'Kartei', exact: true }).click()
await page.screenshot({ path: `${aus}/6-telefon.png`, fullPage: false })
const breit = await page.evaluate(() => document.documentElement.scrollWidth)

console.log(JSON.stringify({ ort, warnung, scrollbreiteTelefon: breit, fehler }, null, 1))
await browser.close()
