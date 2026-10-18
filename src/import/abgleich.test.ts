import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leseOdt } from './odt'
import { rueckprobe, zerlegeEintrag } from './eintrag'

// Prüfstand gegen eine echte Literaturliste. Läuft nur mit Datei:
//   ODT_DATEI=pfad/liste.odt BERICHT=pfad/bericht.md pnpm vitest run src/import/abgleich.test.ts
const datei = process.env.ODT_DATEI

describe.skipIf(!datei)('Abgleich mit einer echten Liste', () => {
  it('liest, zerlegt, druckt und vergleicht jeden Eintrag', () => {
    const eintraege = leseOdt(new Uint8Array(readFileSync(datei!)))
    const zaehler: Record<string, number> = {}
    const gruende: Record<string, number> = {}
    const abweichungen: string[] = []
    const auszeichnung: string[] = []
    const zaehle = (k: string) => (zaehler[k] = (zaehler[k] ?? 0) + 1)
    for (const e of eintraege) {
      const r = zerlegeEintrag(e.laeufe)
      zaehle(r.status)
      if (r.status !== 'erkannt') {
        const g = `${r.status}: ${r.grund ?? ''}`
        gruende[g] = (gruende[g] ?? 0) + 1
        continue
      }
      const p = rueckprobe(r.werk!, e.laeufe)
      zaehle(`rückprobe ${p.ergebnis}`)
      if (p.ergebnis === 'abweichend') abweichungen.push(`- Nr. ${e.nummer}\n  - Original: ${r.original}\n  - Gedruckt: ${p.gedruckt}`)
      if (p.ergebnis === 'text-gleich') auszeichnung.push(`- Nr. ${e.nummer}: ${r.original.slice(0, 140)}`)
    }
    const bericht = [
      `# Abgleich ${new Date().toISOString().slice(0, 10)}`,
      '',
      `${eintraege.length} Einträge gelesen.`,
      '',
      '| Ergebnis | Anzahl |',
      '|---|---|',
      ...Object.entries(zaehler).map(([k, v]) => `| ${k} | ${v} |`),
      '',
      '## Nicht zerlegt, nach Grund',
      '',
      '| Grund | Anzahl |',
      '|---|---|',
      ...Object.entries(gruende).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
      '',
      `## Text weicht ab (${abweichungen.length})`,
      '',
      ...abweichungen,
      '',
      `## Nur Auszeichnung weicht ab (${auszeichnung.length})`,
      '',
      ...auszeichnung,
    ].join('\n')
    if (process.env.BERICHT) writeFileSync(process.env.BERICHT, bericht)
    expect(eintraege.length).toBeGreaterThan(0)
  })
})
