import { useEffect, useMemo, useRef, useState } from 'react'
import { Delete, RotateCcw, Check, X } from 'lucide-react'

export interface NumericPadRequest {
  value: string
  title?: string
  min?: string | number
  max?: string | number
  step?: string | number
  decimal?: boolean
  password?: boolean
  maxLength?: number
  onCommit: (value: string) => void
}

const EVENT_NAME = 'tayba:numeric-pad'

export function openNumericPad(request: NumericPadRequest) {
  window.dispatchEvent(new CustomEvent<NumericPadRequest>(EVENT_NAME, { detail: request }))
}

function normalize(raw: string, decimal: boolean, maxLength?: number) {
  let value = raw.replace(/[^0-9.]/g, '')
  if (!decimal) value = value.split('.')[0]
  if (decimal) {
    const [whole, ...rest] = value.split('.')
    value = `${whole}${rest.length ? `.${rest.join('')}` : ''}`
    if (value.startsWith('.')) value = `0${value}`
  }
  if (maxLength) value = value.slice(0, maxLength)
  return value
}

export function NumericPadProvider() {
  const [request, setRequest] = useState<NumericPadRequest | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<NumericPadRequest>).detail
      if (!detail || typeof detail.onCommit !== 'function') return
      setRequest(detail)
      setDraft(detail.value == null ? '' : String(detail.value))
      setEditing(false)
    }
    window.addEventListener(EVENT_NAME, handle as EventListener)
    return () => window.removeEventListener(EVENT_NAME, handle as EventListener)
  }, [])

  const decimal = !!request?.decimal
  const title = request?.title || 'إدخال رقم'
  const min = request?.min == null || request.min === '' ? undefined : Number(request.min)
  const max = request?.max == null || request.max === '' ? undefined : Number(request.max)
  const parsed = draft === '' || draft === '.' ? null : Number(draft)
  const canConfirm = parsed !== null && Number.isFinite(parsed) &&
    (min === undefined || parsed >= min) &&
    (max === undefined || parsed <= max)
  const masked = request?.password ? '•'.repeat(Math.min(draft.length, 12)) : draft || '0'
  const keys = useMemo(() => ['1','2','3','4','5','6','7','8','9', decimal ? '.' : '', '0', '⌫'], [decimal])

  const close = () => {
    setRequest(null)
    setDraft('')
    setEditing(false)
  }

  const confirm = () => {
    if (!request || !canConfirm) return
    const value = draft === '.' ? '0' : draft
    const callback = request.onCommit
    setRequest(null)
    setDraft('')
    setEditing(false)
    callback(value)
  }

  const press = (key: string) => {
    if (!request) return
    if (key === '⌫') {
      setDraft(value => value.slice(0, -1))
      setEditing(true)
      return
    }

    if (!editing) {
      setEditing(true)
      if (key === '.') {
        setDraft(decimal ? '0.' : '')
        return
      }
      setDraft(normalize(key, decimal, request.maxLength))
      return
    }

    if (key === '.') {
      if (!decimal || draft.includes('.')) return
      setDraft(value => (value ? value : '0') + '.')
      return
    }
    setDraft(value => normalize(value + key, decimal, request.maxLength))
  }

  const clear = () => {
    setDraft('')
    setEditing(true)
  }

  useEffect(() => {
    if (!request) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        confirm()
        return
      }
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        press(event.key)
        return
      }
      if (decimal && event.key === '.') {
        event.preventDefault()
        press('.')
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        press('⌫')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [request, draft, editing, decimal, min, max, canConfirm])

  if (!request) return null

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-black/55 p-3 sm:items-center"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))', overscrollBehavior: 'none', touchAction: 'none' }}
      role="presentation"
      onPointerDown={(event) => { if (event.target === event.currentTarget) close() }}
    >
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-[2rem] border bg-background shadow-2xl"
        style={{ touchAction: 'manipulation' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">لوحة أرقام</p>
            <h2 className="text-lg font-black">{title}</h2>
          </div>
          <button type="button" onClick={close} className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40 active:scale-95" style={{ touchAction: 'manipulation' }} aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 pt-5">
          <div className="flex min-h-20 items-center justify-center rounded-3xl border-2 border-primary/20 bg-primary/[.03] px-4 text-center">
            <span className={`font-black tracking-[0.18em] ${request.password ? 'text-3xl' : 'text-4xl'}`}>{masked}</span>
          </div>
          {!canConfirm && draft !== '' && <p className="mt-2 text-center text-xs font-semibold text-destructive">القيمة خارج النطاق المسموح</p>}
          {request.max != null && <p className="mt-2 text-center text-[11px] text-muted-foreground">الحد الأقصى: {String(request.max)}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2.5 p-5 sm:gap-3">
          {keys.map((key, index) => key ? (
            <button
              key={key + index}
              type="button"
              onClick={() => press(key)}
              className="flex h-16 items-center justify-center rounded-2xl border bg-card text-2xl font-black shadow-sm active:scale-[.97] sm:h-[72px] sm:text-3xl"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              aria-label={key === '⌫' ? 'حذف رقم' : key}
            >
              {key === '⌫' ? <Delete className="size-6 sm:size-7" /> : key}
            </button>
          ) : <div key={'empty'+index} className="h-16 sm:h-[72px]" aria-hidden />)}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 p-4 sm:gap-3">
          <button type="button" onClick={clear} className="flex h-14 items-center justify-center gap-2 rounded-2xl border bg-background text-sm font-bold active:scale-[.98] sm:h-16" style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            <RotateCcw className="size-5" /> مسح الكل
          </button>
          <button type="button" onClick={confirm} disabled={!canConfirm} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground text-sm font-black disabled:opacity-40 active:scale-[.98] sm:h-16" style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            <Check className="size-5" /> تأكيد
          </button>
        </div>
      </div>
    </div>
  )
}

export interface TouchNumericFieldProps {
  value: string | number | null | undefined
  onChange: (value: string) => void
  title?: string
  min?: string | number
  max?: string | number
  decimal?: boolean
  maxLength?: number
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function TouchNumericField({ value, onChange, title = 'إدخال رقم', min, max, decimal = false, maxLength, placeholder = '0', disabled = false, className = '' }: TouchNumericFieldProps) {
  const display = value === '' || value == null ? placeholder : String(value)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => openNumericPad({ value: value == null ? '' : String(value), title, min, max, decimal, maxLength, onCommit: onChange })}
      className={`flex min-h-12 w-full items-center justify-center rounded-xl border bg-background px-3 text-center font-black tabular-nums active:scale-[.99] disabled:opacity-50 ${className}`}
      aria-label={title}
    >
      {display}
    </button>
  )
}
