import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'

/** Literaturliste als Word-Datei (.docx) mit hängendem Einzug. */
export async function wordDatei(titel: string, zeilen: string[]): Promise<Blob> {
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
                children: [new TextRun(z)],
              }),
          ),
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}
