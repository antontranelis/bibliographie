import { useEffect, useMemo, useRef, useState } from 'react'
import { istIsbn, vorauswahl, type Treffer, type WerkVorschlag } from './lobid'
import { sucheImKatalog } from './katalog'
import { alleAuflagen, type Werk } from './model'
import { Bibliothek, Kasten } from './Symbole'

// Katalogsuche als Autovervollständigung in der Karte:
// zuerst die eigene Kartei, dann Werke aus dem Bibliothekskatalog.

export type KatalogStand =
  | { zustand: 'ruhe' }
  | { zustand: 'laedt' }
  | { zustand: 'fertig'; werke: WerkVorschlag[] }
  | { zustand: 'fehler'; nochmal: () => void }

/** Fragt den Katalog erst nach einer kurzen Tipppause, nie bei jedem Zeichen. */
export function useKatalog(autor: string, titel: string, aktiv: boolean, pauseMs = 500): KatalogStand {
  const [stand, setStand] = useState<KatalogStand>({ zustand: 'ruhe' })
  // Wiederholung nach „nicht erreichbar“: startet genau diese Suche ohne Tipppause neu
  const [versuch, setVersuch] = useState(0)
  const sofort = useRef(false)
  useEffect(() => {
    if (!aktiv || titel.trim().length < 3) {
      setStand({ zustand: 'ruhe' })
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setStand({ zustand: 'laedt' })
      try {
        setStand({ zustand: 'fertig', werke: await sucheImKatalog(autor, titel, ctrl.signal) })
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        const nochmal = () => {
          sofort.current = true
          setVersuch((v) => v + 1)
        }
        setStand({ zustand: 'fehler', nochmal })
      }
    }, sofort.current ? 0 : pauseMs)
    sofort.current = false
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [autor, titel, aktiv, pauseMs, versuch])
  return stand
}

/** Kataloge markieren nicht mitsortierte Artikel mit ¬: „¬Die¬ Philosophie“ */
export const ohneNichtsortier = (s: string) => s.replace(/¬/g, '').replace(/\s{2,}/g, ' ').trim()

const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Werke der eigenen Kartei, die zu Autor und Titel passen. */
export function karteiTreffer(werke: Werk[], selbst: string, autor: string, titel: string, hoechstens = 4): Werk[] {
  const isbn = istIsbn(titel)
  if (isbn) return werke.filter((w) => w.id !== selbst && alleAuflagen(w).some((a) => istIsbn(a.isbn) === isbn)).slice(0, hoechstens)
  const woerter = normal(titel).split(' ').filter(Boolean)
  if (woerter.join('').length < 2) return []
  const a = normal(autor)
  const treffer: Werk[] = []
  for (const w of werke) {
    if (w.id === selbst) continue
    const text = normal(`${w.titel} ${w.untertitel}`)
    if (!woerter.every((x) => text.includes(x))) continue
    if (a && !w.personen.some((p) => normal(p.nachname).startsWith(a))) continue
    treffer.push(w)
    if (treffer.length >= hoechstens) break
  }
  return treffer
}

/** Der Katalogvorschlag, der am besten zum Titel einer Karte passt. */
export function besterVorschlag(werke: WerkVorschlag[], titel: string): WerkVorschlag | null {
  const t = normal(ohneNichtsortier(titel))
  return werke.find((w) => normal(ohneNichtsortier(w.titel)) === t) ?? werke[0] ?? null
}

export type Option = { art: 'eigen'; werk: Werk } | { art: 'katalog'; vorschlag: WerkVorschlag }

export function optionenAus(eigene: Werk[], katalog: KatalogStand): Option[] {
  const k = katalog.zustand === 'fertig' ? katalog.werke.slice(0, 6) : []
  return [...eigene.map((werk): Option => ({ art: 'eigen', werk })), ...k.map((vorschlag): Option => ({ art: 'katalog', vorschlag }))]
}

export const namenListe = (personen: { vorname: string; nachname: string }[]) =>
  personen
    .map((p) => [p.nachname, p.vorname].filter(Boolean).join(', '))
    .filter(Boolean)
    .join(' / ')

export function jahrspanne(jahre: string[]): string {
  const j = jahre.map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x))
  if (j.length === 0) return ''
  const min = Math.min(...j)
  const max = Math.max(...j)
  return min === max ? String(min) : `${min}–${max}`
}

