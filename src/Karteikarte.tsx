import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AUSGABE_ARTEN,
  MITWIRKUNGS_ROLLEN,
  TEXT_ARTEN,
  alleAuflagen,
  leereAuflage,
  leereAusgabe,
  leeresErschienenIn,
  neueId,
  type Auflage,
  type Ausgabe,
  type AusgabeArt,
  type ErschienenIn,
  type Mitwirkung,
  type MitwirkungsRolle,
  type Person,
  type TextArt,
  type Verlag,
  type Werk,
} from './model'
import { anzeigeName, findeExakt, nameFuerJahr, ortFuerJahr, ortName, ortsAbweichung, ortswechselEintragen, planeVerlage, type VerlagsGruppe } from './verlag'
import { auflageLeer } from './entwurf'
import { Druckzeile } from './Druckzeile'
import { ausgabeBezeichnung, druckzeileTeile, ersterscheinung, nennen } from './format'
import { VerlagFeld } from './VerlagFeld'
import { type Treffer, type WerkVorschlag } from './lobid'
import { sucheImKatalog } from './katalog'
import { AusgabenWahl, Vorschlagsliste, besterVorschlag, ohneNichtsortier, karteiTreffer, optionenAus, useKatalog, jahrspanne, type Option } from './Katalogsuche'
import type { Fixierung } from './App'
import { Haken, Nadel, Warnung, Winkel } from './Symbole'

interface Props {
  werk: Werk
  istNeu: boolean
  alleWerke: Werk[]
  verlage: Verlag[]
  alleSchlagwoerter: string[]
  fixiert: Fixierung
  /** Beim Öffnen gleich weitere Auflagen im Katalog suchen */
  nachholen: boolean
  seitenleiste: React.ReactNode
  onAendern: (w: Werk) => void
  onFixieren: (f: Fixierung) => void
  onVerlagsAbgleich: (g: VerlagsGruppe[], derselbe: boolean) => void
  onVerlagAendern: (v: Verlag) => void
  onZuVorhandener: (id: string) => void
  onFestAnlegen: () => void
  onNaechste: () => void
  onLoeschen: () => void
}

const HAUPTARTEN: TextArt[] = ['buch', 'aufsatz', 'sammelband']
const artLabel = (a: TextArt) => TEXT_ARTEN.find((x) => x.value === a)?.label ?? a

const istLeer = auflageLeer
const jahrZahl = (a: Auflage) => parseInt(a.jahr, 10) || 9999

