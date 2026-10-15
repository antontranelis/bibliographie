import { useRef, useState } from 'react'
import { sucheImKatalog, vorauswahl, type Treffer, type WerkVorschlag } from './lobid'

interface Props {
  vorbelegung: { autor: string; titel: string }
  hatAktuelleKarte: boolean
  onNeueKarte: (v: WerkVorschlag, auswahl: Treffer[]) => void
  onZuKarte: (auswahl: Treffer[]) => void
  onSchliessen: () => void
}

export function Katalogsuche({ vorbelegung, hatAktuelleKarte, onNeueKarte, onZuKarte, onSchliessen }: Props) {
  const [autor, setAutor] = useState(vorbelegung.autor)
  const [titel, setTitel] = useState(vorbelegung.titel)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')
  const [ergebnis, setErgebnis] = useState<WerkVorschlag[] | null>(null)
  const abbruch = useRef<AbortController | null>(null)

  const suche = async () => {
    abbruch.current?.abort()
    const ctrl = new AbortController()
    abbruch.current = ctrl
    setLaedt(true)
    setFehler('')
    try {
      setErgebnis(await sucheImKatalog(autor, titel, ctrl.signal))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setFehler('Der Katalog ist gerade nicht erreichbar. Ohne Internet geht die Eingabe von Hand weiter.')
    } finally {
      setLaedt(false)
    }
  }

  return (
    <aside className="katalog">
      <header className="katalog-kopf">
        <h2>Im Bibliothekskatalog suchen</h2>
        <button type="button" className="leise" onClick={onSchliessen}>
          schließen
        </button>
      </header>
      <form
        className="reihe"
        onSubmit={(e) => {
          e.preventDefault()
          suche()
        }}
      >
        <label>
          Autor (Nachname)
          <input value={autor} autoFocus onChange={(e) => setAutor(e.target.value)} />
        </label>
        <label>
          Titelwörter
          <input value={titel} onChange={(e) => setTitel(e.target.value)} />
        </label>
        <button type="submit" className="primaer" disabled={laedt || (!autor.trim() && !titel.trim())}>
          {laedt ? 'Suche …' : 'Suchen'}
        </button>
      </form>
      <p className="hinweis">
        Quelle: hbz-Verbundkatalog (lobid.org). Die Kataloge kürzen ab und zählen oft Tausende statt Auflagen. Übernommenes bleibt vorläufig, bis Sie es fest anlegen.
      </p>
      {fehler && <p className="warnung">{fehler}</p>}
      {ergebnis && ergebnis.length === 0 && <p>Nichts gefunden. Weniger oder andere Wörter versuchen.</p>}
      {ergebnis?.map((v) => (
        <Gruppe key={v.schluessel} vorschlag={v} hatAktuelleKarte={hatAktuelleKarte} onNeueKarte={onNeueKarte} onZuKarte={onZuKarte} />
      ))}
    </aside>
  )
}

function Gruppe({
  vorschlag,
  hatAktuelleKarte,
  onNeueKarte,
  onZuKarte,
}: {
  vorschlag: WerkVorschlag
  hatAktuelleKarte: boolean
  onNeueKarte: Props['onNeueKarte']
  onZuKarte: Props['onZuKarte']
}) {
  const [offen, setOffen] = useState(false)
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(() => vorauswahl(vorschlag.treffer))
  const auswahl = vorschlag.treffer.filter((_, i) => gewaehlt.has(i))
  const namen = vorschlag.personen.map((p) => [p.vorname, p.nachname].filter(Boolean).join(' ')).join(' / ')
  const umschalten = (i: number) => {
    const neu = new Set(gewaehlt)
    if (neu.has(i)) neu.delete(i)
    else neu.add(i)
    setGewaehlt(neu)
  }

  return (
    <div className="gruppe">
      <button type="button" className="gruppe-kopf" onClick={() => setOffen(!offen)}>
        <span className="gruppe-titel">
          {namen && <>{namen}: </>}
          <strong>{vorschlag.titel}</strong>
          {vorschlag.untertitel && <span className="untertitel">. {vorschlag.untertitel}</span>}
        </span>
        <span className="anzahl">
          {vorschlag.treffer.length} {vorschlag.treffer.length === 1 ? 'Ausgabe' : 'Ausgaben'} {offen ? '▴' : '▾'}
        </span>
      </button>
      {offen && (
        <>
          <p className="hinweis innen">Bibliotheken melden dieselbe Ausgabe oft mehrfach. Vorausgewählt ist je Jahr eine Ausgabe.</p>
          <table className="ausgaben">
            <thead>
              <tr>
                <th></th>
                <th>Jahr</th>
                <th>Verlag</th>
                <th>Ort</th>
                <th>Auflage / Vermerk</th>
                <th>Seiten</th>
              </tr>
            </thead>
            <tbody>
              {vorschlag.treffer.map((t, i) => (
                <tr key={t.auflage.id} className={gewaehlt.has(i) ? '' : 'abgewaehlt'} onClick={() => umschalten(i)}>
                  <td>
                    <input type="checkbox" checked={gewaehlt.has(i)} onChange={() => umschalten(i)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td>{t.auflage.jahr}</td>
                  <td>{t.auflage.verlag}</td>
                  <td>{t.auflage.ort}</td>
                  <td>{t.auflage.nummer ? `${t.auflage.nummer}. Aufl.` : t.auflage.vermerk}</td>
                  <td>{[t.auflage.seitenRoemisch, t.auflage.seiten].filter(Boolean).join(' + ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="reihe aktionen">
            <button type="button" className="primaer" disabled={auswahl.length === 0} onClick={() => onNeueKarte(vorschlag, auswahl)}>
              Als neue Karte übernehmen ({auswahl.length})
            </button>
            {hatAktuelleKarte && (
              <button type="button" disabled={auswahl.length === 0} onClick={() => onZuKarte(auswahl)}>
                Als Auflagen zur offenen Karte hinzufügen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
