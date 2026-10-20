import { useMemo, useState } from 'react'
import type { Thema, Werk } from './model'
import { ausruecken, baum, bezeichnung, einruecken, entfernen, neuesThema, unterthemen, verschiebe } from './themen'

interface Props {
  themen: Thema[]
  werke: Werk[]
  onAendern: (themen: Thema[], entfernt?: Set<string>) => void
  onListe: (themaId: string) => void
}

/** Themenordnung pflegen: Nummer und Titel, Unterthemen, Reihenfolge, Ebene. */
export function Themen({ themen, werke, onAendern, onListe }: Props) {
  const [neuId, setNeuId] = useState<string | null>(null)
  const knoten = baum(themen)
  const setze = (id: string, teil: Partial<Thema>) => onAendern(themen.map((t) => (t.id === id ? { ...t, ...teil } : t)))
  const anlegen = (elternId: string) => {
    const r = neuesThema(themen, elternId)
    setNeuId(r.thema.id)
    onAendern(r.themen)
  }

  // Karten je Thema: direkt und mit Unterthemen
  const anzahl = useMemo(() => {
    const direkt = new Map<string, number>()
    for (const w of werke) for (const t of w.themen) direkt.set(t, (direkt.get(t) ?? 0) + 1)
    return direkt
  }, [werke])
  const ohneThema = useMemo(() => {
    const bekannt = new Set(themen.map((t) => t.id))
    return werke.filter((w) => !w.themen.some((t) => bekannt.has(t))).length
  }, [werke, themen])
  const mitUnterthemen = (id: string) => {
    const zweig = unterthemen(themen, id)
    return werke.filter((w) => w.themen.some((t) => zweig.has(t))).length
  }

  return (
    <div className="themen">
      <header className="verlage-kopf">
        <div>
          <h1>Themenordnung</h1>
          <p className="hinweis">
            Jede Karte lässt sich beliebig vielen Themen zuordnen. Für jedes Thema entsteht eine Literaturliste, und die ganze Themenkartei lässt sich als eine Liste mit
            Kapiteln drucken. {werke.length > 0 && `${ohneThema} von ${werke.length} Karten haben noch kein Thema.`}
          </p>
        </div>
        <button type="button" className="knopf haupt" onClick={() => anlegen('')}>
          + Thema
        </button>
      </header>
      {knoten.length === 0 && <p className="leise">Noch keine Themen. Ihr Gesamtgerüst lässt sich später einlesen, oder Sie legen die Themen hier an.</p>}
      {knoten.length > 0 && (
        <div className="papier themen-baum" role="tree" aria-label="Themenordnung">
          {knoten.map(({ thema: t, tiefe }) => {
            const direkt = anzahl.get(t.id) ?? 0
            const gesamt = mitUnterthemen(t.id)
            return (
              <div key={t.id} role="treeitem" aria-level={tiefe + 1} aria-label={bezeichnung(t) || 'neues Thema'} className="thema-zeile" style={{ paddingLeft: 12 + tiefe * 28 }}>
                <input className="eingabe thema-nummer" aria-label="Nummer" placeholder="Nr." value={t.nummer} onChange={(e) => setze(t.id, { nummer: e.target.value })} />
                <input
                  className="eingabe serif thema-titel"
                  aria-label="Titel des Themas"
                  placeholder="Titel des Themas"
                  autoFocus={t.id === neuId}
                  value={t.titel}
                  onChange={(e) => setze(t.id, { titel: e.target.value })}
                />
                <span className="leise klein thema-anzahl" title="Karten direkt bei diesem Thema / mit Unterthemen">
                  {direkt}
                  {gesamt !== direkt && ` · ${gesamt}`} {gesamt === 1 ? 'Karte' : 'Karten'}
                </span>
                <span className="thema-knoepfe">
                  <button type="button" className="klein-knopf" aria-label="nach oben" title="nach oben" onClick={() => onAendern(verschiebe(themen, t.id, -1))}>
                    ↑
                  </button>
                  <button type="button" className="klein-knopf" aria-label="nach unten" title="nach unten" onClick={() => onAendern(verschiebe(themen, t.id, 1))}>
                    ↓
                  </button>
                  <button type="button" className="klein-knopf" aria-label="eine Ebene höher" title="eine Ebene höher" disabled={!t.elternId} onClick={() => onAendern(ausruecken(themen, t.id))}>
                    ←
                  </button>
                  <button type="button" className="klein-knopf" aria-label="unter das vorige Thema" title="unter das vorige Thema" onClick={() => onAendern(einruecken(themen, t.id))}>
                    →
                  </button>
                  <button type="button" className="klein-knopf" onClick={() => anlegen(t.id)}>
                    + Unterthema
                  </button>
                  <button type="button" className="klein-knopf" disabled={gesamt === 0} onClick={() => onListe(t.id)}>
                    Liste daraus
                  </button>
                  <button
                    type="button"
                    className="klein-knopf"
                    aria-label={`${bezeichnung(t) || 'Thema'} entfernen`}
                    onClick={() => {
                      const r = entfernen(themen, t.id)
                      const unter = r.entfernt.size - 1
                      const frage = `„${bezeichnung(t) || 'Thema ohne Titel'}“${unter ? ` mit ${unter} Unterthemen` : ''} entfernen?${gesamt ? ` ${gesamt} Karten verlieren diese Zuordnung, die Karten selbst bleiben.` : ''}`
                      if (confirm(frage)) onAendern(r.themen, r.entfernt)
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
