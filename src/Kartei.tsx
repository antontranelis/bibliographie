import { Fragment, useMemo, useRef, useState } from 'react'
import { TEXT_ARTEN, alleAuflagen, personSchluessel, type Thema, type Werk } from './model'
import { baum, pfad } from './themen'
import { ausgabeBezeichnung } from './format'
import { jahrspanne, namenListe } from './Katalogsuche'
import { StatusMarke } from './Karteikarte'
import { Lupe, StatusPunkt } from './Symbole'

export type Register = 'autor' | 'titel' | 'schlagwort' | 'thema'

export interface KarteiSicht {
  suche: string
  register: Register
  nurVorlaeufig: boolean
  /** Nur Karten mit Originalzeile aus einer eingelesenen Liste */
  nurVorlage: boolean
  buchstabe: string | null
  gewaehlt: string | null
}

export const LEERE_SICHT: KarteiSicht = { suche: '', register: 'autor', nurVorlaeufig: false, nurVorlage: false, buchstabe: null, gewaehlt: null }

export interface ListenVorgabe {
  person?: string
  schlagwort?: string
  thema?: string
}

interface Gruppe {
  schluessel: string
  titel: string
  buchstabe: string
  werke: Werk[]
  liste?: ListenVorgabe
  /** Stelle in der Themenordnung; sonst alphabetisch */
  reihenfolge?: number
}

/** Höchstzahl gleichzeitig gezeigter Karten; darüber hilft Register oder Suche. */
const GRENZE = 300
const BUCHSTABEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const artLabel = (a: Werk['art']) => TEXT_ARTEN.find((x) => x.value === a)?.label ?? a

function anfangsbuchstabe(s: string): string {
  const c = s
    .trim()
    .charAt(0)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return BUCHSTABEN.includes(c) ? c : '#'
}

const ohneArtikel = (t: string) => t.trim().replace(/^(der|die|das|ein|eine|the|a|an)\s+/i, '')
const vgl = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' })

function jahreVon(w: Werk): string[] {
  if (w.art === 'aufsatz') return w.erschienenIn?.jahr ? [w.erschienenIn.jahr] : []
  return alleAuflagen(w).map((a) => a.jahr).filter(Boolean)
}
const ersteJahr = (w: Werk) => Math.min(9999, ...jahreVon(w).map((j) => parseInt(j, 10)).filter((j) => !Number.isNaN(j)))

function bildeGruppen(werke: Werk[], register: Register, themen: Thema[]): Gruppe[] {
  const gruppen = new Map<string, Gruppe>()
  const hinein = (schluessel: string, titel: string, buchstabe: string, w: Werk, liste?: ListenVorgabe, reihenfolge?: number) => {
    const g = gruppen.get(schluessel)
    if (g) g.werke.push(w)
    else gruppen.set(schluessel, { schluessel, titel, buchstabe, werke: [w], liste, reihenfolge })
  }
  const stelle = new Map(baum(themen).map((k, i) => [k.thema.id, i]))
  for (const w of werke) {
    if (register === 'thema') {
      const eigene = w.themen.filter((t) => stelle.has(t))
      if (eigene.length === 0) hinein('~ohne', 'Ohne Thema', '#', w, undefined, Infinity)
      for (const id of eigene) {
        const t = themen.find((x) => x.id === id)!
        hinein(`t:${id}`, pfad(themen, id), anfangsbuchstabe(t.titel), w, { thema: id }, stelle.get(id))
      }
      continue
    }
    if (register === 'autor') {
      const personen = w.personen.filter((p) => p.nachname.trim() || p.vorname.trim())
      if (personen.length === 0) hinein('~ohne', 'Ohne Person', '#', w)
      for (const p of personen) {
        const name = [p.nachname.trim(), p.vorname.trim()].filter(Boolean).join(', ')
        hinein(`p:${personSchluessel(p).toLowerCase()}`, name, anfangsbuchstabe(name), w, { person: personSchluessel(p) })
      }
    } else if (register === 'titel') {
      const b = anfangsbuchstabe(ohneArtikel(w.titel))
      hinein(b, b === '#' ? 'Ohne Titel oder Ziffer' : b, b, w)
    } else {
      if (w.schlagwoerter.length === 0) hinein('~ohne', 'Ohne Schlagwort', '#', w)
      for (const s of w.schlagwoerter) hinein(`s:${s.begriff.toLowerCase()}`, s.begriff, anfangsbuchstabe(s.begriff), w, { schlagwort: s.begriff })
    }
  }
  const liste = [...gruppen.values()]
  for (const g of liste) {
    g.werke.sort((a, b) => (register === 'titel' ? vgl(ohneArtikel(a.titel), ohneArtikel(b.titel)) : ersteJahr(a) - ersteJahr(b) || vgl(a.titel, b.titel)))
  }
  if (register === 'thema') return liste.sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))
  return liste.sort((a, b) => (a.buchstabe === '#' ? 1 : 0) - (b.buchstabe === '#' ? 1 : 0) || vgl(a.titel, b.titel))
}

