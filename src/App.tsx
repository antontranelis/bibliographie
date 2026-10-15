import { useEffect, useMemo, useRef, useState } from 'react'
import { leeresWerk, neueId, type Datenstamm, type ErschienenIn, type Person, type Schlagwort, type TextArt, type Werk } from './model'
import { Karteikarte } from './Karteikarte'
import { Katalogsuche } from './Katalogsuche'
import { Liste } from './Liste'
import { Verlage } from './Verlage'
import { beispielDaten } from './beispiel'
import { exportiere, exportiereCsl, importiere, ladeLokal, speichereLokal, zusammenfuehren } from './speicher'
import { herunterladen } from './herunterladen'
import { ortFuerJahr } from './verlag'
import type { Treffer } from './lobid'

export interface Fixierung {
  personen?: Person[]
  art?: TextArt
  verlag?: string
  erschienenIn?: ErschienenIn
  schlagwoerter?: Schlagwort[]
}

type Ansicht = 'kartei' | 'liste' | 'verlage'

const FIX_SCHLUESSEL = 'bibliographie:fixierung'

function ladeFixierung(): Fixierung {
  try {
    return JSON.parse(localStorage.getItem(FIX_SCHLUESSEL) ?? '{}') as Fixierung
  } catch {
    return {}
  }
}

