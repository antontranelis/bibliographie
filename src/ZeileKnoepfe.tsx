import { useState } from 'react'
import { kopiereZeile } from './Druckzeile'
import type { Teil } from './format'
import { passtZurRegel } from './listen'
import type { Literaturliste, Werk } from './model'

/** Unter der Druckzeile einer Karte: Zeile kopieren und die Karte in eine gespeicherte Liste aufnehmen. */
export function ZeileKnoepfe({ werk, teile, listen, onInListe }: { werk: Werk; teile: Teil[]; listen: Literaturliste[]; onInListe: (listeId: string) => void }) {
  const [kopiert, setKopiert] = useState(false)
  const drin = (l: Literaturliste) =>
    !l.ausgenommen.includes(werk.id) && (l.eintraege.some((e) => e.werkId === werk.id) || (l.regel !== null && passtZurRegel(werk, l.regel)))
  return (
    <div className="knopfreihe zeile-knoepfe">
      <button
        type="button"
        className="klein-knopf"
        disabled={!werk.titel.trim()}
        onClick={async () => {
          await kopiereZeile(teile)
          setKopiert(true)
          setTimeout(() => setKopiert(false), 2000)
        }}
      >
        {kopiert ? 'Zeile kopiert' : 'Zeile kopieren'}
      </button>
      {listen.length > 0 && (
        <select
          className="klein-wahl"
          aria-label="In Liste aufnehmen"
          value=""
          disabled={!werk.titel.trim()}
          onChange={(e) => {
            if (e.target.value) onInListe(e.target.value)
          }}
        >
          <option value="">In Liste aufnehmen …</option>
          {listen.map((l) => (
            <option key={l.id} value={l.id} disabled={drin(l)}>
              {l.name.trim() || 'ohne Namen'}
              {drin(l) ? ' (schon drin)' : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
