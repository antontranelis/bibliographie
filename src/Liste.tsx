import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Druckzeile, kopiereZeile } from './Druckzeile'
import { druckzeileTeile, type Stil, type Teil } from './format'
import { ALLE, abschnitte, entferne, kapitelEntfernen, rueckeUm, umschalten, verschiebe, type Abschnitt } from './listen'
import { neueId, personSchluessel, type Kapitel, type Literaturliste, type Werk } from './model'
import { herunterladen } from './herunterladen'
import { Blatt } from './Symbole'

const personLabel = (schluessel: string) => {
  const [n, v] = schluessel.split('|')
  return v ? `${n}, ${v}` : n
}
const ERSTE_ZEILEN = 60

/** Ein Abschnitt, wie er aufs Papier kommt: Überschrift mit Nummer und die gedruckten Zeilen. */
export interface Druckabschnitt {
  ueberschrift: string
  /** 0 = vor dem ersten Kapitel, ohne Überschrift */
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
  liste,
  onAendern,
  onWaehlen,
  onNeu,
  onLoeschen,
}: {
  werke: Werk[]
  listen: Literaturliste[]
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

  const teile = useMemo(() => abschnitte(liste, werke), [liste, werke])
  const alleZeilen = teile.flatMap((a) => a.zeilen)
  const gedruckt = alleZeilen.filter((z) => z.drin)
  const herausgenommen = alleZeilen.length - gedruckt.length
  const vorlaeufig = gedruckt.filter((z) => z.werk.status === 'vorlaeufig').length
  const druck: Druckabschnitt[] = teile
    .map((a) => ({
      ueberschrift: a.kapitel ? `${a.nummer} ${a.kapitel.titel}`.trim() : '',
      ebene: (a.kapitel?.ebene ?? 0) as Druckabschnitt['ebene'],
      zeilen: a.zeilen.filter((z) => z.drin).map((z) => druckzeileTeile(z.werk, stil)),
    }))
    .filter((a) => a.ueberschrift || a.zeilen.length)
  const anzahl = gedruckt.length

  const speichern = async () => {
    const { wordDatei } = await import('./word')
    herunterladen(await wordDatei(liste.name, druck), `${liste.name.trim() || 'Literaturliste'}.docx`)
  }
  const neuesKapitel = (ebene: 1 | 2) => aendere({ kapitel: [...liste.kapitel, { id: neueId(), titel: '', ebene }] })
  const setzeKapitel = (id: string, teil: Partial<Kapitel>) => aendere({ kapitel: liste.kapitel.map((k) => (k.id === id ? { ...k, ...teil } : k)) })
  const kopiere = async (schluessel: string, z: Teil[]) => {
    await kopiereZeile(z)
    setKopiert(schluessel)
    setTimeout(() => setKopiert((k) => (k === schluessel ? '' : k)), 2000)
  }

  // Lange Listen: zuerst nur die ersten Zeilen zeigen, Kapitelüberschriften immer
  let gezeigt = 0
  const zeigen = () => alleZeigen || gezeigt++ < ERSTE_ZEILEN

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
          {teile.map((a) => (
            <Fragment key={a.kapitel?.id ?? 'vorn'}>
              {a.kapitel && <KapitelKopf abschnitt={a} onAendern={(teil) => setzeKapitel(a.kapitel!.id, teil)} onEntfernen={() => onAendern(kapitelEntfernen(liste, a.kapitel!.id))} />}
              {a.zeilen.length === 0 && !a.kapitel && liste.kapitel.length === 0 && <p className="leise">Noch keine Karte in dieser Liste.</p>}
              {a.zeilen.filter(zeigen).map((z) => {
                const zeile = druckzeileTeile(z.werk, stil)
                return (
                  <div key={z.schluessel} className={`eintrag ${z.drin ? '' : 'heraus'}`}>
                    <input type="checkbox" checked={z.drin} aria-label={`${z.werk.titel || 'ohne Titel'} drucken`} onChange={() => onAendern(umschalten(liste, z.werk.id))} />
                    <span>
                      <Druckzeile teile={zeile} />
                      {z.werk.status === 'vorlaeufig' && <span className="marke-vorlaeufig">vorläufig</span>}
                    </span>
                    <span className="eintrag-knoepfe">
                      {liste.kapitel.length > 0 && (
                        <select aria-label="Kapitel" value={a.kapitel?.id ?? ''} onChange={(e) => onAendern(verschiebe(liste, z.werk.id, e.target.value))}>
                          <option value="">vor den Kapiteln</option>
                          {teile
                            .filter((x) => x.kapitel)
                            .map((x) => (
                              <option key={x.kapitel!.id} value={x.kapitel!.id}>
                                {x.nummer} {x.kapitel!.titel}
                              </option>
                            ))}
                        </select>
                      )}
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
          {!alleZeigen && alleZeilen.length > ERSTE_ZEILEN && (
            <button type="button" className="textknopf" onClick={() => setAlleZeigen(true)}>
              {alleZeilen.length - ERSTE_ZEILEN} weitere Einträge
            </button>
          )}
          <div className="knopfreihe kapitel-knoepfe">
            <button type="button" className="textknopf" onClick={() => neuesKapitel(1)}>
              + Kapitel
            </button>
            {liste.kapitel.length > 0 && (
              <button type="button" className="textknopf" onClick={() => neuesKapitel(2)}>
                + Unterkapitel
              </button>
            )}
          </div>
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

function KapitelKopf({ abschnitt, onAendern, onEntfernen }: { abschnitt: Abschnitt; onAendern: (t: Partial<Kapitel>) => void; onEntfernen: () => void }) {
  const k = abschnitt.kapitel!
  return (
    <div className={`kapitel-kopf ebene-${k.ebene}`}>
      <span className="kapitel-nr">{abschnitt.nummer}</span>
      <input className="eingabe serif" aria-label={`Kapitel ${abschnitt.nummer}`} value={k.titel} placeholder="Kapitelüberschrift" onChange={(e) => onAendern({ titel: e.target.value })} />
      <button type="button" className="klein-knopf" onClick={() => onAendern({ ebene: k.ebene === 1 ? 2 : 1 })}>
        {k.ebene === 1 ? 'als Unterkapitel' : 'als Kapitel'}
      </button>
      <button type="button" className="klein-knopf" onClick={onEntfernen}>
        Kapitel entfernen
      </button>
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
