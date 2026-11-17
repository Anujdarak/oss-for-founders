import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Filters } from "@/lib/filters"

/**
 * A plain GET form, so searching works with JavaScript disabled and the result
 * is a real URL. The active filters ride along as hidden inputs rather than
 * being dropped on submit, which is what a client-side box would do by default.
 */
export function SearchForm({
  action,
  defaultValue,
  filters,
  placeholder = "Search names, topics, and descriptions",
}: {
  action: string
  defaultValue: string
  filters: Filters
  placeholder?: string
}) {
  const hidden: [string, string][] = []
  if (filters.sort !== "popular") hidden.push(["sort", filters.sort])
  if (filters.category) hidden.push(["category", filters.category])
  if (filters.language) hidden.push(["lang", filters.language])
  if (filters.license) hidden.push(["license", filters.license])
  if (filters.selfHosted) hidden.push(["selfhost", "1"])
  if (filters.beginner) hidden.push(["beginner", "1"])
  if (filters.reviewed) hidden.push(["reviewed", "1"])
  if (filters.gemsOnly) hidden.push(["gems", "1"])

  return (
    <form action={action} method="get" className="flex max-w-xl items-center gap-2">
      {hidden.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="relative flex h-9 min-w-0 flex-1 origin-left items-center rounded-md border border-input transition-[border-color,box-shadow,transform] duration-200 ease-out focus-within:scale-[1.01] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <SearchIcon
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label="Search repositories"
          className="h-full w-full bg-transparent pr-3 pl-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
        />
      </div>

      <Button type="submit" size="sm" variant="outline">
        Search
      </Button>
    </form>
  )
}
