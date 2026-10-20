import { useEffect, useMemo, useRef, useState } from 'react'
import type { Thema } from './model'
import { baum, bezeichnung } from './themen'

/** Ohne die abgewählten Themen; deren Unterthemen rücken eine Ebene hoch. */
export function ohneAbgewaehlte(themen: Thema[], ab: Set<string>): Thema[] {
  const nachId = new Map(themen.map((t) => [t.id, t]))
  const eltern = (id: string): string => {
    let e = nachId.get(id)?.elternId ?? ''
    while (e && ab.has(e)) e = nachId.get(e)?.elternId ?? ''
    return e
  }
  return themen.filter((t) => !ab.has(t.id)).map((t) => ({ ...t, elternId: eltern(t.id) }))
}

/** Vorschau eines eingelesenen Gesamtgerüsts vor dem Übernehmen in die Themenordnung. */
export function GeruestDialog({
  dateiname,
  themen,
  bestand,
  onUebernehmen,
  onAbbrechen,
}: {
  dateiname: string
  themen: Thema[]
  bestand: number
  onUebernehmen: (themen: Thema[]) => void
  onAbbrechen: () => void
}) {
  const [ab, setAb] = useState<Set<string>>(new Set())
  const abbrechen = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    abbrechen.current?.focus()
    const t = (e: KeyboardEvent) => e.key === 'Escape' && onAbbrechen()
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [onAbbrechen])
  const knoten = useMemo(() => baum(themen), [themen])
  const anzahl = themen.length - ab.size
  const umschalten = (id: string) => {
    const neu = new Set(ab)
    if (neu.has(id)) neu.delete(id)
    else neu.add(id)
    setAb(neu)
  }

  return (
    <div className="ueberlagerung" role="dialog" aria-modal="true" aria-label="Themenordnung einlesen">
      <div className="papier import-dialog">
        <h2>Themenordnung einlesen: {dateiname}</h2>
        <p className="leise">
          {themen.length} Themen erkannt. Bitte prüfen, ob die Ebenen stimmen; Zeilen, die kein Thema sind, etwa ein Titel, lassen sich abwählen.
          {bestand > 0 && ' Die Themen kommen zur bestehenden Ordnung dazu; gleichnamige werden zusammengeführt.'}
        </p>
        <div className="papier themen-baum geruest-vorschau" role="tree" aria-label="Vorschau der Themenordnung">
          {knoten.map(({ thema: t, tiefe }) => (
            <label key={t.id} role="treeitem" aria-level={tiefe + 1} className={`thema-zeile ${ab.has(t.id) ? 'abgewaehlt' : ''}`} style={{ paddingLeft: 12 + tiefe * 28 }}>
              <input type="checkbox" checked={!ab.has(t.id)} onChange={() => umschalten(t.id)} aria-label={`${bezeichnung(t)} übernehmen`} />
              <span className="geruest-nummer">{t.nummer}</span>
              <span>{t.titel}</span>
            </label>
          ))}
        </div>
        <div className="knopfreihe">
          <button type="button" className="knopf haupt" disabled={anzahl === 0} onClick={() => onUebernehmen(ohneAbgewaehlte(themen, ab))}>
            {anzahl} {anzahl === 1 ? 'Thema' : 'Themen'} übernehmen
          </button>
          <button ref={abbrechen} type="button" className="knopf" onClick={onAbbrechen}>
            Abbrechen <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
