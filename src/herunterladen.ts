export function herunterladen(blob: Blob, dateiname: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