interface Props {
  werke: Werk[]
  themen: Thema[]
  sicht: KarteiSicht
  onSicht: (s: KarteiSicht) => void
  onBearbeiten: (id: string, nachholen?: boolean) => void
  onListe: (v: ListenVorgabe) => void
  onBeispiele: () => void
  onNeueKarte: () => void
}

export function Kartei({ werke, themen, sicht, onSicht, onBearbeiten, onListe, onBeispiele, onNeueKarte }: Props) {
  const setze = (teil: Partial<KarteiSicht>) => onSicht({ ...sicht, ...teil })
  const kasten = useRef<HTMLDivElement>(null)

  const mitVorlage = useMemo(() => werke.some((w) => w.vorlage), [werke])
  const passend = useMemo(() => {
    const s = sicht.suche.trim().toLowerCase()
    return werke.filter(
      (w) =>
        (!sicht.nurVorlaeufig || w.status === 'vorlaeufig') &&
        (!sicht.nurVorlage || Boolean(w.vorlage)) &&
        (!s ||
          [
            w.titel,
            w.untertitel,
            w.kommentar,
            w.erschienenIn?.titel ?? '',
            ...w.personen.map((p) => `${p.vorname} ${p.nachname}`),
            ...w.schlagwoerter.map((x) => x.begriff),
            ...w.themen.map((id) => pfad(themen, id)),
            ...alleAuflagen(w).map((a) => `${a.verlag} ${a.ort} ${a.jahr}`),
          ]
            .join(' ')
            .toLowerCase()
            .includes(s)),
    )
  }, [werke, themen, sicht.suche, sicht.nurVorlaeufig, sicht.nurVorlage])

  const gruppen = useMemo(() => bildeGruppen(passend, sicht.register, themen), [passend, sicht.register, themen])
  const vorhandeneBuchstaben = useMemo(() => new Set(gruppen.map((g) => g.buchstabe)), [gruppen])
  const imBuchstaben = sicht.buchstabe && vorhandeneBuchstaben.has(sicht.buchstabe) ? gruppen.filter((g) => g.buchstabe === sicht.buchstabe) : gruppen

  const gezeigt: Gruppe[] = []
  let rest = GRENZE
  let insgesamt = 0
  for (const g of imBuchstaben) {
    insgesamt += g.werke.length
    if (rest <= 0) continue
    gezeigt.push({ ...g, werke: g.werke.slice(0, rest) })
    rest -= g.werke.length
  }
  const ausgelassen = insgesamt - gezeigt.reduce((n, g) => n + g.werke.length, 0)
  const gewaehlt = werke.find((w) => w.id === sicht.gewaehlt) ?? null

  const tasten = (e: React.KeyboardEvent) => {
    const ziel = e.target as HTMLElement
    if (!ziel.dataset.karte) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const alle = [...(kasten.current?.querySelectorAll<HTMLElement>('[data-karte]') ?? [])]
      const i = alle.indexOf(ziel)
      const naechste = alle[e.key === 'ArrowDown' ? i + 1 : i - 1]
      if (naechste) {
        naechste.focus()
        setze({ gewaehlt: naechste.dataset.karte ?? null })
      }
    } else if (e.key === 'Enter' && ziel.dataset.karte === sicht.gewaehlt) {
      e.preventDefault()
      onBearbeiten(ziel.dataset.karte)
    }
  }

  if (werke.length === 0) {
    return (
      <div className="leer-kartei papier">
        <h2>Die Kartei ist noch leer.</h2>
        <p>Neue Karten entstehen unter „Erfassen“. Zum Ausprobieren gibt es ein paar Beispielkarten.</p>
        <div className="knopfreihe">
          <button type="button" className="knopf haupt" onClick={onNeueKarte}>
            Erste Karte anlegen
          </button>
          <button type="button" className="knopf" onClick={onBeispiele}>
            Beispielkarten laden
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="kartei">
      <section className="kartei-haupt" aria-label="Karteikasten">
        <div className="kartei-suche">
          <label className="suchfeld">
            <Lupe />
            <span className="unsichtbar">In der Kartei suchen</span>
            <input
              autoFocus
              placeholder="In der Kartei suchen: Autor, Titel, Schlagwort, Verlag …"
              value={sicht.suche}
              onChange={(e) => setze({ suche: e.target.value, buchstabe: null })}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  const erste = kasten.current?.querySelector<HTMLElement>('[data-karte]')
                  erste?.focus()
                  setze({ gewaehlt: erste?.dataset.karte ?? null })
                }
                if (e.key === 'Escape') setze({ suche: '' })
              }}
            />
          </label>
          <div className="segment" role="radiogroup" aria-label="Register">
            {(['autor', 'titel', 'schlagwort', ...(themen.length ? (['thema'] as const) : [])] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={sicht.register === r} onClick={() => setze({ register: r, buchstabe: null })}>
                nach {r === 'autor' ? 'Autor' : r === 'titel' ? 'Titel' : r === 'schlagwort' ? 'Schlagwort' : 'Thema'}
              </button>
            ))}
          </div>
        </div>

        <div className="kartei-filter">
          <span>
            {passend.length} {passend.length === 1 ? 'Karte' : 'Karten'}
            {sicht.buchstabe && vorhandeneBuchstaben.has(sicht.buchstabe) && <> · Register {sicht.buchstabe}</>}
          </span>
          <label className="pille">
            <input type="checkbox" checked={sicht.nurVorlaeufig} onChange={(e) => setze({ nurVorlaeufig: e.target.checked })} /> nur vorläufige
          </label>
          {(sicht.nurVorlage || mitVorlage) && (
            <label className="pille">
              <input type="checkbox" checked={sicht.nurVorlage} onChange={(e) => setze({ nurVorlage: e.target.checked })} /> nur mit Vorlage aus dem Import
            </label>
          )}
        </div>

        <div className="kasten-mit-register">
          <nav className="register" aria-label="Register A bis Z">
            <button type="button" aria-pressed={!sicht.buchstabe} onClick={() => setze({ buchstabe: null })}>
              alle
            </button>
            {[...BUCHSTABEN, '#'].map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={sicht.buchstabe === b}
                disabled={!vorhandeneBuchstaben.has(b)}
                aria-label={b === '#' ? 'Ohne Buchstaben' : `Register ${b}`}
                onClick={() => setze({ buchstabe: b })}
              >
                {b}
              </button>
            ))}
          </nav>

          <div className="kasten" ref={kasten} onKeyDown={tasten}>
            {gezeigt.length === 0 && <p className="leise">Keine Karte passt zur Suche.</p>}
            {gezeigt.map((g) => (
              <div key={g.schluessel} className="kasten-gruppe">
                <div className="gruppe-kopf">
                  <h2>{g.titel}</h2>
                  <span className="leise">
                    {g.werke.length} {g.werke.length === 1 ? 'Karte' : 'Karten'}
                  </span>
                  {g.liste && (
                    <button type="button" className="textknopf rechts" onClick={() => onListe(g.liste!)}>
                      Liste daraus
                    </button>
                  )}
                </div>
                {g.werke.map((w) => {
                  const jahre = jahreVon(w)
                  const zeile = [
                    sicht.register !== 'autor' ? namenListe(w.personen) : '',
                    w.art === 'aufsatz' && w.erschienenIn?.titel ? `Aufsatz in: ${w.erschienenIn.titel}` : artLabel(w.art),
                    w.schlagwoerter.map((s) => s.begriff).join(', '),
                  ].filter(Boolean)
                  return (
                    <button
                      key={w.id}
                      type="button"
                      data-karte={w.id}
                      className={`kartei-karte ${w.id === sicht.gewaehlt ? 'gewaehlt' : ''}`}
                      aria-current={w.id === sicht.gewaehlt ? 'true' : undefined}
                      onClick={() => setze({ gewaehlt: w.id })}
                      onDoubleClick={() => onBearbeiten(w.id)}
                    >
                      <StatusPunkt status={w.status} />
                      <span className="kk-titel">{w.titel || 'ohne Titel'}</span>
                      <span className="kk-jahr">
                        {jahrspanne(jahre)}
                        {w.art !== 'aufsatz' && jahre.length > 1 && ` · ${jahre.length} Aufl.`}
                      </span>
                      <span className={`kk-zeile ${w.status === 'vorlaeufig' ? 'vorlaeufig' : ''}`}>
                        {w.status === 'vorlaeufig' && 'vorläufig · '}
                        {zeile.join(' · ')}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            {ausgelassen > 0 && (
              <p className="hinweis">
                {ausgelassen} weitere Karten sind nicht gezeigt. Ein Registerbuchstabe oder ein Suchwort grenzt ein.
              </p>
            )}
          </div>
        </div>
        <p className="tastenhilfe">
          <kbd>↑</kbd> <kbd>↓</kbd> blättern · <kbd>↵</kbd> Karte bearbeiten · Doppelklick öffnet ebenfalls
        </p>
      </section>

      <aside className="kartei-seite" aria-label="Geöffnete Karte">
        {gewaehlt ? (
          <KarteLesen key={gewaehlt.id} werk={gewaehlt} themen={themen} onBearbeiten={onBearbeiten} />
        ) : (
          <div className="platzhalter">Eine Karte anklicken, dann steht sie hier.</div>
        )}
      </aside>
    </div>
  )
}

function KarteLesen({ werk, themen, onBearbeiten }: { werk: Werk; themen: Thema[]; onBearbeiten: (id: string, nachholen?: boolean) => void }) {
  const [seite, setSeite] = useState<'vorne' | 'hinten'>('vorne')
  const [alleZeigen, setAlleZeigen] = useState(false)
  // Weitere Ausgaben bekommen eine Kopfzeile, die erste nur, wenn es mehrere gibt
  const ausgaben = werk.ausgaben
    .map((x) => ({ ausgabe: x, auflagen: x.auflagen.filter((a) => a.jahr || a.verlag || a.ort) }))
    .filter((x) => x.auflagen.length > 0)
  const auflagen = ausgaben.flatMap((x) => x.auflagen)
  const gezeigt = alleZeigen ? auflagen : auflagen.slice(0, 4)
  const kopfVor = new Map(
    ausgaben
      .filter((_, i) => i > 0 || ausgaben.length > 1)
      .map((x) => [x.auflagen[0].id, [ausgabeBezeichnung(x.ausgabe) || 'Erstausgabe', x.ausgabe.titel].filter(Boolean).join(': ')]),
  )
  const personen = werk.personen.map((p) => [p.vorname, p.nachname].filter(Boolean).join(' ')).filter(Boolean)
  const hrsg = werk.personen.length > 0 && werk.personen.every((p) => p.rolle === 'hrsg')
  const ei = werk.erschienenIn
  const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE')

  return (
    <>
      <div role="tablist" aria-label="Seite der Karte" className="kartenreiter">
        <button type="button" role="tab" aria-selected={seite === 'vorne'} onClick={() => setSeite('vorne')}>
          Vorderseite
        </button>
        <button type="button" role="tab" aria-selected={seite === 'hinten'} onClick={() => setSeite('hinten')}>
          Rückseite{werk.kommentar.trim() ? ' · Notiz' : ''}
        </button>
      </div>
      <article className="papier karte-lesen">
        <header className="karte-kopf">
          <span className="karte-name">{artLabel(werk.art)}</span>
          <StatusMarke status={werk.status} />
        </header>
        {seite === 'vorne' ? (
          <div className="lesen-inhalt">
            {personen.length > 0 && (
              <div className="lesen-personen">
                {personen.join(' / ')}
                {hrsg && ' (Hrsg.)'}
              </div>
            )}
            <h3 className="lesen-titel">{werk.titel || 'ohne Titel'}</h3>
            {werk.untertitel && <p className="lesen-untertitel">{werk.untertitel}</p>}
            {werk.reihe && (
              <div className="leise klein">
                {werk.reihe}
                {werk.reiheBand && `, Bd. ${werk.reiheBand}`}
              </div>
            )}
            {werk.art === 'aufsatz' ? (
              ei?.titel && (
                <p className="lesen-ei">
                  in: <i>{ei.titel}</i>
                  {[ei.jahrgang && `${ei.jahrgang}. Jg.`, ei.jahr, ei.heft && `Nr. ${ei.heft}`, ei.seitenVon && `S. ${[ei.seitenVon, ei.seitenBis].filter(Boolean).join('–')}`]
                    .filter(Boolean)
                    .map((x) => `, ${x}`)
                    .join('')}
                </p>
              )
            ) : auflagen.length > 0 ? (
              <table className="lesen-auflagen">
                <caption>
                  <span className="lab">Auflagen · {auflagen.length}</span>
                </caption>
                <tbody>
                  {gezeigt.map((a) => (
                    <Fragment key={a.id}>
                      {kopfVor.has(a.id) && (
                        <tr className="lesen-ausgabe">
                          <td colSpan={3}>{kopfVor.get(a.id)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="sp-nr">
                          {a.nummer ? `${a.nummer}.` : '–'}
                          {a.bearbeitung && <span className="leise klein"> {a.bearbeitung}</span>}
                        </td>
                        <td className="sp-jahr">
                          {a.jahr}
                          {a.gedrucktesJahr && a.gedrucktesJahr !== a.jahr && <span className="leise klein"> ({a.gedrucktesJahr})</span>}
                        </td>
                        <td>
                          {[a.verlag, a.ort].filter(Boolean).join(', ')}
                          {a.vermerk && <span className="leise klein"> {a.vermerk}</span>}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  {auflagen.length > 4 && !alleZeigen && (
                    <tr>
                      <td colSpan={3}>
                        <button type="button" className="textknopf" onClick={() => setAlleZeigen(true)}>
                          alle {auflagen.length} Auflagen
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <p className="leise">Noch keine Auflage eingetragen.</p>
            )}
            {werk.themen.some((id) => themen.some((t) => t.id === id)) && (
              <ul className="lesen-themen" aria-label="Themen">
                {werk.themen
                  .filter((id) => themen.some((t) => t.id === id))
                  .map((id) => (
                    <li key={id}>{pfad(themen, id)}</li>
                  ))}
              </ul>
            )}
            {werk.schlagwoerter.length > 0 && (
              <div className="schlagwoerter">
                {werk.schlagwoerter.map((s) => (
                  <span key={s.begriff} className="chip lesen">
                    {s.begriff}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="lesen-inhalt rueckseite-lesen">{werk.kommentar.trim() || <span className="leise">Keine Notiz.</span>}</div>
        )}
        <footer className="karte-fuss">
          <button type="button" className="knopf haupt" onClick={() => onBearbeiten(werk.id)}>
            Bearbeiten <kbd>↵</kbd>
          </button>
          {werk.art !== 'aufsatz' && werk.titel.trim() && (
            <button type="button" className="knopf" onClick={() => onBearbeiten(werk.id, true)}>
              Auflagen aus dem Katalog holen
            </button>
          )}
        </footer>
      </article>
      <p className="leise klein datumzeile">
        Angelegt {datum(werk.angelegt)} · zuletzt geändert {datum(werk.geaendert)}
      </p>
    </>
  )
}
