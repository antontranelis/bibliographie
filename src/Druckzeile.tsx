import type { Teil } from './format'

/** Druckzeile mit Auszeichnung: Titel fett oder halbfett, Zeitschriften kursiv. */
export function Druckzeile({ teile }: { teile: Teil[] }) {
  return (
    <>
      {teile.map((t, i) =>
        t.auszeichnung || t.kursiv ? (
          <span key={i} className={[t.auszeichnung, t.kursiv && 'kursiv'].filter(Boolean).join(' ')}>
            {t.text}
          </span>
        ) : (
          t.text
        ),
      )}
    </>
  )
}
