import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Verlag } from './model'
import { anzeigeName, nameFuerJahr, ortFuerJahr, verlagVorschlaege } from './verlag'

interface Props {
  wert: string
  jahr: string
  verlage: Verlag[]
  onText: (text: string) => void
  onWaehlen: (v: Verlag) => void
}

/** Kurzfassung der Ortsgeschichte: „Berlin, ab 1923 Dornach“. */
function ortsGeschichte(v: Verlag): string {
  return v.orte
    .filter((o) => o.ort.trim())
    .map((o, i) => (i === 0 || !o.abJahr ? o.ort : `ab ${o.abJahr} ${o.ort}`))
    .join(', ')
}

/**
 * Verlagsfeld mit Vorschlägen im Stil der Titelvorschläge. Die Liste liegt über der Seite,
 * damit der scrollbare Tabellenrahmen sie nicht abschneidet.
 */
export function VerlagFeld({ wert, jahr, verlage, onText, onWaehlen }: Props) {
  const [offen, setOffen] = useState(false)
  const [markiert, setMarkiert] = useState(0)
  const [lage, setLage] = useState<{ left: number; top: number; width: number } | null>(null)
  const feld = useRef<HTMLInputElement>(null)
  const listeId = useId()
  const vorschlaege = useMemo(() => (offen ? verlagVorschlaege(verlage, wert) : []), [offen, verlage, wert])
  const sichtbar = offen && vorschlaege.length > 0

  useLayoutEffect(() => {
    if (!sichtbar) return
    const messen = () => {
      const r = feld.current?.getBoundingClientRect()
      if (r) setLage({ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 420) })
    }
    messen()
    window.addEventListener('scroll', messen, true)
    window.addEventListener('resize', messen)
    return () => {
      window.removeEventListener('scroll', messen, true)
      window.removeEventListener('resize', messen)
    }
  }, [sichtbar])
  useEffect(() => setMarkiert(0), [wert])

  const waehle = (v: Verlag) => {
    onWaehlen(v)
    setOffen(false)
  }

  return (
    <>
      <input
        ref={feld}
        className="eingabe zelle"
        aria-label="Verlag"
        placeholder="Name oder Kürzel"
        autoComplete="off"
        role="combobox"
        aria-expanded={sichtbar}
        aria-controls={listeId}
        aria-activedescendant={sichtbar ? `${listeId}-${markiert}` : undefined}
        value={wert}
        onChange={(e) => {
          onText(e.target.value)
          setOffen(true)
        }}
        onFocus={() => setOffen(true)}
        onBlur={() => setOffen(false)}
        onKeyDown={(e) => {
          if (!sichtbar) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setMarkiert((m) => Math.min(m + 1, vorschlaege.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setMarkiert((m) => Math.max(m - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            waehle(vorschlaege[markiert] ?? vorschlaege[0])
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            setOffen(false)
          }
        }}
      />
      {sichtbar &&
        lage &&
        createPortal(
          <div className="vorschlaege-menue verlag-menue" style={{ left: lage.left, top: lage.top, width: lage.width }}>
            <ul role="listbox" id={listeId} aria-label="Verlage">
              {vorschlaege.map((v, i) => {
                const name = (/^\d{4}$/.test(jahr.trim()) && nameFuerJahr(v, jahr)) || anzeigeName(v)
                const ort = /^\d{4}$/.test(jahr.trim()) ? ortFuerJahr(v, jahr)?.ort : undefined
                const frueher = v.namen.map((n) => n.name).filter((n) => n && n !== name)
                const zusatz = [
                  ort ? `${jahr.trim()} in ${ort}` : ortsGeschichte(v),
                  frueher.length ? `auch: ${frueher.join(', ')}` : '',
                ].filter(Boolean)
                return (
                  <li
                    key={v.id}
                    id={`${listeId}-${i}`}
                    role="option"
                    aria-selected={i === markiert}
                    className={`vorschlag ${i === markiert ? 'markiert' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setMarkiert(i)}
                    onClick={() => waehle(v)}
                  >
                    <span className="vorschlag-text">
                      <span className="vorschlag-titel">
                        <b>{name}</b>
                      </span>
                      {zusatz.length > 0 && <span className="vorschlag-zusatz">{zusatz.join(' · ')}</span>}
                    </span>
                    {v.kuerzel && <kbd className="verlag-kuerzel">{v.kuerzel}</kbd>}
                  </li>
                )
              })}
            </ul>
            <div className="vorschlag-fuss">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> wählen
              </span>
              <span>
                <kbd>↵</kbd> übernehmen
              </span>
              <span>
                <kbd>Esc</kbd> schließen
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
