import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TEXT_ARTEN, alleAuflagen, leeresWerk, mitAuflagen, type Datenstamm, type Literaturliste, type ErschienenIn, type Person, type Schlagwort, type TextArt, type Verlag, type Werk } from './model'
import { Karteikarte } from './Karteikarte'
import { Kartei, LEERE_SICHT, type KarteiSicht, type ListenVorgabe } from './Kartei'
import { Liste } from './Liste'
import { ALLE, hinzufuegen, neueListe } from './listen'
import { Verlage } from './Verlage'
import { beispielDaten } from './beispiel'
import { exportiere, exportiereCsl, importiere, ladeLokal, speichereLokal, zusammenfuehren } from './speicher'
import { herunterladen } from './herunterladen'
import { anzeigeName, findeExakt, nameFuerJahr, ortFuerJahr, planeVerlage, wendePlanAn, type VerlagsGruppe } from './verlag'
import { Abwaerts, Nadel, StatusPunkt } from './Symbole'
import { eigeneAngaben, weichtAb, type Inhaltsfeld } from './entwurf'

export interface Fixierung {
  personen?: Person[]
  art?: TextArt
  verlag?: string
  erschienenIn?: ErschienenIn
  schlagwoerter?: Schlagwort[]
}

type Ansicht = 'erfassen' | 'kartei' | 'liste' | 'verlage'

const FIX_SCHLUESSEL = 'bibliographie:fixierung'

function ladeFixierung(): Fixierung {
  try {
    return JSON.parse(localStorage.getItem(FIX_SCHLUESSEL) ?? '{}') as Fixierung
  } catch {
    return {}
  }
}

/** Neue Karte mit allen fixierten Feldern vorbelegt. */
function mitFixierung(w: Werk, fixiert: Fixierung, verlage: Verlag[]): Werk {
  const neu = { ...w }
  if (fixiert.personen) neu.personen = fixiert.personen.map((p) => ({ ...p }))
  if (fixiert.art) neu.art = fixiert.art
  if (fixiert.erschienenIn) neu.erschienenIn = { ...fixiert.erschienenIn }
  if (fixiert.schlagwoerter) neu.schlagwoerter = fixiert.schlagwoerter.map((s) => ({ ...s }))
  if (fixiert.verlag !== undefined) {
    const v = findeExakt(verlage, fixiert.verlag)
    return mitAuflagen(neu, (a) => ({
      ...a,
      verlag: v ? nameFuerJahr(v, a.jahr) || fixiert.verlag! : fixiert.verlag ?? '',
      ...(v ? { verlagId: v.id } : {}),
      ort: (v && ortFuerJahr(v, a.jahr)?.ort) || a.ort,
    }))
  }
  return neu
}

/** Felder, über die die Karte vorhandene Werke vorschlägt. */
const SUCHFELDER: Inhaltsfeld[] = ['personen', 'titel', 'untertitel']

const FELDNAMEN: Record<Inhaltsfeld, string> = {
  art: 'Art des Textes',
  status: 'Status',
  personen: 'Personen',
  titel: 'Titel',
  untertitel: 'Untertitel',
  reihe: 'Schriftenreihe',
  reiheBand: 'Band',
  ausgaben: 'Ausgaben und Auflagen',
  ersterscheinung: 'Ersterscheinung',
  erschienenIn: 'Erschienen in',
  kommentar: 'Rückseite',
  anmerkung: 'Anmerkung',
  schlagwoerter: 'Schlagwörter',
}

const REITER: { ansicht: Ansicht; label: string; taste: string }[] = [
  { ansicht: 'erfassen', label: 'Erfassen', taste: 'F2' },
  { ansicht: 'kartei', label: 'Kartei', taste: 'F3' },
  { ansicht: 'liste', label: 'Liste', taste: 'F4' },
  { ansicht: 'verlage', label: 'Verlage', taste: 'F5' },
]