export function Vorschlagsliste({
  id,
  optionen,
  katalog,
  markiert,
  onWaehlen,
}: {
  id: string
  optionen: Option[]
  katalog: KatalogStand
  markiert: number
  onWaehlen: (o: Option) => void
}) {
  const anzahlEigene = optionen.filter((o) => o.art === 'eigen').length
  const anzahlKatalog = optionen.length - anzahlEigene

  const zeile = (o: Option, i: number) => {
    const gewaehlt = i === markiert
    const gemeinsam = {
      id: `${id}-${i}`,
      role: 'option',
      'aria-selected': gewaehlt,
      className: `vorschlag ${gewaehlt ? 'markiert' : ''}`,
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onClick: () => onWaehlen(o),
    }
    if (o.art === 'eigen') {
      const w = o.werk
      const jahre = alleAuflagen(w).map((a) => a.jahr).filter(Boolean)
      const zusatz = [
        w.untertitel,
        jahre.length ? `${jahre.length} ${jahre.length === 1 ? 'Auflage' : 'Auflagen'}, ${jahrspanne(jahre)}` : '',
        w.status === 'fest' ? 'fest angelegt' : 'vorläufig',
      ]
      return (
        <li key={w.id} {...gemeinsam}>
          <span className="vorschlag-text">
            <span className="vorschlag-titel">
              {namenListe(w.personen) && <>{namenListe(w.personen)}: </>}
              <b>{w.titel || 'ohne Titel'}</b>
            </span>
            <span className="vorschlag-zusatz">{zusatz.filter(Boolean).join(' · ')}</span>
          </span>
          <span className="marke-vorhanden">schon vorhanden</span>
          <span className="vorschlag-sprung">Zur Karte</span>
        </li>
      )
    }
    const v = o.vorschlag
    return (
      <li key={v.schluessel} {...gemeinsam}>
        <span className="vorschlag-text">
          <span className="vorschlag-titel">
            {namenListe(v.personen) && <>{namenListe(v.personen)}: </>}
            <b>{ohneNichtsortier(v.titel)}</b>
          </span>
          {v.untertitel && <span className="vorschlag-zusatz">{ohneNichtsortier(v.untertitel)}</span>}
        </span>
        <span className="vorschlag-anzahl">
          {v.treffer.length} {v.treffer.length === 1 ? 'Ausgabe' : 'Ausgaben'}
          <span>{jahrspanne(v.treffer.map((t) => t.auflage.jahr))}</span>
        </span>
      </li>
    )
  }

  return (
    <div className="vorschlaege-menue">
      <ul role="listbox" id={id} aria-label="Vorschläge">
        {anzahlEigene > 0 && (
          <li role="presentation" className="vorschlag-gruppe">
            <Kasten /> In Ihrer Kartei
          </li>
        )}
        {optionen.slice(0, anzahlEigene).map((o, i) => zeile(o, i))}
        <li role="presentation" className="vorschlag-gruppe">
          <Bibliothek /> Aus dem Bibliothekskatalog
          <span className="rechts">
            {katalog.zustand === 'laedt' && 'wird gefragt …'}
            {katalog.zustand === 'fertig' && anzahlKatalog === 0 && 'nichts gefunden'}
            {katalog.zustand === 'fehler' && (
              <>
                nicht erreichbar, nur die eigene Kartei ·{' '}
                <button type="button" className="textknopf" onMouseDown={(e) => e.preventDefault()} onClick={katalog.nochmal}>
                  Noch einmal versuchen
                </button>
              </>
            )}
            {katalog.zustand === 'ruhe' && 'nach einer kurzen Tipppause'}
            {katalog.zustand === 'fertig' && anzahlKatalog > 0 && 'Werke, je mit Zahl der Ausgaben'}
          </span>
        </li>
        {optionen.slice(anzahlEigene).map((o, i) => zeile(o, anzahlEigene + i))}
      </ul>
      <div className="vorschlag-fuss">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> wählen
        </span>
        <span>
          <kbd>↵</kbd> übernehmen
        </span>
        <span>
          <kbd>Esc</kbd> schließen
        </span>
        <span className="rechts">Nichts passt? Einfach weiterschreiben.</span>
      </div>
    </div>
  )
}