export default function App() {
  const [daten, setDaten] = useState<Datenstamm>(() => ladeLokal() ?? { werke: [], verlage: [] })
  const [aktivId, setAktivId] = useState<string | null>(() => daten.werke[0]?.id ?? null)
  const [ansicht, setAnsicht] = useState<Ansicht>('kartei')
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState<'alle' | 'vorlaeufig' | 'fest'>('alle')
  const [katalogOffen, setKatalogOffen] = useState(false)
  const [fixiert, setFixiert] = useState<Fixierung>(ladeFixierung)
  const [meldung, setMeldung] = useState('')
  const dateiEingabe = useRef<HTMLInputElement>(null)

  useEffect(() => speichereLokal(daten), [daten])
  useEffect(() => {
    try {
      localStorage.setItem(FIX_SCHLUESSEL, JSON.stringify(fixiert))
    } catch {
      /* egal */
    }
  }, [fixiert])
  useEffect(() => {
    if (!meldung) return
    const t = setTimeout(() => setMeldung(''), 4000)
    return () => clearTimeout(t)
  }, [meldung])

  const aktiv = daten.werke.find((w) => w.id === aktivId) ?? null
  const alleSchlagwoerter = useMemo(
    () => [...new Set(daten.werke.flatMap((w) => w.schlagwoerter.map((s) => s.begriff)))].sort((a, b) => a.localeCompare(b, 'de')),
    [daten.werke],
  )

  const sichtbar = useMemo(() => {
    const s = suche.trim().toLowerCase()
    return daten.werke
      .filter((w) => filter === 'alle' || w.status === filter)
      .filter(
        (w) =>
          !s ||
          [w.titel, w.untertitel, w.kommentar, ...w.personen.map((p) => `${p.vorname} ${p.nachname}`), ...w.schlagwoerter.map((x) => x.begriff), ...w.auflagen.map((a) => `${a.verlag} ${a.ort} ${a.jahr}`)]
            .join(' ')
            .toLowerCase()
            .includes(s),
      )
      .sort((a, b) => b.geaendert.localeCompare(a.geaendert))
  }, [daten.werke, suche, filter])

  const aendereWerk = (w: Werk) =>
    setDaten((d) => ({ ...d, werke: d.werke.map((x) => (x.id === w.id ? { ...w, geaendert: new Date().toISOString() } : x)) }))

  const fixierungAnwenden = (w: Werk): Werk => {
    const neu = { ...w }
    if (fixiert.personen) neu.personen = fixiert.personen.map((p) => ({ ...p }))
    if (fixiert.art) neu.art = fixiert.art
    if (fixiert.erschienenIn) neu.erschienenIn = { ...fixiert.erschienenIn }
    if (fixiert.schlagwoerter) neu.schlagwoerter = fixiert.schlagwoerter.map((s) => ({ ...s }))
    if (fixiert.verlag !== undefined) {
      const v = daten.verlage.find((x) => x.name === fixiert.verlag)
      neu.auflagen = neu.auflagen.map((a) => ({ ...a, verlag: fixiert.verlag ?? '', ort: v ? ortFuerJahr(v, a.jahr)?.ort ?? a.ort : a.ort }))
    }
    return neu
  }

  const neueKarte = () => {
    const w = fixierungAnwenden(leeresWerk())
    setDaten((d) => ({ ...d, werke: [w, ...d.werke] }))
    setAktivId(w.id)
    setAnsicht('kartei')
  }

  const ausKatalog = (vorschlag: { titel: string; untertitel: string; personen: Person[] }, auswahl: Treffer[]) => {
    const w = fixierungAnwenden({
      ...leeresWerk(),
      titel: vorschlag.titel,
      untertitel: vorschlag.untertitel,
      personen: vorschlag.personen.length ? vorschlag.personen : [{ vorname: '', nachname: '', rolle: 'autor' }],
      auflagen: auswahl.map((t) => ({ ...t.auflage, id: neueId() })),
    })
    // Katalogdaten haben Vorrang vor fixierten Personen und Verlag
    w.personen = vorschlag.personen.length ? vorschlag.personen : w.personen
    w.auflagen = auswahl.map((t) => ({ ...t.auflage, id: neueId() }))
    setDaten((d) => ({ ...d, werke: [w, ...d.werke] }))
    setAktivId(w.id)
    setKatalogOffen(false)
    setMeldung(`Neue vorläufige Karte mit ${auswahl.length} ${auswahl.length === 1 ? 'Ausgabe' : 'Ausgaben'} angelegt.`)
  }

  const zuKarte = (auswahl: Treffer[]) => {
    if (!aktiv) return
    const leer = (a: Werk['auflagen'][number]) => !a.jahr && !a.verlag && !a.ort
    aendereWerk({ ...aktiv, auflagen: [...aktiv.auflagen.filter((a) => !leer(a)), ...auswahl.map((t) => ({ ...t.auflage, id: neueId() }))] })
    setKatalogOffen(false)
    setMeldung(`${auswahl.length} ${auswahl.length === 1 ? 'Ausgabe' : 'Ausgaben'} zur Karte hinzugefügt.`)
  }

  const loeschen = () => {
    if (!aktiv) return
    if (!confirm(`Karte „${aktiv.titel || 'ohne Titel'}“ löschen?`)) return
    const rest = daten.werke.filter((w) => w.id !== aktiv.id)
    setDaten({ ...daten, werke: rest })
    setAktivId(rest[0]?.id ?? null)
  }

  const verlagMerken = (name: string, ort: string, jahr: string) => {
    const kuerzel = name
      .split(/\s+/)
      .filter((t) => !/^(verlag|verl\.?|der|die|das|am|im|und|&)$/i.test(t))
      .map((t) => t[0]?.toLowerCase() ?? '')
      .join('')
      .slice(0, 4)
    setDaten((d) => ({
      ...d,
      verlage: [...d.verlage, { id: neueId(), name, kuerzel, orte: [{ abJahr: /^\d{4}$/.test(jahr) ? jahr : '', ort, wechselImJahr: false }] }],
    }))
    setMeldung(`Verlag „${name}“ gemerkt (Kürzel „${kuerzel}“). Unter „Verlage“ lässt sich das ändern.`)
  }

  const exportJson = () => {
    const datum = new Date().toISOString().slice(0, 10)
    herunterladen(new Blob([exportiere(daten)], { type: 'application/json' }), `bibliographie-${datum}.json`)
  }
  const exportCsl = () => {
    const datum = new Date().toISOString().slice(0, 10)
    herunterladen(new Blob([exportiereCsl(daten.werke)], { type: 'application/json' }), `bibliographie-csl-${datum}.json`)
  }
  const importJson = async (datei: File) => {
    try {
      const neu = importiere(await datei.text())
      setDaten((d) => zusammenfuehren(d, neu))
      setMeldung(`${neu.werke.length} Karten und ${neu.verlage.length} Verlage eingelesen.`)
    } catch (e) {
      setMeldung((e as Error).message)
    }
  }

  const fixierteTeile = [
    fixiert.personen && `Personen: ${fixiert.personen.map((p) => [p.vorname, p.nachname].filter(Boolean).join(' ')).join(' / ') || '(leer)'}`,
    fixiert.art && `Art: ${fixiert.art}`,
    fixiert.verlag !== undefined && `Verlag: ${fixiert.verlag || '(leer)'}`,
    fixiert.erschienenIn && `Erschienen in: ${fixiert.erschienenIn.titel || '(leer)'}`,
    fixiert.schlagwoerter && `Schlagwörter: ${fixiert.schlagwoerter.map((s) => s.begriff).join(', ') || '(leer)'}`,
  ].filter(Boolean) as string[]

  const anzahlFest = daten.werke.filter((w) => w.status === 'fest').length

  return (
    <div className="app">
      <header className="kopf">
        <h1>Bibliographie</h1>
        <nav>
          <button type="button" className={ansicht === 'kartei' ? 'aktiv' : ''} onClick={() => setAnsicht('kartei')}>
            Kartei
          </button>
          <button type="button" className={ansicht === 'liste' ? 'aktiv' : ''} onClick={() => setAnsicht('liste')}>
            Liste
          </button>
          <button type="button" className={ansicht === 'verlage' ? 'aktiv' : ''} onClick={() => setAnsicht('verlage')}>
            Verlage
          </button>
        </nav>
        <div className="datei">
          <button type="button" onClick={exportJson} title="Alle Daten als Datei sichern">
            Sichern
          </button>
          <button type="button" onClick={() => dateiEingabe.current?.click()} title="Gesicherte Datei einlesen">
            Einlesen
          </button>
          <button type="button" className="leise" onClick={exportCsl} title="Für Zotero, Citavi, Pandoc">
            CSL-Export
          </button>
          <input
            ref={dateiEingabe}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="hinweisband">
        Prototyp zum Ausprobieren. Die Daten liegen nur in diesem Browser. Mit „Sichern“ entsteht eine Datei, die sich mit „Einlesen“ zurückholen lässt.
      </div>

      {meldung && (
        <div className="meldung" role="status">
          {meldung}
        </div>
      )}

      {ansicht === 'kartei' && (
        <div className="kartei">
          <aside className="register">
            <button type="button" className="primaer gross" onClick={neueKarte}>
              + Neue Karte
            </button>
            <button type="button" onClick={() => setKatalogOffen(true)}>
              Im Katalog suchen
            </button>
            <input className="suche" placeholder="In der Kartei suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
            <div className="filter">
              {(['alle', 'vorlaeufig', 'fest'] as const).map((f) => (
                <button key={f} type="button" className={filter === f ? 'aktiv' : ''} onClick={() => setFilter(f)}>
                  {f === 'alle' ? 'alle' : f === 'fest' ? 'fest' : 'vorläufig'}
                </button>
              ))}
            </div>
            <p className="zaehler">
              {daten.werke.length} Karten, davon {anzahlFest} fest angelegt
            </p>
            <ul className="kartenliste">
              {sichtbar.map((w) => (
                <li key={w.id}>
                  <button type="button" className={w.id === aktivId ? 'aktiv' : ''} onClick={() => setAktivId(w.id)}>
                    <span className={`punkt ${w.status}`} title={w.status === 'fest' ? 'fest angelegt' : 'vorläufig'} />
                    <span className="eintrag-text">
                      <span className="name">{w.personen.map((p) => p.nachname).filter(Boolean).join(' / ') || '—'}</span>
                      <span className="titel">{w.titel || 'ohne Titel'}</span>
                      <span className="jahr">{w.art === 'aufsatz' ? w.erschienenIn?.jahr : w.auflagen.map((a) => a.jahr).filter(Boolean)[0]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {daten.werke.length === 0 && (
              <div className="leer-register">
                <p>Die Kartei ist leer.</p>
                <button
                  type="button"
                  onClick={() => {
                    const b = beispielDaten()
                    setDaten(b)
                    setAktivId(b.werke[0].id)
                  }}
                >
                  Beispielkarten laden
                </button>
              </div>
            )}
          </aside>

          <main className="arbeitsflaeche">
            {fixierteTeile.length > 0 && (
              <div className="fixiert-band">
                <span>📌 Fixiert für neue Karten: {fixierteTeile.join(' · ')}</span>
                <button type="button" className="leise" onClick={() => setFixiert({})}>
                  alle lösen
                </button>
              </div>
            )}
            {katalogOffen && (
              <Katalogsuche
                vorbelegung={{ autor: aktiv?.personen[0]?.nachname ?? '', titel: aktiv?.titel ?? '' }}
                hatAktuelleKarte={Boolean(aktiv)}
                onNeueKarte={ausKatalog}
                onZuKarte={zuKarte}
                onSchliessen={() => setKatalogOffen(false)}
              />
            )}
            {aktiv ? (
              <Karteikarte
                key={aktiv.id}
                werk={aktiv}
                verlage={daten.verlage}
                alleSchlagwoerter={alleSchlagwoerter}
                fixiert={fixiert}
                onAendern={aendereWerk}
                onLoeschen={loeschen}
                onFixieren={setFixiert}
                onVerlagMerken={verlagMerken}
              />
            ) : (
              !katalogOffen && (
                <div className="willkommen">
                  <h2>Willkommen</h2>
                  <p>Links eine neue Karte anlegen oder im Bibliothekskatalog suchen. Gefundene Ausgaben werden als vorläufige Karte übernommen und lassen sich dann prüfen und fest anlegen.</p>
                </div>
              )
            )}
          </main>
        </div>
      )}

      {ansicht === 'liste' && <Liste werke={daten.werke} />}
      {ansicht === 'verlage' && <Verlage verlage={daten.verlage} onAendern={(verlage) => setDaten((d) => ({ ...d, verlage }))} />}
    </div>
  )
}
