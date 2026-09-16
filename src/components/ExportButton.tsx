import { useState, type RefObject } from 'react'
import html2canvas from 'html2canvas'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  targetRef: RefObject<HTMLDivElement | null>
}

export function ExportButton({ targetRef }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    const node = targetRef.current
    if (!node) return

    setExporting(true)
    setError(null)

    try {
      const canvas = await html2canvas(node, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#ffffff',
      })

      const dataUrl = canvas.toDataURL('image/png')
      const now = new Date()
      const pad = (n: number) => n.toString().padStart(2, '0')
      const filename = `tier-list-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`

      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
      setError('导出失败。如果图片来自跨域 URL，可能无法导出完整内容。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={handleExport} disabled={exporting} variant="secondary">
        {exporting ? '导出中...' : '导出图片'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
