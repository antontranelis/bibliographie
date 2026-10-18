import type { Teil } from './format'
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'

/** Literaturliste als Word-Datei (.docx) mit hängendem Einzug; halbfett wird fett. */
export async function wordDatei(titel: string, zeilen: Teil[][]): Promise<Blob> {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 24 } } },
    },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [new TextRun({ text: titel, font: 'Times New Roman', size: 30, bold: true })],
          }),
          ...zeilen.map(
            (z) =>
              new Paragraph({
                indent: { left: 567, hanging: 567 },
                spacing: { after: 120 },
                alignment: AlignmentType.LEFT,
                children: z.map((t) => new TextRun({ text: t.text, bold: Boolean(t.auszeichnung), italics: t.kursiv })),
              }),
          ),
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}
