// Prüft Updates mit wartendem Service Worker. Aufruf: node scripts/update.mjs <url>
// Baut dazwischen selbst neu (npx vite build), die Vorschau muss dist ausliefern.
// Jeder Build ändert über den Build-Stempel auch den Word-Teil, so wie ein echtes Update.
import { execSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const stand = (p) => p.evaluate(() => document.documentElement.dataset.stand)
const bauen = () => execSync('npx vite build', { stdio: 'ignore' })
const vorraete = (p) => p.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith('bibliographie-')))
const gesteuert = (p) => p.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 })
const neuerStand = (p, alt) =>
  p.waitForFunction((a) => document.documentElement.dataset.stand && document.documentElement.dataset.stand !== a, alt, { timeout: 20000 }).then(() => true).catch(() => false)
const seite = async (kontext) => {
  const p = await kontext.newPage()
  p.on('pageerror', (e) => fehler.push(e.message))
  return p
}
const wordOffline = async (p) => {
  await p.locator('.reiter button', { hasText: 'Liste' }).click()
  const laden = p.waitForEvent('download', { timeout: 10000 }).catch(() => null)
  await p.getByRole('button', { name: 'Als Word-Datei speichern' }).first().click()
  return Boolean(await laden)
}

// 1. Ein Tab: schließen und wieder öffnen bringt die neue Version, ohne Knopf
{
  const kontext = await browser.newContext()
  const a = await seite(kontext)
  await a.goto(url)
  await gesteuert(a)
  const alt = await stand(a)
  pruefe('Erster Besuch: keine Meldung, kein Neuladen', (await a.locator('.neue-version').count()) === 0 && (await stand(a)) === alt)
  await a.getByLabel('Nachname, Person 1').fill('Steiner')
  await a.getByRole('combobox', { name: 'Titel' }).fill('Vor dem Update angelegt')
  await a.keyboard.press('Escape')
  await a.getByLabel('Jahr', { exact: true }).first().fill('1920')
  await a.waitForTimeout(600)
  await a.close()

  bauen()
  const b = await seite(kontext)
  await b.goto(url)
  pruefe('Wieder geöffnet: neue Version übernimmt beim Start', await neuerStand(b, alt), `${alt} → ${await stand(b)}`)
  pruefe('Karte ist nach dem Update noch da', (await b.evaluate(() => localStorage.getItem('bibliographie:datenstamm:v1') ?? '')).includes('Vor dem Update angelegt'))
  pruefe('Nur der neue Vorrat', (await vorraete(b)).length === 1, (await vorraete(b)).join(', '))
  await kontext.close()
}

// 2. Mehrere Tabs: neue Version wartet, alle Tabs arbeiten stimmig weiter, der Knopf bringt alle auf den neuen Stand
{
  const kontext = await browser.newContext({ acceptDownloads: true })
  const a = await seite(kontext)
  await a.goto(url)
  await gesteuert(a)
  const b = await seite(kontext)
  await b.goto(url)
  const alt = await stand(a)
  // Wie im Review: Karte nur in A, nachdem B schon offen ist
  await a.getByLabel('Nachname, Person 1').fill('Steiner')
  await a.getByRole('combobox', { name: 'Titel' }).fill('Nur in A angelegt')
  await a.keyboard.press('Escape')
  await a.waitForTimeout(600)

  bauen()
  await a.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))
  const hinweis = await a.locator('.neue-version').waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
  pruefe('Bei mehreren Tabs: Hinweis statt Wechsel', hinweis && (await stand(a)) === alt)

  const c = await seite(kontext)
  await c.goto(url)
  await c.waitForTimeout(1500)
  pruefe('Neuer Tab bekommt solange die alte, stimmige Version', (await stand(c)) === alt)

  await kontext.setOffline(true)
  pruefe('Alter Tab exportiert offline Word', await wordOffline(a))
  const d = await seite(kontext)
  await d.goto(url)
  pruefe('Offline geöffneter Tab: alte, stimmige Version', (await stand(d)) === alt)
  await d.close()
  await kontext.setOffline(false)

  await a.getByRole('button', { name: 'Jetzt aktualisieren' }).click()
  const alle = await Promise.all([a, b, c].map((p) => neuerStand(p, alt)))
  pruefe('Knopf bringt alle Tabs auf den neuen Stand', alle.every(Boolean), alle.join(','))
  pruefe('Danach nur der neue Vorrat', (await vorraete(a)).length === 1, (await vorraete(a)).join(', '))
  await a.waitForTimeout(800)
  pruefe('Karte aus A übersteht das Update aller Tabs', (await a.evaluate(() => localStorage.getItem('bibliographie:datenstamm:v1') ?? '')).includes('Nur in A angelegt'))
  await kontext.close()
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
