import { useMemo, useState } from 'react'
import { druckzeile, sortiere, STANDARD_STIL, type Stil } from './format'
import type { Werk } from './model'
import { herunterladen } from './herunterladen'

export function Liste({ werke }: { werke: Werk[] }) {
  const [stil, setStil] = useState<Stil>(STANDARD_STIL)
  const [sortierung, setSortierung] = useState<'name' | 'jahr'>('name')
  const [person, setPerson] = useState('')
  const [schlagwort, setSchlagwort] = useState('')
  const [nurPrimaer, setNurPrimaer] = useState(false)
  const [nurFest, setNurFest] = useState(false)
  const [ueberschrift, setUeberschrift] = useState('Literaturliste')

  const personen = useMemo(
    () => [...new Set(werke.flatMap((w) => w.personen.map((p) => p.nachname.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'de')),
    [werke],
  )
  const schlagwoerter = useMemo(
    () => [...new Set(werke.flatMap((w) => w.schlagwoerter.map((s) => s.begriff)))].sort((a, b) => a.localeCompare(b, 'de')),
    [werke],
  )

  const auswahl = sortiere(
    werke.filter(
      (w) =>
        (!nurFest || w.status === 'fest') &&
        (!person || w.personen.some((p) => p.nachname.trim() === person)) &&
        (!schlagwort || w.schlagwoerter.some((s) => s.begriff === schlagwort && (!nurPrimaer || s.primaer))),
    ),
    sortierung,
  )
  const zeilen = auswahl.map((w) => druckzeile(w, stil))

  return (
    <div className="liste-ansicht">
      <aside className="liste-optionen">
        <h2>Liste zusammenstellen</h2>
        <label>
          Überschrift
          <input value={ueberschrift} onChange={(e) => setUeberschrift(e.target.value)} />
        </label>
        <fieldset>
          <legend>Auswahl</legend>
          <label>
            Person
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">alle</option>
              {personen.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Schlagwort
            <select value={schlagwort} onChange={(e) => setSchlagwort(e.target.value)}>
              <option value="">alle</option>
              {schlagwoerter.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="haken">
            <input type="checkbox" checked={nurPrimaer} disabled={!schlagwort} onChange={(e) => setNurPrimaer(e.target.checked)} /> nur primäre Bezüge
          </label>
          <label className="haken">
            <input type="checkbox" checked={nurFest} onChange={(e) => setNurFest(e.target.checked)} /> nur fest angelegte Karten
          </label>
        </fieldset>
        <fieldset>
          <legend>Darstellung</legend>
          <label>
            Muster
            <select value={stil.muster} onChange={(e) => setStil({ ...stil, muster: e.target.value as Stil['muster'] })}>
              <option value="ort">Name: Titel. Untertitel, Ort Jahr</option>
              <option value="verlag">Name: Titel. Untertitel. Verlag, Ort Jahr</option>
            </select>
          </label>
          <label>
            Namen
            <select value={stil.namensfolge} onChange={(e) => setStil({ ...stil, namensfolge: e.target.value as Stil['namensfolge'] })}>
              <option value="vorname-name">Vorname Name</option>
              <option value="name-vorname">Name, Vorname</option>
            </select>
          </label>
          <label>
            Zwischen Titel und Untertitel
            <select value={stil.untertitelTrenner} onChange={(e) => setStil({ ...stil, untertitelTrenner: e.target.value as Stil['untertitelTrenner'] })}>
              <option value=". ">Punkt</option>
              <option value=" – ">Gedankenstrich</option>
              <option value=": ">Doppelpunkt</option>
            </select>
          </label>
          <label>
            Auflagen
            <select value={stil.auflagen} onChange={(e) => setStil({ ...stil, auflagen: e.target.value as Stil['auflagen'] })}>
              <option value="erste">nur erste</option>
              <option value="alle">alle</option>
            </select>
          </label>
          <label className="haken">
            <input type="checkbox" checked={stil.seitenzahl} onChange={(e) => setStil({ ...stil, seitenzahl: e.target.checked })} /> Seitenzahl zeigen
          </label>
          <label>
            Sortierung
            <select value={sortierung} onChange={(e) => setSortierung(e.target.value as 'name' | 'jahr')}>
              <option value="name">nach Nachname, dann Jahr</option>
              <option value="jahr">nach Jahr, dann Nachname</option>
            </select>
          </label>
        </fieldset>
        <div className="spalte">
          <button type="button" className="primaer" disabled={zeilen.length === 0} onClick={async () => {
              const { wordDatei } = await import('./word')
              herunterladen(await wordDatei(ueberschrift, zeilen), `${ueberschrift || 'Literaturliste'}.docx`)
            }}>
            Als Word-Datei speichern
          </button>
          <button type="button" disabled={zeilen.length === 0} onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </aside>
      <section className="blatt">
        <h1>{ueberschrift}</h1>
        {zeilen.length === 0 ? (
          <p className="leer">Keine Karten passen zur Auswahl.</p>
        ) : (
          zeilen.map((z, i) => (
            <p key={auswahl[i].id} className="eintrag">
              {z}
            </p>
          ))
        )}
      </section>
    </div>
  )
}
