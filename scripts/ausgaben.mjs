// Prüft Ausgaben, Auflagenauswahl und Mitwirkende im Browser. Aufruf: node scripts/ausgaben.mjs <url> [ausgabeordner]
import { chromium } from 'playwright-core'
import { spieleEin } from './einspielen.mjs'

const [url = 'http://localhost:4321/', aus] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
page.on('pageerror', (e) => fehler.push(e.message))
await page.route('https://lobid.org/**', (r) => r.abort())
await page.route('https://services.dnb.de/**', (r) => r.abort())
await page.goto(url)
await page.evaluate(() => localStorage.clear())
await page.reload()
// Die App speichert 400 ms verzögert
const warte = (page) => page.waitForTimeout(500)
const daten = async () => {
  await warte(page)
  return page.evaluate(() => JSON.parse(localStorage.getItem('bibliographie:datenstamm:v1') ?? '{"werke":[],"verlage":[]}'))
}
const vorschau = () => page.locator('.vorschau p').innerText()

// Erste Ausgabe mit zwei Auflagen
await page.getByLabel('Nachname, Person 1').fill('Postman')
await page.getByLabel('Vorname, Person 1').fill('Neil')
await page.getByRole('combobox', { name: 'Titel' }).fill('Amusing Ourselves to Death')
await page.keyboard.press('Escape')
await page.getByLabel('Jahr', { exact: true }).first().fill('1985')
await page.getByLabel('Ort', { exact: true }).first().fill('New York')
pruefe('Eine Ausgabe sieht aus wie bisher', (await page.locator('.ausgabe-kopf').count()) === 0)
await page.getByRole('button', { name: '+ Auflage' }).click()
await page.getByLabel('Jahr', { exact: true }).nth(1).fill('1987')
pruefe('Zweite Auflage ohne Bearbeitung erscheint nicht in der Liste', (await vorschau()) === 'Neil Postman: Amusing Ourselves to Death, New York 1985', await vorschau())
const haken = page.getByLabel('Auflage 1987 in der Liste nennen')
pruefe('Haken folgt der Regel', (await haken.isChecked()) === false)
await haken.check()
pruefe('Haken nimmt die Auflage in die Liste', (await vorschau()) === 'Neil Postman: Amusing Ourselves to Death, New York 1985; 1987', await vorschau())
await haken.uncheck()
const nach = (await daten()).werke[0]?.ausgaben[0].auflagen[1]
pruefe('Zurück zur Regel speichert keine Markierung', nach && nach.inListe === undefined, JSON.stringify(nach?.inListe))

// Bearbeitung macht die Auflage nennenswert
await page.getByRole('button', { name: 'Weitere Angaben zur Auflage 1987' }).click()
await page.getByLabel('Bearbeitung').fill('erw.')
await page.getByLabel('Auflage', { exact: true }).nth(1).fill('2')
pruefe('Bearbeitete Auflage erscheint', (await vorschau()) === 'Neil Postman: Amusing Ourselves to Death, New York 1985; 2. erw. Aufl. 1987', await vorschau())

// Übersetzung als zweite Ausgabe
await page.getByRole('button', { name: '+ Ausgabe' }).click()
pruefe('Zwei Ausgaben bekommen Köpfe', (await page.locator('.ausgabe-kopf').count()) === 2)
const zweite = page.getByRole('region', { name: /^Ausgabe 2/ })
await zweite.getByLabel('Art').selectOption('uebersetzung')
await zweite.getByLabel('Sprache').fill('deutsch')
await zweite.getByLabel('Eigener Titel').fill('Wir amüsieren uns zu Tode')
await zweite.getByLabel('Jahr', { exact: true }).fill('1985')
await zweite.getByLabel('Ort', { exact: true }).fill('Frankfurt a.M.')
pruefe(
  'Übersetzung erscheint in der Druckzeile',
  (await vorschau()) === 'Neil Postman: Amusing Ourselves to Death, New York 1985; 2. erw. Aufl. 1987; deutsche Ausgabe: Wir amüsieren uns zu Tode, Frankfurt a.M. 1985',
  await vorschau(),
)
pruefe('Titel der Übersetzung ist fett', (await page.locator('.vorschau p .fett').allInnerTexts()).join('|') === 'Amusing Ourselves to Death|Wir amüsieren uns zu Tode')

// Mitwirkende an der Übersetzung, nicht gedruckt
await zweite.getByRole('button', { name: /Mitwirkende/ }).click()
await zweite.getByRole('button', { name: '+ Mitwirkende' }).click()
await zweite.getByLabel('Mitwirkung').selectOption('uebersetzung')
await zweite.getByLabel('Nachname').fill('Kaiser')
const w = (await daten()).werke[0]
pruefe('Mitwirkende gespeichert', w?.ausgaben[1].mitwirkende[0]?.rolle === 'uebersetzung' && w.ausgaben[1].mitwirkende[0].nachname === 'Kaiser')
pruefe('Mitwirkende werden nicht gedruckt', !(await vorschau()).includes('Kaiser'))

// Auflage einer anderen Ausgabe zuordnen; die weiteren Angaben zur Auflage 1987 sind noch offen
await page.locator('.detailzeile select').first().selectOption({ index: 1 })
const w2 = (await daten()).werke[0]
pruefe('Auflage wechselt die Ausgabe', w2.ausgaben[0].auflagen.length === 1 && w2.ausgaben[1].auflagen.map((a) => a.jahr).join(',') === '1985,1987', w2.ausgaben.map((x) => x.auflagen.map((a) => a.jahr).join('+')).join(' | '))
if (aus) await page.screenshot({ path: `${aus}/ausgaben.png`, fullPage: true })

// Ersterscheinung von Hand
await page.getByLabel('Ersterscheinung').fill('1984')
pruefe('Ersterscheinung von Hand gespeichert', (await daten()).werke[0].ersterscheinung === '1984')

// Aufsatz ohne Ausgabe aus alten Daten lässt sich in ein Buch umstellen (#8)
{
  const aufsatz = { ...(await daten()).werke[0], id: 'aufsatz', titel: 'Ein Beitrag', art: 'aufsatz', ausgaben: [], erschienenIn: { art: 'zeitschrift', titel: 'Gegenwart', jahrgang: '', jahr: '2004', heft: '1', ausgabe: '', seitenVon: '', seitenBis: '' } }
  await spieleEin(page, { werke: [aufsatz], verlage: [], listen: [] })
  await page.locator('.reiter button', { hasText: 'Kartei' }).click()
  await page.locator('.kartei-karte', { hasText: 'Ein Beitrag' }).dblclick()
  await page.getByRole('radio', { name: 'Buch', exact: true }).click()
  await page.getByRole('button', { name: '+ Auflage' }).click()
  await page.getByLabel('Jahr', { exact: true }).last().fill('2010')
  const w3 = (await daten()).werke.find((x) => x.id === 'aufsatz')
  pruefe('Aufsatz ohne Ausgabe wird Buch mit Auflage', w3?.art === 'buch' && w3.ausgaben.length === 1 && w3.ausgaben[0].auflagen.some((a) => a.jahr === '2010'), JSON.stringify(w3?.ausgaben.map((x) => x.auflagen.map((a) => a.jahr))))
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
