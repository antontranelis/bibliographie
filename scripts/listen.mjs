// Prüft gespeicherte Listen im Browser. Aufruf: node scripts/listen.mjs <url> [ausgabeordner]
import { chromium } from 'playwright-core'
import { gespeichert, leere, spieleEin } from './einspielen.mjs'

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
await leere(page)
// Die App speichert 400 ms verzögert
const warte = (page) => page.waitForTimeout(500)
const daten = async () => {
  await warte(page)
  return (await gespeichert(page)) ?? { werke: [], verlage: [], listen: [], themen: [] }
}
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

// Zweite Karte von Hand, Reihenfolge von Hand
await reiter('Kartei').click()
await page.locator('.kartei-karte', { hasText: 'Die Erziehung des Kindes' }).dblclick()
await page.getByLabel('In Liste aufnehmen').selectOption({ label: 'Freiheit' })
await reiter('Liste').click()
await page.locator('.listen-wahl select').selectOption({ label: 'Freiheit' })
await page.getByRole('radio', { name: 'von Hand' }).click()
await page.locator('.eintraege .eintrag').nth(1).getByRole('button', { name: 'nach oben' }).click()
const reihe = (await eintraege()).map((t) => (t.includes('Erziehung') ? 'Erziehung' : 'Freiheit'))
pruefe('Reihenfolge von Hand', reihe.join(',') === 'Erziehung,Freiheit', reihe.join(','))
pruefe('Keine eigenen Kapitel mehr in der Liste', (await page.getByRole('button', { name: '+ Kapitel' }).count()) === 0 && (await page.getByLabel('Kapitel', { exact: true }).count()) === 0)
await page.getByRole('button', { name: 'Blattvorschau ansehen' }).click()
const blatt = await page.locator('.blatt').innerText()
pruefe('Blatt in der Reihenfolge der Liste', /Freiheit\s*\n\s*Rudolf Steiner: Die Erziehung des Kindes[\s\S]*Die Philosophie der Freiheit/.test(blatt), blatt.slice(0, 120).replace(/\n/g, ' | '))
if (aus) await page.screenshot({ path: `${aus}/listen-blatt.png` })
await page.keyboard.press('Escape')

// Bleibt nach dem Neuladen erhalten
await page.reload()
await page.waitForTimeout(500)
await reiter('Liste').click()
await page.locator('.listen-wahl select').selectOption({ label: 'Freiheit' })
const l = (await daten()).listen.find((x) => x.name === 'Freiheit')
pruefe('Liste mit Einträgen in ihrer Reihenfolge gespeichert', l && l.regel === null && l.sortierung === 'hand' && l.eintraege.length === 2 && !('kapitel' in l))
if (aus) await page.screenshot({ path: `${aus}/listen.png`, fullPage: true })

// Zeile kopieren
await page.locator('.eintraege .eintrag').first().hover()
await page.getByRole('button', { name: 'kopieren' }).first().click()
await page.getByRole('button', { name: 'kopiert' }).waitFor({ timeout: 5000 }).catch(() => {})
const kopie = await page.evaluate(() => navigator.clipboard.readText())
const html = await page.evaluate(async () => { const [i] = await navigator.clipboard.read(); return i.types.includes('text/html') ? (await i.getType('text/html')).text() : '' })
pruefe('Zeile in der Zwischenablage', kopie.startsWith('Rudolf Steiner: Die Erziehung des Kindes'), kopie.slice(0, 60))
pruefe('Titel fett in der Zwischenablage', html.includes('<b>Die Erziehung des Kindes vom Gesichtspunkte der Geisteswissenschaft</b>'), html.slice(0, 80))

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

// Bei jeder Person: die Einordnungsperson steht in der gedruckten Zeile vorn (#11)
{
  const vorlage = (await daten()).werke[0]
  const werk = (id, personen) => ({ ...vorlage, id, titel: id, untertitel: '', status: 'fest', personen, schlagwoerter: [], ausgaben: [{ ...vorlage.ausgaben[0], auflagen: [{ ...vorlage.ausgaben[0].auflagen[0], jahr: '1990', ort: 'Basel', gedrucktesJahr: '' }] }] })
  const p = (vorname, nachname) => ({ vorname, nachname, rolle: 'autor' })
  const liste = { ...(await daten()).listen[0], id: 'personen', name: 'Personen', regel: { person: '', schlagwort: '', nurPrimaer: false, nurFest: false }, eintraege: [], ausgenommen: [], sortierung: 'name', jedePerson: true }
  const neu = { werke: [werk('Gemeinschaftswerk', [p('Anna', 'Adler'), p('Zoe', 'Zebra')]), werk('Mittelwerk', [p('Max', 'Mitte')])], verlage: [], listen: [liste] }
  await spieleEin(page, neu)
  await reiter('Liste').click()
  const zeilen = (await page.locator('.eintraege .eintrag > span:first-of-type').allInnerTexts()).map((t) => t.split(',')[0])
  pruefe('Liste: Einordnungsperson vorn', zeilen.join(' | ') === 'Anna Adler/Zoe Zebra: Gemeinschaftswerk | Max Mitte: Mittelwerk | Zoe Zebra/Anna Adler: Gemeinschaftswerk', zeilen.join(' | '))
  await page.getByRole('button', { name: 'Blattvorschau ansehen' }).click()
  const blatt = (await page.locator('.blatt p').allInnerTexts()).map((t) => t.split(',')[0])
  pruefe('Blatt: Einordnungsperson vorn', blatt.join(' | ') === 'Anna Adler/Zoe Zebra: Gemeinschaftswerk | Max Mitte: Mittelwerk | Zoe Zebra/Anna Adler: Gemeinschaftswerk', blatt.join(' | '))
  await page.keyboard.press('Escape')
  const karte = (await daten()).werke.find((w) => w.id === 'Gemeinschaftswerk')
  pruefe('Karte behält ihre Personenfolge', karte.personen.map((x) => x.nachname).join('/') === 'Adler/Zebra')
}

// Lange Liste: das Blatt wächst mit, kein Text läuft über seinen Rand hinaus
{
  const vorlage = (await daten()).werke[0]
  const werke = Array.from({ length: 80 }, (_, i) => ({ ...vorlage, id: `lang-${i}`, titel: `Titel ${String(i).padStart(2, '0')}`, untertitel: '' }))
  await spieleEin(page, { werke, verlage: [], listen: [{ ...(await daten()).listen[0], id: 'lang', name: 'Lang', regel: { person: '', schlagwort: '', nurPrimaer: false, nurFest: false, thema: '', mitUnterthemen: true }, eintraege: [], ausgenommen: [], gliederung: 'keine' }], themen: [] })
  await reiter('Liste').click()
  await page.getByRole('button', { name: 'Blattvorschau ansehen' }).click()
  const blatt = await page.locator('.blatt').evaluate((b) => ({ hoehe: b.clientHeight, inhalt: b.scrollHeight, absaetze: b.querySelectorAll('p').length }))
  pruefe('Langes Blatt wächst mit dem Inhalt', blatt.absaetze >= 80 && blatt.inhalt <= blatt.hoehe + 1, `${blatt.absaetze} Zeilen, Höhe ${blatt.hoehe}, Inhalt ${blatt.inhalt}`)
  await page.keyboard.press('Escape')
}

// Schmal
await page.setViewportSize({ width: 390, height: 844 })
pruefe('Liste ohne Querscrollen auf dem Telefon', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
