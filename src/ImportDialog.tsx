import { useEffect, useMemo, useRef, useState } from 'react'
import type { ImportPlan } from './import/einlesen'

/** Auswahl beim Einlesen einer Literaturliste: welche Abschnitte, ob zusätzlich eine Liste entsteht. */
export function ImportDialog({
  dateiname,
  plan,
  onUebernehmen,
  onAbbrechen,
}: {
  dateiname: string
  plan: ImportPlan
  onUebernehmen: (auswahl: Set<number>, listenName: string | null) => void
  onAbbrechen: () => void
}) {
  const [auswahl, setAuswahl] = useState(() => new Set(plan.abschnitte.filter((a) => a.vorschlag).map((a) => a.nr)))
  const [alsListe, setAlsListe] = useState(true)
  const [name, setName] = useState(dateiname.replace(/\.odt$/i, ''))
  const abbrechen = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    abbrechen.current?.focus()
    const t = (e: KeyboardEvent) => e.key === 'Escape' && onAbbrechen()
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [onAbbrechen])

  const zahlen = useMemo(() => {
    const g = plan.posten.filter((p) => auswahl.has(p.abschnittNr))
    const istDoppelt = (p: (typeof g)[number]) => !p.vorhandenId && p.doppeltVon !== undefined && auswahl.has(plan.posten[p.doppeltVon].abschnittNr)
    // sicher, prüfen und von Hand zählen nur die Karten, die neu entstehen
    const neu = g.filter((p) => !p.vorhandenId && !istDoppelt(p))
    const z = (s: string) => neu.filter((p) => p.status === s).length
    return { alle: g.length, sicher: z('sicher'), pruefen: z('pruefen'), hand: z('hand'), vorhanden: g.filter((p) => p.vorhandenId).length, doppelt: g.filter(istDoppelt).length, neu: neu.length }
  }, [plan, auswahl])
  const umschalten = (nr: number) => {
    const neu = new Set(auswahl)
    if (neu.has(nr)) neu.delete(nr)
    else neu.add(nr)
    setAuswahl(neu)
  }

  return (
    <div className="ueberlagerung" role="dialog" aria-modal="true" aria-label="Liste einlesen">
      <div className="papier import-dialog">
        <h2>Liste einlesen: {dateiname}</h2>
        <p className="leise">
          Gefunden: {plan.posten.length} Einträge in {plan.abschnitte.length} Absätzen. Begleittext ohne erkennbare Einträge ist abgewählt.
        </p>
        <div className="tabelle-rahmen">
          <table className="tabelle import-abschnitte">
            <thead>
              <tr>
                <th className="sp-liste">
                  <span className="unsichtbar">Einlesen</span>
                </th>
                <th>Absatz</th>
                <th className="zahl">Einträge</th>
                <th className="zahl">erkannt</th>
              </tr>
            </thead>
            <tbody>
              {plan.abschnitte.map((a) => (
                <tr key={a.nr} className={auswahl.has(a.nr) ? '' : 'abgewaehlt'}>
                  <td className="sp-liste">
                    <input type="checkbox" aria-label={`Absatz ${a.nr + 1} einlesen`} checked={auswahl.has(a.nr)} onChange={() => umschalten(a.nr)} />
                  </td>
                  <td title={a.titel}>
                    {a.titel.length > 90 ? `${a.titel.slice(0, 90)} …` : a.titel}
                    {a.eintraege === 0 && <span className="leise klein"> · Überschrift</span>}
                  </td>
                  <td className="zahl">{a.eintraege || ''}</td>
                  <td className="zahl">{a.eintraege ? `${Math.round((a.erkannt / a.eintraege) * 100)} %` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="import-zahlen">
          <div>
            <dt>sicher erkannt</dt>
            <dd>{zahlen.sicher}</dd>
          </div>
          <div>
            <dt>erkannt, bitte prüfen</dt>
            <dd>{zahlen.pruefen}</dd>
          </div>
          <div>
            <dt>von Hand nacharbeiten</dt>
            <dd>{zahlen.hand}</dd>
          </div>
          <div>
            <dt>schon in der Kartei</dt>
            <dd>{zahlen.vorhanden}</dd>
          </div>
          <div>
            <dt>doppelt in der Datei</dt>
            <dd>{zahlen.doppelt}</dd>
          </div>
        </dl>
        <p className="klein">
          Alle neuen Karten sind vorläufig. Wo nicht sicher erkannt wurde, steht die Originalzeile auf der Karte; die Kartei zeigt diese Karten mit „nur mit Vorlage“.
        </p>

        <label className="haken">
          <input type="checkbox" checked={alsListe} onChange={(e) => setAlsListe(e.target.checked)} /> Zusätzlich als Liste mit Kapiteln anlegen
        </label>
        {alsListe && (
          <label className="import-name">
            <span className="lab">Name der Liste</span>
            <input className="eingabe serif" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}

        <div className="knopfreihe">
          <button type="button" className="knopf haupt" disabled={zahlen.alle === 0} onClick={() => onUebernehmen(auswahl, alsListe ? name.trim() || 'Eingelesene Liste' : null)}>
            {zahlen.neu} {zahlen.neu === 1 ? 'Karte' : 'Karten'} anlegen
          </button>
          <button ref={abbrechen} type="button" className="knopf" onClick={onAbbrechen}>
            Abbrechen <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
