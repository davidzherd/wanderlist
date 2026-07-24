import { useState, type RefObject } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { useScript } from '../hooks/useScript'

declare global {
  interface Window {
    html2pdf?: (element: HTMLElement, options?: Record<string, unknown>) => { save: () => Promise<void> }
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
    if (!targetRef.current || !window.html2pdf) return
    setIsExporting(true)
    try {
      await window.html2pdf(targetRef.current, {
        margin: 10,
        filename: `${fileName}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).save()
    } finally {
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
      className="flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isExporting || isLoadingScript ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
      {isExporting ? 'Exporting…' : scriptStatus === 'error' ? 'Export unavailable' : 'Export PDF'}
    </button>
  )
}
