import { cn } from "cn"

/**
 * Loading placeholder.
 *
 * The brief asked for a shimmer, which conventionally means a light band
 * swept across the element with a linear-gradient. The design rules forbid
 * gradients, so this is a soft opacity breath instead: the same "this is
 * waiting, not broken" signal, built from opacity alone.
 *
 * `motion-reduce:animate-none` leaves a plain block rather than a pulsing
 * one, and the global reduced-motion rule in globals.css collapses the
 * duration regardless.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-skeleton rounded-md bg-muted motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
