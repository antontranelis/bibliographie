// Eigene Daten für Browser-Prüfungen einspielen. Die App speichert beim Verlassen der Seite ihren Stand;
// deshalb werden die Daten auf der neuen Seite gesetzt, bevor die App sie liest, und zwar genau einmal.
export async function spieleEin(page, daten) {
  const marke = `einspielen-${Math.random()}`
  await page.addInitScript(
    ([m, d]) => {
      if (sessionStorage.getItem(m)) return
      sessionStorage.setItem(m, '1')
      if (d === null) localStorage.clear()
      else localStorage.setItem('bibliographie:datenstamm:v1', JSON.stringify(d))
    },
    [marke, daten],
  )
  await page.reload()
}
