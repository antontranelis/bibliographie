import { neueId, type Verlag } from './model'

export function Verlage({ verlage, onAendern, onZurueck }: { verlage: Verlag[]; onAendern: (v: Verlag[]) => void; onZurueck: () => void }) {
  const setze = (id: string, teil: Partial<Verlag>) => onAendern(verlage.map((v) => (v.id === id ? { ...v, ...teil } : v)))
  const sortiert = [...verlage].sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return (
    <div className="verlage">
      <header className="verlage-kopf">
        <div>
          <button type="button" className="textknopf" onClick={onZurueck}>
            ← zurück
          </button>
          <h1>Verlage</h1>
          <p className="hinweis">
            Jeder Verlag hat ein Kürzel für die schnelle Eingabe und eine Ortsgeschichte. Ein Ort gilt bis zum nächsten Wechsel. Lag ein Wechsel mitten im Jahr,
            warnt die Karte in diesem Jahr.
          </p>
        </div>
        <button
          type="button"
          className="knopf haupt"
          onClick={() => onAendern([{ id: neueId(), name: '', kuerzel: '', orte: [{ abJahr: '', ort: '', wechselImJahr: false }] }, ...verlage])}
        >
          + Neuer Verlag
        </button>
      </header>
      {sortiert.length === 0 && <p className="leise">Noch keine Verlage. Auf der Karte lässt sich jeder eingetippte Verlag unter „⋯“ merken.</p>}
      {sortiert.map((v) => (
        <section className="papier verlag" key={v.id} aria-label={v.name || 'Neuer Verlag'}>
          <div className="verlag-kopf">
            <label className="breit">
              <span className="lab">Name</span>
              <input className="eingabe serif" value={v.name} onChange={(e) => setze(v.id, { name: e.target.value })} />
            </label>
            <label className="schmal">
              <span className="lab">Kürzel</span>
              <input className="eingabe" value={v.kuerzel} onChange={(e) => setze(v.id, { kuerzel: e.target.value })} />
            </label>
            <button
              type="button"
              className="textknopf leise"
              onClick={() => confirm(`„${v.name || 'Verlag ohne Namen'}“ löschen?`) && onAendern(verlage.filter((x) => x.id !== v.id))}
            >
              Verlag löschen
            </button>
          </div>
          <table className="tabelle orte">
            <thead>
              <tr>
                <th>ab Jahr</th>
                <th>Ort</th>
                <th>Wechsel mitten im Jahr</th>
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
                      aria-label="ab Jahr"
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
        </section>
      ))}
    </div>
  )
}
