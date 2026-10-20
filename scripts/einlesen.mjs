// Prüft das Einlesen einer Literaturliste im Browser. Aufruf: node scripts/einlesen.mjs <url> [ausgabeordner]
// Mit ODT_DATEI=<pfad> wird zusätzlich diese Datei eingelesen (Zeit, Umfang, Speicher).
import { readFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'
import { chromium } from 'playwright-core'
import { spieleEin } from './einspielen.mjs'

const [url = 'http://localhost:4321/', aus] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

// Kleine Liste: Begleittext, Überschrift über zwei Absätze, zwei Abschnitte mit Einträgen
const fett = (t) => `<text:span text:style-name="F">${t}</text:span>`
const punkt = (inhalt) => `<text:list-item><text:p>${inhalt}</text:p></text:list-item>`
const odt = zipSync({
  'content.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content><office:automatic-styles>
<style:style style:name="F" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
</office:automatic-styles><office:body><office:text>
<text:p>Lieber Herr Tranelis, anbei die Liste. Zuerst noch ein paar Gedanken, die mit Einträgen nichts zu tun haben und deshalb nicht eingelesen werden sollen.</text:p>
<text:list>${punkt('a) Lizenzausgaben,')}${punkt('b) Taschenbücher')}</text:list>
<text:p>V. Medien</text:p><text:p>und Technik</text:p>
<text:p>a) Film</text:p>
<text:list>${punkt(`Ernst Iros: ${fett('Wesen und Dramaturgie des Films')}, Zürich/Leipzig 1938; 2. erw. Aufl. Zürich 1957`)}${punkt(`Rudolf Arnheim: ${fett('Film als Kunst')}, Berlin 1932`)}${punkt(`Walter Benjamin: ${fett('Das Kunstwerk')}, Paris 1936; viele weitere Ausgaben`)}</text:list>
<text:p>b) Rundfunk</text:p>
<text:list>${punkt(`Rudolf Arnheim: ${fett('Rundfunk als Hörkunst')}, München 1979`)}${punkt(`Ernst Iros: ${fett('Wesen und Dramaturgie des Films')}, Zürich/Leipzig 1938; 2. erw. Aufl. Zürich 1957`)}</text:list>
</office:text></office:body></office:document-content>`),
})

const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
page.on('pageerror', (e) => fehler.push(e.message))
await page.route('https://lobid.org/**', (r) => r.abort())
await page.route('https://services.dnb.de/**', (r) => r.abort())
await page.goto(url)
await page.evaluate(() => localStorage.clear())
await page.reload()
const daten = async () => {
  await page.waitForTimeout(500)
  return page.evaluate(() => JSON.parse(localStorage.getItem('bibliographie:datenstamm:v1') ?? '{"werke":[],"verlage":[],"listen":[]}'))
}
const reiter = (name) => page.locator('.reiter button', { hasText: name })
const einlesen = async (name, buffer) => {
  await page.getByRole('button', { name: /Ablage/ }).click()
  const wahl = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: /Liste einlesen/ }).click()
  await (await wahl).setFiles({ name, mimeType: 'application/vnd.oasis.opendocument.text', buffer })
  await page.getByRole('dialog', { name: 'Liste einlesen' }).waitFor()
}

await einlesen('Medien.odt', Buffer.from(odt))
const gewaehlt = await page.locator('.import-abschnitte tbody input').evaluateAll((xs) => xs.map((x) => x.checked))
pruefe('Begleittext abgewählt, Überschriften und Abschnitte gewählt', gewaehlt.join(',') === 'false,true,true,true,true', gewaehlt.join(','))
const zahlen = await page.locator('.import-zahlen dd').allInnerTexts()
pruefe('Zahlen: 3 sicher, 0 prüfen, 1 von Hand, 1 doppelt', zahlen.join(',') === '3,0,1,0,1', zahlen.join(','))
if (aus) await page.screenshot({ path: `${aus}/einlesen-dialog.png`, fullPage: true })
await page.getByRole('button', { name: /4 Karten anlegen/ }).click()

let d = await daten()
pruefe('Vier vorläufige Karten angelegt', d.werke.length === 4 && d.werke.every((w) => w.status === 'vorlaeufig'), String(d.werke.length))
const l = d.listen.find((x) => x.name === 'Medien')
const themenTitel = d.themen.map((t) => `${t.elternId ? 2 : 1}:${t.nummer} ${t.titel}`).join('|')
pruefe('Überschriften als Themen angelegt', themenTitel === '1:V. Medien und Technik|2:a) Film|2:b) Rundfunk', themenTitel)
pruefe('Liste nach Themen gegliedert, Reihenfolge der Datei', l?.gliederung === 'themen' && l.sortierung === 'hand' && l.eintraege.length === 4)
pruefe('Liste ist geöffnet', (await page.locator('#listen-name').inputValue()) === 'Medien')
const koepfeKlein = await page.locator('.eintraege .thema-kopf').allInnerTexts()
const blattzeilen = await page.locator('.eintraege .eintrag').count()
// Iros steht in a) und b) der Datei: eine Karte, unter beiden Themen
pruefe('Liste zeigt die Überschriften der Datei, Iros unter beiden', koepfeKlein.join(' | ') === 'V. Medien und Technik | a) Film | b) Rundfunk' && blattzeilen === 5, `${koepfeKlein.join(' | ')}, ${blattzeilen} Zeilen`)
if (aus) await page.screenshot({ path: `${aus}/einlesen-liste.png`, fullPage: true })

// Reihenfolge je Thema: Iros steht in a) vorn, in b) hinter Arnheims Rundfunk (#24)
const abschnitteDerListe = () =>
  page.locator('.eintraege').evaluate((e) => {
    const aus = []
    for (const k of e.children) {
      if (k.matches('.thema-kopf')) aus.push({ titel: k.textContent.trim(), zeilen: [] })
      else if (k.matches('.eintrag') && aus.length) aus.at(-1).zeilen.push(k.textContent.includes('Iros') ? 'Iros' : k.textContent.includes('Rundfunk') ? 'Rundfunk' : 'andere')
    }
    return aus.map((a) => `${a.titel.slice(0, 2)}:${a.zeilen.join(',')}`).join(' | ')
  })
pruefe('Jedes Thema in der Reihenfolge der Datei', (await abschnitteDerListe()) === 'V.: | a):Iros,andere,andere | b):Rundfunk,Iros', await abschnitteDerListe())
await page.locator('.eintraege .eintrag', { hasText: 'Iros' }).nth(1).getByRole('button', { name: 'nach oben' }).click()
pruefe('↑ unter b) ändert nur b)', (await abschnitteDerListe()) === 'V.: | a):Iros,andere,andere | b):Iros,Rundfunk', await abschnitteDerListe())

// Kartei: nur Karten mit Vorlage
await reiter('Kartei').click()
await page.getByLabel('nur mit Vorlage aus dem Import').check()
const mitVorlage = await page.locator('.kartei-karte').count()
pruefe('Kartei filtert Karten mit Vorlage', mitVorlage === 1, String(mitVorlage))

// Karte von Hand: Vorlage sichtbar, beim Festanlegen weg
await page.locator('.kartei-karte').first().dblclick()
pruefe('Karte zeigt die Vorlage', (await page.locator('.vorlage p').innerText()).startsWith('Walter Benjamin: Das Kunstwerk'))
if (aus) await page.screenshot({ path: `${aus}/einlesen-karte.png`, fullPage: true })
await page.getByRole('button', { name: /Fest anlegen/ }).click()
d = await daten()
const benjamin = d.werke.find((w) => w.titel === 'Das Kunstwerk')
pruefe('Festanlegen entfernt die Vorlage', benjamin?.status === 'fest' && benjamin.vorlage === '')

// Zweites Einlesen derselben Datei legt nichts doppelt an
await einlesen('Medien.odt', Buffer.from(odt))
const zweite = await page.locator('.import-zahlen dd').allInnerTexts()
pruefe('Zweites Einlesen erkennt alles als vorhanden', zweite.join(',') === '0,0,0,5,0', zweite.join(','))
await page.getByRole('button', { name: /Abbrechen/ }).click()

// Einträge vor dem ersten Absatz (#13) und Doppelte bei abgewähltem Erstfund (#14)
{
  await spieleEin(page, null)
  const iros = punkt(`Ernst Iros: ${fett('Wesen und Dramaturgie des Films')}, Zürich 1938`)
  const zweite = zipSync({
    'content.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content><office:automatic-styles>
<style:style style:name="F" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
</office:automatic-styles><office:body><office:text>
<text:list>${punkt(`Rudolf Arnheim: ${fett('Film als Kunst')}, Berlin 1932`)}</text:list>
<text:p>A</text:p><text:list>${iros}</text:list>
<text:p>B</text:p><text:list>${iros}</text:list>
<text:p>C</text:p><text:list>${iros}</text:list>
</office:text></office:body></office:document-content>`),
  })
  await einlesen('Zweite.odt', Buffer.from(zweite))
  const zeilen = await page.locator('.import-abschnitte tbody tr').allInnerTexts()
  pruefe('Einträge vor dem ersten Absatz sind wählbar', zeilen[0].trim().startsWith('vor dem ersten Absatz') && (await page.getByLabel('Einträge vor dem ersten Absatz einlesen').isChecked()), zeilen[0].replace(/\s+/g, ' '))
  await page.getByLabel('Absatz 1 einlesen').uncheck()
  const z = await page.locator('.import-zahlen dd').allInnerTexts()
  pruefe('Erstfund abgewählt: ein Doppelter in der Auswahl', z.join(',') === '2,0,0,0,1', z.join(','))
  await page.getByRole('button', { name: /2 Karten anlegen/ }).click()
  const d2 = await daten()
  pruefe('Zwei Karten, Iros nur einmal', d2.werke.length === 2 && d2.werke.filter((w) => w.titel.startsWith('Wesen')).length === 1, String(d2.werke.length))
  const l2 = d2.listen.find((x) => x.name === 'Zweite')
  const themaB = d2.themen.find((t) => t.titel === 'B')?.id
  const themaC = d2.themen.find((t) => t.titel === 'C')?.id
  const irosKarte = d2.werke.find((w) => w.titel.startsWith('Wesen'))
  const arnheimKarte = d2.werke.find((w) => w.titel === 'Film als Kunst')
  pruefe('Arnheim ohne Thema, Iros unter B und C', l2 && l2.eintraege.length === 2 && arnheimKarte?.themen.length === 0 && irosKarte?.themen.join() === `${themaB},${themaC}`, `${arnheimKarte?.themen.length} / ${irosKarte?.themen.join()}`)
}