export default function App() {
  const [daten, setDaten] = useState<Datenstamm>(() => ladeLokal() ?? { werke: [], verlage: [], listen: [] })
  const [fixiert, setFixiert] = useState<Fixierung>(ladeFixierung)
  const [ansicht, setAnsicht] = useState<Ansicht>('erfassen')
  const [entwurf, setEntwurf] = useState<Werk | null>(() => mitFixierung(leeresWerk(), fixiert, daten.verlage))
  /** Die Karte, wie sie angelegt wurde. Alles, was davon abweicht, hat der Nutzer eingetragen. */
  const [vorlage, setVorlage] = useState<Werk | null>(() => (entwurf ? structuredClone(entwurf) : null))
  const [erfassenId, setErfassenId] = useState<string>(() => entwurf?.id ?? '')
  /** Karte, die in dieser Erfassung aus dem Entwurf entstanden ist */
  const [frischId, setFrischId] = useState<string | null>(null)
  const [nachholenId, setNachholenId] = useState<string | null>(null)
  const [sitzung, setSitzung] = useState<string[]>([])
  const [karteiSicht, setKarteiSicht] = useState<KarteiSicht>(LEERE_SICHT)
  const [listenId, setListenId] = useState<string | null>(null)
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
    const t = setTimeout(() => setMeldung(''), 5000)
    return () => clearTimeout(t)
  }, [meldung])

  const gespeichert = daten.werke.find((w) => w.id === erfassenId)
  const karte = gespeichert ?? (entwurf?.id === erfassenId ? entwurf : null)

  const alleSchlagwoerter = useMemo(
    () => [...new Set(daten.werke.flatMap((w) => w.schlagwoerter.map((s) => s.begriff)))].sort((a, b) => a.localeCompare(b, 'de')),
    [daten.werke],
  )

  const merkeSitzung = (id: string) => setSitzung((s) => (s[0] === id ? s : [id, ...s.filter((x) => x !== id)].slice(0, 40)))

  const neueKarte = useCallback(() => {
    const w = mitFixierung(leeresWerk(), fixiert, daten.verlage)
    setEntwurf(w)
    setVorlage(structuredClone(w))
    setErfassenId(w.id)
    setFrischId(null)
    setNachholenId(null)
    setAnsicht('erfassen')
  }, [fixiert, daten.verlage])

  // Karte verschwunden (gelöscht, eingelesen): gleich eine neue bereitlegen
  useEffect(() => {
    if (!karte) neueKarte()
  }, [karte, neueKarte])

  const aendereKarte = (w: Werk) => {
    const jetzt = new Date().toISOString()
    if (daten.werke.some((x) => x.id === w.id)) {
      setDaten((d) => ({ ...d, werke: d.werke.map((x) => (x.id === w.id ? { ...w, geaendert: jetzt } : x)) }))
      merkeSitzung(w.id)
    } else if (!vorlage || vorlage.id !== w.id || weichtAb(w, vorlage)) {
      setDaten((d) => ({ ...d, werke: [{ ...w, angelegt: jetzt, geaendert: jetzt }, ...d.werke] }))
      setEntwurf(null)
      setFrischId(w.id)
      merkeSitzung(w.id)
    } else {
      setEntwurf(w)
    }
  }

  const festAnlegen = () => {
    if (!karte) return
    if (!karte.titel.trim()) {
      setMeldung('Zum Festanlegen fehlt noch der Titel.')
      return
    }
    // Verlage der Karte abgleichen: bekannte verknüpfen, neue merken, bei ähnlichen einmal fragen
    const plan = planeVerlage(karte, daten.verlage)
    const r = wendePlanAn(karte, daten.verlage, plan, (g) =>
      confirm(
        `Auf der Karte steht ${g.texte.map((t) => `„${t}“`).join(', ')}.\nIst das der Verlag „${g.verlag ? anzeigeName(g.verlag) : ''}“?\n\n` +
          'OK: derselbe Verlag, die Schreibweise wird gemerkt.\nAbbrechen: ein anderer Verlag, er wird neu angelegt.',
      ),
    )
    const neueVerlage = r.verlage.length - daten.verlage.length
    if (r.verlage !== daten.verlage) setDaten((d) => ({ ...d, verlage: r.verlage }))
    aendereKarte({ ...r.werk, status: 'fest' })
    setMeldung(
      `„${karte.titel.trim()}“ ist fest angelegt.` +
        (neueVerlage > 0 ? ` ${neueVerlage === 1 ? 'Ein neuer Verlag ist' : `${neueVerlage} neue Verlage sind`} gemerkt.` : '') +
        ' Die nächste Karte liegt bereit.',
    )
    neueKarte()
  }

  const oeffne = (id: string, nachholen = false) => {
    setEntwurf(null)
    setErfassenId(id)
    setFrischId(null)
    setNachholenId(nachholen ? id : null)
    setAnsicht('erfassen')
  }

  const zuVorhandener = (id: string) => {
    if (karte && frischId === karte.id && karte.status === 'vorlaeufig') {
      // Nur Suchangaben getippt: die Karte war bloß der Weg zum vorhandenen Werk und darf weg.
      // Alles Weitere wird nie still verworfen.
      const weitere = vorlage?.id === karte.id ? eigeneAngaben(karte, vorlage, SUCHFELDER) : ['ausgaben' as Inhaltsfeld]
      const verwerfen =
        weitere.length === 0 ||
        confirm(
          `Die angefangene Karte enthält eigene Angaben (${weitere.map((f) => FELDNAMEN[f]).join(', ')}).\n\n` +
            'OK verwirft sie. Abbrechen behält sie als vorläufige Karte.',
        )
      if (verwerfen) {
        setDaten((d) => ({ ...d, werke: d.werke.filter((w) => w.id !== karte.id) }))
        setSitzung((s) => s.filter((x) => x !== karte.id))
        setMeldung('Das Werk steht schon in der Kartei. Die angefangene Karte ist verworfen.')
      } else {
        setMeldung('Das Werk steht schon in der Kartei. Die angefangene Karte bleibt vorläufig erhalten.')
      }
    }
    oeffne(id)
  }

  const loeschen = () => {
    if (!karte) return
    if (gespeichert) {
      if (!confirm(`Karte „${karte.titel || 'ohne Titel'}“ löschen?`)) return
      setDaten((d) => ({ ...d, werke: d.werke.filter((w) => w.id !== karte.id) }))
      setSitzung((s) => s.filter((x) => x !== karte.id))
    }
    neueKarte()
  }

  /** Abgleich für eine Gruppe von Verlagsnamen der Karte: true = derselbe bekannte Verlag, false = neuer Verlag. */
  const verlagsAbgleich = (gruppen: VerlagsGruppe[], derselbe: boolean) => {
    if (!karte || gruppen.length === 0) return
    const r = wendePlanAn(karte, daten.verlage, gruppen, () => derselbe)
    setDaten((d) => ({ ...d, verlage: r.verlage }))
    aendereKarte(r.werk)
    const ziel = r.verlage.find((v) => v.id === alleAuflagen(r.werk).find((a) => a.id === gruppen[0].auflagen[0])?.verlagId)
    if (gruppen.length > 1) setMeldung(`${gruppen.length} Verlage gemerkt.`)
    else if (ziel) setMeldung(derselbe ? `Schreibweise zu „${anzeigeName(ziel)}“ gemerkt.` : `Verlag „${anzeigeName(ziel)}“ gemerkt (Kürzel „${ziel.kuerzel}“).`)
  }

  /**
   * Verlagskarten ändern. Sie sind eine Eingabehilfe für neue Auflagen; bestehende Auflagen bleiben,
   * wie sie sind. Verweise auf gelöschte Verlage gelten beim nächsten Abgleich als unverknüpft.
   */
  const aendereVerlage = (verlage: Verlag[]) => setDaten((d) => ({ ...d, verlage }))
  const aendereVerlag = (v: Verlag) => aendereVerlage(daten.verlage.map((x) => (x.id === v.id ? v : x)))

  const liste = daten.listen.find((l) => l.id === listenId) ?? daten.listen[0]
  // Wer die Listen öffnet und noch keine hat, bekommt eine mit allen Karten
  useEffect(() => {
    if (ansicht === 'liste' && daten.listen.length === 0) setDaten((d) => (d.listen.length ? d : { ...d, listen: [neueListe('Literaturliste')] }))
  }, [ansicht, daten.listen.length])
  const aendereListe = (l: Literaturliste) => setDaten((d) => ({ ...d, listen: d.listen.map((x) => (x.id === l.id ? l : x)) }))
  const legeListeAn = (l: Literaturliste) => {
    setDaten((d) => ({ ...d, listen: [...d.listen, l] }))
    setListenId(l.id)
    setAnsicht('liste')
  }
  const listeAusVorgabe = (v: ListenVorgabe) => {
    const [n, vn] = (v.person ?? '').split('|')
    const name = v.person ? [vn, n].filter(Boolean).join(' ') : v.schlagwort ?? 'Literaturliste'
    legeListeAn(neueListe(name, { ...ALLE, person: v.person ?? '', schlagwort: v.schlagwort ?? '' }))
  }
  const loescheListe = (id: string) => {
    setDaten((d) => ({ ...d, listen: d.listen.filter((l) => l.id !== id) }))
    setListenId(null)
  }
  const inListeAufnehmen = (listeId: string, werkId: string) => {
    const l = daten.listen.find((x) => x.id === listeId)
    if (!l) return
    aendereListe(hinzufuegen(l, werkId))
    setMeldung(`In „${l.name || 'ohne Namen'}“ aufgenommen.`)
  }

  const beispieleLaden = () => {
    const b = beispielDaten()
    setDaten((d) => zusammenfuehren(d, b))
    setMeldung(`${b.werke.length} Beispielkarten geladen.`)
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

  // Tastatur für die Serienerfassung
  const tastenRef = useRef<(e: KeyboardEvent) => void>(() => {})
  tastenRef.current = (e: KeyboardEvent) => {
    const wechsel: Record<string, Ansicht> = { F2: 'erfassen', F3: 'kartei', F4: 'liste', F5: 'verlage' }
    if (wechsel[e.key] && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      setAnsicht(wechsel[e.key])
      return
    }
    if (ansicht !== 'erfassen') return
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      festAnlegen()
    } else if (e.altKey && !e.ctrlKey && e.code === 'KeyN') {
      e.preventDefault()
      neueKarte()
    }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => tastenRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const anzahlVorlaeufig = daten.werke.filter((w) => w.status === 'vorlaeufig').length
  const sitzungsKarten = sitzung.map((id) => daten.werke.find((w) => w.id === id)).filter((w): w is Werk => Boolean(w))

  return (
    <div className="app">
      <header className="kopf">
        <div className="kopf-innen">
          <span className="marke">Bibliographie</span>
          <nav className="reiter" aria-label="Bereiche">
            {REITER.map((r) => (
              <button key={r.ansicht} type="button" aria-current={ansicht === r.ansicht ? 'page' : undefined} onClick={() => setAnsicht(r.ansicht)}>
                {r.label} <kbd>{r.taste}</kbd>
              </button>
            ))}
          </nav>
          <div className="kopf-rechts">
            <span>
              {daten.werke.length.toLocaleString('de-DE')} {daten.werke.length === 1 ? 'Karte' : 'Karten'}
              {anzahlVorlaeufig > 0 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="textknopf warnfarbe"
                    onClick={() => {
                      setKarteiSicht({ ...karteiSicht, nurVorlaeufig: true, buchstabe: null })
                      setAnsicht('kartei')
                    }}
                  >
                    {anzahlVorlaeufig.toLocaleString('de-DE')} vorläufig
                  </button>
                </>
              )}
            </span>
            <Ablage
              karteiLeer={daten.werke.length === 0}
              onSichern={exportJson}
              onEinlesen={() => dateiEingabe.current?.click()}
              onCsl={exportCsl}
              onBeispiele={beispieleLaden}
            />
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
        </div>
      </header>

      {meldung && (
        <div className="meldung" role="status">
          {meldung}
        </div>
      )}

      <main className="flaeche">
        {ansicht === 'erfassen' && karte && (
          <Karteikarte
            key={karte.id}
            werk={karte}
            istNeu={!gespeichert || karte.id === frischId}
            alleWerke={daten.werke}
            verlage={daten.verlage}
            alleSchlagwoerter={alleSchlagwoerter}
            fixiert={fixiert}
            nachholen={nachholenId === karte.id}
            onAendern={aendereKarte}
            onFixieren={setFixiert}
            onVerlagsAbgleich={verlagsAbgleich}
            onVerlagAendern={aendereVerlag}
            onZuVorhandener={zuVorhandener}
            onFestAnlegen={festAnlegen}
            onNaechste={neueKarte}
            onLoeschen={loeschen}
            listen={daten.listen}
            onInListe={(listeId) => inListeAufnehmen(listeId, karte.id)}
            seitenleiste={
              <>
                <FixiertKasten fixiert={fixiert} onFixieren={setFixiert} />
                <SitzungKasten karten={sitzungsKarten} aktivId={karte.id} onOeffnen={oeffne} />
                {daten.werke.length === 0 && (
                  <div className="papier kasten-innen">
                    <p className="leise">Die Kartei ist noch leer. Zum Ausprobieren gibt es ein paar Beispielkarten.</p>
                    <button type="button" className="knopf" onClick={beispieleLaden}>
                      Beispielkarten laden
                    </button>
                  </div>
                )}
                <div className="tastenhilfe">
                  <div>
                    <kbd>Strg ↵</kbd> fest anlegen, nächste Karte
                  </div>
                  <div>
                    <kbd>Alt N</kbd> nächste Karte, Fixiertes bleibt
                  </div>
                  <div>
                    <kbd>↓</kbd> im Titel: Vorschläge durchgehen
                  </div>
                </div>
              </>
            }
          />
        )}
        {ansicht === 'kartei' && (
          <Kartei
            werke={daten.werke}
            sicht={karteiSicht}
            onSicht={setKarteiSicht}
            onBearbeiten={oeffne}
            onListe={listeAusVorgabe}
            onBeispiele={beispieleLaden}
            onNeueKarte={neueKarte}
          />
        )}
        {ansicht === 'liste' && liste && (
          <Liste
            key={liste.id}
            werke={daten.werke}
            listen={daten.listen}
            liste={liste}
            onAendern={aendereListe}
            onWaehlen={setListenId}
            onNeu={() => legeListeAn(neueListe(''))}
            onLoeschen={loescheListe}
          />
        )}
        {ansicht === 'verlage' && <Verlage verlage={daten.verlage} werke={daten.werke} onAendern={aendereVerlage} onZurueck={() => setAnsicht('erfassen')} />}
      </main>
    </div>
  )
}

