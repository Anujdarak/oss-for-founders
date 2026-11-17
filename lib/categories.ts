/**
 * The 13 categories, in display order. The tuple drives the Zod enum in
 * `lib/schema.ts`, so adding a category here is what makes it legal in the data.
 *
 * Deliberately React-free: `scripts/validate-repos.ts` imports the schema, which
 * imports this file, and the validator must run under plain tsx. Icons live in
 * `components/category-icon.tsx` instead.
 */
export const CATEGORIES = [
  "ai-ml",
  "saas-development",
  "auth-security",
  "marketing-seo",
  "crm-sales",
  "analytics-bi",
  "infrastructure-devops",
  "ecommerce",
  "customer-support",
  "productivity-automation",
  "design-ui",
  "databases",
  "developer-tools",
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_META: Record<
  Category,
  { label: string; description: string }
> = {
  "ai-ml": {
    label: "AI & ML",
    description: "Model runtimes, agent frameworks, and inference you host yourself.",
  },
  "saas-development": {
    label: "SaaS Development",
    description: "Backends, admin panels, and the plumbing under the product itself.",
  },
  "auth-security": {
    label: "Authentication & Security",
    description: "Login, identity, and access control you do not have to build.",
  },
  "marketing-seo": {
    label: "Marketing & SEO",
    description: "Campaigns, newsletters, and site audits.",
  },
  "crm-sales": {
    label: "CRM & Sales",
    description: "Contacts, pipelines, and deal tracking.",
  },
  "analytics-bi": {
    label: "Analytics & BI",
    description: "Traffic stats, product analytics, and dashboards over your own data.",
  },
  "infrastructure-devops": {
    label: "Infrastructure & DevOps",
    description: "Deploys, proxies, and hosting sized for a small team.",
  },
  ecommerce: {
    label: "E-commerce",
    description: "Storefronts, carts, and checkout you control.",
  },
  "customer-support": {
    label: "Customer Support",
    description: "Shared inboxes, help desks, and live chat.",
  },
  "productivity-automation": {
    label: "Productivity & Automation",
    description: "Scheduling, workflow automation, and internal glue.",
  },
  "design-ui": {
    label: "Design & UI Components",
    description: "Component libraries and design tooling.",
  },
  databases: {
    label: "Databases",
    description: "Stores and engines that sit behind the product.",
  },
  "developer-tools": {
    label: "Developer Tools",
    description: "Error tracking, API clients, and the tooling around the codebase.",
  },
}

/** Kept as a derived export so callers that only need the name stay terse. */
export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((category) => [category, CATEGORY_META[category].label])
) as Record<Category, string>

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}
