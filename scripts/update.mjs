// Prüft, dass der Service Worker Updates nicht blockiert: offene Seite, neuer Build, neuer Stand.
// Aufruf: node scripts/update.mjs <url> — baut dazwischen selbst neu (npx vite build), die Vorschau muss dist ausliefern.
import { execSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const [url = 'http://localhost:4321/'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
const ergebnisse = []
const pruefe = (name, ok, info = '') => ergebnisse.push({ name, ok, info })
const fehler = []

const kontext = await browser.newContext()
const page = await kontext.newPage()
page.on('pageerror', (e) => fehler.push(e.message))
const stand = (p) => p.evaluate(() => document.documentElement.dataset.stand)

await page.goto(url)
await page.evaluate(() => navigator.serviceWorker.ready)
await page.reload()
const alt = await stand(page)
pruefe('Alte Version läuft mit Service Worker', Boolean(alt) && (await page.evaluate(() => Boolean(navigator.serviceWorker.controller))), alt)

execSync('npx vite build', { stdio: 'ignore' })

// Die offene Seite erfährt beim nächsten Update-Check von der neuen Version
await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))
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
const vorraete = await frisch.evaluate(() => caches.keys())
pruefe('Alter Vorrat ist gelöscht', vorraete.length === 1, vorraete.join(', '))

await browser.close()
for (const e of ergebnisse) console.log(`${e.ok ? 'ok  ' : 'FEHL'} ${e.name}${e.info ? ` (${e.info})` : ''}`)
if (fehler.length) console.log('Seitenfehler:', fehler)
process.exit(ergebnisse.every((e) => e.ok) && !fehler.length ? 0 : 1)
