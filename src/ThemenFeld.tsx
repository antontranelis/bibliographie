import { useId, useState } from 'react'
import type { Thema } from './model'
import { baum, pfad } from './themen'
import { Nadel } from './Symbole'

const normal = (s: string) => s.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Themen der Karte aus der Themenordnung: Chips mit Pfad, Suche nach Nummer oder Titel. */
export function ThemenFeld({
  gewaehlt,
  themen,
  fixiert,
  nadel,
  onAendern,
}: {
  gewaehlt: string[]
  themen: Thema[]
  fixiert: string[]
  nadel: React.ReactNode
  onAendern: (ids: string[]) => void
}) {
  const [eingabe, setEingabe] = useState('')
  const [markiert, setMarkiert] = useState(0)
  const listeId = useId()
  const bekannt = new Set(themen.map((t) => t.id))
  const drin = gewaehlt.filter((id) => bekannt.has(id))
  const woerter = normal(eingabe).split(' ').filter(Boolean)
  const vorschlaege = woerter.length
    ? baum(themen)
        .map((k) => ({ id: k.thema.id, text: pfad(themen, k.thema.id) }))
        .filter((v) => !drin.includes(v.id) && woerter.every((w) => normal(v.text).includes(w)))
        .slice(0, 8)
    : []
  const waehle = (id: string) => {
    onAendern([...drin, id])
    setEingabe('')
    setMarkiert(0)
  }

  return (
    <div className="feld">
      <div className="feld-kopf">
        <span className="lab">Themen</span>
        {nadel}
      </div>
      {themen.length === 0 ? (
        <p className="hinweis">Noch keine Themenordnung. Themen legen Sie im Reiter „Themen“ an.</p>
      ) : (
        <div className="schlagwoerter">
          {drin.map((id) => (
            <span key={id} className="chip thema-chip">
              <span className="chip-text">
                {pfad(themen, id)}
                {fixiert.includes(id) && <Nadel groesse={12} />}
              </span>
              <button type="button" className="chip-weg" aria-label={`Thema ${pfad(themen, id)} entfernen`} onClick={() => onAendern(drin.filter((x) => x !== id))}>
                ×
              </button>
            </span>
          ))}
          <span className="schlagwort-eingabe">
            <input
              className="eingabe serif"
              role="combobox"
              aria-label="Thema hinzufügen"
              aria-expanded={vorschlaege.length > 0}
              aria-controls={listeId}
              aria-activedescendant={vorschlaege.length ? `${listeId}-${markiert}` : undefined}
              placeholder="Thema suchen …"
              autoComplete="off"
              value={eingabe}
              onChange={(e) => {
                setEingabe(e.target.value)
                setMarkiert(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && vorschlaege.length) {
                  e.preventDefault()
                  setMarkiert((m) => Math.min(m + 1, vorschlaege.length - 1))
                } else if (e.key === 'ArrowUp' && vorschlaege.length) {
                  e.preventDefault()
                  setMarkiert((m) => Math.max(m - 1, 0))
                } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && vorschlaege.length) {
                  e.preventDefault()
                  waehle(vorschlaege[markiert].id)
                } else if (e.key === 'Escape') setEingabe('')
              }}
            />
            {vorschlaege.length > 0 && (
              <ul className="klein-menue" role="listbox" id={listeId}>
                {vorschlaege.map((v, i) => (
                  <li
                    key={v.id}
                    id={`${listeId}-${i}`}
                    role="option"
                    aria-selected={i === markiert}
                    className={i === markiert ? 'markiert' : ''}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => waehle(v.id)}
                  >
                    {v.text}
                  </li>
                ))}
              </ul>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