function Ablage({
  karteiLeer,
  onSichern,
  onEinlesen,
  onCsl,
  onBeispiele,
}: {
  karteiLeer: boolean
  onSichern: () => void
  onEinlesen: () => void
  onCsl: () => void
  onBeispiele: () => void
}) {
  const [offen, setOffen] = useState(false)
  const rahmen = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!offen) return
    const klick = (e: MouseEvent) => !rahmen.current?.contains(e.target as Node) && setOffen(false)
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    document.addEventListener('mousedown', klick)
    document.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('mousedown', klick)
      document.removeEventListener('keydown', taste)
    }
  }, [offen])
  const tu = (f: () => void) => () => {
    setOffen(false)
    f()
  }
  return (
    <div className="ablage" ref={rahmen}>
      <button type="button" className="knopf" aria-expanded={offen} aria-haspopup="menu" onClick={() => setOffen(!offen)}>
        Ablage <Abwaerts />
      </button>
      {offen && (
        <div className="ablage-menue" role="menu">
          <button type="button" role="menuitem" onClick={tu(onSichern)}>
            Sichern <span>alle Daten als Datei</span>
          </button>
          <button type="button" role="menuitem" onClick={tu(onEinlesen)}>
            Einlesen <span>gesicherte Datei zurückholen</span>
          </button>
          <div className="menue-linie" />
          <button type="button" role="menuitem" onClick={tu(onCsl)}>
            CSL-Export <span>für Zotero, Citavi, Pandoc</span>
          </button>
          {karteiLeer && (
            <button type="button" role="menuitem" onClick={tu(onBeispiele)}>
              Beispielkarten laden
            </button>
          )}
          <p className="menue-hinweis">Prototyp: Die Daten liegen nur in diesem Browser. Regelmäßig sichern.</p>
        </div>
      )}
    </div>
  )
}