// Echte Liste, wenn angegeben
if (process.env.ODT_DATEI) {
  await spieleEin(page, null)
  pruefe('Kartei vor der echten Liste leer', (await daten()).werke.length === 0)
  const start = Date.now()
  await einlesen('Liste.odt', readFileSync(process.env.ODT_DATEI))
  const dialog = Date.now() - start
  const echt = await page.locator('.import-zahlen dd').allInnerTexts()
  const knopf = page.getByRole('button', { name: /Karten anlegen/ })
  const beschriftung = await knopf.innerText()
  const t2 = Date.now()
  await knopf.click()
  await page.locator('#listen-name').waitFor()
  const anlegen = Date.now() - t2
  const groesse = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 800))
    return (localStorage.getItem('bibliographie:datenstamm:v1') ?? '').length
  })
  const koepfe = await page.locator('.eintraege .thema-kopf').count()
  const weitere = await page.locator('.weitere-eintraege').innerText()
  pruefe('Gekürzte Ansicht endet ganz: keine Überschrift ohne ihre Einträge', koepfe === 2 && /unter 1 weiteren Thema/.test(weitere), `${koepfe} Überschriften, „${weitere}“`)
  await page.getByRole('button', { name: 'Blattvorschau ansehen' }).click()
  pruefe('Mit Blattvorschau scrollt nur sie', (await page.evaluate(() => getComputedStyle(document.documentElement).overflow)) === 'hidden')
  await page.keyboard.press('Escape')
  pruefe('Ohne Blattvorschau scrollt die Seite wieder', (await page.evaluate(() => getComputedStyle(document.documentElement).overflow)) !== 'hidden')
  await page.getByLabel(/von\s+selbst aufnehmen/).check()
  const optionen = await page.locator('.bedingung', { hasText: 'Thema' }).locator('option').allInnerTexts()
  pruefe('Lange Themen in der Auswahl gekürzt', optionen.length > 1 && optionen.every((o) => o.trim().length <= 48), String(Math.max(...optionen.map((o) => o.trim().length))))
  await page.getByLabel(/von\s+selbst aufnehmen/).uncheck()
  const voll = await page.locator('.speicher-warnung').count()
  pruefe('Echte Liste eingelesen und gespeichert', voll === 0 && groesse > 1e6 && echt[3] === '0', `${echt.join(',')} · ${beschriftung} · Dialog ${dialog} ms, Anlegen ${anlegen} ms, ${Math.round(groesse / 1024)} kB`)
  const t3 = Date.now()
  await page.reload()
  await reiter('Kartei').click()
  await page.locator('.kartei-karte').first().waitFor()
  pruefe('Neu laden mit allen Karten', true, `${Date.now() - t3} ms`)
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
