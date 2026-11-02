// Prüft das Einlesen einer Themenordnung und die Themen beim Einlesen einer Literaturliste. Aufruf: node scripts/geruest.mjs <url> [ausgabeordner]
import { strToU8, zipSync } from 'fflate'
import { chromium } from 'playwright-core'
import { gespeichert } from './einspielen.mjs'

const [url = 'http://localhost:4321/', aus] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const odt = (inhalt) =>
  Buffer.from(
    zipSync({
      'content.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content><office:automatic-styles>
<style:style style:name="F" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
</office:automatic-styles><office:body><office:text>${inhalt}</office:text></office:body></office:document-content>`),
    }),
  )
const punkt = (inhalt, unter = '') => `<text:list-item><text:p>${inhalt}</text:p>${unter}</text:list-item>`
const fett = (t) => `<text:span text:style-name="F">${t}</text:span>`

const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
page.on('pageerror', (e) => fehler.push(e.message))
await page.route('https://lobid.org/**', (r) => r.abort())
await page.route('https://services.dnb.de/**', (r) => r.abort())
await page.goto(url)
await page.waitForTimeout(500)
const daten = async () => {
  await page.waitForTimeout(500)
  return (await gespeichert(page)) ?? { werke: [], verlage: [], listen: [], themen: [] }
}
const datei = async (menue, name, mimeType, buffer, dialog) => {
  await page.getByRole('button', { name: /Ablage/ }).click()
  const wahl = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: menue }).click()
  await (await wahl).setFiles({ name, mimeType, buffer })
  await page.getByRole('dialog', { name: dialog }).waitFor()
}

try {
  // 1. Gerüst als Text: Titelzeile abwählen
  const text = 'Gesamtgerüst der Bibliographie\n  V. Die elektronischen Medien\n    a) Film\n    b) Rundfunk\n  VI. Technik\n'
  await datei(/Themenordnung einlesen/, 'Gerüst.txt', 'text/plain', Buffer.from(text), 'Themenordnung einlesen')
  const vorschau = await page.getByRole('treeitem').evaluateAll((xs) => xs.map((x) => `${x.getAttribute('aria-level')}:${x.textContent.trim()}`))
  pruefe('Vorschau zeigt die erkannten Ebenen', vorschau.join(' | ') === '1:Gesamtgerüst der Bibliographie | 2:V.Die elektronischen Medien | 3:a)Film | 3:b)Rundfunk | 2:VI.Technik', vorschau.join(' | '))
  await page.getByLabel('Gesamtgerüst der Bibliographie übernehmen').uncheck()
  if (aus) await page.screenshot({ path: `${aus}/geruest-vorschau.png` })
  await page.getByRole('button', { name: /4 Themen übernehmen/ }).click()
  const baum = await page.getByRole('treeitem').evaluateAll((xs) => xs.map((x) => `${x.getAttribute('aria-level')}:${x.getAttribute('aria-label')}`))
  pruefe('Themenordnung übernommen, Titelzeile abgewählt', baum.join(' | ') === '1:V. Die elektronischen Medien | 2:a) Film | 2:b) Rundfunk | 1:VI. Technik', baum.join(' | '))

  // 2. Dasselbe als verschachtelte ODT-Aufzählung, mit einem neuen Unterthema: zusammenführen
  const geruestOdt = odt(
    `<text:list>${punkt('V. Die elektronischen Medien', `<text:list>${punkt('a) Film')}${punkt('c) Computer')}</text:list>`)}${punkt('VI. Technik')}</text:list>`,
  )
  await datei(/Themenordnung einlesen/, 'Gerüst.odt', 'application/vnd.oasis.opendocument.text', geruestOdt, 'Themenordnung einlesen')
  await page.getByRole('button', { name: /Themen übernehmen/ }).click()
  const d = await daten()
  pruefe('Zweites Einlesen führt zusammen, nur das Neue kommt dazu', d.themen.length === 5 && d.themen.some((t) => t.nummer === 'c)'), d.themen.map((t) => t.nummer).join(','))

  // 3. Literaturliste mit Überschriften wie im Gerüst: Karten bekommen ihr Thema, keine doppelten Themen
  const liste = odt(
    `<text:p>V. Die elektronischen Medien</text:p><text:p>a) Film:</text:p><text:list>${punkt(`Rudolf Arnheim: ${fett('Film als Kunst')}, Berlin 1932`)}${punkt(`Ernst Iros: ${fett('Wesen und Dramaturgie des Films')}, Zürich 1938`)}</text:list>` +
      `<text:p>b) Rundfunk</text:p><text:list>${punkt(`Rudolf Arnheim: ${fett('Rundfunk als Hörkunst')}, München 1979`)}</text:list>`,
  )
  await datei(/Liste einlesen/, 'Medien.odt', 'application/vnd.oasis.opendocument.text', liste, 'Liste einlesen')
  pruefe('Option „Überschriften als Themen zuordnen“ ist an', await page.getByLabel('Überschriften als Themen zuordnen').isChecked())
  await page.getByRole('button', { name: /Karten anlegen/ }).click()
  const d2 = await daten()
  const thema = (nr) => d2.themen.find((t) => t.nummer === nr)?.id
  const karte = (titel) => d2.werke.find((w) => w.titel === titel)
  pruefe('Keine doppelten Themen', d2.themen.length === 5, d2.themen.map((t) => `${t.nummer} ${t.titel}`).join(' | '))
  pruefe('Karten tragen das Thema ihres Abschnitts', karte('Film als Kunst')?.themen[0] === thema('a)') && karte('Rundfunk als Hörkunst')?.themen[0] === thema('b)'))

  await page.keyboard.press('F3')
  await page.getByRole('radio', { name: 'nach Thema' }).click()
  const gruppen = await page.locator('.gruppe-kopf h2').allInnerTexts()
  pruefe('Kartei nach Thema zeigt die eingelesenen Karten', gruppen.join(' | ') === 'V. Die elektronischen Medien › a) Film | V. Die elektronischen Medien › b) Rundfunk', gruppen.join(' | '))
} catch (e) {
  pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0])
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
