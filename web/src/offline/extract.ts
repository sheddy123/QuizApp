/** Port of QuizApp.Parsing's text extractors: .txt/.md read as-is, PDFs through pdf.js. */

/** Below this many characters per page, we assume the page is a scan or screenshot. */
const minCharsPerPage = 80

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md')) return file.text()
  if (name.endsWith('.pdf')) return extractPdf(file)
  const dot = name.lastIndexOf('.')
  throw new Error(`No extractor handles '${dot >= 0 ? name.slice(dot) : name}'.`)
}

async function extractPdf(file: File): Promise<string> {
  // Loaded on demand: pdf.js is large and only needed for PDF imports.
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  let text = ''
  for (let p = 1; p <= document.numPages; p++) {
    const page = await document.getPage(p)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!('str' in item)) continue
      text += item.str + (item.hasEOL ? '\n' : '')
    }
    text += '\n\n'
  }

  const chars = (text.match(/[\p{L}\p{N}]/gu) ?? []).length
  if (document.numPages > 0 && chars / document.numPages < minCharsPerPage)
    throw new Error(
      'This PDF has almost no selectable text, so it is probably scans or screenshots. ' +
        'Run it through OCR first, then upload the result or paste the text.'
    )

  return text
}
