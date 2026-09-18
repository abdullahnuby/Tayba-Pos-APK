import { cn } from '@/lib/utils'
import { KayanMark } from '@/components/kayan-brand'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('kayan-empty', className)}>
      <div className="kayan-empty__art">
        <span className="kayan-empty__ring" />
        {Icon ? <Icon className="size-7" /> : <KayanMark className="size-10" />}
      </div>
      <div className="space-y-1">
        <p className="kayan-empty__title">{title}</p>
        {description && <p className="kayan-empty__description">{description}</p>}
      </div>
      {action}
    </div>
  )
}
