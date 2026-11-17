import * as React from "react"
import { cn } from "cn"

export function Tag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tag"
      className={cn(
        "inline-flex items-center rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.6875rem] leading-none text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
