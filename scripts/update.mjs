// Prüft, dass der Service Worker Updates nicht blockiert und offene Tabs nicht beschädigt.
// Aufruf: node scripts/update.mjs <url> — baut dazwischen selbst neu (npx vite build), die Vorschau muss dist ausliefern.
// Jeder Build ändert über den Build-Stempel auch den Word-Teil, so wie ein echtes Update.
import { execSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const stand = (p) => p.evaluate(() => document.documentElement.dataset.stand)
const wordTeil = () => execSync('ls dist/assets').toString().match(/word-[^\s]+\.js/)?.[0]
const bauen = () => execSync('npx vite build', { stdio: 'ignore' })
const updatePruefen = (p) => p.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))
const vorraete = (p) => p.evaluate(async () => (await caches.keys()).filter((n) => n !== 'bibliographie-auslauf'))

// 1. Erster Besuch, ohne Neuladen: Hinweis beim ersten echten Update, alter Tab arbeitet offline weiter
{
  const kontext = await browser.newContext({ acceptDownloads: true })
  const page = await kontext.newPage()
  page.on('pageerror', (e) => fehler.push(e.message))
  await page.goto(url)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 })
  pruefe('Erste Übernahme meldet keine neue Version', (await page.locator('.neue-version').count()) === 0)
  const altWord = wordTeil()
  await page.getByLabel('Nachname, Person 1').fill('Steiner')
  await page.getByRole('combobox', { name: 'Titel' }).fill('Vor dem Update angelegt')
  await page.keyboard.press('Escape')
  await page.getByLabel('Jahr', { exact: true }).first().fill('1920')

  bauen()
  const neuWord = wordTeil()
  pruefe('Neuer Build hat einen anderen Word-Teil', altWord !== neuWord, `${altWord} → ${neuWord}`)
  await updatePruefen(page)
  const hinweis = await page.locator('.neue-version').waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
  pruefe('Erster Besuch: Update wird gemeldet', hinweis)
  pruefe('Alter Vorrat bleibt, solange der alte Tab offen ist', (await vorraete(page)).length === 2, (await vorraete(page)).join(', '))

  // Ohne Neuladen weiterarbeiten, offline, mit dem alten Word-Teil
  await kontext.setOffline(true)
  await page.locator('.reiter button', { hasText: 'Liste' }).click()
  const laden = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
  await page.getByRole('button', { name: 'Als Word-Datei speichern' }).first().click()
  pruefe('Alter Tab erzeugt offline die Word-Datei', Boolean(await laden))

  // Neu laden: der alte Tab ist ersetzt, der alte Vorrat wird aufgeräumt
  await kontext.setOffline(false)
  await page.reload()
  await page.waitForTimeout(500)
  pruefe('Nach dem Neuladen nur noch der neue Vorrat', (await vorraete(page)).length === 1, (await vorraete(page)).join(', '))
  pruefe('Karte ist nach dem Update noch da', (await page.evaluate(() => localStorage.getItem('bibliographie:datenstamm:v1') ?? '')).includes('Vor dem Update angelegt'))
  await kontext.close()
}

// 2. Gesteuerte Seite: Hinweis, Neuladen, neuer Tab und offline zeigen den neuen Stand
{
  const kontext = await browser.newContext()
  const page = await kontext.newPage()
  page.on('pageerror', (e) => fehler.push(e.message))
  await page.goto(url)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  const alt = await stand(page)
  pruefe('Alte Version läuft mit Service Worker', Boolean(alt) && (await page.evaluate(() => Boolean(navigator.serviceWorker.controller))), alt)

  bauen()
  await updatePruefen(page)
  const hinweis = await page.locator('.neue-version').waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
  pruefe('Offene Seite meldet die neue Version', hinweis)
  if (hinweis) await page.getByRole('button', { name: 'Jetzt neu laden' }).click()
  else await page.reload()
  await page.waitForLoadState()
  const nachher = await stand(page)
  pruefe('Neu laden bringt den neuen Stand', nachher && nachher !== alt, `${alt} → ${nachher}`)

  const frisch = await kontext.newPage()
  await frisch.goto(url)
  pruefe('Neuer Tab hat sofort den neuen Stand', (await stand(frisch)) === nachher)

  await kontext.setOffline(true)
  await frisch.reload()
  pruefe('Offline danach ebenfalls neuer Stand', (await stand(frisch)) === nachher)
  await kontext.close()
}

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
