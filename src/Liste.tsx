import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Druckzeile, kopiereZeile } from './Druckzeile'
import { druckzeileTeile, type Stil, type Teil } from './format'
import { ALLE, abschnitte, druckWerk, entferne, rueckeUm, umschalten, type Abschnitt } from './listen'
import { personSchluessel, type Literaturliste, type Thema, type Werk } from './model'
import { baum, bezeichnung } from './themen'
import { herunterladen } from './herunterladen'
import { Blatt } from './Symbole'

const personLabel = (schluessel: string) => {
  const [n, v] = schluessel.split('|')
  return v ? `${n}, ${v}` : n
}
const ERSTE_ZEILEN = 60

/** Lange Themenüberschriften in Auswahllisten kürzen; die Liste des Browsers würde sonst fensterbreit */
const kurz = (text: string, hoechstens = 48) => (text.length > hoechstens ? `${text.slice(0, hoechstens - 2).trimEnd()} …` : text)

/** Ein Abschnitt, wie er aufs Papier kommt: Überschrift und die gedruckten Zeilen. */
export interface Druckabschnitt {
  ueberschrift: string
  /** 0 = ohne Überschrift */
  ebene: 0 | 1 | 2
  zeilen: Teil[][]
}

function Wahl<T extends string>({ label, wert, optionen, onWahl }: { label: string; wert: T; optionen: [T, string][]; onWahl: (w: T) => void }) {
  return (
    <div>
      <span className="lab">{label}</span>
      <div className="segment voll" role="radiogroup" aria-label={label}>
        {optionen.map(([w, text]) => (
          <button key={w} type="button" role="radio" aria-checked={wert === w} onClick={() => onWahl(w)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Liste({
  werke,
  listen,
  themen,
  liste,
  onAendern,
  onWaehlen,
  onNeu,
  onLoeschen,
}: {
  werke: Werk[]
  listen: Literaturliste[]
  themen: Thema[]
  liste: Literaturliste
  onAendern: (l: Literaturliste) => void
  onWaehlen: (id: string) => void
  onNeu: () => void
  onLoeschen: (id: string) => void
}) {
  const [alleZeigen, setAlleZeigen] = useState(false)
  const [vorschau, setVorschau] = useState(false)
  const [kopiert, setKopiert] = useState('')
  const aendere = (teil: Partial<Literaturliste>) => onAendern({ ...liste, ...teil, geaendert: new Date().toISOString() })
  const stil = liste.stil
  const setStil = (s: Stil) => aendere({ stil: s })
  const regel = liste.regel
  const setzeRegel = (teil: Partial<typeof ALLE>) => aendere({ regel: { ...(regel ?? ALLE), ...teil } })

  const personen = useMemo(
    () =>
      [...new Set(werke.flatMap((w) => w.personen.filter((p) => p.nachname.trim() || p.vorname.trim()).map(personSchluessel)))].sort((a, b) =>
        a.localeCompare(b, 'de'),
      ),
    [werke],
  )
  const schlagwoerter = useMemo(
    () => [...new Set(werke.flatMap((w) => w.schlagwoerter.map((s) => s.begriff)))].sort((a, b) => a.localeCompare(b, 'de')),
    [werke],
  )

  const teile = useMemo(() => abschnitte(liste, werke, themen), [liste, werke, themen])
  const alleZeilen = teile.flatMap((a) => a.zeilen)
  const gedruckt = alleZeilen.filter((z) => z.drin)
  const herausgenommen = alleZeilen.length - gedruckt.length
  const vorlaeufig = gedruckt.filter((z) => z.werk.status === 'vorlaeufig').length
  const druck: Druckabschnitt[] = teile
    .map((a) => ({
      ueberschrift: a.ueberschrift?.titel ?? '',
      ebene: (a.ueberschrift?.ebene ?? 0) as Druckabschnitt['ebene'],
      zeilen: a.zeilen.filter((z) => z.drin).map((z) => druckzeileTeile(druckWerk(z), stil)),
    }))
    .filter((a) => a.ueberschrift || a.zeilen.length)
  const anzahl = gedruckt.length

  const speichern = async () => {
    const { wordDatei } = await import('./word')
    herunterladen(await wordDatei(liste.name, druck), `${liste.name.trim() || 'Literaturliste'}.docx`)
  }
  const kopiere = async (schluessel: string, z: Teil[]) => {
    await kopiereZeile(z)
    setKopiert(schluessel)
    setTimeout(() => setKopiert((k) => (k === schluessel ? '' : k)), 2000)
  }

    // Lange Listen: zuerst nur die ersten Zeilen; die Ansicht endet dort ganz, auch ohne die folgenden Überschriften
  const sichtbar: { abschnitt: Abschnitt; zeilen: Abschnitt['zeilen'] }[] = []
  let platz = ERSTE_ZEILEN
  for (const a of teile) {
    if (!alleZeigen && platz <= 0) break
    const zeilen = alleZeigen ? a.zeilen : a.zeilen.slice(0, platz)
    platz -= zeilen.length
    sichtbar.push({ abschnitt: a, zeilen })
  }
  const verborgen = alleZeilen.length - sichtbar.reduce((n, s) => n + s.zeilen.length, 0)
  const verborgeneThemen = teile.filter((a) => a.ueberschrift).length - sichtbar.filter((s) => s.abschnitt.ueberschrift).length

  return (
    <div className="liste">
      <section className="liste-haupt" aria-label="Auswahl">
        <div className="listen-wahl">
          <label className="bedingung gesetzt">
            <span>Liste</span>
            <select value={liste.id} onChange={(e) => onWaehlen(e.target.value)}>
              {listen.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name.trim() || 'ohne Namen'}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="textknopf" onClick={onNeu}>
            + Neue Liste
          </button>
          <button
            type="button"
            className="textknopf leise rechts"
            onClick={() => confirm(`Liste „${liste.name || 'ohne Namen'}“ löschen? Die Karten bleiben erhalten.`) && onLoeschen(liste.id)}
          >
            Liste löschen
          </button>
        </div>
        <label className="unsichtbar" htmlFor="listen-name">
          Überschrift der Liste
        </label>
        <input id="listen-name" className="listen-name" value={liste.name} placeholder="Überschrift der Liste" onChange={(e) => aendere({ name: e.target.value })} />

        <div className="papier bedingungen-kasten">
          <span className="lab">Welche Karten</span>
          <label className="haken">
            <input type="checkbox" checked={regel !== null} onChange={(e) => aendere({ regel: e.target.checked ? { ...ALLE } : null })} /> Karten nach Person oder Schlagwort von
            selbst aufnehmen
          </label>
          {regel && (
            <div className="bedingungen">
              <label className={`bedingung ${regel.person ? 'gesetzt' : ''}`}>
                <span>Person</span>
                <select value={regel.person} onChange={(e) => setzeRegel({ person: e.target.value })}>
                  <option value="">alle Personen</option>
                  {personen.map((p) => (
                    <option key={p} value={p}>
                      {personLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
              <span className="leise">und</span>
              <label className={`bedingung ${regel.schlagwort ? 'gesetzt' : ''}`}>
                <span>Schlagwort</span>
                <select value={regel.schlagwort} onChange={(e) => setzeRegel({ schlagwort: e.target.value })}>
                  <option value="">alle Schlagwörter</option>
                  {schlagwoerter.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {regel.schlagwort && (
                <label className="pille">
                  <input type="checkbox" checked={regel.nurPrimaer} onChange={(e) => setzeRegel({ nurPrimaer: e.target.checked })} /> nur primär
                </label>
              )}
              {themen.length > 0 && (
                <>
                  <span className="leise">und</span>
                  <label className={`bedingung ${regel.thema ? 'gesetzt' : ''}`}>
                    <span>Thema</span>
                    <select value={regel.thema} onChange={(e) => setzeRegel({ thema: e.target.value })}>
                      <option value="">alle Themen</option>
                      {baum(themen).map((k) => (
                        <option key={k.thema.id} value={k.thema.id}>
                          {'\u00a0\u00a0'.repeat(k.tiefe)}
                          {kurz(bezeichnung(k.thema) || 'ohne Titel')}
                        </option>
                      ))}
                    </select>
                  </label>
                  {regel.thema && (
                    <label className="pille">
                      <input type="checkbox" checked={regel.mitUnterthemen} onChange={(e) => setzeRegel({ mitUnterthemen: e.target.checked })} /> mit Unterthemen
                    </label>
                  )}
                </>
              )}
              <label className="pille">
                <input type="checkbox" checked={regel.nurFest} onChange={(e) => setzeRegel({ nurFest: e.target.checked })} /> nur fest angelegte
              </label>
            </div>
          )}
          <p className="zaehler">
            {alleZeilen.length} {alleZeilen.length === 1 ? 'Eintrag' : 'Einträge'}
            {herausgenommen > 0 && ` · ${herausgenommen} herausgenommen`}
            {vorlaeufig > 0 && <span className="warnfarbe"> · {vorlaeufig} noch vorläufig</span>}
            {!regel && ' · Karten kommen über „In Liste aufnehmen“ auf der Karte hinzu'}
          </p>
        </div>

        <div className="papier eintraege">
          <div className="eintraege-kopf">
            <span className="lab">Einträge, wie sie gedruckt werden</span>
            <span className="leise klein rechts">Haken entfernen = nicht drucken</span>
          </div>
          {sichtbar.map(({ abschnitt: a, zeilen: gezeigteZeilen }) => (
            <Fragment key={a.ueberschrift?.id ?? 'alle'}>
              {a.ueberschrift && <h3 className={`kapitel-kopf thema-kopf ebene-${a.ueberschrift.ebene}`}>{a.ueberschrift.titel}</h3>}
              {a.zeilen.length === 0 && !a.ueberschrift && <p className="leise">Noch keine Karte in dieser Liste.</p>}
              {gezeigteZeilen.map((z) => {
                const zeile = druckzeileTeile(druckWerk(z), stil)
                return (
                  <div key={z.schluessel} className={`eintrag ${z.drin ? '' : 'heraus'}`}>
                    <input type="checkbox" checked={z.drin} aria-label={`${z.werk.titel || 'ohne Titel'} drucken`} onChange={() => onAendern(umschalten(liste, z.werk.id))} />
                    <span>
                      <Druckzeile teile={zeile} />
                      {z.werk.status === 'vorlaeufig' && <span className="marke-vorlaeufig">vorläufig</span>}
                    </span>
                    <span className="eintrag-knoepfe">
                      {liste.sortierung === 'hand' && z.vonHand && (
                        <>
                          <button type="button" className="klein-knopf" aria-label="nach oben" onClick={() => onAendern(rueckeUm(liste, z.werk.id, -1))}>
                            ↑
                          </button>
                          <button type="button" className="klein-knopf" aria-label="nach unten" onClick={() => onAendern(rueckeUm(liste, z.werk.id, 1))}>
                            ↓
                          </button>
                        </>
                      )}
                      <button type="button" className="klein-knopf" onClick={() => kopiere(z.schluessel, zeile)}>
                        {kopiert === z.schluessel ? 'kopiert' : 'kopieren'}
                      </button>
                      {z.vonHand && (
                        <button type="button" className="klein-knopf" aria-label="aus der Liste nehmen" title="Von Hand aufgenommen: aus der Liste nehmen" onClick={() => onAendern(entferne(liste, z.werk.id))}>
                          ×
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </Fragment>
          ))}
          {!alleZeigen && verborgen > 0 && (
            <div className="weitere-eintraege">
              <button type="button" className="textknopf" onClick={() => setAlleZeigen(true)}>
                {verborgen} weitere Einträge{verborgeneThemen > 0 && ` unter ${verborgeneThemen} ${verborgeneThemen === 1 ? 'weiteren Thema' : 'weiteren Themen'}`} zeigen
              </button>
            </div>
          )}
        </div>
      </section>

      <aside className="liste-seite" aria-label="Darstellung und Ausgabe">
        <div className="papier kasten-innen">
          <h2>Darstellung</h2>
          <Wahl label="Ortsangabe" wert={stil.muster} optionen={[['ort', 'Ort Jahr'], ['verlag', 'Verlag, Ort Jahr']]} onWahl={(muster) => setStil({ ...stil, muster })} />
          <Wahl
            label="Namen"
            wert={stil.namensfolge}
            optionen={[
              ['vorname-name', 'Vorname Name'],
              ['name-vorname', 'Name, Vorname'],
            ]}
            onWahl={(namensfolge) => setStil({ ...stil, namensfolge })}
          />
          <Wahl
            label="Mehrere Personen"
            wert={stil.personenTrenner}
            optionen={[
              ['/', 'A/B'],
              [' / ', 'A / B'],
            ]}
            onWahl={(personenTrenner) => setStil({ ...stil, personenTrenner })}
          />
          <Wahl
            label="Titel"
            wert={stil.titelAuszeichnung}
            optionen={[
              ['fett', 'fett'],
              ['halbfett', 'halbfett'],
              ['keine', 'normal'],
            ]}
            onWahl={(titelAuszeichnung) => setStil({ ...stil, titelAuszeichnung })}
          />
          <Wahl
            label="Beiträge"
            wert={stil.beitragsform}
            optionen={[
              ['klammer', '(in: …)'],
              ['komma', ', in: …'],
            ]}
            onWahl={(beitragsform) => setStil({ ...stil, beitragsform })}
          />
          <Wahl
            label="Untertitel abtrennen mit"
            wert={stil.untertitelTrenner}
            optionen={[
              ['. ', 'Punkt'],
              [' – ', 'Strich'],
              [': ', 'Doppelpunkt'],
            ]}
            onWahl={(untertitelTrenner) => setStil({ ...stil, untertitelTrenner })}
          />
          <Wahl
            label="Auflagen"
            wert={stil.auflagen}
            optionen={[
              ['auswahl', 'ausgewählte'],
              ['alle', 'alle'],
              ['erste', 'nur erste'],
            ]}
            onWahl={(auflagen) => setStil({ ...stil, auflagen })}
          />
          <label className="haken">
            <input type="checkbox" checked={stil.seitenzahl} onChange={(e) => setStil({ ...stil, seitenzahl: e.target.checked })} /> Seitenzahl angeben
          </label>
          <label className="haken">
            <input type="checkbox" checked={stil.isbn} onChange={(e) => setStil({ ...stil, isbn: e.target.checked })} /> ISBN angeben
          </label>
          <label className="haken">
            <input type="checkbox" checked={stil.anmerkungen} onChange={(e) => setStil({ ...stil, anmerkungen: e.target.checked })} /> Anmerkungen mitdrucken
          </label>
          <label className="haken">
            <input type="checkbox" checked={stil.schlusspunkt} onChange={(e) => setStil({ ...stil, schlusspunkt: e.target.checked })} /> Punkt am Zeilenende
          </label>
          <div className="trennlinie" />
          {themen.length > 0 && (
            <Wahl
              label="Gliederung"
              wert={liste.gliederung}
              optionen={[
                ['keine', 'keine'],
                ['themen', 'nach Themenordnung'],
              ]}
              onWahl={(gliederung) => aendere({ gliederung })}
            />
          )}
          <Wahl
            label="Sortieren nach"
            wert={liste.sortierung}
            optionen={[
              ['name', 'Name, Jahr'],
              ['jahr', 'Jahr, Name'],
              ['hand', 'von Hand'],
            ]}
            onWahl={(sortierung) => aendere({ sortierung })}
          />
          {liste.sortierung !== 'hand' && (
            <label className="haken">
              <input type="checkbox" checked={liste.jedePerson} onChange={(e) => aendere({ jedePerson: e.target.checked })} /> Werk bei jeder seiner Personen nennen
            </label>
          )}
        </div>

        <div className="papier kasten-innen">
          <h2>Fertig?</h2>
          <button type="button" className="knopf" disabled={anzahl === 0} onClick={() => setVorschau(true)}>
            <Blatt /> Blattvorschau ansehen
          </button>
          <button type="button" className="knopf haupt" disabled={anzahl === 0} onClick={speichern}>
            Als Word-Datei speichern
          </button>
          <button type="button" className="knopf" disabled={anzahl === 0} onClick={() => window.print()}>
            Drucken
          </button>
          <span className="leise klein">
            {anzahl} {anzahl === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </div>
      </aside>

      {vorschau && <Blattvorschau ueberschrift={liste.name} druck={druck} onSpeichern={speichern} onSchliessen={() => setVorschau(false)} />}

      <div className="druckblatt" aria-hidden="true">
        <Blattinhalt ueberschrift={liste.name} druck={druck} />
      </div>
    </div>
  )
}


function Blattinhalt({ ueberschrift, druck }: { ueberschrift: string; druck: Druckabschnitt[] }) {
  return (
    <>
      <h1>{ueberschrift}</h1>
      {druck.map((a, i) => (
        <Fragment key={i}>
          {a.ebene === 1 && <h2>{a.ueberschrift}</h2>}
          {a.ebene === 2 && <h3>{a.ueberschrift}</h3>}
          {a.zeilen.map((z, j) => (
            <p key={j}>
              <Druckzeile teile={z} />
            </p>
          ))}
        </Fragment>
      ))}
    </>
  )
}

function Blattvorschau({ ueberschrift, druck, onSpeichern, onSchliessen }: { ueberschrift: string; druck: Druckabschnitt[]; onSpeichern: () => void; onSchliessen: () => void }) {
  const schliessen = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    schliessen.current?.focus()
    const t = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen()
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [onSchliessen])
  return (
    <div className="ueberlagerung" role="dialog" aria-modal="true" aria-label="Blattvorschau">
      <div className="vorschau-leiste">
        <strong>Blattvorschau</strong>
        <span className="leise klein">So kommt die Liste aufs Papier.</span>
        <span className="rechts knopfreihe">
          <button type="button" className="knopf haupt" onClick={onSpeichern}>
            Als Word-Datei speichern
          </button>
          <button type="button" className="knopf" onClick={() => window.print()}>
            Drucken
          </button>
          <button ref={schliessen} type="button" className="knopf" onClick={onSchliessen}>
            Schließen <kbd>Esc</kbd>
          </button>
        </span>
      </div>
      <div className="blatt">
        <Blattinhalt ueberschrift={ueberschrift} druck={druck} />
      </div>
    </div>
  )
}