function FixiertKasten({ fixiert, onFixieren }: { fixiert: Fixierung; onFixieren: (f: Fixierung) => void }) {
  const zeilen: { was: string; wert: string; loesen: () => void }[] = []
  if (fixiert.personen)
    zeilen.push({
      was: fixiert.personen.every((p) => p.rolle === 'hrsg') ? 'Hrsg.' : 'Autor',
      wert: fixiert.personen.map((p) => [p.nachname, p.vorname].filter(Boolean).join(', ')).join(' / ') || '(leer)',
      loesen: () => onFixieren({ ...fixiert, personen: undefined }),
    })
  if (fixiert.art) zeilen.push({ was: 'Art', wert: TEXT_ARTEN.find((a) => a.value === fixiert.art)?.label ?? fixiert.art, loesen: () => onFixieren({ ...fixiert, art: undefined }) })
  if (fixiert.verlag !== undefined) zeilen.push({ was: 'Verlag', wert: fixiert.verlag || '(leer)', loesen: () => onFixieren({ ...fixiert, verlag: undefined }) })
  if (fixiert.erschienenIn)
    zeilen.push({ was: 'Erschienen in', wert: fixiert.erschienenIn.titel || '(leer)', loesen: () => onFixieren({ ...fixiert, erschienenIn: undefined }) })
  if (fixiert.schlagwoerter)
    zeilen.push({
      was: 'Schlagwörter',
      wert: fixiert.schlagwoerter.map((s) => s.begriff).join(', ') || '(leer)',
      loesen: () => onFixieren({ ...fixiert, schlagwoerter: undefined }),
    })

  return (
    <section className={`papier kasten-innen fixiert-kasten ${zeilen.length ? 'aktiv' : ''}`} aria-label="Fixierte Felder">
      <h2>
        <Nadel /> Fixiert für die nächsten Karten
      </h2>
      {zeilen.length === 0 ? (
        <p className="leise klein">Nichts fixiert. Die Stecknadel an einem Feld hält es für alle folgenden Karten fest.</p>
      ) : (
        <>
          <dl>
            {zeilen.map((z) => (
              <div key={z.was} className="fix-zeile">
                <dt>{z.was}</dt>
                <dd>{z.wert}</dd>
                <dd>
                  <button type="button" className="textknopf" onClick={z.loesen}>
                    lösen
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          {zeilen.length > 1 && (
            <button type="button" className="textknopf leise" onClick={() => onFixieren({})}>
              alle lösen
            </button>
          )}
        </>
      )}
    </section>
  )
}

function SitzungKasten({ karten, aktivId, onOeffnen }: { karten: Werk[]; aktivId: string; onOeffnen: (id: string) => void }) {
  if (karten.length === 0) return null
  return (
    <section className="papier kasten-innen" aria-label="In dieser Sitzung">
      <h2>
        In dieser Sitzung <span className="leise rechts">{karten.length}</span>
      </h2>
      <ol className="sitzung">
        {karten.slice(0, 8).map((w) => (
          <li key={w.id}>
            <StatusPunkt status={w.status} />
            <button type="button" className={`sitzung-titel ${w.id === aktivId ? 'aktiv' : ''}`} onClick={() => onOeffnen(w.id)}>
              {w.titel || 'ohne Titel'}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
