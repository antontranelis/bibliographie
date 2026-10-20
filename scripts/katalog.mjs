// Prüft die Katalogsuche, wenn lobid ausfällt und die DNB Aussetzer hat. Aufruf: node scripts/katalog.mjs <url>
// Die DNB-Antworten kommen aus dem echten Katalog; Ausfälle werden simuliert.
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

async function suche(einrichten) {
  const kontext = await browser.newContext()
  const p = await kontext.newPage()
  p.on('pageerror', (e) => fehler.push(e.message))
  await p.route('https://lobid.org/**', (r) => r.fulfill({ status: 404, body: 'Not Found' }))
  await einrichten?.(p)
  await p.goto(url)
  await p.getByLabel('Nachname, Person 1').fill('Steiner')
  await p.getByLabel('Nachname, Person 1').press('Enter')
  await p.keyboard.type('Philosophie der Freiheit')
  return { p, kontext }
}
const vorschlaege = (p) => p.locator('.vorschlag-anzahl').first().waitFor({ timeout: 20000 }).then(() => p.locator('.vorschlag-anzahl').count()).catch(() => 0)

// 1. lobid fällt aus: die DNB allein liefert Vorschläge
{
  const { p, kontext } = await suche()
  const n = await vorschlaege(p)
  pruefe('Ohne lobid kommen Vorschläge aus der DNB', n > 0, `${n} Werke`)
  await kontext.close()
}

// 2. Zweite DNB-Seite scheitert beide Male: die erste Seite bleibt
{
  const { p, kontext } = await suche((p) =>
    p.route('https://services.dnb.de/**', (r) => (new URL(r.request().url()).searchParams.get('startRecord') === '1' ? r.continue() : r.abort('internetdisconnected'))),
  )
  const n = await vorschlaege(p)
  pruefe('Scheitert eine weitere DNB-Seite, bleibt die erste', n > 0, `${n} Werke`)
  await kontext.close()
}

// 3. Erste DNB-Seite hat einen einmaligen Aussetzer: der zweite Versuch trägt
{
  let erste = true
  const { p, kontext } = await suche((p) =>
    p.route('https://services.dnb.de/**', (r) => {
      if (erste && new URL(r.request().url()).searchParams.get('startRecord') === '1') {
        erste = false
        return r.abort('internetdisconnected')
      }
      return r.continue()
    }),
  )
  const n = await vorschlaege(p)
  pruefe('Einmaliger Aussetzer: zweiter Versuch liefert Vorschläge', n > 0, `${n} Werke`)
  await kontext.close()
}

// 4. Gar kein Katalog: Meldung mit „Noch einmal versuchen“, danach Vorschläge
{
  let gesperrt = true
  const { p, kontext } = await suche((p) => p.route('https://services.dnb.de/**', (r) => (gesperrt ? r.abort('internetdisconnected') : r.continue())))
  const knopf = p.getByRole('button', { name: 'Noch einmal versuchen' })
  const da = await knopf.waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
  pruefe('Kein Katalog: Meldung mit „Noch einmal versuchen“', da)
  gesperrt = false
  if (da) await knopf.click()
  const n = await vorschlaege(p)
  pruefe('Noch einmal versuchen bringt Vorschläge', n > 0, `${n} Werke`)
  await kontext.close()
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
