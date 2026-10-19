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

const html = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Zeile mit Fett und Kursiv in die Zwischenablage, damit sie so in Word ankommt; sonst als reiner Text. */
export async function kopiereZeile(teile: Teil[]): Promise<void> {
  const text = teile.map((t) => t.text).join('')
  const auszeichnung = teile
    .map((t) => {
      let s = html(t.text)
      if (t.kursiv) s = `<i>${s}</i>`
      if (t.auszeichnung === 'fett') s = `<b>${s}</b>`
      if (t.auszeichnung === 'halbfett') s = `<span style="font-weight:600">${s}</span>`
      return s
    })
    .join('')
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([auszeichnung], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
    ])
  } catch {
    await navigator.clipboard.writeText(text)
  }
}
