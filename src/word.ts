import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import type { Druckabschnitt } from './Liste'

const SCHRIFT = 'Times New Roman'

/** Literaturliste als Word-Datei (.docx) mit Überschriften und hängendem Einzug; halbfett wird fett. */
export async function wordDatei(titel: string, abschnitte: Druckabschnitt[]): Promise<Blob> {
  const absaetze = abschnitte.flatMap((a) => [
    ...(a.ebene > 0
      ? [
          new Paragraph({
            heading: a.ebene === 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: a.ueberschrift, font: SCHRIFT, size: a.ebene === 1 ? 26 : 24, bold: true })],
          }),
        ]
      : []),
    ...a.zeilen.map(
      (z) =>
        new Paragraph({
          indent: { left: 567, hanging: 567 },
          spacing: { after: 120 },
          alignment: AlignmentType.LEFT,
          children: z.map((t) => new TextRun({ text: t.text, bold: Boolean(t.auszeichnung), italics: t.kursiv })),
        }),
    ),
  ])
  const doc = new Document({
    description: `Bibliographie, Stand ${__STAND__}`,
    styles: {
      default: { document: { run: { font: SCHRIFT, size: 24 } } },
    },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [new TextRun({ text: titel, font: SCHRIFT, size: 30, bold: true })],
          }),
          ...absaetze,
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}
