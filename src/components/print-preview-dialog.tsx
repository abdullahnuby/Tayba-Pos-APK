'use client'

import { useEffect, useRef } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type PrintPreviewDialogProps = {
  open: boolean
  title: string
  html: string
  onOpenChange: (open: boolean) => void
  onPrint?: () => void | Promise<void>
}

export function PrintPreviewDialog({ open, title, html, onOpenChange, onPrint }: PrintPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!open) return
    const frame = iframeRef.current
    if (!frame) return
    const focus = () => frame.contentWindow?.focus()
    frame.addEventListener('load', focus)
    return () => frame.removeEventListener('load', focus)
  }, [open, html])

  const print = async () => {
    if (onPrint) { await onPrint(); return }
    const frame = iframeRef.current
    if (!frame?.contentWindow) return
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-5xl overflow-hidden rounded-3xl">
        <DialogHeader>
          <DialogTitle>{title} — معاينة قبل الطباعة</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-muted/30">
          <iframe
            ref={iframeRef}
            title={title}
            srcDoc={html}
            className="h-[68vh] w-full bg-white"
            sandbox="allow-modals"
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <Button onClick={print} className="gap-2">
            <Printer className="size-4" /> طباعة الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
