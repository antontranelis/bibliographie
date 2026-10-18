import { useMemo, useState } from 'react'
import { alleAuflagen, neueId, type Verlag, type Werk } from './model'
import { alleNamen, anzeigeName } from './verlag'

interface Props {
  verlage: Verlag[]
  werke: Werk[]
  onAendern: (v: Verlag[]) => void
  onZurueck: () => void
}

export function Verlage({ verlage, werke, onAendern }: Props) {
  const [suche, setSuche] = useState('')
  const setze = (id: string, teil: Partial<Verlag>) => onAendern(verlage.map((v) => (v.id === id ? { ...v, ...teil } : v)))

  const verwendet = useMemo(() => {
    const zaehler = new Map<string, number>()
    for (const w of werke) for (const a of alleAuflagen(w)) if (a.verlagId) zaehler.set(a.verlagId, (zaehler.get(a.verlagId) ?? 0) + 1)
    return zaehler
  }, [werke])

  const s = suche.trim().toLowerCase()
  const sortiert = [...verlage]
    .filter((v) => !s || v.kuerzel.toLowerCase() === s || alleNamen(v).some((n) => n.toLowerCase().includes(s)))
    .sort((a, b) => {
      const na = anzeigeName(a)
      const nb = anzeigeName(b)
      if (!na !== !nb) return na ? 1 : -1
      return na.localeCompare(nb, 'de')
    })

  return (
    <div className="verlage">
      <header className="verlage-kopf">
        <div>
          <h1>Verlage</h1>
          <p className="hinweis">
            Verlage werden beim Festanlegen einer Karte von selbst gemerkt. Hier lassen sich Kürzel, Namens- und Ortsgeschichte korrigieren. Ein Name oder Ort gilt bis zur
            nächsten Änderung. Die Angaben helfen beim Ausfüllen neuer Auflagen; was schon auf den Karten steht, bleibt unverändert.
          </p>
        </div>
        <button
          type="button"
          className="knopf haupt"
          onClick={() =>
            onAendern([{ id: neueId(), kuerzel: '', namen: [{ abJahr: '', name: '' }], orte: [{ abJahr: '', ort: '', wechselImJahr: false }], schreibweisen: [] }, ...verlage])
          }
        >
          + Neuer Verlag
        </button>
      </header>
      {verlage.length > 3 && (
        <input className="eingabe suche-verlage" placeholder="Verlag suchen: Name, frühere Namen, Kürzel" value={suche} onChange={(e) => setSuche(e.target.value)} />
      )}
      {verlage.length === 0 && <p className="leise">Noch keine Verlage. Sie entstehen von selbst, sobald eine Karte mit Verlag fest angelegt wird.</p>}
      {sortiert.map((v) => {
        const name = anzeigeName(v)
        const anzahl = verwendet.get(v.id) ?? 0
        return (
          <section className="papier verlag" key={v.id} aria-label={name || 'Neuer Verlag'}>
            <div className="verlag-kopf">
              <h2 className="verlag-name">{name || 'Neuer Verlag'}</h2>
              <label className="schmal">
                <span className="lab">Kürzel</span>
                <input className="eingabe" value={v.kuerzel} onChange={(e) => setze(v.id, { kuerzel: e.target.value })} />
              </label>
              <span className="leise klein">{anzahl === 0 ? 'auf keiner Auflage' : anzahl === 1 ? 'auf 1 Auflage' : `auf ${anzahl} Auflagen`}</span>
              <button
                type="button"
                className="textknopf leise rechts"
                onClick={() =>
                  confirm(`„${name || 'Verlag ohne Namen'}“ löschen?${anzahl ? ` Die ${anzahl} Auflagen behalten ihren Verlagsnamen, sind dann aber keinem Verlag mehr zugeordnet.` : ''}`) &&
                  onAendern(verlage.filter((x) => x.id !== v.id))
                }
              >
                Verlag löschen
              </button>
            </div>

            <div className="verlag-spalten">
              <div>
                <span className="lab">Namen</span>
                <table className="tabelle orte">
                  <thead>
                    <tr>
                      <th>ab Jahr</th>
                      <th>Name</th>
                      <th>
                        <span className="unsichtbar">Entfernen</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.namen.map((n, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            className="eingabe zelle"
                            aria-label="Name ab Jahr"
                            placeholder={i === 0 ? 'Anfang' : ''}
                            value={n.abJahr}
                            maxLength={4}
                            onChange={(e) => setze(v.id, { namen: v.namen.map((x, j) => (j === i ? { ...x, abJahr: e.target.value } : x)) })}
                          />
                        </td>
                        <td>
                          <input
                            className="eingabe zelle serif"
                            aria-label="Name"
                            value={n.name}
                            onChange={(e) => setze(v.id, { namen: v.namen.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                          />
                        </td>
                        <td>
                          {v.namen.length > 1 && (
                            <button type="button" className="weg" aria-label="Name entfernen" onClick={() => setze(v.id, { namen: v.namen.filter((_, j) => j !== i) })}>
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="textknopf" onClick={() => setze(v.id, { namen: [...v.namen, { abJahr: '', name: '' }] })}>
                  + Namensänderung
                </button>
              </div>

              <div>
                <span className="lab">Orte</span>
                <table className="tabelle orte">
                  <thead>
                    <tr>
                      <th>ab Jahr</th>
                      <th>Ort</th>
                      <th title="Lag der Wechsel mitten im Jahr, warnt die Karte in diesem Jahr">mitten im Jahr</th>
                      <th>
                        <span className="unsichtbar">Entfernen</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.orte.map((o, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            className="eingabe zelle"
                            aria-label="Ort ab Jahr"
                            placeholder={i === 0 ? 'Anfang' : ''}
                            value={o.abJahr}
                            maxLength={4}
                            onChange={(e) => setze(v.id, { orte: v.orte.map((x, j) => (j === i ? { ...x, abJahr: e.target.value } : x)) })}
                          />
                        </td>
                        <td>
                          <input
                            className="eingabe zelle"
                            aria-label="Ort"
                            value={o.ort}
                            onChange={(e) => setze(v.id, { orte: v.orte.map((x, j) => (j === i ? { ...x, ort: e.target.value } : x)) })}
                          />
                        </td>
                        <td>
                          {i > 0 && (
                            <input
                              type="checkbox"
                              aria-label="Wechsel mitten im Jahr"
                              checked={o.wechselImJahr}
                              onChange={(e) => setze(v.id, { orte: v.orte.map((x, j) => (j === i ? { ...x, wechselImJahr: e.target.checked } : x)) })}
                            />
                          )}
                        </td>
                        <td>
                          {v.orte.length > 1 && (
                            <button type="button" className="weg" aria-label="Ort entfernen" onClick={() => setze(v.id, { orte: v.orte.filter((_, j) => j !== i) })}>
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="textknopf" onClick={() => setze(v.id, { orte: [...v.orte, { abJahr: '', ort: '', wechselImJahr: false }] })}>
                  + Ortswechsel
                </button>
              </div>
            </div>

            {v.schreibweisen.length > 0 && (
              <div className="schreibweisen">
                <span className="lab">Weitere Schreibweisen</span>
                <span className="chips">
                  {v.schreibweisen.map((sw) => (
                    <span className="chip" key={sw}>
                      {sw}
                      <button type="button" aria-label={`Schreibweise „${sw}“ entfernen`} onClick={() => setze(v.id, { schreibweisen: v.schreibweisen.filter((x) => x !== sw) })}>
                        ×
                      </button>
                    </span>
                  ))}
                </span>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
