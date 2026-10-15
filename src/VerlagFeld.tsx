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

interface Lage {
  left: number
  width: number
  /** Abstand von oben (Liste unter dem Feld) oder von unten (Liste über dem Feld) */
  top?: number
  bottom?: number
  maxHoehe: number
}

const RAND = 16
const ABSTAND = 6
const FUSS = 44
const WUNSCHHOEHE = 320

/**
 * Lage der Liste im Fenster: nie breiter als das Fenster, rechts und links mit Rand,
 * nach oben aufgeklappt, wenn unten der Platz nicht reicht und oben mehr ist.
 */
export function berechneLage(feld: { left: number; top: number; bottom: number; width: number }, fenster: { breite: number; hoehe: number }): Lage {
  const width = Math.min(Math.max(feld.width, 420), fenster.breite - 2 * RAND)
  const left = Math.min(Math.max(feld.left, RAND), fenster.breite - width - RAND)
  const unten = fenster.hoehe - feld.bottom - ABSTAND - RAND
  const oben = feld.top - ABSTAND - RAND
  if (unten >= WUNSCHHOEHE + FUSS || unten >= oben) {
    return { left, width, top: feld.bottom + ABSTAND, maxHoehe: Math.max(unten - FUSS, 80) }
  }
  return { left, width, bottom: fenster.hoehe - feld.top + ABSTAND, maxHoehe: Math.max(oben - FUSS, 80) }
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
  const [lage, setLage] = useState<Lage | null>(null)
  const feld = useRef<HTMLInputElement>(null)
  const listeId = useId()
  const vorschlaege = useMemo(() => (offen ? verlagVorschlaege(verlage, wert) : []), [offen, verlage, wert])
  const sichtbar = offen && vorschlaege.length > 0

  useLayoutEffect(() => {
    if (!sichtbar) return
    const messen = () => {
      const r = feld.current?.getBoundingClientRect()
      if (r) setLage(berechneLage(r, { breite: window.innerWidth, hoehe: window.innerHeight }))
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
  // Die markierte Option bleibt beim Blättern mit den Pfeiltasten sichtbar
  useEffect(() => {
    if (sichtbar) document.getElementById(`${listeId}-${markiert}`)?.scrollIntoView({ block: 'nearest' })
  }, [markiert, sichtbar, listeId])

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
          <div className="vorschlaege-menue verlag-menue" style={{ left: lage.left, top: lage.top, bottom: lage.bottom, width: lage.width }}>
            <ul role="listbox" id={listeId} aria-label="Verlage" style={{ maxHeight: lage.maxHoehe }}>
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
