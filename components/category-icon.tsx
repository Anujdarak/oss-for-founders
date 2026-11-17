import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  DatabaseIcon,
  HandshakeIcon,
  LayersIcon,
  LifeBuoyIcon,
  MegaphoneIcon,
  PaletteIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TerminalIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react"

import type { Category } from "@/lib/categories"

/**
 * Kept out of `lib/categories.ts` so that file stays React-free: the validator
 * script imports the schema, which imports the categories, and it runs on plain
 * tsx with no JSX pipeline.
 */
export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  "ai-ml": BrainIcon,
  "saas-development": LayersIcon,
  "auth-security": ShieldCheckIcon,
  "marketing-seo": MegaphoneIcon,
  "crm-sales": HandshakeIcon,
  "analytics-bi": ChartNoAxesColumnIcon,
  "infrastructure-devops": ServerIcon,
  ecommerce: ShoppingCartIcon,
  "customer-support": LifeBuoyIcon,
  "productivity-automation": WorkflowIcon,
  "design-ui": PaletteIcon,
  databases: DatabaseIcon,
  "developer-tools": TerminalIcon,
}

export function CategoryIcon({
  category,
  className,
}: {
  category: Category
  className?: string
}) {
  const Icon = CATEGORY_ICONS[category]
  return <Icon className={className} aria-hidden />
}