/** Gefundene Ausgaben eines Werks zum Abhaken. Je Jahr ist eine vorausgewählt. */
export function AusgabenWahl({
  vorschlag,
  vorhandeneJahre,
  onUebernehmen,
  onVerwerfen,
}: {
  vorschlag: WerkVorschlag
  vorhandeneJahre: Set<string>
  onUebernehmen: (auswahl: Treffer[]) => void
  onVerwerfen: () => void
}) {
  const treffer = vorschlag.treffer
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(() => {
    const v = vorauswahl(treffer)
    return new Set([...v].filter((i) => !vorhandeneJahre.has(treffer[i].auflage.jahr)))
  })
  const [alle, setAlle] = useState(treffer.length <= 8)
  const sichtbar = alle ? treffer : treffer.slice(0, 6)
  const auswahl = useMemo(() => treffer.filter((_, i) => gewaehlt.has(i)), [treffer, gewaehlt])
  const umschalten = (i: number) => {
    const neu = new Set(gewaehlt)
    if (neu.has(i)) neu.delete(i)
    else neu.add(i)
    setGewaehlt(neu)
  }
  const umfang = (a: Treffer['auflage']) => {
    const s = [a.seitenRoemisch, a.seiten].filter(Boolean).join(' + ')
    return s ? `${s} S.` : '–'
  }

  return (
    <section className="ausgaben-wahl" aria-label="Gefundene Ausgaben">
      <div className="ausgaben-kopf">
        <h3>
          Im Katalog gefunden: {treffer.length} {treffer.length === 1 ? 'Ausgabe' : 'Ausgaben'}
        </h3>
        <span>
          Je Jahr ist eine vorausgewählt{vorhandeneJahre.size > 0 ? ', außer Jahren, die schon auf der Karte stehen' : ''}. Abhaken, was auf die
          Karte soll.
        </span>
      </div>
      <div className="tabelle-rahmen">
        <table className="tabelle ausgaben">
          <thead>
            <tr>
              <th>
                <span className="unsichtbar">Übernehmen</span>
              </th>
              <th>Jahr</th>
              <th>Aufl.</th>
              <th>Verlag</th>
              <th>Ort</th>
              <th>Umfang</th>
            </tr>
          </thead>
          <tbody>
            {sichtbar.map((t, i) => {
              const a = t.auflage
              const wiederholt = i > 0 && a.jahr !== '' && treffer[i - 1].auflage.jahr === a.jahr
              return (
                <tr key={a.id} className={gewaehlt.has(i) ? '' : 'abgewaehlt'} onClick={() => umschalten(i)}>
                  <td>
                    <input
                      type="checkbox"
                      checked={gewaehlt.has(i)}
                      aria-label={`Ausgabe ${a.jahr || 'ohne Jahr'} übernehmen`}
                      onChange={() => umschalten(i)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    {wiederholt ? <span className="leise" title={a.jahr}>″</span> : a.jahr || '–'}
                    {!wiederholt && vorhandeneJahre.has(a.jahr) && <span className="schon">auf der Karte</span>}
                  </td>
                  <td>{a.nummer ? `${a.nummer}.` : a.vermerk ? <span className="leise">{a.vermerk}</span> : '–'}</td>
                  <td>{a.verlag || '–'}</td>
                  <td>{a.ort || '–'}</td>
                  <td>{umfang(a)}</td>
                </tr>
              )
            })}
            {!alle && (
              <tr>
                <td colSpan={6}>
                  <button type="button" className="textknopf" onClick={() => setAlle(true)}>
                    {treffer.length - sichtbar.length} weitere Ausgaben zeigen
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="ausgaben-fuss">
        <button type="button" className="knopf haupt" disabled={auswahl.length === 0} onClick={() => onUebernehmen(auswahl)}>
          {auswahl.length === 1 ? '1 als Auflage übernehmen' : `${auswahl.length} als Auflagen übernehmen`}
        </button>
        <button type="button" className="knopf" onClick={onVerwerfen}>
          Keine übernehmen
        </button>
        <span className="rechts leise">Quellen: Deutsche Nationalbibliothek, hbz-Verbundkatalog</span>
      </div>
    </section>
  )
}
