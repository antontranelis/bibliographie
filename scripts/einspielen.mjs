// Gespeicherte Daten für Browser-Prüfungen lesen und einspielen. Die App hält ihren Datenbestand in IndexedDB
// (src/ablage.ts) und zieht beim Start einen alten Stand aus localStorage dorthin um.

/** Der gespeicherte Datenbestand der Seite, oder null */
export const gespeichert = (page) =>
  page.evaluate(
    () =>
      new Promise((fertig, fehler) => {
        const offen = indexedDB.open('bibliographie')
        // Gibt es die Datenbank noch nicht, wird sie nicht angelegt
        let neu = false
        offen.onupgradeneeded = () => {
          neu = true
          offen.transaction.abort()
        }
        offen.onerror = () => (neu ? fertig(null) : fehler(offen.error))
        offen.onsuccess = () => {
          const db = offen.result
          if (!db.objectStoreNames.contains('stamm')) {
            db.close()
            return fertig(null)
          }
          const t = db.transaction(['werke', 'stamm'])
          const rest = t.objectStore('stamm').get('rest')
          const werke = t.objectStore('werke').getAll()
          t.oncomplete = () => {
            db.close()
            const r = rest.result
            if (!r) return fertig(null)
            const nachId = new Map(werke.result.flat().map((w) => [w.id, w]))
            fertig({ werke: r.reihenfolge.map((id) => nachId.get(id)), verlage: r.verlage, listen: r.listen, themen: r.themen })
          }
          t.onerror = () => fehler(t.error)
        }
      }),
  )

/** Gespeicherter Datenbestand nach dem verzögerten Speichern der App (400 ms), leer statt null */
export const daten = async (page) => {
  await page.waitForTimeout(500)
  return (await gespeichert(page)) ?? { werke: [], verlage: [], listen: [], themen: [] }
}

// Die App speichert beim Verlassen der Seite ihren Stand; deshalb werden die Daten auf der neuen Seite gesetzt,
// bevor die App sie liest, und zwar genau einmal: die Datenbank wird gelöscht und der Stand in localStorage gelegt,
// von wo die App ihn umzieht. null leert alles.
export async function spieleEin(page, daten) {
  const marke = `einspielen-${Math.random()}`
  await page.addInitScript(
    ([m, d]) => {
      if (sessionStorage.getItem(m)) return
      sessionStorage.setItem(m, '1')
      // Spätere Öffnungen warten, bis das Löschen durch ist
      indexedDB.deleteDatabase('bibliographie')
      localStorage.clear()
      if (d !== null) localStorage.setItem('bibliographie:datenstamm:v1', JSON.stringify(d))
    },
    [marke, daten],
  )
  await page.reload()
}

/** Alles leeren und neu laden */
export const leere = (page) => spieleEin(page, null)
