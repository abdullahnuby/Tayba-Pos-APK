import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all select-none touch-manipulation disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "min-h-12 h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "min-h-12 h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-12 min-h-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({ className, variant, size, asChild = false, onClick, disabled, type, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"

  // Buttons here used to fire onClick early on `pointerup` (for touch) as a
  // perceived-latency trick, then try to suppress the native `click` that
  // follows a few dozen ms later so it wouldn't fire twice. The problem:
  // that suppression is tied to one specific DOM node. The instant the
  // first action (an add, a delete, a page change) causes React to
  // re-render, the list can reflow *before* that trailing native `click`
  // arrives — so the click lands on whatever row or card has slid into
  // that same screen position and fires ITS action for real, since that
  // element's own suppression window was never armed. That's what caused
  // deleting one cart line to cascade into the ones below it, and tapping
  // "previous" after "next" to silently add whatever product ended up
  // under that button. Relying on a single native `click` event — which
  // Android's WebView already dispatches quickly thanks to `touch-action:
  // manipulation` below — removes the race entirely: there is only ever
  // one event, so there is nothing left to land on the wrong target.
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...props}
    />
  )
}

export { Button, buttonVariants }
