import * as React from "react"

import { cn } from "@/lib/utils"
import { openNumericPad } from "@/components/numeric-pad"

function Input({ className, type, inputMode, onChange, onClick, value, defaultValue, min, max, step, maxLength, placeholder, disabled, ...props }: React.ComponentProps<"input">) {
  const isNumber = type === 'number'
  const isPin = inputMode === 'numeric' && type === 'password' && maxLength === 4
  const usePad = isNumber || isPin

  if (usePad) {
    const current = value ?? defaultValue ?? ''
    const text = current === '' ? '' : String(current)
    const display = isPin ? '•'.repeat(Math.min(text.length, 12)) : (text || placeholder || '0')
    const decimal = inputMode === 'decimal' || String(step ?? '').includes('.')
    const title = isPin ? 'PIN — 4 أرقام' : (placeholder || 'إدخال رقم')

    return (
      <button
        type="button"
        id={props.id}
        name={props.name}
        data-slot="input"
        disabled={disabled}
        aria-label={props['aria-label'] ?? title}
        aria-invalid={props['aria-invalid']}
        className={cn(
          "flex h-14 w-full min-w-0 items-center justify-center rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow,transform] outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] active:scale-[.995]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          isPin && "tracking-[0.45em]",
          className,
        )}
        onClick={(event) => {
          onClick?.(event as unknown as React.MouseEvent<HTMLInputElement>)
          if (disabled) return
          openNumericPad({
            value: text,
            title,
            min: min as string | number | undefined,
            max: max as string | number | undefined,
            step: step as string | number | undefined,
            decimal,
            password: isPin,
            maxLength: maxLength,
            onCommit: (next) => {
              const synthetic = {
                target: { value: next },
                currentTarget: { value: next },
              } as unknown as React.ChangeEvent<HTMLInputElement>
              onChange?.(synthetic)
            },
          })
        }}
      >
        <span className={cn(text || placeholder ? "font-black" : "text-muted-foreground", isNumber && text && "tabular-nums")}>{display}</span>
      </button>
    )
  }

  return (
    <input
      type={type}
      inputMode={inputMode}
      style={{ touchAction: 'auto', WebkitUserSelect: 'text', WebkitTapHighlightColor: 'transparent', ...(props.style || {}) }}
      value={value as React.InputHTMLAttributes<HTMLInputElement>["value"]}
      defaultValue={defaultValue}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "touch-text-input min-h-12 text-[16px] md:text-base",
        className
      )}
      onChange={onChange}
      {...props}
    />
  )
}

export { Input }
