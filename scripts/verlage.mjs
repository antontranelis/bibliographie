// Prüft Verlage, ISBN und Erscheinungstag im Browser. Aufruf: node scripts/verlage.mjs <url> [ausgabeordner]
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/', aus] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

async function seite({ katalog = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
  page.on('pageerror', (e) => fehler.push(e.message))
  if (!katalog) {
    await page.route('https://lobid.org/**', (r) => r.abort())
    await page.route('https://services.dnb.de/**', (r) => r.abort())
  }
  await page.goto(url)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  return page
}
// Die App speichert 400 ms verzögert
const warte = (page) => page.waitForTimeout(500)
const daten = async (page) => {
  await warte(page)
  return page.evaluate(() => JSON.parse(localStorage.getItem('bibliographie:datenstamm:v1') ?? '{"werke":[],"verlage":[]}'))
}
const name = (v) => [...v.namen].sort((a, b) => (parseInt(a.abJahr) || -1e9) - (parseInt(b.abJahr) || -1e9)).at(-1).name
async function karte(page, { autor, titel, jahr, verlag, ort }) {
  await page.getByLabel('Nachname, Person 1').fill(autor)
  await page.getByRole('combobox', { name: 'Titel' }).fill(titel)
  await page.keyboard.press('Escape')
  if (jahr) await page.getByLabel('Jahr', { exact: true }).first().fill(jahr)
  if (verlag) {
    await page.getByLabel('Verlag', { exact: true }).first().fill(verlag)
    await page.keyboard.press('Escape')
  }
  if (ort !== undefined) await page.getByLabel('Ort', { exact: true }).first().fill(ort)
}

// 1. Neuer Verlag wird beim Festanlegen gemerkt
{
  const page = await seite()
  await karte(page, { autor: 'Muster', titel: 'Erstes Buch', jahr: '1950', verlag: 'Mein Verlag', ort: 'Basel' })
  pruefe('Abgleich kündigt neuen Verlag an', (await page.locator('.abgleich-zeile.neu').count()) === 1)
  await page.keyboard.press('Control+Enter')
  const d = await daten(page)
  pruefe('Neuer Verlag ist nach dem Festanlegen gemerkt', d.verlage.length === 1 && name(d.verlage[0]) === 'Mein Verlag' && d.verlage[0].orte[0].ort === 'Basel')
  pruefe('Auflage ist mit dem Verlag verknüpft', d.werke[0].ausgaben[0].auflagen[0].verlagId === d.verlage[0].id)

  // 2. Exakter Name verknüpft sofort, Ort kommt mit; abweichender Ort wird als Wechsel gelernt
  await karte(page, { autor: 'Muster', titel: 'Zweites Buch', jahr: '1960', verlag: 'mein verlag' })
  pruefe('Ort kommt bei bekanntem Verlag mit dem Jahr', (await page.getByLabel('Ort', { exact: true }).first().inputValue()) === 'Basel')
  await page.getByLabel('Ort', { exact: true }).first().fill('Zürich')
  const knopf = page.getByRole('button', { name: /Ortswechsel nach Zürich ab 1960 eintragen/ })
  pruefe('Abweichender Ort bietet Ortswechsel an', (await knopf.count()) === 1)
  await knopf.click()
  const d2 = await daten(page)
  pruefe('Ortswechsel steht in der Verlagskarte', d2.verlage[0].orte.map((o) => `${o.abJahr} ${o.ort}`).join(', ') === ' Basel, 1960 Zürich')
  pruefe('Hinweis verschwindet nach dem Eintragen', (await knopf.count()) === 0)

  // 3. Erscheinungstag: Kalender auf das Jahr begrenzt, leeres Jahr wird aus dem Tag gefüllt
  await page.getByRole('button', { name: /Weitere Angaben zur Auflage/ }).first().click()
  const tag = page.getByLabel('Erscheinungstag')
  pruefe('Kalender öffnet im Jahr der Zeile', (await tag.getAttribute('min')) === '1960-01-01' && (await tag.getAttribute('max')) === '1960-12-31')
  await page.getByLabel('ISBN').fill('3-7274-0040-5')
  await page.keyboard.press('Control+Enter')
  await karte(page, { autor: 'Muster', titel: 'Drittes Buch' })
  await page.getByRole('button', { name: /Weitere Angaben zur Auflage/ }).first().click()
  await page.getByLabel('Erscheinungstag').fill('1971-03-15')
  pruefe('Erscheinungstag füllt das leere Jahr', (await page.getByLabel('Jahr', { exact: true }).first().inputValue()) === '1971')

  // 4. ISBN: in der eigenen Kartei auffindbar und in der Liste zuschaltbar
  await page.keyboard.press('Alt+KeyN')
  await page.getByRole('combobox', { name: 'Titel' }).fill('3727400405')
  await page.locator('.marke-vorhanden').first().waitFor({ timeout: 5000 }).catch(() => {})
  pruefe('ISBN im Titelfeld findet die eigene Karte', (await page.locator('.marke-vorhanden').count()) === 1)
  await page.keyboard.press('Escape')
  await page.keyboard.press('F4')
  await page.getByLabel('ISBN angeben').check()
  pruefe('ISBN erscheint in der Liste', (await page.getByText('ISBN 3-7274-0040-5').count()) > 0)

  // 5. Verlage als eigener Reiter; Umbenennen zieht verknüpfte Auflagen nach
  await page.keyboard.press('F5')
  pruefe('F5 öffnet die Verlage', (await page.getByRole('heading', { name: 'Verlage', level: 1 }).count()) === 1)
  if (aus) await page.screenshot({ path: `${aus}/verlage.png`, fullPage: true })
  // Verlagskarte schrittweise bearbeiten wie ein Mensch: löschen, neu tippen, Ortswechsel mit Jahr vor Ort
  const vorher = JSON.stringify((await daten(page)).werke)
  const nameFeld = page.getByLabel('Name', { exact: true }).first()
  await nameFeld.fill('')
  await nameFeld.pressSequentially('Mein Verlag AG')
  await page.getByRole('button', { name: '+ Ortswechsel' }).first().click()
  await page.getByLabel('Ort ab Jahr').last().pressSequentially('1990')
  await page.getByLabel('Ort', { exact: true }).last().pressSequentially('Leipzig')
  const d3 = await daten(page)
  pruefe('Bearbeiten der Verlagskarte lässt die Karten unverändert', JSON.stringify(d3.werke) === vorher)
  pruefe('Verlagskarte hat die neuen Angaben', name(d3.verlage[0]) === 'Mein Verlag AG' && d3.verlage[0].orte.some((o) => o.abJahr === '1990' && o.ort === 'Leipzig'))
  // Neue Auflage mit diesem Verlag bekommt den neuen Namen und den Ort zum Jahr
  await page.keyboard.press('F2')
  await karte(page, { autor: 'Muster', titel: 'Fünftes Buch', jahr: '1995' })
  await page.getByLabel('Verlag', { exact: true }).first().fill('m')
  await page.getByLabel('Verlag', { exact: true }).first().press('Enter')
  pruefe('Neue Auflage nutzt die bearbeitete Verlagskarte', (await page.getByLabel('Verlag', { exact: true }).first().inputValue()) === 'Mein Verlag AG' && (await page.getByLabel('Ort', { exact: true }).first().inputValue()) === 'Leipzig')
  await page.close()
}

// 6. Ähnliche Schreibweise: Abgleich auf der Karte, danach Ortswarnung über die Verknüpfung
{
  const page = await seite()
  await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()
  await karte(page, { autor: 'Muster', titel: 'Viertes Buch', jahr: '1923', verlag: 'Philos.-Anthroposophischer Verl.' })
  pruefe('Ähnlicher Verlag wird erkannt', (await page.getByText('ist vermutlich').count()) === 1)
  await page.getByRole('button', { name: 'Ja, derselbe Verlag' }).click()
  const d = await daten(page)
  const pav = d.verlage.find((v) => name(v) === 'Philosophisch-Anthroposophischer Verlag')
  const a = d.werke.find((w) => w.titel === 'Viertes Buch').ausgaben[0].auflagen[0]
  pruefe('Schreibweise gemerkt und verknüpft', pav.schreibweisen.includes('Philos.-Anthroposophischer Verl.') && a.verlagId === pav.id)
  pruefe('Ortswarnung im Wechseljahr greift über die Schreibweise', (await page.locator('[role=alert]').count()) === 1)
  if (aus) {
    await page.locator('.rueckseite textarea').fill('Erste Zeile mit Unterlängen gjpqy\nZweite Zeile\n\nVierte Zeile')
    await page.locator('.rueckseite').screenshot({ path: `${aus}/rueckseite.png` })
  }
  await page.close()
}

// 7. Katalogimport: Festanlegen gruppiert die Fragen pro Verlag
{
  const page = await seite({ katalog: true })
  await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()
  await page.getByLabel('Nachname, Person 1').fill('Steiner')
  await page.getByRole('combobox', { name: 'Titel' }).fill('Philosophie der Freiheit')
  await page.locator('.vorschlag:has(.vorschlag-anzahl)').first().waitFor({ timeout: 20000 })
  await page.locator('.vorschlag:has(.vorschlag-anzahl)').first().click()
  await page.locator('.ausgaben-wahl').waitFor()
  await page.getByRole('button', { name: /als Auflagen? übernehmen/ }).click()
  const zeilen = await page.locator('.abgleich-zeile').allInnerTexts()
  if (aus) await page.screenshot({ path: `${aus}/katalog-abgleich.png`, fullPage: true })
  const dialoge = []
  page.on('dialog', (dlg) => {
    dialoge.push(dlg.message().split('\n')[0])
    dlg.accept()
  })
  const vorher = (await daten(page)).verlage.length
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(300)
  const d = await daten(page)
  const w = d.werke.find((x) => x.status === 'fest' && x.ausgaben[0].auflagen.length > 5)
  pruefe('Nach Katalogimport und Festanlegen sind alle Auflagen verknüpft', w && w.ausgaben[0].auflagen.every((a) => !a.verlag || a.verlagId), `${w?.ausgaben[0].auflagen.length} Auflagen`)
  pruefe('Eine Frage pro ähnlichem Verlag, nicht pro Auflage', dialoge.length <= zeilen.filter((z) => z.includes('vermutlich')).length, `${dialoge.length} Fragen, ${zeilen.length} Abgleichzeilen, ${d.verlage.length - vorher} neue Verlage`)
  console.log('Abgleich:\n  ' + zeilen.join('\n  '))
  await page.close()
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
