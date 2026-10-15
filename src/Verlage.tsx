import { neueId, type Verlag } from './model'

export function Verlage({ verlage, onAendern }: { verlage: Verlag[]; onAendern: (v: Verlag[]) => void }) {
  const setze = (id: string, teil: Partial<Verlag>) => onAendern(verlage.map((v) => (v.id === id ? { ...v, ...teil } : v)))
  const sortiert = [...verlage].sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return (
    <div className="verlage">
      <header className="verlage-kopf">
        <div>
          <h2>Verlage</h2>
          <p className="hinweis">
            Jeder Verlag hat ein Kürzel für die schnelle Eingabe und eine Ortsgeschichte. Der erste Ort gilt für alle Jahre bis zum nächsten Wechsel. Lag ein Wechsel mitten im Jahr, warnt die Karte in diesem Jahr.
          </p>
        </div>
        <button type="button" className="primaer" onClick={() => onAendern([{ id: neueId(), name: '', kuerzel: '', orte: [{ abJahr: '', ort: '', wechselImJahr: false }] }, ...verlage])}>
          + Neuer Verlag
        </button>
      </header>
      {sortiert.length === 0 && <p>Noch keine Verlage. Auf der Karte lässt sich jeder eingetippte Verlag mit einem Klick merken.</p>}
      {sortiert.map((v) => (
        <div className="verlag" key={v.id}>
          <div className="reihe">
            <label>
              Name
              <input value={v.name} onChange={(e) => setze(v.id, { name: e.target.value })} />
            </label>
            <label className="schmal">
              Kürzel
              <input value={v.kuerzel} onChange={(e) => setze(v.id, { kuerzel: e.target.value })} />
            </label>
            <button type="button" className="entfernen" title="Verlag löschen" onClick={() => confirm(`„${v.name}“ löschen?`) && onAendern(verlage.filter((x) => x.id !== v.id))}>
              ×
            </button>
          </div>
          <table className="orte">
            <thead>
              <tr>
                <th>ab Jahr</th>
                <th>Ort</th>
                <th>Wechsel mitten im Jahr</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {v.orte.map((o, i) => (
                <tr key={i}>
                  <td>
                    <input value={o.abJahr} maxLength={4} onChange={(e) => setze(v.id, { orte: v.orte.map((x, j) => (j === i ? { ...x, abJahr: e.target.value } : x)) })} />
                  </td>
                  <td>
                    <input value={o.ort} onChange={(e) => setze(v.id, { orte: v.orte.map((x, j) => (j === i ? { ...x, ort: e.target.value } : x)) })} />
                  </td>
                  <td>
                    {i > 0 && (
                      <input type="checkbox" checked={o.wechselImJahr} onChange={(e) => setze(v.id, { orte: v.orte.map((x, j) => (j === i ? { ...x, wechselImJahr: e.target.checked } : x)) })} />
                    )}
                  </td>
                  <td>
                    {v.orte.length > 1 && (
                      <button type="button" className="entfernen" onClick={() => setze(v.id, { orte: v.orte.filter((_, j) => j !== i) })}>
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="hinzu klein" onClick={() => setze(v.id, { orte: [...v.orte, { abJahr: '', ort: '', wechselImJahr: false }] })}>
            + Ortswechsel
          </button>
        </div>
      ))}
    </div>
  )
}
