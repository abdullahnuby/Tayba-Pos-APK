import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function KayanMark({ className }: { className?: string }) {
  return (
    <span className={cn('kayan-mark', className)} aria-hidden="true">
      <img src="/kayan-mark.svg" alt="" className="kayan-mark__image" />
    </span>
  )
}

export function KayanBrand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('kayan-brand', compact && 'is-compact', className)}>
      <img src="/kayan-logo.svg" alt="KAYAN — كيان" className="kayan-brand__logo" />
      {compact && <KayanMark className="kayan-brand__compact-mark" />}
    </div>
  )
}

export function KayanPageHeader({
  eyebrow, title, description, actions, className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('kayan-page-header', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="kayan-eyebrow">{eyebrow}</div>}
        <h2 className="kayan-page-title">{title}</h2>
        {description && <p className="kayan-page-description">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
