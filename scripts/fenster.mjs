// Prüft, dass nur ein Fenster schreibt und die Übergabe nichts verliert. Aufruf: node scripts/fenster.mjs <url>
// Auch gegen den Devserver laufen lassen: dort startet React im StrictMode doppelt.
import { chromium } from 'playwright-core'
import { speicherFrei, speicherVoll } from './speicher-voll.mjs'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const kontext = await browser.newContext()
const seite = async () => {
  const p = await kontext.newPage()
  p.on('pageerror', (e) => fehler.push(e.message))
  await p.goto(url)
  await p.waitForTimeout(400)
  return p
}
const gesperrt = (p) => p.getByRole('dialog', { name: 'In einem anderen Fenster geöffnet' })
const karte = async (p, titel) => {
  await p.locator('.reiter button', { hasText: 'Erfassen' }).click()
  await p.getByLabel('Nachname, Person 1').fill('Steiner')
  await p.getByRole('combobox', { name: 'Titel' }).fill(titel)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(600)
}
const inKartei = async (p, titel) => {
  await p.locator('.reiter button', { hasText: 'Kartei' }).click()
  return (await p.locator('.kartei-karte', { hasText: titel }).count()) === 1
}
const gespeichert = (p) => p.evaluate(() => localStorage.getItem('bibliographie:datenstamm:v1') ?? '')

try {
  const a = await seite()
  // Im Devserver kann der Hinweis beim doppelten Start kurz aufblitzen
  await gesperrt(a).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  pruefe('Erstes Fenster schreibt', (await gesperrt(a).count()) === 0)
  const b = await seite()
  pruefe('Zweites Fenster ist gesperrt', await gesperrt(b).isVisible())

  await karte(a, 'Aus Fenster A')
  pruefe('Karte aus A gespeichert', (await gespeichert(a)).includes('Aus Fenster A'))

  await b.getByRole('button', { name: 'Hier weiterarbeiten' }).click()
  await gesperrt(b).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  pruefe('B übernimmt, A ist gesperrt', (await gesperrt(b).count()) === 0 && (await gesperrt(a).isVisible()))
  pruefe('B sieht die Karte aus A', await inKartei(b, 'Aus Fenster A'))

  await karte(b, 'Aus Fenster B')
  await b.close()
  await gesperrt(a).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  pruefe('B geschlossen: A schreibt wieder von selbst', (await gesperrt(a).count()) === 0)
  pruefe('A sieht beide Karten', (await inKartei(a, 'Aus Fenster A')) && (await inKartei(a, 'Aus Fenster B')))

  // Voller Speicher: keine Übergabe, solange die neue Karte nicht gespeichert ist
  {
    const b2 = await seite()
    await speicherVoll(a)
    await karte(a, 'Bei vollem Speicher')
    pruefe('Voller Speicher wird in A gemeldet', await a.locator('.speicher-warnung').isVisible())
    await b2.getByRole('button', { name: 'Hier weiterarbeiten' }).click()
    await b2.waitForTimeout(2500)
    pruefe('B bleibt gesperrt und sagt warum', (await gesperrt(b2).isVisible()) && (await b2.getByText('kann gerade nicht speichern').count()) === 1)
    pruefe('A schreibt weiter', (await gesperrt(a).count()) === 0)
    await speicherFrei(a)
    await b2.getByRole('button', { name: 'Hier weiterarbeiten' }).click()
    await gesperrt(b2).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    pruefe('Nach dem Freimachen übernimmt B', (await gesperrt(b2).count()) === 0)
    pruefe('B hat die Karte, die A erst bei der Übergabe speichern konnte', await inKartei(b2, 'Bei vollem Speicher'))
    await b2.close()
    await gesperrt(a).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  }

  // A hat die Sperre inzwischen über die Schlange bekommen: auch dann Übergabe hin und zurück, danach Nachrücken
  {
    const c2 = await seite()
    await c2.getByRole('button', { name: 'Hier weiterarbeiten' }).click()
    await gesperrt(c2).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    pruefe('Übernahme von einem Fenster, das über die Schlange kam', (await gesperrt(c2).count()) === 0 && (await gesperrt(a).isVisible()))
    await c2.close()
    await gesperrt(a).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    pruefe('Danach rückt A wieder von selbst nach', (await gesperrt(a).count()) === 0)
  }

  // Gesperrtes Fenster schreibt nie, auch nicht beim Schließen
  const c = await seite()
  await c.close()
  pruefe('Schließen eines gesperrten Fensters verliert nichts', (await gespeichert(a)).includes('Aus Fenster B'))

} catch (e) {
  pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0])
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
