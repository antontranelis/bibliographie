// Prüft Themenordnung, Themen auf der Karte, Kartei-Register und Listen nach Themen. Aufruf: node scripts/themen.mjs <url> [ausgabeordner]
import { chromium } from 'playwright-core'
import { gespeichert } from './einspielen.mjs'

const [url = 'http://localhost:4321/', aus] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
page.on('pageerror', (e) => fehler.push(e.message))
page.on('dialog', (d) => d.accept())
await page.route('https://lobid.org/**', (r) => r.abort())
await page.route('https://services.dnb.de/**', (r) => r.abort())
await page.goto(url)
const daten = async () => {
  await page.waitForTimeout(500)
  return (await gespeichert(page)) ?? { werke: [], verlage: [], listen: [], themen: [] }
}
const reiter = (name) => page.locator('.reiter button', { hasText: name })

try {
  await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()
  await page.keyboard.press('F5')
  pruefe('F5 öffnet die Themenordnung mit den Beispielthemen', (await page.getByRole('treeitem').count()) === 3)

  // Neues Thema mit Unterthema
  await page.getByRole('button', { name: '+ Thema' }).click()
  await page.getByRole('treeitem').last().getByLabel('Nummer').fill('III.')
  await page.getByRole('treeitem').last().getByLabel('Titel des Themas').fill('Medien')
  await page.getByRole('treeitem', { name: 'III. Medien' }).getByRole('button', { name: '+ Unterthema' }).click()
  await page.getByRole('treeitem').last().getByLabel('Titel des Themas').fill('Film')
  const ebenen = await page.getByRole('treeitem').evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-level')).join(','))
  pruefe('Unterthema eine Ebene tiefer', ebenen === '1,1,2,1,2', ebenen)
  if (aus) await page.screenshot({ path: `${aus}/themen.png`, fullPage: true })

  // Thema auf der Karte
  await reiter('Kartei').click()
  await page.locator('.kartei-karte', { hasText: 'Die Philosophie der Freiheit' }).dblclick()
  await page.getByLabel('Thema hinzufügen').fill('film')
  await page.keyboard.press('Enter')
  pruefe('Thema per Suche auf der Karte', (await page.locator('.thema-chip').allInnerTexts()).some((t) => t.includes('III. Medien › Film')))
  if (aus) await page.screenshot({ path: `${aus}/themen-karte.png`, fullPage: true })

  // Kartei nach Thema, Liste daraus
  await reiter('Kartei').click()
  await page.getByRole('radio', { name: 'nach Thema' }).click()
  const gruppen = await page.locator('.gruppe-kopf h2').allInnerTexts()
  pruefe('Kartei nach Thema in der Reihenfolge der Ordnung', gruppen.join(' | ') === 'I. Erkenntnis und Freiheit | II. Erziehung › a) Das Kind im Elternhaus | III. Medien › Film', gruppen.join(' | '))
  await page.locator('.kasten-gruppe', { hasText: 'III. Medien › Film' }).getByRole('button', { name: 'Liste daraus' }).click()
  pruefe('„Liste daraus“ legt eine Liste zum Thema an', (await page.locator('#listen-name').inputValue()) === 'Film' && (await page.locator('.eintraege .eintrag').count()) === 1)

  // Von Hand aufgenommene Karte außerhalb des Themas bleibt beim Umschalten auf die Themengliederung (#20)
  await reiter('Kartei').click()
  await page.getByRole('radio', { name: 'nach Autor' }).click()
  await page.locator('.kartei-karte', { hasText: 'Die Erziehung des Kindes' }).dblclick()
  await page.getByLabel('In Liste aufnehmen').selectOption({ label: 'Film' })
  await reiter('Liste').click()
  await page.locator('.listen-wahl select').selectOption({ label: 'Film' })
  const vorher = await page.locator('.eintraege .eintrag').count()
  await page.getByRole('radio', { name: 'nach Themenordnung' }).click()
  const nachher = await page.locator('.eintraege .eintrag').count()
  const koepfeFilm = await page.locator('.thema-kopf').allInnerTexts()
  pruefe('Von Hand Aufgenommenes bleibt in der Themengliederung', vorher === 2 && nachher === 2 && koepfeFilm.includes('Weitere Titel'), `${vorher} → ${nachher}, ${koepfeFilm.join(' | ')}`)
  await page.getByRole('radio', { name: 'keine', exact: true }).click()

  // Themenkartei als eine Liste
  await page.getByRole('button', { name: '+ Neue Liste' }).click()
  await page.locator('#listen-name').fill('Themenkartei')
  await page.getByRole('radio', { name: 'nach Themenordnung' }).click()
  const koepfe = await page.locator('.thema-kopf').allInnerTexts()
  pruefe('Themenkartei: Kapitel aus der Ordnung, leere Zweige entfallen', koepfe.join(' | ') === 'I. Erkenntnis und Freiheit | II. Erziehung | a) Das Kind im Elternhaus | III. Medien | Film', koepfe.join(' | '))
  const pdf = await page.locator('.eintraege .eintrag', { hasText: 'Die Philosophie der Freiheit' }).count()
  pruefe('Ein Werk steht unter jedem seiner Themen', pdf === 2, String(pdf))
  await page.getByRole('button', { name: 'Blattvorschau ansehen' }).click()
  const blatt = await page.locator('.blatt h2, .blatt h3').allInnerTexts()
  pruefe('Blatt mit Themen als Überschriften', blatt.includes('III. Medien') && blatt.includes('Film'), blatt.join(' | '))
  if (aus) await page.screenshot({ path: `${aus}/themen-blatt.png` })
  await page.keyboard.press('Escape')

  // Thema entfernen: Zuordnung und Listenregel verschwinden
  await page.keyboard.press('F5')
  await page.getByRole('button', { name: 'III. Medien entfernen' }).click()
  const d = await daten()
  const karte = d.werke.find((w) => w.titel === 'Die Philosophie der Freiheit')
  pruefe('Entfernen nimmt das Unterthema mit', d.themen.length === 3, String(d.themen.length))
  pruefe('Karte verliert nur die entfernten Themen', karte.themen.length === 1)
  pruefe('Listenregel zum entfernten Thema ist gelöst', d.listen.find((l) => l.name === 'Film')?.regel.thema === '')

  await page.reload()
  // Tastenkürzel greifen erst mit Schreibrecht
  await page.waitForTimeout(500)
  await page.keyboard.press('F5')
  pruefe('Themenordnung bleibt nach dem Neuladen', (await page.getByRole('treeitem').count()) === 3)
  await page.keyboard.press('F6')
  pruefe('F6 öffnet die Verlage', (await page.getByRole('heading', { name: 'Verlage', level: 1 }).count()) === 1)
} catch (e) {
  pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0])
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
