import { useState, type RefObject } from 'react'
import html2canvas from 'html2canvas'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const EXPORT_TIP_KEY = 'otm:export:tip-shown'

interface ExportButtonProps {
  targetRef: RefObject<HTMLDivElement | null>
}

export function ExportButton({ targetRef }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { isAuthenticated } = useAuth()

  const handleExport = async () => {
    const node = targetRef.current
    if (!node) return

    if (!isAuthenticated) {
      try {
        const tipShown = sessionStorage.getItem(EXPORT_TIP_KEY)
        if (!tipShown) {
          sessionStorage.setItem(EXPORT_TIP_KEY, '1')
          setToast('提示：登录后可云端保存 & 生成分享链接')
          setTimeout(() => setToast(null), 3500)
        }
      } catch {
        // ignore
      }
    }

    setExporting(true)
    setToast(null)

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
      setToast('导出失败。如果图片来自跨域 URL，可能无法导出完整内容。')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative">
      <Button onClick={handleExport} disabled={exporting} variant="secondary">
        {exporting ? '导出中...' : '导出图片'}
      </Button>
      {toast && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-popover text-popover-foreground text-sm rounded-md border border-border shadow-md px-3 py-2 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
