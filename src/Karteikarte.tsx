import { useMemo, useState } from 'react'
import {
  TEXT_ARTEN,
  leereAuflage,
  leeresErschienenIn,
  type Auflage,
  type ErschienenIn,
  type Person,
  type Verlag,
  type Werk,
} from './model'
import { ortFuerJahr, verlagVorschlaege } from './verlag'
import { druckzeile } from './format'
import type { Fixierung } from './App'

interface Props {
  werk: Werk
  verlage: Verlag[]
  alleSchlagwoerter: string[]
  fixiert: Fixierung
  onAendern: (w: Werk) => void
  onLoeschen: () => void
  onFixieren: (f: Fixierung) => void
  onVerlagMerken: (name: string, ort: string, jahr: string) => void
}

export function Karteikarte({ werk, verlage, alleSchlagwoerter, fixiert, onAendern, onLoeschen, onFixieren, onVerlagMerken }: Props) {
  const setze = (teil: Partial<Werk>) => onAendern({ ...werk, ...teil })
  const istAufsatz = werk.art === 'aufsatz'

  const setzePerson = (i: number, teil: Partial<Person>) =>
    setze({ personen: werk.personen.map((p, j) => (j === i ? { ...p, ...teil } : p)) })
  const setzeAuflage = (i: number, a: Auflage) => setze({ auflagen: werk.auflagen.map((x, j) => (j === i ? a : x)) })
  const setzeEI = (teil: Partial<ErschienenIn>) => setze({ erschienenIn: { ...(werk.erschienenIn ?? leeresErschienenIn()), ...teil } })

  const pin = (aktiv: boolean, an: () => void, aus: () => void, was: string) => (
    <button
      type="button"
      className={`pin ${aktiv ? 'aktiv' : ''}`}
      title={aktiv ? `${was}: Fixierung lösen` : `${was} für alle folgenden Karten fixieren`}
      onClick={aktiv ? aus : an}
    >
      {aktiv ? '📌 fixiert' : '📌'}
    </button>
  )

  return (
    <article className={`karte ${werk.status}`}>
      <header className="karte-kopf">
        <span className={`status ${werk.status}`}>{werk.status === 'fest' ? 'Fest angelegt' : 'Vorläufig'}</span>
        <div className="kopf-aktionen">
          {werk.status === 'vorlaeufig' ? (
            <button type="button" className="primaer" onClick={() => setze({ status: 'fest' })}>
              Fest anlegen
            </button>
          ) : (
            <button type="button" onClick={() => setze({ status: 'vorlaeufig' })}>
              Wieder vorläufig
            </button>
          )}
          <button type="button" className="leise" onClick={onLoeschen}>
            Karte löschen
          </button>
        </div>
      </header>

      <section className="feldgruppe">
        <div className="gruppen-kopf">
          <h3>Art des Textes</h3>
          {pin(fixiert.art !== undefined, () => onFixieren({ ...fixiert, art: werk.art }), () => onFixieren({ ...fixiert, art: undefined }), 'Art')}
        </div>
        <select value={werk.art} onChange={(e) => setze({ art: e.target.value as Werk['art'] })}>
          {TEXT_ARTEN.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </section>

      <section className="feldgruppe">
        <div className="gruppen-kopf">
          <h3>{werk.personen.every((p) => p.rolle === 'hrsg') && werk.personen.length ? 'Herausgeber' : 'Autoren'}</h3>
          {pin(
            fixiert.personen !== undefined,
            () => onFixieren({ ...fixiert, personen: werk.personen }),
            () => onFixieren({ ...fixiert, personen: undefined }),
            'Personen',
          )}
        </div>
        {werk.personen.map((p, i) => (
          <div className="reihe person" key={i}>
            <label>
              Vorname(n)
              <input value={p.vorname} onChange={(e) => setzePerson(i, { vorname: e.target.value })} />
            </label>
            <label>
              Nachname(n)
              <input value={p.nachname} onChange={(e) => setzePerson(i, { nachname: e.target.value })} />
            </label>
            <label className="schmal">
              Rolle
              <select value={p.rolle} onChange={(e) => setzePerson(i, { rolle: e.target.value as Person['rolle'] })}>
                <option value="autor">Autor</option>
                <option value="hrsg">Hrsg.</option>
              </select>
            </label>
            {werk.personen.length > 1 && (
              <button type="button" className="entfernen" title="Person entfernen" onClick={() => setze({ personen: werk.personen.filter((_, j) => j !== i) })}>
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" className="hinzu" onClick={() => setze({ personen: [...werk.personen, { vorname: '', nachname: '', rolle: werk.personen[0]?.rolle ?? 'autor' }] })}>
          + weitere Person
        </button>
      </section>

      <section className="feldgruppe">
        <h3>Titel</h3>
        <label>
          Titel
          <input className="gross" value={werk.titel} onChange={(e) => setze({ titel: e.target.value })} />
        </label>
        <label>
          Untertitel
          <input value={werk.untertitel} onChange={(e) => setze({ untertitel: e.target.value })} />
        </label>
        {!istAufsatz && (
          <div className="reihe">
            <label>
              Schriftenreihe
              <input value={werk.reihe} onChange={(e) => setze({ reihe: e.target.value })} />
            </label>
            <label className="schmal">
              Band
              <input value={werk.reiheBand} maxLength={4} onChange={(e) => setze({ reiheBand: e.target.value })} />
            </label>
          </div>
        )}
      </section>

      {istAufsatz ? (
        <ErschienenInFeld
          wert={werk.erschienenIn ?? leeresErschienenIn()}
          onAendern={setzeEI}
          fixiert={fixiert.erschienenIn !== undefined}
          pin={pin(
            fixiert.erschienenIn !== undefined,
            () => onFixieren({ ...fixiert, erschienenIn: { ...(werk.erschienenIn ?? leeresErschienenIn()), seitenVon: '', seitenBis: '' } }),
            () => onFixieren({ ...fixiert, erschienenIn: undefined }),
            'Erschienen in',
          )}
        />
      ) : (
        <section className="feldgruppe">
          <div className="gruppen-kopf">
            <h3>Auflagen und Ausgaben</h3>
            {pin(
              fixiert.verlag !== undefined,
              () => onFixieren({ ...fixiert, verlag: werk.auflagen[0]?.verlag ?? '' }),
              () => onFixieren({ ...fixiert, verlag: undefined }),
              'Verlag',
            )}
          </div>
          {werk.auflagen.map((a, i) => (
            <AuflageFeld
              key={a.id}
              auflage={a}
              verlage={verlage}
              onAendern={(neu) => setzeAuflage(i, neu)}
              onEntfernen={werk.auflagen.length > 1 ? () => setze({ auflagen: werk.auflagen.filter((_, j) => j !== i) }) : undefined}
              onVerlagMerken={onVerlagMerken}
            />
          ))}
          <button
            type="button"
            className="hinzu"
            onClick={() => {
              const letzte = werk.auflagen[werk.auflagen.length - 1]
              setze({ auflagen: [...werk.auflagen, { ...leereAuflage(), verlag: letzte?.verlag ?? '', ort: letzte?.ort ?? '' }] })
            }}
          >
            + weitere Auflage oder Ausgabe
          </button>
        </section>
      )}

      <section className="feldgruppe">
        <div className="gruppen-kopf">
          <h3>Schlagwörter</h3>
          {pin(
            fixiert.schlagwoerter !== undefined,
            () => onFixieren({ ...fixiert, schlagwoerter: werk.schlagwoerter }),
            () => onFixieren({ ...fixiert, schlagwoerter: undefined }),
            'Schlagwörter',
          )}
        </div>
        <Schlagwoerter werk={werk} alle={alleSchlagwoerter} onAendern={(s) => setze({ schlagwoerter: s })} />
      </section>

      <section className="feldgruppe rueckseite">
        <h3>Kommentar (Rückseite der Karte)</h3>
        <textarea rows={5} value={werk.kommentar} onChange={(e) => setze({ kommentar: e.target.value })} />
      </section>

      <section className="vorschau">
        <h3>So erscheint die Karte in der Liste</h3>
        <p>{druckzeile(werk)}</p>
      </section>
    </article>
  )
}

function AuflageFeld({
  auflage,
  verlage,
  onAendern,
  onEntfernen,
  onVerlagMerken,
}: {
  auflage: Auflage
  verlage: Verlag[]
  onAendern: (a: Auflage) => void
  onEntfernen?: () => void
  onVerlagMerken: (name: string, ort: string, jahr: string) => void
}) {
  const [offen, setOffen] = useState(false)
  const [mehr, setMehr] = useState(Boolean(auflage.gedrucktesJahr || auflage.erscheinungstag || auflage.vermerk))
  const setze = (teil: Partial<Auflage>) => onAendern({ ...auflage, ...teil })
  const vorschlaege = useMemo(() => (offen ? verlagVorschlaege(verlage, auflage.verlag) : []), [offen, verlage, auflage.verlag])
  const bekannt = verlage.find((v) => v.name === auflage.verlag)
  const auskunft = bekannt ? ortFuerJahr(bekannt, auflage.jahr) : null

  const waehle = (v: Verlag) => {
    const a = ortFuerJahr(v, auflage.jahr)
    setze({ verlag: v.name, ort: a?.ort ?? auflage.ort })
    setOffen(false)
  }

  const setzeJahr = (jahr: string) => {
    const a = bekannt ? ortFuerJahr(bekannt, jahr) : null
    setze({ jahr, ort: a && /^\d{4}$/.test(jahr) ? a.ort : auflage.ort })
  }

  return (
    <div className="auflage">
      <div className="reihe">
        <label className="schmal">
          Aufl.
          <input value={auflage.nummer} maxLength={3} inputMode="numeric" onChange={(e) => setze({ nummer: e.target.value })} />
        </label>
        <label className="schmal">
          Jahr
          <input value={auflage.jahr} maxLength={4} inputMode="numeric" onChange={(e) => setzeJahr(e.target.value)} />
        </label>
        <label className="verlag-feld">
          Verlag
          <input
            value={auflage.verlag}
            placeholder="Name oder Kürzel"
            onChange={(e) => {
              setze({ verlag: e.target.value })
              setOffen(true)
            }}
            onFocus={() => setOffen(true)}
            onBlur={() => setTimeout(() => setOffen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && vorschlaege[0]) {
                e.preventDefault()
                waehle(vorschlaege[0])
              }
            }}
          />
          {vorschlaege.length > 0 && (
            <ul className="vorschlaege">
              {vorschlaege.map((v) => (
                <li key={v.id} onMouseDown={() => waehle(v)}>
                  {v.name} {v.kuerzel && <span className="kuerzel">{v.kuerzel}</span>}
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>
          Ort
          <input value={auflage.ort} onChange={(e) => setze({ ort: e.target.value })} />
        </label>
        {onEntfernen && (
          <button type="button" className="entfernen" title="Auflage entfernen" onClick={onEntfernen}>
            ×
          </button>
        )}
      </div>
      {auskunft?.zweiOrteMoeglich && (
        <p className="warnung">
          Achtung: {bekannt?.name} wechselte {auflage.jahr} den Ort. In diesem Jahr ist {auskunft.zweiOrteMoeglich.join(' oder ')} möglich. Bitte im Buch nachsehen.
        </p>
      )}
      {auflage.verlag.trim() && !bekannt && (
        <button type="button" className="hinzu klein" onClick={() => onVerlagMerken(auflage.verlag.trim(), auflage.ort.trim(), auflage.jahr.trim())}>
          „{auflage.verlag.trim()}“ als Verlag merken
        </button>
      )}
      <div className="reihe">
        <label className="schmal">
          Seiten röm.
          <input value={auflage.seitenRoemisch} onChange={(e) => setze({ seitenRoemisch: e.target.value.toUpperCase() })} />
        </label>
        <label className="schmal">
          Seiten
          <input value={auflage.seiten} maxLength={5} inputMode="numeric" onChange={(e) => setze({ seiten: e.target.value })} />
        </label>
        <button type="button" className="leise klein" onClick={() => setMehr(!mehr)}>
          {mehr ? 'weniger' : 'mehr Angaben'}
        </button>
        {auflage.quelle && <span className="quelle">aus Katalog</span>}
      </div>
      {mehr && (
        <div className="reihe">
          <label className="schmal">
            Jahr im Druck
            <input value={auflage.gedrucktesJahr} maxLength={4} title="Im Buch abgedrucktes, abweichendes Jahr" onChange={(e) => setze({ gedrucktesJahr: e.target.value })} />
          </label>
          <label className="mittel">
            Erscheinungstag
            <input type="date" value={auflage.erscheinungstag} onChange={(e) => setze({ erscheinungstag: e.target.value })} />
          </label>
          <label>
            Vermerk
            <input value={auflage.vermerk} placeholder="z. B. 20.–25. Tsd., Taschenbuchausgabe" onChange={(e) => setze({ vermerk: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  )
}

function ErschienenInFeld({ wert, onAendern, pin }: { wert: ErschienenIn; onAendern: (t: Partial<ErschienenIn>) => void; fixiert: boolean; pin: React.ReactNode }) {
  return (
    <section className="feldgruppe">
      <div className="gruppen-kopf">
        <h3>Erschienen in</h3>
        {pin}
      </div>
      <div className="reihe">
        <label className="mittel">
          Art
          <select value={wert.art} onChange={(e) => onAendern({ art: e.target.value as ErschienenIn['art'] })}>
            <option value="zeitschrift">Zeitschrift</option>
            <option value="zeitung">Zeitung</option>
            <option value="sammelband">Sammelband</option>
          </select>
        </label>
        <label>
          Titel
          <input value={wert.titel} onChange={(e) => onAendern({ titel: e.target.value })} />
        </label>
      </div>
      <div className="reihe">
        {wert.art !== 'sammelband' && (
          <>
            <label className="schmal">
              Jahrgang
              <input value={wert.jahrgang} onChange={(e) => onAendern({ jahrgang: e.target.value })} />
            </label>
            <label className="schmal">
              Jahr
              <input value={wert.jahr} maxLength={9} onChange={(e) => onAendern({ jahr: e.target.value })} />
            </label>
            <label className="schmal">
              Heft / Nr.
              <input value={wert.heft} onChange={(e) => onAendern({ heft: e.target.value })} />
            </label>
          </>
        )}
        <label className="schmal">
          Seite von
          <input value={wert.seitenVon} onChange={(e) => onAendern({ seitenVon: e.target.value })} />
        </label>
        <label className="schmal">
          bis
          <input value={wert.seitenBis} onChange={(e) => onAendern({ seitenBis: e.target.value })} />
        </label>
      </div>
      <p className="hinweis">Die ausführliche Zeitschriftenkarte mit Heftraster und Titelgeschichte folgt in einem späteren Schritt.</p>
    </section>
  )
}

function Schlagwoerter({ werk, alle, onAendern }: { werk: Werk; alle: string[]; onAendern: (s: Werk['schlagwoerter']) => void }) {
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
  return (
    <div>
      <div className="schlagwoerter">
        {werk.schlagwoerter.map((s, i) => (
          <span key={s.begriff} className={`chip ${s.primaer ? 'primaer' : ''}`}>
            <button
              type="button"
              title={s.primaer ? 'primär (klicken für sekundär)' : 'sekundär (klicken für primär)'}
              onClick={() => onAendern(werk.schlagwoerter.map((x, j) => (j === i ? { ...x, primaer: !x.primaer } : x)))}
            >
              {s.primaer ? '★' : '☆'}
            </button>
            {s.begriff}
            <button type="button" title="entfernen" onClick={() => onAendern(werk.schlagwoerter.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="schlagwort-eingabe">
        <input
          value={eingabe}
          placeholder="Schlagwort tippen, Enter übernimmt"
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              fuegeHinzu(vorschlaege[0] ?? eingabe)
            }
          }}
        />
        {vorschlaege.length > 0 && (
          <ul className="vorschlaege">
            {vorschlaege.map((b) => (
              <li key={b} onMouseDown={() => fuegeHinzu(b)}>
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="hinweis">★ primärer Bezug, ☆ sekundärer Bezug.</p>
    </div>
  )
}
