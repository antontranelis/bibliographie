// Prüft den Speicher im Browser: Umzug aus localStorage, große Karteien, Schließen gleich nach einer Änderung.
// Aufruf: node scripts/ablage.mjs <url> [anzahl karten, Vorgabe 20000]
import { chromium } from 'playwright-core'
import { daten, gespeichert, leere, spieleEin } from './einspielen.mjs'
import { speicherFrei, speicherVoll } from './speicher-voll.mjs'

const [url = 'http://localhost:4321/', anzahl = '20000'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const kontext = await browser.newContext({ viewport: { width: 1360, height: 900 } })
const seite = async () => {
  const p = await kontext.newPage()
  p.on('pageerror', (e) => fehler.push(e.message))
  await p.route('https://lobid.org/**', (r) => r.abort())
  await p.route('https://services.dnb.de/**', (r) => r.abort())
  await p.goto(url)
  return p
}
const reiter = (p, name) => p.locator('.reiter button', { hasText: name })
const altSchluessel = (p) => p.evaluate(() => localStorage.getItem('bibliographie:datenstamm:v1'))

try {
  const page = await seite()
  await leere(page)
  await page.getByRole('button', { name: 'Beispielkarten laden' }).first().click()
  const beispiel = await daten(page)
  pruefe('Beispielkarten in IndexedDB gespeichert', beispiel.werke.length === 2, String(beispiel.werke.length))
  pruefe('Nichts mehr in localStorage', (await altSchluessel(page)) === null)

  // Umzug: ein Stand der bisherigen Fassung in localStorage kommt in die Datenbank und verschwindet dort
  {
    const alt = { ...beispiel, werke: beispiel.werke.map((w) => ({ ...w, titel: `${w.titel} (alt)` })) }
    await spieleEin(page, alt)
    await reiter(page, 'Kartei').click()
    const karten = await page.locator('.kartei-karte', { hasText: '(alt)' }).count()
    const neu = await daten(page)
    pruefe('Umzug: alte Karten sichtbar', karten === 2, String(karten))
    pruefe('Umzug: in IndexedDB', neu.werke.filter((w) => w.titel.endsWith('(alt)')).length === 2)
    pruefe('Umzug: alter Stand gelöscht', (await altSchluessel(page)) === null)
    await page.reload()
    await reiter(page, 'Kartei').click()
    pruefe('Umzug: nach Neuladen noch da', (await page.locator('.kartei-karte', { hasText: '(alt)' }).count()) === 2)
  }

  // Liegt schon etwas in der Datenbank, zählt nur das; ein übrig gebliebener alter Stand wird nicht eingespielt
  {
    await page.evaluate(() => localStorage.setItem('bibliographie:datenstamm:v1', JSON.stringify({ werke: [], verlage: [], listen: [], themen: [] })))
    await page.reload()
    pruefe('Datenbank vor altem Rest', (await daten(page)).werke.length === 2)
  }

  // Neu laden gleich nach einer Änderung, vor dem verzögerten Speichern
  {
    await reiter(page, 'Erfassen').click()
    await page.getByLabel('Nachname, Person 1').fill('Steiner')
    await page.getByRole('combobox', { name: 'Titel' }).fill('Kurz vor dem Neuladen')
    await page.keyboard.press('Escape')
    await page.reload()
    const d = await daten(page)
    pruefe('Beim Neuladen gespeichert', d.werke.some((w) => w.titel === 'Kurz vor dem Neuladen'), `${d.werke.length} Karten`)
    await reiter(page, 'Kartei').click()
    pruefe('Beim Neuladen gespeichert: in der Kartei', (await page.locator('.kartei-karte', { hasText: 'Kurz vor dem Neuladen' }).count()) === 1)
  }

  pruefe('Nachtrag nach dem Speichern wieder gelöscht', (await page.evaluate(() => localStorage.getItem('bibliographie:nachtrag'))) === null)

  // Nur verborgen, dann weitergearbeitet: der Nachtrag dreht die spätere Änderung nicht zurück
  {
    const sichtbar = (z) =>
      page.evaluate((z) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => z })
        document.dispatchEvent(new Event('visibilitychange'))
      }, z)
    await reiter(page, 'Erfassen').click()
    await page.getByLabel('Nachname, Person 1').fill('Steiner')
    const titel = page.getByRole('combobox', { name: 'Titel' })
    // Speichern gelingt gerade nicht: dann muss der Nachtrag den Zwischenstand halten
    await speicherVoll(page)
    await titel.fill('Zwischenstand')
    await page.waitForTimeout(600)
    await sichtbar('hidden')
    const nachtrag = await page.evaluate(() => localStorage.getItem('bibliographie:nachtrag'))
    await sichtbar('visible')
    await speicherFrei(page)
    await titel.fill('Endstand')
    await page.keyboard.press('Escape')
    await daten(page)
    await page.reload()
    const d = await daten(page)
    pruefe('Verborgen: Nachtrag geschrieben', (nachtrag ?? '').includes('Zwischenstand'))
    pruefe('Verborgen: spätere Änderung bleibt', d.werke.some((w) => w.titel === 'Endstand') && !d.werke.some((w) => w.titel === 'Zwischenstand'), d.werke.map((w) => w.titel).join(' | '))
    await reiter(page, 'Kartei').click()
    page.once('dialog', (x) => x.accept())
    await page.locator('.kartei-karte', { hasText: 'Endstand' }).dblclick()
    await page.getByRole('button', { name: 'Karte löschen' }).click()
    await daten(page)
  }

  // Schließen gleich nach einer Änderung, vor dem verzögerten Speichern
  {
    await reiter(page, 'Erfassen').click()
    await page.getByLabel('Nachname, Person 1').fill('Steiner')
    await page.getByRole('combobox', { name: 'Titel' }).fill('Kurz vor dem Schließen')
    await page.keyboard.press('Escape')
    await page.close({ runBeforeUnload: true })
    const p2 = await seite()
    const d = await daten(p2)
    pruefe('Beim Schließen gespeichert', d.werke.some((w) => w.titel === 'Kurz vor dem Schließen'), `${d.werke.length} Karten`)
    await p2.close()
  }

  // Gelöschte Karte bleibt gelöscht
  {
    const p = await seite()
    p.on('dialog', (d) => d.accept())
    await reiter(p, 'Kartei').click()
    await p.locator('.kartei-karte', { hasText: 'Kurz vor dem Schließen' }).dblclick()
    await p.getByRole('button', { name: 'Karte löschen' }).click()
    await daten(p)
    await p.reload()
    const d = await daten(p)
    pruefe('Gelöschte Karte bleibt gelöscht', d.werke.length === 3 && !d.werke.some((w) => w.titel === 'Kurz vor dem Schließen'), `${d.werke.length} Karten`)
    await p.close()
  }

  // Ein Fenster ohne Schreibrecht verändert nichts, auch keinen liegengebliebenen Nachtrag
  {
    const a = await seite()
    await speicherVoll(a)
    await reiter(a, 'Erfassen').click()
    await a.getByLabel('Nachname, Person 1').fill('Steiner')
    await a.getByRole('combobox', { name: 'Titel' }).fill('Nur im Nachtrag')
    await a.waitForTimeout(600)
    await a.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    const vorher = await a.evaluate(() => localStorage.getItem('bibliographie:nachtrag'))
    const b = await seite()
    await b.waitForTimeout(800)
    const nachher = await b.evaluate(() => localStorage.getItem('bibliographie:nachtrag'))
    pruefe('Lesefenster lässt den Nachtrag liegen', !!vorher && nachher === vorher)
    await b.close()
    // Schließen bei blockiertem Speichern: der Nachtrag bringt die Karte beim nächsten Start zurück
    await a.close({ runBeforeUnload: true })
    const c = await seite()
    const d = await daten(c)
    pruefe('Nachtrag beim Start eingespielt', d.werke.some((w) => w.titel === 'Nur im Nachtrag'), `${d.werke.length} Karten`)
    pruefe('Nachtrag danach gelöscht', (await c.evaluate(() => localStorage.getItem('bibliographie:nachtrag'))) === null)
    c.once('dialog', (x) => x.accept())
    await reiter(c, 'Kartei').click()
    await c.locator('.kartei-karte', { hasText: 'Nur im Nachtrag' }).dblclick()
    await c.getByRole('button', { name: 'Karte löschen' }).click()
    await daten(c)
    await c.close()
  }

  // Gescheitertes Speichern: das nächste gelungene holt alles nach. Löschen bei blockiertem Speichern trägt der Nachtrag
  {
    const p = await seite()
    const neu = async (titel) => {
      await reiter(p, 'Erfassen').click()
      await p.getByRole('button', { name: /Vorläufig lassen/ }).click()
      await p.getByLabel('Nachname, Person 1').fill('Steiner')
      await p.getByRole('combobox', { name: 'Titel' }).fill(titel)
      await p.keyboard.press('Escape')
      await p.waitForTimeout(700)
    }
    await speicherVoll(p)
    await neu('Gescheitert X')
    pruefe('Gescheitertes Speichern wird gemeldet', (await p.locator('.speicher-warnung').count()) === 1)
    await speicherFrei(p)
    await neu('Danach Y')
    const d = await gespeichert(p)
    pruefe('Nächstes Speichern holt nach', ['Gescheitert X', 'Danach Y'].every((t) => d.werke.some((w) => w.titel === t)) && (await p.locator('.speicher-warnung').count()) === 0)
    await speicherVoll(p)
    p.on('dialog', (x) => x.accept())
    for (const t of ['Gescheitert X', 'Danach Y']) {
      await reiter(p, 'Kartei').click()
      await p.locator('.kartei-karte', { hasText: t }).dblclick()
      await p.getByRole('button', { name: 'Karte löschen' }).click()
    }
    await p.waitForTimeout(600)
    await p.close({ runBeforeUnload: true })
    const q = await seite()
    const e = await daten(q)
    pruefe('Nachtrag trägt Löschungen', !e.werke.some((w) => ['Gescheitert X', 'Danach Y'].includes(w.titel)), e.werke.map((w) => w.titel).join(' | '))
    await q.close()
  }

  // Ein Nachtrag ohne bekannte Grundlage ersetzt den Bestand und holt gelöschte Karten nicht zurück
  {
    const p = await seite()
    const d = await daten(p)
    const [erste] = d.werke
    await p.evaluate(
      ([w, rest]) => localStorage.setItem('bibliographie:nachtrag', JSON.stringify({ werke: [w], weg: [], rest, voll: true })),
      [erste, { verlage: d.verlage, listen: d.listen, themen: d.themen, reihenfolge: [erste.id] }],
    )
    await p.close()
    const q = await seite()
    const e = await daten(q)
    pruefe('Voller Nachtrag holt nichts zurück', e.werke.length === 1 && e.werke[0].id === erste.id, `${e.werke.length} Karten`)
    // Bestand wiederherstellen
    await q.evaluate(
      ([w, rest]) => localStorage.setItem('bibliographie:nachtrag', JSON.stringify({ werke: w, weg: [], rest, voll: true })),
      [d.werke, { verlage: d.verlage, listen: d.listen, themen: d.themen, reihenfolge: d.werke.map((w) => w.id) }],
    )
    await q.close()
  }

  // Unlesbarer Datensatz: Hinweis statt leerer Kartei, nichts wird überschrieben
  {
    const p = await seite()
    await daten(p)
    const vorher = await gespeichert(p)
    await p.evaluate(
      () =>
        new Promise((f) => {
          const o = indexedDB.open('bibliographie')
          o.onsuccess = () => {
            const t = o.result.transaction('stamm', 'readwrite')
            t.objectStore('stamm').put({ kaputt: true }, 'rest')
            t.oncomplete = () => {
              o.result.close()
              f()
            }
          }
        }),
    )
    await p.reload()
    await p.waitForTimeout(800)
    pruefe('Unlesbar: Hinweis statt App', (await p.locator('.ladefehler').count()) === 1 && (await p.locator('.reiter').count()) === 0)
    const roh = await p.evaluate(
      () =>
        new Promise((f) => {
          const o = indexedDB.open('bibliographie')
          o.onsuccess = () => {
            const t = o.result.transaction(['werke', 'stamm'])
            const w = t.objectStore('werke').count()
            const r = t.objectStore('stamm').get('rest')
            t.oncomplete = () => f({ faecher: w.result, rest: r.result })
          }
        }),
    )
    pruefe('Unlesbar: nichts überschrieben', roh.faecher > 0 && roh.rest?.kaputt === true)
    // Wiederherstellen
    await p.evaluate(
      (d) =>
        new Promise((f) => {
          const o = indexedDB.open('bibliographie')
          o.onsuccess = () => {
            const t = o.result.transaction('stamm', 'readwrite')
            t.objectStore('stamm').put({ verlage: d.verlage, listen: d.listen, themen: d.themen, reihenfolge: d.werke.map((w) => w.id) }, 'rest')
            t.oncomplete = () => f()
          }
        }),
      vorher,
    )
    await p.close()
  }

  // Ohne Web Locks: auch dann erst frisch laden und den Nachtrag einspielen, bevor geschrieben wird
  {
    const p = await seite()
    const d = await daten(p)
    const neu = { ...d.werke[0], id: 'ohne-sperre', titel: 'Aus dem Nachtrag ohne Web Locks' }
    await p.evaluate(
      ([w, rest]) => localStorage.setItem('bibliographie:nachtrag', JSON.stringify({ werke: [w], weg: [], rest, voll: false })),
      [neu, { verlage: d.verlage, listen: d.listen, themen: d.themen, reihenfolge: [...d.werke.map((w) => w.id), neu.id] }],
    )
    await p.close()
    const q = await kontext.newPage()
    q.on('pageerror', (e) => fehler.push(e.message))
    await q.addInitScript(() => Object.defineProperty(Navigator.prototype, 'locks', { configurable: true, get: () => undefined }))
    await q.goto(url)
    const e = await daten(q)
    pruefe('Ohne Web Locks: Nachtrag eingespielt', e.werke.some((w) => w.id === 'ohne-sperre'))
    pruefe('Ohne Web Locks: Nachtrag danach gelöscht', (await q.evaluate(() => localStorage.getItem('bibliographie:nachtrag'))) === null)
    q.once('dialog', (x) => x.accept())
    await reiter(q, 'Kartei').click()
    await q.locator('.kartei-karte', { hasText: 'Aus dem Nachtrag ohne Web Locks' }).dblclick()
    await q.getByRole('button', { name: 'Karte löschen' }).click()
    await daten(q)
    await q.close()
  }

  // Steht der Bestand in der Datenbank und lässt sie sich nicht öffnen: Hinweis statt leerer App
  {
    const q = await kontext.newPage()
    await q.addInitScript(() => {
      IDBFactory.prototype.open = function () {
        throw new DOMException('gesperrt', 'InvalidStateError')
      }
    })
    await q.goto(url)
    await q.waitForTimeout(800)
    pruefe('Datenbank nicht erreichbar: Hinweis statt App', (await q.locator('.ladefehler').count()) === 1 && (await q.locator('.reiter').count()) === 0)
    await q.close()
  }

  // Große Kartei über die Exportdatei einlesen
  {
    const p = await seite()
    const vorlage = (await daten(p)).werke[0]
    const werke = Array.from({ length: Number(anzahl) }, (_, i) => ({ ...vorlage, id: `gross-${i}`, titel: `Werk Nummer ${i}`, kommentar: 'x'.repeat(200) }))
    const datei = JSON.stringify({ format: 'bibliographie-datenstamm', version: 7, exportiert: new Date().toISOString(), werke, verlage: [], listen: [], themen: [] })
    const t = Date.now()
    await p.locator('input[accept="application/json,.json"]').setInputFiles({ name: 'gross.json', mimeType: 'application/json', buffer: Buffer.from(datei) })
    await p.getByText(`${anzahl} Karten`).waitFor({ timeout: 30000 })
    await p.waitForTimeout(3000)
    const d = await gespeichert(p)
    const n = d?.werke.length ?? 0
    pruefe(`${anzahl} Karten gespeichert`, n >= Number(anzahl) && (await p.locator('.speicher-warnung').count()) === 0, `${n} Karten, ${Math.round(datei.length / 1e6)} MB, ${Date.now() - t} ms`)
    const t2 = Date.now()
    await p.reload()
    await reiter(p, 'Kartei').click()
    await p.locator('.kartei-karte').first().waitFor()
    pruefe('Große Kartei lädt wieder', ((await gespeichert(p))?.werke.length ?? 0) === n, `${Date.now() - t2} ms`)

    // Eine Änderung schreibt nur die geänderte Karte und den Rest, nicht die ganze Kartei
    await p.evaluate(() => {
      window.__geschrieben = 0
      const echt = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...a) {
        window.__geschrieben++
        return echt.apply(this, a)
      }
    })
    await reiter(p, 'Erfassen').click()
    await p.getByLabel('Nachname, Person 1').fill('Steiner')
    await p.getByRole('combobox', { name: 'Titel' }).fill('Neu in der großen Kartei')
    await p.keyboard.press('Escape')
    await p.waitForTimeout(1000)
    const geschrieben = await p.evaluate(() => window.__geschrieben)
    pruefe('Eine neue Karte schreibt nur ihr Fach', geschrieben > 0 && geschrieben <= 4, `${geschrieben} Datensätze`)
    await p.reload()
    pruefe('Neue Karte gespeichert', ((await gespeichert(p))?.werke ?? []).some((w) => w.titel === 'Neu in der großen Kartei'))
    await p.close()
  }
} catch (e) {
  pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0])
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