export function Karteikarte(props: Props) {
  const { werk, istNeu, alleWerke, verlage, alleSchlagwoerter, fixiert, nachholen, seitenleiste } = props
  const { onAendern, onFixieren, onVerlagsAbgleich, onVerlagAendern, onZuVorhandener, onFestAnlegen, onNaechste, onLoeschen } = props
  const setze = (teil: Partial<Werk>) => onAendern({ ...werk, ...teil })
  const istAufsatz = werk.art === 'aufsatz'
  const listeId = useId()

  // Vorschläge unter Autor und Titel
  const [offen, setOffen] = useState(false)
  const [markiert, setMarkiert] = useState(-1)
  const autor = werk.personen[0]?.nachname ?? ''
  const katalog = useKatalog(autor, werk.titel, offen)
  const eigene = useMemo(() => (offen ? karteiTreffer(alleWerke, werk.id, autor, werk.titel) : []), [offen, alleWerke, werk.id, autor, werk.titel])
  const optionen = optionenAus(eigene, katalog)
  const menueSichtbar = offen && werk.titel.trim().length >= 2

  // Ausgaben zum Abhaken, nach Auswahl eines Werks oder beim Nachholen
  const [ausgaben, setAusgaben] = useState<WerkVorschlag | null>(null)
  const [nachholStand, setNachholStand] = useState<'ruhe' | 'laedt' | 'nichts' | 'fehler'>('ruhe')

  const titelFeld = useRef<HTMLInputElement>(null)
  const nachnameFeld = useRef<HTMLInputElement>(null)
  const untertitelFeld = useRef<HTMLInputElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (werk.personen[0]?.nachname.trim()) titelFeld.current?.focus()
    else nachnameFeld.current?.focus()
    if (nachholen) holeNach()
    // nur beim Öffnen der Karte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tippen = () => {
    setOffen(true)
    setMarkiert(-1)
  }

  const waehle = (o: Option) => {
    setOffen(false)
    setMarkiert(-1)
    if (o.art === 'eigen') {
      onZuVorhandener(o.werk.id)
      return
    }
    const v = o.vorschlag
    setze({
      titel: ohneNichtsortier(v.titel),
      untertitel: ohneNichtsortier(v.untertitel) || werk.untertitel,
      personen: v.personen.length ? v.personen.map((p) => ({ ...p })) : werk.personen,
    })
    setAusgaben(v)
  }

  const tastenImKopf = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape' && menueSichtbar) {
      e.preventDefault()
      setOffen(false)
      return
    }
    if (!menueSichtbar || optionen.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMarkiert((m) => Math.min(m + 1, optionen.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMarkiert((m) => Math.max(m - 1, -1))
    } else if (e.key === 'Enter' && markiert >= 0) {
      e.preventDefault()
      waehle(optionen[markiert])
    }
  }

  // Enter springt in der Serienerfassung zum nächsten wichtigen Feld
  const weiterZumTitel = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || (menueSichtbar && markiert >= 0)) return
    e.preventDefault()
    titelFeld.current?.focus()
  }

  const holeNach = async () => {
    if (!werk.titel.trim()) return
    setNachholStand('laedt')
    try {
      const v = besterVorschlag(await sucheImKatalog(werk.personen[0]?.nachname ?? '', werk.titel), werk.titel)
      if (v) {
        setAusgaben(v)
        setNachholStand('ruhe')
      } else setNachholStand('nichts')
    } catch {
      setNachholStand('fehler')
    }
  }

  const uebernimmAusgaben = (auswahl: Treffer[]) => {
    // Neue Auflagen aus dem Katalog kommen zur ersten Ausgabe; von dort lassen sie sich einer anderen zuordnen
    const [erste, ...weitere] = mitAusgabe(werk.ausgaben)
    const neu = [...erste.auflagen.filter((a) => !istLeer(a)), ...auswahl.map((t) => ({ ...t.auflage, id: neueId() }))]
    neu.sort((a, b) => jahrZahl(a) - jahrZahl(b))
    setze({ ausgaben: [{ ...erste, auflagen: neu }, ...weitere] })
    setAusgaben(null)
  }

  const setzePerson = (i: number, teil: Partial<Person>) => setze({ personen: werk.personen.map((p, j) => (j === i ? { ...p, ...teil } : p)) })
  const setzeEI = (teil: Partial<ErschienenIn>) => setze({ erschienenIn: { ...(werk.erschienenIn ?? leeresErschienenIn()), ...teil } })
  const weitereArt = !HAUPTARTEN.includes(werk.art)

  return (
    <div className="erfassen">
      <article className={`karte papier ${werk.status}`} aria-label="Karte, Vorderseite">
        <header className="karte-kopf">
          <span className="karte-name">{istNeu ? 'Neue Karte' : 'Karte'}</span>
          <div className="segment" role="radiogroup" aria-label="Art des Textes">
            {HAUPTARTEN.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={werk.art === a} onClick={() => setze({ art: a })}>
                {artLabel(a)}
              </button>
            ))}
            <select
              aria-label="Weitere Arten des Textes"
              className={weitereArt ? 'gewaehlt' : ''}
              value={weitereArt ? werk.art : ''}
              onChange={(e) => setze({ art: e.target.value as TextArt })}
            >
              <option value="" disabled>
                weitere …
              </option>
              {TEXT_ARTEN.filter((a) => !HAUPTARTEN.includes(a.value)).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <NadelKnopf was="Art des Textes" aktiv={fixiert.art !== undefined} an={() => onFixieren({ ...fixiert, art: werk.art })} aus={() => onFixieren({ ...fixiert, art: undefined })} />
          <StatusMarke status={werk.status} />
        </header>

        <div className="karte-inhalt">
          <div
            className="kopfangaben"
            onKeyDown={tastenImKopf}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOffen(false)
            }}
          >
            <div className="feld">
              <div className="feld-kopf">
                <span className="lab">{werk.personen.length > 0 && werk.personen.every((p) => p.rolle === 'hrsg') ? 'Herausgeber' : 'Autoren / Herausgeber'}</span>
                <NadelKnopf
                  was="Personen"
                  aktiv={fixiert.personen !== undefined}
                  an={() => onFixieren({ ...fixiert, personen: werk.personen.map((p) => ({ ...p })) })}
                  aus={() => onFixieren({ ...fixiert, personen: undefined })}
                />
              </div>
              <div className="personen">
                {werk.personen.map((p, i) => (
                  <div className={`person ${fixiert.personen ? 'fixiert' : ''}`} key={i}>
                    <input
                      ref={i === 0 ? nachnameFeld : undefined}
                      className="eingabe serif"
                      aria-label={`Nachname, Person ${i + 1}`}
                      placeholder="Nachname"
                      value={p.nachname}
                      onChange={(e) => {
                        setzePerson(i, { nachname: e.target.value })
                        if (i === 0) tippen()
                      }}
                      onKeyDown={weiterZumTitel}
                    />
                    <input
                      className="eingabe serif"
                      aria-label={`Vorname, Person ${i + 1}`}
                      placeholder="Vorname"
                      value={p.vorname}
                      onChange={(e) => setzePerson(i, { vorname: e.target.value })}
                      onKeyDown={weiterZumTitel}
                    />
                    <button
                      type="button"
                      className="rolle"
                      title="Zwischen Autor und Herausgeber wechseln"
                      onClick={() => setzePerson(i, { rolle: p.rolle === 'autor' ? 'hrsg' : 'autor' })}
                    >
                      {p.rolle === 'autor' ? 'Autor' : 'Hrsg.'}
                    </button>
                    {werk.personen.length > 1 && (
                      <button type="button" className="weg" aria-label={`Person ${i + 1} entfernen`} onClick={() => setze({ personen: werk.personen.filter((_, j) => j !== i) })}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="hinzu"
                  onClick={() => setze({ personen: [...werk.personen, { vorname: '', nachname: '', rolle: werk.personen[0]?.rolle ?? 'autor' }] })}
                >
                  + Person
                </button>
              </div>
            </div>

            <div className="feld vorschlag-rahmen">
              <label className="lab" htmlFor={`${listeId}-titel`}>
                Titel
              </label>
              <input
                id={`${listeId}-titel`}
                ref={titelFeld}
                className="eingabe serif titel"
                value={werk.titel}
                autoComplete="off"
                role="combobox"
                aria-expanded={menueSichtbar}
                aria-controls={listeId}
                aria-autocomplete="list"
                aria-activedescendant={menueSichtbar && markiert >= 0 ? `${listeId}-${markiert}` : undefined}
                onChange={(e) => {
                  setze({ titel: e.target.value })
                  tippen()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !(menueSichtbar && markiert >= 0)) {
                    e.preventDefault()
                    setOffen(false)
                    untertitelFeld.current?.focus()
                  }
                }}
              />
              {menueSichtbar && <Vorschlagsliste id={listeId} optionen={optionen} katalog={katalog} markiert={markiert} onWaehlen={waehle} />}
            </div>

            <div className="feld">
              <label className="lab" htmlFor={`${listeId}-untertitel`}>
                Untertitel
              </label>
              <input id={`${listeId}-untertitel`} ref={untertitelFeld} className="eingabe serif" value={werk.untertitel} onChange={(e) => setze({ untertitel: e.target.value })} />
            </div>
          </div>

          {ausgaben && (
            <AusgabenWahl
              key={ausgaben.schluessel}
              vorschlag={ausgaben}
              vorhandeneJahre={new Set(alleAuflagen(werk).map((a) => a.jahr).filter(Boolean))}
              onUebernehmen={uebernimmAusgaben}
              onVerwerfen={() => setAusgaben(null)}
            />
          )}

          {istAufsatz ? (
            <ErschienenInFeld
              wert={werk.erschienenIn ?? leeresErschienenIn()}
              onAendern={setzeEI}
              nadel={
                <NadelKnopf
                  was="Erschienen in"
                  aktiv={fixiert.erschienenIn !== undefined}
                  an={() => onFixieren({ ...fixiert, erschienenIn: { ...(werk.erschienenIn ?? leeresErschienenIn()), seitenVon: '', seitenBis: '' } })}
                  aus={() => onFixieren({ ...fixiert, erschienenIn: undefined })}
                />
              }
            />
          ) : (
            <AusgabenFeld
              werk={werk}
              verlage={verlage}
              fixiert={fixiert}
              nachholStand={nachholStand}
              onAendern={setze}
              onFixieren={onFixieren}
              onNachholen={holeNach}
              onVerlagsAbgleich={onVerlagsAbgleich}
              onVerlagAendern={onVerlagAendern}
            />
          )}

          {!istAufsatz && <Reihe werk={werk} onAendern={setze} />}

          <Schlagwoerter
            werk={werk}
            alle={alleSchlagwoerter}
            onAendern={(s) => setze({ schlagwoerter: s })}
            nadel={
              <NadelKnopf
                was="Schlagwörter"
                aktiv={fixiert.schlagwoerter !== undefined}
                an={() => onFixieren({ ...fixiert, schlagwoerter: werk.schlagwoerter.map((s) => ({ ...s })) })}
                aus={() => onFixieren({ ...fixiert, schlagwoerter: undefined })}
              />
            }
            fixiert={fixiert.schlagwoerter?.map((s) => s.begriff) ?? []}
          />

          <label className="feld">
            <span className="lab">Anmerkung für den Druck</span>
            <textarea
              className="eingabe serif"
              rows={2}
              value={werk.anmerkung}
              placeholder="Erscheint in der Liste kursiv als (Anm.: …); *Titel* darin steht aufrecht"
              onChange={(e) => setze({ anmerkung: e.target.value })}
            />
          </label>

          <div className="vorschau">
            <span className="lab">So steht die Karte in der Liste</span>
            <p>{werk.titel.trim() ? <Druckzeile teile={druckzeileTeile(werk)} /> : <span className="leise">Erscheint, sobald ein Titel da ist.</span>}</p>
          </div>
        </div>

        <footer className="karte-fuss">
          {werk.status === 'vorlaeufig' ? (
            <button type="button" className="knopf haupt" onClick={onFestAnlegen}>
              Fest anlegen <kbd>Strg ↵</kbd>
            </button>
          ) : (
            <button type="button" className="knopf" onClick={() => setze({ status: 'vorlaeufig' })}>
              Wieder vorläufig
            </button>
          )}
          <button type="button" className="knopf" onClick={onNaechste}>
            {werk.status === 'vorlaeufig' ? 'Vorläufig lassen, nächste Karte' : 'Nächste Karte'} <kbd>Alt N</kbd>
          </button>
          <button type="button" className="textknopf leise rechts" onClick={onLoeschen}>
            Karte löschen
          </button>
        </footer>
      </article>

      <aside className="erfassen-seite">
        <section className="papier rueckseite" aria-label="Rückseite">
          <header className="karte-kopf klein">
            <h2>Rückseite</h2>
          </header>
          <textarea
            aria-label="Kommentar auf der Rückseite"
            rows={8}
            placeholder="Kommentar, Herkunft, eigenes Exemplar …"
            value={werk.kommentar}
            onChange={(e) => setze({ kommentar: e.target.value })}
          />
        </section>
        {seitenleiste}
      </aside>
    </div>
  )
}

export function NadelKnopf({ was, aktiv, an, aus }: { was: string; aktiv: boolean; an: () => void; aus: () => void }) {
  return (
    <button
      type="button"
      className={`nadel ${aktiv ? 'aktiv' : ''}`}
      aria-pressed={aktiv}
      aria-label={aktiv ? `${was}: Fixierung lösen` : `${was} für die nächsten Karten fixieren`}
      title={aktiv ? `${was} ist fixiert. Klicken löst die Fixierung.` : `${was} für die nächsten Karten fixieren`}
      onClick={aktiv ? aus : an}
    >
      <Nadel />
      {aktiv && <span>fixiert</span>}
    </button>
  )
}

export function StatusMarke({ status }: { status: Werk['status'] }) {
  return status === 'fest' ? (
    <span className="status fest">
      <Haken /> fest angelegt
    </span>
  ) : (
    <span className="status vorlaeufig">
      <span className="punkt vorlaeufig" aria-hidden="true" /> vorläufig
    </span>
  )
}

function AusgabenFeld({
  werk,
  verlage,
  fixiert,
  nachholStand,
  onAendern,
  onFixieren,
  onNachholen,
  onVerlagsAbgleich,
  onVerlagAendern,
}: {
  werk: Werk
  verlage: Verlag[]
  fixiert: Fixierung
  nachholStand: 'ruhe' | 'laedt' | 'nichts' | 'fehler'
  onAendern: (t: Partial<Werk>) => void
  onFixieren: (f: Fixierung) => void
  onNachholen: () => void
  onVerlagsAbgleich: (g: VerlagsGruppe[], derselbe: boolean) => void
  onVerlagAendern: (v: Verlag) => void
}) {
  const [neuId, setNeuId] = useState<string | null>(null)
  const ausgaben = useMemo(() => mitAusgabe(werk.ausgaben), [werk.ausgaben])
  const gefuellt = alleAuflagen(werk).filter((a) => !istLeer(a))
  const mehrere = ausgaben.length > 1
  const setzeAusgaben = (neu: Ausgabe[]) => onAendern({ ausgaben: neu })
  const setzeAusgabe = (i: number, teil: Partial<Ausgabe>) => setzeAusgaben(ausgaben.map((x, j) => (j === i ? { ...x, ...teil } : x)))

  const neueAuflage = (i: number) => {
    const auflagen = ausgaben[i].auflagen
    const letzte = auflagen[auflagen.length - 1]
    const a = { ...leereAuflage(), verlag: letzte?.verlag ?? '', ort: letzte?.ort ?? '', ...(letzte?.verlagId ? { verlagId: letzte.verlagId } : {}) }
    setNeuId(a.id)
    setzeAusgabe(i, { auflagen: [...auflagen, a] })
  }
  const neueAusgabe = () => {
    const a = leereAusgabe('neuausgabe')
    setNeuId(a.auflagen[0].id)
    setzeAusgaben([...ausgaben, a])
  }
  /** Auflage in eine andere Ausgabe verschieben, dort nach Jahr einsortiert. */
  const verschiebe = (von: number, auflage: Auflage, nachId: string) =>
    setzeAusgaben(
      ausgaben.map((x, j) => {
        if (j === von) return { ...x, auflagen: x.auflagen.filter((a) => a.id !== auflage.id) }
        if (x.id === nachId) return { ...x, auflagen: [...x.auflagen.filter((a) => !istLeer(a)), auflage].sort((a, b) => jahrZahl(a) - jahrZahl(b)) }
        return x
      }),
    )
  const wahl = ausgaben.map((x, j) => ({ id: x.id, label: `${j + 1}. ${ausgabeName(x)}` }))
  const berechnet = ersterscheinung({ ...werk, ersterscheinung: '' })

  return (
    <div className="feld">
      <div className="feld-kopf">
        <span className="lab">{mehrere ? 'Ausgaben und Auflagen' : 'Auflagen'}</span>
        {gefuellt.length > 0 && (
          <span className="leise klein">
            {gefuellt.length} · {jahrspanne(gefuellt.map((a) => a.jahr))}
          </span>
        )}
        <NadelKnopf
          was="Verlag"
          aktiv={fixiert.verlag !== undefined}
          an={() => onFixieren({ ...fixiert, verlag: ausgaben[0]?.auflagen[0]?.verlag ?? '' })}
          aus={() => onFixieren({ ...fixiert, verlag: undefined })}
        />
        <span className="rechts knopfreihe">
          {!mehrere && (
            <button type="button" className="textknopf" onClick={() => neueAuflage(0)}>
              + Auflage
            </button>
          )}
          <button type="button" className="textknopf" onClick={neueAusgabe}>
            + Ausgabe
          </button>
          <button type="button" className="textknopf" disabled={!werk.titel.trim() || nachholStand === 'laedt'} onClick={onNachholen}>
            {nachholStand === 'laedt' ? 'Katalog wird gefragt …' : 'Weitere aus dem Katalog holen'}
          </button>
        </span>
      </div>
      {nachholStand === 'nichts' && <p className="hinweis">Im Katalog ist zu diesem Titel nichts zu finden.</p>}
      {nachholStand === 'fehler' && <p className="hinweis">Der Katalog ist gerade nicht erreichbar. Von Hand geht es weiter.</p>}
      {ausgaben.map((ausgabe, i) => (
        <section key={ausgabe.id} className={mehrere ? 'ausgabe-block' : undefined} aria-label={mehrere ? `Ausgabe ${i + 1}: ${ausgabeName(ausgabe)}` : undefined}>
          {mehrere && (
            <AusgabeKopf
              ausgabe={ausgabe}
              nummer={i + 1}
              werkTitel={werk.titel}
              onAendern={(teil) => setzeAusgabe(i, teil)}
              onNeueAuflage={() => neueAuflage(i)}
              onEntfernen={i > 0 ? () => setzeAusgaben(ausgaben.filter((_, j) => j !== i)) : undefined}
            />
          )}
          <div className="tabelle-rahmen">
            <table className="tabelle auflagen">
              <thead>
                <tr>
                  <th className="sp-liste" title="In der Liste nennen">
                    Liste
                  </th>
                  <th className="sp-nr">Aufl.</th>
                  <th className="sp-jahr">Jahr</th>
                  <th>Verlag</th>
                  <th className="sp-ort">Ort</th>
                  <th className="sp-seiten">Seiten</th>
                  <th className="sp-mehr">
                    <span className="unsichtbar">Weitere Angaben</span>
                  </th>
                </tr>
              </thead>
              {ausgabe.auflagen.map((a, k) => (
                <AuflageZeile
                  key={a.id}
                  auflage={a}
                  erste={k === ausgabe.auflagen.findIndex((x) => !istLeer(x))}
                  verlage={verlage}
                  autoFokus={a.id === neuId}
                  ausgaben={mehrere ? wahl : []}
                  ausgabeId={ausgabe.id}
                  onAendern={(neu) => setzeAusgabe(i, { auflagen: ausgabe.auflagen.map((x, j) => (j === k ? neu : x)) })}
                  onEntfernen={ausgabe.auflagen.length > 1 ? () => setzeAusgabe(i, { auflagen: ausgabe.auflagen.filter((_, j) => j !== k) }) : undefined}
                  onVerschieben={(nachId) => verschiebe(i, a, nachId)}
                  onVerlagAendern={onVerlagAendern}
                />
              ))}
            </table>
          </div>
          <MitwirkendeFeld ausgabe={ausgabe} onAendern={(teil) => setzeAusgabe(i, teil)} />
        </section>
      ))}
      <VerlagsAbgleich werk={werk} verlage={verlage} onAbgleich={onVerlagsAbgleich} />
      {mehrere && (
        <label className="ersterscheinung">
          <span className="lab">Ersterscheinung</span>
          <input
            className="eingabe zelle"
            value={werk.ersterscheinung}
            maxLength={4}
            inputMode="numeric"
            placeholder={berechnet < 9999 ? String(berechnet) : 'Jahr'}
            onChange={(e) => onAendern({ ersterscheinung: e.target.value })}
          />
          <span className="leise klein">leer = älteste Ausgabe, Manuskripte zählen nicht</span>
        </label>
      )}
    </div>
  )
}

/** Vorwort, Nachwort, Übersetzung und Ähnliches einer Ausgabe; normal nicht gedruckt. */
function MitwirkendeFeld({ ausgabe, onAendern }: { ausgabe: Ausgabe; onAendern: (t: Partial<Ausgabe>) => void }) {
  const [offen, setOffen] = useState(ausgabe.mitwirkende.length > 0)
  const setzeMitwirkung = (i: number, teil: Partial<Mitwirkung>) => onAendern({ mitwirkende: ausgabe.mitwirkende.map((m, j) => (j === i ? { ...m, ...teil } : m)) })
  return (
    <div className="mitwirkende-feld">
      <button type="button" className="aufklapp" aria-expanded={offen} onClick={() => setOffen(!offen)}>
        <Winkel offen={offen} /> Mitwirkende {!offen && <span className="leise">· {ausgabe.mitwirkende.length || 'keine'}</span>}
      </button>
      {offen && (
        <div className="mitwirkende">
          {ausgabe.mitwirkende.map((m, i) => (
            <div key={i} className="ausgabe-zeile">
              <select className="eingabe" aria-label="Mitwirkung" value={m.rolle} onChange={(e) => setzeMitwirkung(i, { rolle: e.target.value as MitwirkungsRolle })}>
                {MITWIRKUNGS_ROLLEN.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input className="eingabe" aria-label="Vorname" placeholder="Vorname" value={m.vorname} onChange={(e) => setzeMitwirkung(i, { vorname: e.target.value })} />
              <input className="eingabe" aria-label="Nachname" placeholder="Nachname" value={m.nachname} onChange={(e) => setzeMitwirkung(i, { nachname: e.target.value })} />
              <input className="eingabe zelle schmal" aria-label="ab Auflage" placeholder="ab Aufl." value={m.abAuflage} maxLength={3} onChange={(e) => setzeMitwirkung(i, { abAuflage: e.target.value })} />
              <button type="button" className="textknopf leise" onClick={() => onAendern({ mitwirkende: ausgabe.mitwirkende.filter((_, j) => j !== i) })}>
                entfernen
              </button>
            </div>
          ))}
          <button
            type="button"
            className="textknopf"
            onClick={() => onAendern({ mitwirkende: [...ausgabe.mitwirkende, { vorname: '', nachname: '', rolle: 'vorwort', abAuflage: '' }] })}
          >
            + Mitwirkende
          </button>
        </div>
      )}
    </div>
  )
}

/** Jedes Werk hat eine erste Ausgabe; fehlt sie in alten oder fremden Daten, wird sie hier ergänzt. */
const mitAusgabe = (ausgaben: Ausgabe[]): Ausgabe[] => (ausgaben.length ? ausgaben : [leereAusgabe()])

/** Name einer Ausgabe für Überschriften und Auswahl. */
function ausgabeName(a: Ausgabe): string {
  const art = AUSGABE_ARTEN.find((x) => x.value === a.art)?.label ?? ''
  return [a.art === 'uebersetzung' && a.sprache.trim() ? `${a.sprache.trim()}e Ausgabe` : art, a.titel.trim()].filter(Boolean).join(': ')
}

function AusgabeKopf({
  ausgabe,
  nummer,
  werkTitel,
  onAendern,
  onNeueAuflage,
  onEntfernen,
}: {
  ausgabe: Ausgabe
  nummer: number
  werkTitel: string
  onAendern: (t: Partial<Ausgabe>) => void
  onNeueAuflage: () => void
  onEntfernen?: () => void
}) {
  const vorgabe = ausgabeBezeichnung({ ...ausgabe, bezeichnung: '' })
  return (
    <div className="ausgabe-kopf">
      <div className="ausgabe-zeile">
        <span className="ausgabe-nr">{nummer}.</span>
        <label>
          <span className="lab">Art</span>
          <select className="eingabe" value={ausgabe.art} onChange={(e) => onAendern({ art: e.target.value as AusgabeArt })}>
            {AUSGABE_ARTEN.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {ausgabe.art === 'uebersetzung' && (
          <label className="schmal">
            <span className="lab">Sprache</span>
            <input className="eingabe" value={ausgabe.sprache} placeholder="deutsch" onChange={(e) => onAendern({ sprache: e.target.value })} />
          </label>
        )}
        {nummer > 1 && (
          <label>
            <span className="lab">In der Liste eingeleitet mit</span>
            <input className="eingabe serif" value={ausgabe.bezeichnung} placeholder={vorgabe || 'ohne Einleitung'} onChange={(e) => onAendern({ bezeichnung: e.target.value })} />
          </label>
        )}
        <span className="rechts knopfreihe">
          <button type="button" className="textknopf" onClick={onNeueAuflage}>
            + Auflage
          </button>
          {onEntfernen && (
            <button type="button" className="textknopf leise" onClick={onEntfernen}>
              Ausgabe entfernen
            </button>
          )}
        </span>
      </div>
      {nummer > 1 && (
        <div className="ausgabe-zeile">
          <label className="breit">
            <span className="lab">Eigener Titel</span>
            <input className="eingabe serif" value={ausgabe.titel} placeholder={werkTitel ? `wie das Werk: ${werkTitel}` : 'wie das Werk'} onChange={(e) => onAendern({ titel: e.target.value })} />
          </label>
          <label className="breit">
            <span className="lab">Untertitel</span>
            <input className="eingabe serif" value={ausgabe.untertitel} onChange={(e) => onAendern({ untertitel: e.target.value })} />
          </label>
          <label className="breit">
            <span className="lab">Zusatz nach dem Jahr</span>
            <input className="eingabe serif" value={ausgabe.zusatz} placeholder="etwa: mit Untertitel: …" onChange={(e) => onAendern({ zusatz: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  )
}

function AuflageZeile({
  auflage,
  erste,
  verlage,
  autoFokus,
  ausgaben,
  ausgabeId,
  onAendern,
  onEntfernen,
  onVerschieben,
  onVerlagAendern,
}: {
  auflage: Auflage
  /** Erste Auflage ihrer Ausgabe: wird in der Liste genannt, solange nichts anderes markiert ist */
  erste: boolean
  verlage: Verlag[]
  autoFokus: boolean
  /** Ausgaben, denen die Auflage zugeordnet werden kann; leer bei nur einer Ausgabe */
  ausgaben: { id: string; label: string }[]
  ausgabeId: string
  onAendern: (a: Auflage) => void
  onEntfernen?: () => void
  onVerschieben: (ausgabeId: string) => void
  onVerlagAendern: (v: Verlag) => void
}) {
  const [mehr, setMehr] = useState(false)
  const setze = (teil: Partial<Auflage>) => onAendern({ ...auflage, ...teil })
  const bekannt = verlage.find((v) => v.id === auflage.verlagId) ?? findeExakt(verlage, auflage.verlag)
  const auskunft = bekannt ? ortFuerJahr(bekannt, auflage.jahr) : null
  const abweichung = bekannt && !auskunft?.zweiOrteMoeglich ? ortsAbweichung(bekannt, auflage) : null
  const hatMehr = Boolean(auflage.gedrucktesJahr || auflage.erscheinungstag || auflage.bearbeitung || auflage.vermerk || auflage.seitenRoemisch || auflage.isbn)
  const genannt = nennen(auflage, erste)

  const waehle = (v: Verlag) => {
    const a = ortFuerJahr(v, auflage.jahr)
    setze({ verlag: nameFuerJahr(v, auflage.jahr) || anzeigeName(v), verlagId: v.id, ort: a?.ort || auflage.ort, ortBestaetigt: false })
  }
  /** Neues Jahr: Name und Ort folgen der Verlagskarte, solange sie dem bisherigen Stand entsprachen. */
  const mitJahr = (jahr: string): Partial<Auflage> => {
    if (!bekannt || !/^\d{4}$/.test(jahr)) return { jahr }
    const teil: Partial<Auflage> = { jahr }
    const alterName = nameFuerJahr(bekannt, auflage.jahr)
    if (!auflage.verlag.trim() || auflage.verlag.trim() === alterName) teil.verlag = nameFuerJahr(bekannt, jahr) || auflage.verlag
    const ort = ortFuerJahr(bekannt, jahr)?.ort
    if (ort && !auflage.ortBestaetigt) teil.ort = ort
    return teil
  }
  const setzeJahr = (jahr: string) => setze(mitJahr(jahr))
  const setzeErscheinungstag = (tag: string) => {
    const jahr = tag.slice(0, 4)
    setze({ erscheinungstag: tag, ...(tag && !auflage.jahr.trim() ? mitJahr(jahr) : {}) })
  }
  const jahrGrenzen = /^\d{4}$/.test(auflage.jahr.trim()) ? { min: `${auflage.jahr.trim()}-01-01`, max: `${auflage.jahr.trim()}-12-31` } : {}

  return (
    <tbody className={auskunft?.zweiOrteMoeglich ? 'mit-warnung' : ''}>
      <tr>
        <td className="sp-liste">
          <input
            type="checkbox"
            aria-label={`Auflage ${auflage.jahr} in der Liste nennen`}
            title={auflage.inListe === undefined ? 'Nach Regel: erste und bearbeitete Auflagen' : 'Von Hand gesetzt'}
            checked={genannt}
            onChange={(e) => setze({ inListe: e.target.checked === (erste || Boolean(auflage.bearbeitung.trim())) ? undefined : e.target.checked })}
          />
        </td>
        <td>
          <input className="eingabe zelle" aria-label="Auflage" value={auflage.nummer} maxLength={3} inputMode="numeric" onChange={(e) => setze({ nummer: e.target.value })} />
        </td>
        <td>
          <input className="eingabe zelle" aria-label="Jahr" autoFocus={autoFokus} value={auflage.jahr} maxLength={4} inputMode="numeric" onChange={(e) => setzeJahr(e.target.value)} />
        </td>
        <td className="verlag-zelle">
          <VerlagFeld
            wert={auflage.verlag}
            jahr={auflage.jahr}
            verlage={verlage}
            onText={(text) => {
              const v = findeExakt(verlage, text)
              const ort = v && !auflage.ort.trim() ? ortFuerJahr(v, auflage.jahr)?.ort : undefined
              setze({ verlag: text, verlagId: v?.id, ...(ort ? { ort } : {}) })
            }}
            onWaehlen={waehle}
          />
        </td>
        <td>
          <input className={`eingabe zelle ${auskunft?.zweiOrteMoeglich ? 'warnfarbe' : ''}`} aria-label="Ort" value={auflage.ort} onChange={(e) => setze({ ort: e.target.value, ortBestaetigt: false })} />
        </td>
        <td>
          <input className="eingabe zelle" aria-label="Seiten" value={auflage.seiten} maxLength={5} inputMode="numeric" onChange={(e) => setze({ seiten: e.target.value })} />
        </td>
        <td>
          <button
            type="button"
            className={`mehr-knopf ${hatMehr ? 'hat-mehr' : ''}`}
            aria-expanded={mehr}
            aria-label={`Weitere Angaben zur Auflage ${auflage.jahr}`}
            title="Bearbeitung, Druckjahr, Seiten röm., Vermerk, Erscheinungstag, ISBN"
            onClick={() => setMehr(!mehr)}
          >
            ⋯
          </button>
        </td>
      </tr>
      {auskunft?.zweiOrteMoeglich && (
        <tr className="warnzeile">
          <td colSpan={7}>
            <div role="alert" className="warnung">
              <Warnung />
              <span>
                {bekannt ? anzeigeName(bekannt) : ''} wechselte <b>{auflage.jahr}</b> von {auskunft.zweiOrteMoeglich[0]} nach {auskunft.zweiOrteMoeglich[1]}. In diesem Jahr ist beides möglich, bitte im Buch nachsehen.
              </span>
              <span className="knopfreihe">
                {auskunft.zweiOrteMoeglich.map((o) => (
                  <button key={o} type="button" className="klein-knopf" aria-pressed={auflage.ort === o} onClick={() => setze({ ort: o })}>
                    {o}
                  </button>
                ))}
              </span>
            </div>
          </td>
        </tr>
      )}
      {abweichung && bekannt && (
        <tr className="warnzeile">
          <td colSpan={7}>
            <div className="warnung leise-warnung">
              <Warnung />
              <span>
                Laut Verlagskarte saß {anzeigeName(bekannt)} {auflage.jahr ? <b>{auflage.jahr}</b> : null} in {abweichung.erwartet}.
              </span>
              <span className="knopfreihe">
                {/^\d{4}$/.test(auflage.jahr.trim()) && (
                  <button type="button" className="klein-knopf" onClick={() => onVerlagAendern(ortswechselEintragen(bekannt, auflage.jahr, auflage.ort))}>
                    Ortswechsel nach {ortName(auflage.ort)} ab {auflage.jahr.trim()} eintragen
                  </button>
                )}
                <button type="button" className="klein-knopf" onClick={() => setze({ ortBestaetigt: true })}>
                  Stimmt so, nur hier
                </button>
              </span>
            </div>
          </td>
        </tr>
      )}
      {mehr && (
        <tr className="detailzeile">
          <td colSpan={7}>
            <div className="detail-raster">
              <label>
                <span className="lab">Bearbeitung</span>
                <input className="eingabe" value={auflage.bearbeitung} placeholder="z. B. erw." onChange={(e) => setze({ bearbeitung: e.target.value })} />
              </label>
              <label>
                <span className="lab">Im Druck steht</span>
                <input className="eingabe" value={auflage.gedrucktesJahr} maxLength={4} placeholder="Jahr" onChange={(e) => setze({ gedrucktesJahr: e.target.value })} />
              </label>
              <label>
                <span className="lab">Seiten röm.</span>
                <input className="eingabe" value={auflage.seitenRoemisch} onChange={(e) => setze({ seitenRoemisch: e.target.value.toUpperCase() })} />
              </label>
              <label>
                <span className="lab">Vermerk</span>
                <input className="eingabe" value={auflage.vermerk} placeholder="z. B. 20.–25. Tsd." onChange={(e) => setze({ vermerk: e.target.value })} />
              </label>
              <label>
                <span className="lab">Erscheinungstag</span>
                <input className="eingabe" type="date" value={auflage.erscheinungstag} {...jahrGrenzen} onChange={(e) => setzeErscheinungstag(e.target.value)} />
              </label>
              <label>
                <span className="lab">ISBN</span>
                <input className="eingabe" value={auflage.isbn} inputMode="numeric" onChange={(e) => setze({ isbn: e.target.value })} />
              </label>
            </div>
            <div className="knopfreihe">
              {auflage.quelle && <span className="leise klein">aus dem Katalog übernommen</span>}
              {ausgaben.length > 1 && (
                <label className="pille">
                  gehört zu
                  <select value={ausgabeId} onChange={(e) => onVerschieben(e.target.value)}>
                    {ausgaben.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {onEntfernen && (
                <button type="button" className="textknopf leise rechts" onClick={onEntfernen}>
                  Auflage entfernen
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  )
}

/** Verlage der Karte, die noch keinem Verlag zugeordnet sind: ähnliche bestätigen, neue gleich merken. */
function VerlagsAbgleich({ werk, verlage, onAbgleich }: { werk: Werk; verlage: Verlag[]; onAbgleich: (g: VerlagsGruppe[], derselbe: boolean) => void }) {
  const plan = planeVerlage(werk, verlage)
  const aehnliche = plan.filter((g) => g.art === 'aehnlich' && g.verlag)
  const neue = plan.filter((g) => g.art === 'neu')
  if (aehnliche.length + neue.length === 0) return null
  const namen = (g: VerlagsGruppe) => g.texte.map((t) => `„${t}“`).join(', ')
  const anzahl = (g: VerlagsGruppe) => (g.auflagen.length > 1 ? ` (${g.auflagen.length} Auflagen)` : '')
  return (
    <div className="verlags-abgleich" aria-label="Verlage zuordnen">
      {aehnliche.map((g) => (
        <div className="abgleich-zeile" key={g.texte.join('|')}>
          <span>
            {namen(g)}
            {anzahl(g)} ist vermutlich <b>{anzeigeName(g.verlag!)}</b>.
          </span>
          <span className="knopfreihe">
            <button type="button" className="klein-knopf" onClick={() => onAbgleich([g], true)}>
              Ja, derselbe Verlag
            </button>
            <button type="button" className="klein-knopf" onClick={() => onAbgleich([g], false)}>
              Nein, ein anderer
            </button>
          </span>
        </div>
      ))}
      {neue.length > 0 && (
        <div className="abgleich-zeile neu">
          <span>
            {neue.length === 1 ? 'Neuer Verlag' : 'Neue Verlage'}: {neue.map((g) => g.texte[0]).join(', ')}. {neue.length === 1 ? 'Er wird' : 'Sie werden'} beim Festanlegen gemerkt.
          </span>
          <button type="button" className="textknopf" onClick={() => onAbgleich(neue, false)}>
            Jetzt merken
          </button>
        </div>
      )}
    </div>
  )
}

function Reihe({ werk, onAendern }: { werk: Werk; onAendern: (t: Partial<Werk>) => void }) {
  const [offen, setOffen] = useState(Boolean(werk.reihe || werk.reiheBand))
  const zusammenfassung = werk.reihe ? `${werk.reihe}${werk.reiheBand ? `, Bd. ${werk.reiheBand}` : ''}` : 'leer'
  return (
    <div className="feld">
      <button type="button" className="aufklapp" aria-expanded={offen} onClick={() => setOffen(!offen)}>
        <Winkel offen={offen} /> Schriftenreihe und Band {!offen && <span className="leise">· {zusammenfassung}</span>}
      </button>
      {offen && (
        <div className="reihe-felder">
          <label>
            <span className="lab">Schriftenreihe</span>
            <input className="eingabe serif" value={werk.reihe} onChange={(e) => onAendern({ reihe: e.target.value })} />
          </label>
          <label className="schmal">
            <span className="lab">Band</span>
            <input className="eingabe serif" value={werk.reiheBand} maxLength={6} onChange={(e) => onAendern({ reiheBand: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  )
}

function ErschienenInFeld({ wert, onAendern, nadel }: { wert: ErschienenIn; onAendern: (t: Partial<ErschienenIn>) => void; nadel: React.ReactNode }) {
  return (
    <div className="feld erschienen-in">
      <div className="feld-kopf">
        <span className="lab">Erschienen in</span>
        {nadel}
      </div>
      <div className="ei-raster">
        <label>
          <span className="lab">Art</span>
          <select className="eingabe" value={wert.art} onChange={(e) => onAendern({ art: e.target.value as ErschienenIn['art'] })}>
            <option value="zeitschrift">Zeitschrift</option>
            <option value="zeitung">Zeitung</option>
            <option value="sammelband">Sammelband</option>
          </select>
        </label>
        <label className="breit">
          <span className="lab">Titel</span>
          <input className="eingabe serif" value={wert.titel} onChange={(e) => onAendern({ titel: e.target.value })} />
        </label>
        {wert.art !== 'sammelband' && (
          <>
            <label>
              <span className="lab">Jahrgang</span>
              <input className="eingabe" value={wert.jahrgang} onChange={(e) => onAendern({ jahrgang: e.target.value })} />
            </label>
            <label>
              <span className="lab">Jahr</span>
              <input className="eingabe" value={wert.jahr} maxLength={9} onChange={(e) => onAendern({ jahr: e.target.value })} />
            </label>
            <label>
              <span className="lab">Heft / Nr.</span>
              <input className="eingabe" value={wert.heft} onChange={(e) => onAendern({ heft: e.target.value })} />
            </label>
          </>
        )}
        <label className="breit">
          <span className="lab">{wert.art === 'sammelband' ? 'Weitere Angaben' : 'Ausgabe, wie gedruckt'}</span>
          <input
            className="eingabe serif"
            value={wert.ausgabe}
            placeholder={wert.art === 'sammelband' ? ', hrsg. von …, Ort Jahr' : 'statt Jahrgang und Heft, etwa 44/1927'}
            onChange={(e) => onAendern({ ausgabe: e.target.value })}
          />
        </label>
        <label>
          <span className="lab">Seite von</span>
          <input className="eingabe" value={wert.seitenVon} onChange={(e) => onAendern({ seitenVon: e.target.value })} />
        </label>
        <label>
          <span className="lab">bis</span>
          <input className="eingabe" value={wert.seitenBis} onChange={(e) => onAendern({ seitenBis: e.target.value })} />
        </label>
      </div>
    </div>
  )
}

function Schlagwoerter({
  werk,
  alle,
  fixiert,
  nadel,
  onAendern,
}: {
  werk: Werk
  alle: string[]
  fixiert: string[]
  nadel: React.ReactNode
  onAendern: (s: Werk['schlagwoerter']) => void
}) {
  const [eingabe, setEingabe] = useState('')
  const vorhanden = new Set(werk.schlagwoerter.map((s) => s.begriff.toLowerCase()))
  const vorschlaege = eingabe.trim()
    ? alle.filter((b) => b.toLowerCase().startsWith(eingabe.trim().toLowerCase()) && !vorhanden.has(b.toLowerCase())).slice(0, 6)
    : []
  const fuegeHinzu = (begriff: string) => {
    const b = begriff.trim()
    if (!b || vorhanden.has(b.toLowerCase())) return
    onAendern([...werk.schlagwoerter, { begriff: b, primaer: werk.schlagwoerter.length === 0 }])
    setEingabe('')
  }
  const primaere = werk.schlagwoerter.filter((s) => s.primaer)
  const sekundaere = werk.schlagwoerter.filter((s) => !s.primaer)
  const chip = (s: Werk['schlagwoerter'][number]) => {
    const i = werk.schlagwoerter.indexOf(s)
    return (
      <span key={s.begriff} className={`chip ${s.primaer ? 'primaer' : ''}`}>
        <button
          type="button"
          className="chip-text"
          title={s.primaer ? 'primär – klicken für sekundär' : 'sekundär – klicken für primär'}
          aria-label={`${s.begriff}, ${s.primaer ? 'primär' : 'sekundär'}. Klicken wechselt.`}
          onClick={() => onAendern(werk.schlagwoerter.map((x, j) => (j === i ? { ...x, primaer: !x.primaer } : x)))}
        >
          {s.begriff}
          {fixiert.includes(s.begriff) && <Nadel groesse={12} />}
        </button>
        <button type="button" className="chip-weg" aria-label={`${s.begriff} entfernen`} onClick={() => onAendern(werk.schlagwoerter.filter((_, j) => j !== i))}>
          ×
        </button>
      </span>
    )
  }

  return (
    <div className="feld">
      <div className="feld-kopf">
        <span className="lab">Schlagwörter</span>
        {nadel}
      </div>
      <div className="schlagwoerter">
        {primaere.map(chip)}
        {primaere.length > 0 && sekundaere.length > 0 && <span className="trenner" aria-hidden="true" />}
        {sekundaere.map(chip)}
        <span className="schlagwort-eingabe">
          <input
            className="eingabe serif"
            aria-label="Schlagwort hinzufügen"
            placeholder="Schlagwort …"
            autoComplete="off"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault()
                fuegeHinzu(vorschlaege[0] ?? eingabe)
              }
            }}
          />
          {vorschlaege.length > 0 && (
            <ul className="klein-menue">
              {vorschlaege.map((b) => (
                <li key={b} onMouseDown={(e) => e.preventDefault()} onClick={() => fuegeHinzu(b)}>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </span>
      </div>
      <p className="hinweis">Gefüllt = primär, umrandet = sekundär. Ein Klick wechselt.</p>
    </div>
  )
}
