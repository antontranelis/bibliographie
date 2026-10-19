// Spielt die Datenverlust-Fälle aus dem Review zu PR #1 nach. Aufruf: node scripts/datenverlust.mjs <url>
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })

async function frischeSeite() {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
  // Katalog abklemmen: die Fälle hängen nicht vom Netz ab
  await page.route('https://lobid.org/**', (r) => r.abort())
  await page.route('https://services.dnb.de/**', (r) => r.abort())
  await page.goto(url)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  return page
}
// Die App speichert 400 ms verzögert
const warte = (page) => page.waitForTimeout(500)
const werke = async (page) => {
  await warte(page)
  return page.evaluate(() => JSON.parse(localStorage.getItem('bibliographie:datenstamm:v1') ?? '{"werke":[]}').werke)
}

// Fall 1: nur ein Nachname, dann „Vorläufig lassen, nächste Karte“
{
  const page = await frischeSeite()
  await page.getByLabel('Nachname, Person 1').fill('NurAutor')
  await page.getByRole('button', { name: /Vorläufig lassen/ }).click()
  const w = await werke(page)
  pruefe('Fall 1: Karte mit nur einem Nachnamen bleibt erhalten', w.some((x) => x.personen.some((p) => p.nachname === 'NurAutor')), `${w.length} Karten`)
  await page.reload()
  const nachReload = await werke(page)
  pruefe('Fall 1: auch nach Neuladen', nachReload.some((x) => x.personen.some((p) => p.nachname === 'NurAutor')))
  await page.close()
}

// Fall 1b: unberührte Vorlage erzeugt keine Karte
{
  const page = await frischeSeite()
  await page.getByRole('button', { name: /Vorläufig lassen/ }).click()
  await page.getByRole('button', { name: /Vorläufig lassen/ }).click()
  pruefe('Fall 1b: leere Karten landen nicht in der Kartei', (await werke(page)).length === 0)
  await page.close()
}

// Fall 2: vorhandenes Werk wählen, nachdem ein eigener Verlag eingetragen wurde
async function fall2(antwort) {
  const page = await frischeSeite()
  await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()
  await page.getByLabel('Nachname, Person 1').fill('Steiner')
  const titel = page.getByRole('combobox', { name: 'Titel' })
  await titel.fill('Philosophie der Freiheit')
  await page.keyboard.press('Escape')
  const verlag = page.getByLabel('Verlag', { exact: true }).first()
  await verlag.fill('Mein eigens erfasster Verlag')
  await page.keyboard.press('Escape')
  const vorher = (await werke(page)).length
  let dialog = ''
  page.once('dialog', (d) => {
    dialog = d.message()
    antwort ? d.accept() : d.dismiss()
  })
  await titel.click()
  await titel.press('End')
  await titel.type(' ')
  await page.locator('.marke-vorhanden').first().waitFor({ timeout: 8000 })
  await page.getByText('Zur Karte').first().click()
  await page.waitForTimeout(300)
  const nachher = await werke(page)
  const verlagDa = nachher.some((x) => x.ausgaben.flatMap((y) => y.auflagen).some((a) => a.verlag === 'Mein eigens erfasster Verlag'))
  await page.close()
  return { vorher, nachher: nachher.length, verlagDa, dialog }
}
{
  const r = await fall2(false)
  pruefe('Fall 2: Rückfrage erscheint', r.dialog.includes('Auflagen'), r.dialog.split('\n')[0])
  pruefe('Fall 2: Abbrechen behält den eigenen Verlag', r.verlagDa && r.nachher === r.vorher, `${r.vorher} → ${r.nachher} Karten`)
  const r2 = await fall2(true)
  pruefe('Fall 2: OK verwirft erst nach Bestätigung', !r2.verlagDa && r2.nachher === r2.vorher - 1, `${r2.vorher} → ${r2.nachher} Karten`)
}

// Fall 2b: nur Suchangaben getippt, vorhandenes Werk gewählt: ohne Rückfrage weg
{
  const page = await frischeSeite()
  await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()
  await page.getByLabel('Nachname, Person 1').fill('Steiner')
  await page.getByRole('combobox', { name: 'Titel' }).fill('Philosophie der Freiheit')
  let dialog = false
  page.once('dialog', (d) => {
    dialog = true
    d.dismiss()
  })
  await page.locator('.marke-vorhanden').first().waitFor({ timeout: 8000 })
  await page.getByText('Zur Karte').first().click()
  await page.waitForTimeout(300)
  pruefe('Fall 2b: nur Suchangaben werden ohne Rückfrage verworfen', !dialog && (await werke(page)).length === 2)
  await page.close()
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
process.exit(ergebnisse.every((e) => e.ok) ? 0 : 1)
