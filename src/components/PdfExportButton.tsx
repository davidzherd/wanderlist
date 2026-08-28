import { useState, type RefObject } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { useScript } from '../hooks/useScript'

declare global {
  interface Html2PdfWorker {
    set: (options: Record<string, unknown>) => Html2PdfWorker
    from: (element: HTMLElement) => Html2PdfWorker
    save: () => Promise<void>
  }
  interface Window {
    html2pdf?: (element?: HTMLElement, options?: Record<string, unknown>) => Html2PdfWorker
  }
}

const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js'

interface PdfExportButtonProps {
  targetRef: RefObject<HTMLElement>
  fileName: string
}

export function PdfExportButton({ targetRef, fileName }: PdfExportButtonProps) {
  const scriptStatus = useScript(HTML2PDF_CDN)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    const el = targetRef.current
    if (!el || !window.html2pdf) return
    setIsExporting(true)
    // Reveal PDF-only content (e.g. the title heading) for the capture; html2canvas reads the
    // live computed styles, so flipping the class here is enough. Removed again in `finally`.
    el.classList.add('pdf-export')
    try {
      // Chained worker API (set → from → save), NOT the html2pdf(el, opts) shorthand — that
      // shorthand ALREADY calls .save() internally, so an extra .save() downloads the file twice.
      await window
        .html2pdf()
        .set({
          margin: 10,
          filename: `${fileName}.pdf`,
          // useCORS lets html2canvas draw the cross-origin Cloudinary/Pexels images instead of
          // skipping them (they'd otherwise taint the canvas and render blank).
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          // Respect each card's `break-inside: avoid` so a stop that doesn't fit is pushed to the next
          // page whole — without forcing entire (possibly page-taller) days to stay together.
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(el)
        .save()
    } finally {
      el.classList.remove('pdf-export')
      setIsExporting(false)
    }
  }

  const isReady = scriptStatus === 'ready'
  const isLoadingScript = scriptStatus === 'loading' || scriptStatus === 'idle'

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={!isReady || isExporting}
      className="flex items-center gap-2 rounded-full bg-harbor px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isExporting || isLoadingScript ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
      {isExporting ? 'Exporting…' : scriptStatus === 'error' ? 'Export unavailable' : 'Export PDF'}
    </button>
  )
}
