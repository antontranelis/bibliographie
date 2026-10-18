import { useEffect, useMemo, useRef, useState } from 'react'
import { Druckzeile } from './Druckzeile'
import { druckzeileTeile, sortiere, STANDARD_STIL, type Stil, type Teil } from './format'
import type { Werk } from './model'
import { herunterladen } from './herunterladen'
import { personSchluessel, type ListenVorgabe } from './Kartei'
import { Blatt } from './Symbole'

const personLabel = (schluessel: string) => {
  const [n, v] = schluessel.split('|')
  return v ? `${n}, ${v}` : n
}
const ERSTE_ZEILEN = 60

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

export function Liste({ werke, vorgabe }: { werke: Werk[]; vorgabe: ListenVorgabe }) {
  const [stil, setStil] = useState<Stil>(STANDARD_STIL)
  const [sortierung, setSortierung] = useState<'name' | 'jahr'>('name')
  const [person, setPerson] = useState(vorgabe.person ?? '')
  const [schlagwort, setSchlagwort] = useState(vorgabe.schlagwort ?? '')
  const [nurPrimaer, setNurPrimaer] = useState(false)
  const [nurFest, setNurFest] = useState(false)
  const [ausgenommen, setAusgenommen] = useState<Set<string>>(new Set())
  const [alleZeigen, setAlleZeigen] = useState(false)
  const [vorschau, setVorschau] = useState(false)
  const [ueberschrift, setUeberschrift] = useState(() => {
    if (vorgabe.person) {
      const [n, v] = vorgabe.person.split('|')
      return [v, n].filter(Boolean).join(' ')
    }
    return vorgabe.schlagwort ?? 'Literaturliste'
  })

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

  const passend = useMemo(
    () =>
      sortiere(
        werke.filter(
          (w) =>
            (!nurFest || w.status === 'fest') &&
            (!person || w.personen.some((p) => personSchluessel(p) === person)) &&
            (!schlagwort || w.schlagwoerter.some((s) => s.begriff === schlagwort && (!nurPrimaer || s.primaer))),
        ),
        sortierung,
      ),
    [werke, nurFest, person, schlagwort, nurPrimaer, sortierung],
  )
  const aufgenommen = passend.filter((w) => !ausgenommen.has(w.id))
  const zeilen = aufgenommen.map((w) => druckzeileTeile(w, stil))
  const herausgenommen = passend.length - aufgenommen.length
  const vorlaeufig = aufgenommen.filter((w) => w.status === 'vorlaeufig').length
  const gezeigt = alleZeigen ? passend : passend.slice(0, ERSTE_ZEILEN)

  const umschalten = (id: string) => {
    const neu = new Set(ausgenommen)
    if (neu.has(id)) neu.delete(id)
    else neu.add(id)
    setAusgenommen(neu)
  }
  const speichern = async () => {
    const { wordDatei } = await import('./word')
    herunterladen(await wordDatei(ueberschrift, zeilen), `${ueberschrift.trim() || 'Literaturliste'}.docx`)
  }

  return (
    <div className="liste">
      <section className="liste-haupt" aria-label="Auswahl">
        <label className="unsichtbar" htmlFor="listen-name">
          Überschrift der Liste
        </label>
        <input id="listen-name" className="listen-name" value={ueberschrift} onChange={(e) => setUeberschrift(e.target.value)} />

        <div className="papier bedingungen-kasten">
          <span className="lab">Welche Karten</span>
          <div className="bedingungen">
            <label className={`bedingung ${person ? 'gesetzt' : ''}`}>
              <span>Person</span>
              <select value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">alle Personen</option>
                {personen.map((p) => (
                  <option key={p} value={p}>
                    {personLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <span className="leise">und</span>
            <label className={`bedingung ${schlagwort ? 'gesetzt' : ''}`}>
              <span>Schlagwort</span>
              <select value={schlagwort} onChange={(e) => setSchlagwort(e.target.value)}>
                <option value="">alle Schlagwörter</option>
                {schlagwoerter.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {schlagwort && (
              <label className="pille">
                <input type="checkbox" checked={nurPrimaer} onChange={(e) => setNurPrimaer(e.target.checked)} /> nur primär
              </label>
            )}
            <label className="pille">
              <input type="checkbox" checked={nurFest} onChange={(e) => setNurFest(e.target.checked)} /> nur fest angelegte
            </label>
          </div>
          <p className="zaehler">
            {passend.length} {passend.length === 1 ? 'Karte passt' : 'Karten passen'}
            {herausgenommen > 0 && ` · ${herausgenommen} von Hand herausgenommen`}
            {vorlaeufig > 0 && <span className="warnfarbe"> · {vorlaeufig} noch vorläufig</span>}
          </p>
        </div>

        <div className="papier eintraege">
          <div className="eintraege-kopf">
            <span className="lab">Einträge, wie sie gedruckt werden</span>
            <span className="leise klein rechts">Haken entfernen = nicht in die Liste</span>
          </div>
          {passend.length === 0 && <p className="leise">Keine Karte passt zur Auswahl.</p>}
          {gezeigt.map((w) => {
            const drin = !ausgenommen.has(w.id)
            return (
              <label key={w.id} className={`eintrag ${drin ? '' : 'heraus'}`}>
                <input type="checkbox" checked={drin} onChange={() => umschalten(w.id)} />
                <span>
                  <Druckzeile teile={druckzeileTeile(w, stil)} />
                  {w.status === 'vorlaeufig' && <span className="marke-vorlaeufig">vorläufig</span>}
                </span>
              </label>
            )
          })}
          {!alleZeigen && passend.length > ERSTE_ZEILEN && (
            <button type="button" className="textknopf" onClick={() => setAlleZeigen(true)}>
              {passend.length - ERSTE_ZEILEN} weitere Einträge
            </button>
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
          <Wahl
            label="Sortieren nach"
            wert={sortierung}
            optionen={[
              ['name', 'Name, dann Jahr'],
              ['jahr', 'Jahr, dann Name'],
            ]}
            onWahl={setSortierung}
          />
        </div>

        <div className="papier kasten-innen">
          <h2>Fertig?</h2>
          <button type="button" className="knopf" disabled={zeilen.length === 0} onClick={() => setVorschau(true)}>
            <Blatt /> Blattvorschau ansehen
          </button>
          <button type="button" className="knopf haupt" disabled={zeilen.length === 0} onClick={speichern}>
            Als Word-Datei speichern
          </button>
          <button type="button" className="knopf" disabled={zeilen.length === 0} onClick={() => window.print()}>
            Drucken
          </button>
          <span className="leise klein">
            {zeilen.length} {zeilen.length === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </div>
      </aside>

      {vorschau && <Blattvorschau ueberschrift={ueberschrift} zeilen={zeilen} onSpeichern={speichern} onSchliessen={() => setVorschau(false)} />}

      <div className="druckblatt" aria-hidden="true">
        <h1>{ueberschrift}</h1>
        {zeilen.map((z, i) => (
          <p key={i}>
            <Druckzeile teile={z} />
          </p>
        ))}
      </div>
    </div>
  )
}

function Blattvorschau({ ueberschrift, zeilen, onSpeichern, onSchliessen }: { ueberschrift: string; zeilen: Teil[][]; onSpeichern: () => void; onSchliessen: () => void }) {
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
        <h1>{ueberschrift}</h1>
        {zeilen.map((z, i) => (
          <p key={i}>
            <Druckzeile teile={z} />
          </p>
        ))}
      </div>
    </div>
  )
}
