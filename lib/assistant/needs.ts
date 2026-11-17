import type { Category } from "../categories"

/**
 * The need taxonomy.
 *
 * This is the piece that fixes "I want to improve my ui ux of my website"
 * returning things whose description happens to contain the word "website".
 * A founder's message names a *goal*; what the catalogue is organised by is
 * *needs*. Those are not the same thing, and no amount of keyword weighting
 * bridges them — "website" is a noun in the goal and a stopword in the need.
 *
 * So the pipeline never searches the raw message. It resolves the message to
 * one or more needs, and searches each need separately. "Improve my UI/UX"
 * becomes six searches, not one.
 *
 * Every need carries:
 * - `query`, the text that gets embedded. Written as a description of the kind
 *   of tool, not as a keyword list, because that is what the sentence
 *   embedding model is good at matching against a repo description.
 * - `keywords`, for the BM25 half of the blend, which is the half that is good
 *   at exact topic hits like `oauth2` or `kubernetes`.
 * - `categories`, used both to bias retrieval and to assert in the tests.
 */
export type NeedSpec = {
  key: string
  /** Section heading in the answer. */
  label: string
  /** Natural-language text, embedded at build time. */
  query: string
  /** Terms for the lexical half of retrieval. */
  keywords: string[]
  /** Where tools for this need actually live. */
  categories: Category[]
}

export const NEEDS: NeedSpec[] = [
  // ---- Design and front end -------------------------------------------
  {
    key: "ui-components",
    label: "Component libraries",
    query:
      "reusable UI component library of accessible buttons, forms, dialogs and tables for building web interfaces",
    keywords: ["ui", "components", "component-library", "design-system", "react", "vue", "svelte", "tailwind", "headless-ui"],
    categories: ["design-ui"],
  },
  {
    key: "animation",
    label: "Animation and motion",
    query: "animation library for smooth motion, transitions and interactive effects in a web interface",
    keywords: ["animation", "motion", "transitions", "gsap", "scroll-animation", "css-animation"],
    categories: ["design-ui"],
  },
  {
    key: "icons",
    label: "Icons and illustrations",
    query: "open source icon set or illustration pack for user interfaces",
    keywords: ["icons", "icon-set", "svg-icons", "illustrations", "iconfont"],
    categories: ["design-ui"],
  },
  {
    key: "design-system",
    label: "Design systems and tokens",
    query: "design system with design tokens, theming and a styleguide shared between design and code",
    keywords: ["design-system", "design-tokens", "theming", "styleguide", "storybook"],
    categories: ["design-ui"],
  },
  {
    key: "css-framework",
    label: "CSS and styling",
    query: "CSS framework or styling toolkit for laying out and theming a web page",
    keywords: ["css", "css-framework", "sass", "styling", "tailwindcss", "css-in-js"],
    categories: ["design-ui"],
  },
  {
    key: "accessibility",
    label: "Accessibility testing",
    query: "accessibility testing tool that audits a site for WCAG issues, contrast and screen reader problems",
    keywords: ["accessibility", "a11y", "wcag", "axe", "screen-reader", "aria"],
    categories: ["developer-tools", "design-ui"],
  },
  {
    key: "landing-page",
    label: "Site and landing page builders",
    query: "website builder or static site generator for marketing pages and landing pages",
    keywords: ["static-site-generator", "landing-page", "website-builder", "jamstack", "ssg"],
    categories: ["marketing-seo", "design-ui"],
  },

  // ---- Understanding users --------------------------------------------
  {
    key: "ux-analytics",
    label: "Product analytics",
    query: "product analytics that tracks user events, funnels, retention and feature usage inside an application",
    keywords: ["product-analytics", "event-tracking", "funnel", "retention", "cohort", "user-behavior"],
    categories: ["analytics-bi"],
  },
  {
    key: "web-analytics",
    label: "Web analytics",
    query: "privacy friendly web analytics that counts page views, visitors and traffic sources for a website",
    keywords: ["analytics", "web-analytics", "privacy", "google-analytics-alternative", "pageviews", "statistics"],
    categories: ["analytics-bi"],
  },
  {
    key: "session-replay",
    label: "Session replay and heatmaps",
    query: "session replay and heatmaps showing recordings of how visitors click and scroll through pages",
    keywords: ["session-replay", "heatmap", "session-recording", "clickmap", "user-recording"],
    categories: ["analytics-bi"],
  },
  {
    key: "ab-testing",
    label: "Feature flags and experiments",
    query: "feature flags and A/B testing to roll out features gradually and measure which variant performs better",
    keywords: ["feature-flags", "ab-testing", "experiments", "feature-toggle", "split-testing"],
    categories: ["analytics-bi", "saas-development"],
  },
  {
    key: "bi-dashboard",
    label: "Dashboards and BI",
    query: "business intelligence tool for building dashboards and charts on top of a SQL database",
    keywords: ["business-intelligence", "dashboard", "data-visualization", "charts", "reporting", "sql"],
    categories: ["analytics-bi"],
  },
  {
    key: "data-pipeline",
    label: "Data pipelines",
    query: "data pipeline and ETL tool that moves and transforms data between warehouses and services",
    keywords: ["etl", "data-pipeline", "data-integration", "workflow-orchestration", "data-engineering"],
    categories: ["analytics-bi", "databases"],
  },

  // ---- Talking to customers -------------------------------------------
  {
    key: "support-desk",
    label: "Support and live chat",
    query: "customer support help desk with shared inbox, ticketing and live chat widget for talking to users",
    keywords: ["helpdesk", "live-chat", "support", "ticketing", "customer-support", "shared-inbox"],
    categories: ["customer-support"],
  },
  {
    key: "email-transactional",
    label: "Transactional email",
    query: "transactional email server or API for sending signup, password reset and notification emails from an app",
    keywords: ["email", "smtp", "transactional-email", "mail-server", "email-api", "mailer"],
    categories: ["marketing-seo", "saas-development", "developer-tools"],
  },
  {
    key: "email-marketing",
    label: "Email marketing",
    query: "email marketing platform for newsletters, campaigns and subscriber lists",
    keywords: ["newsletter", "email-marketing", "campaign", "mailing-list", "subscribers", "drip"],
    categories: ["marketing-seo"],
  },
  {
    key: "notifications",
    label: "Notifications",
    query: "notification infrastructure for sending push, in-app, SMS and email alerts to users",
    keywords: ["notifications", "push-notifications", "sms", "in-app-notifications", "alerting"],
    categories: ["saas-development", "customer-support"],
  },
  {
    key: "crm",
    label: "CRM and sales",
    query: "CRM for tracking contacts, leads, deals and the sales pipeline",
    keywords: ["crm", "sales", "pipeline", "leads", "contacts", "deals"],
    categories: ["crm-sales"],
  },
  {
    key: "forms",
    label: "Forms and surveys",
    query: "form builder and survey tool for collecting responses and feedback from users",
    keywords: ["forms", "survey", "form-builder", "feedback", "questionnaire", "typeform-alternative"],
    categories: ["productivity-automation", "marketing-seo"],
  },
  {
    key: "seo",
    label: "SEO",
    query: "SEO tooling for auditing a site, checking metadata, sitemaps and search engine rankings",
    keywords: ["seo", "sitemap", "meta-tags", "search-engine-optimization", "lighthouse", "crawler"],
    categories: ["marketing-seo"],
  },

  // ---- AI --------------------------------------------------------------
  {
    key: "llm-apps",
    label: "LLM application frameworks",
    query: "framework for building applications on top of large language models with prompts, agents and tool calling",
    keywords: ["llm", "agents", "openai", "prompt", "langchain", "rag", "gpt", "ai-agent"],
    categories: ["ai-ml"],
  },
  {
    key: "vector-db",
    label: "Vector search and RAG",
    query: "vector database for embeddings and semantic similarity search powering retrieval augmented generation",
    keywords: ["vector-database", "embeddings", "semantic-search", "rag", "similarity-search", "nearest-neighbor"],
    categories: ["ai-ml", "databases"],
  },
  {
    key: "llm-serving",
    label: "Running models",
    query: "serving and running open source language models locally or on your own GPU infrastructure",
    keywords: ["inference", "llm-serving", "local-llm", "llama", "ollama", "gguf", "gpu", "model-serving", "quantization"],
    categories: ["ai-ml"],
  },
  {
    key: "ml-ops",
    label: "ML tooling",
    query: "machine learning experiment tracking, training pipelines and model lifecycle management",
    keywords: ["machine-learning", "mlops", "experiment-tracking", "training", "pytorch", "model-registry"],
    categories: ["ai-ml"],
  },
  {
    key: "chatbot",
    label: "Chatbots",
    query: "chatbot and conversational assistant that answers questions from your own documents or knowledge base",
    keywords: ["chatbot", "conversational-ai", "assistant", "chat-ui", "question-answering"],
    categories: ["ai-ml", "customer-support"],
  },

  // ---- The application itself -----------------------------------------
  {
    key: "auth",
    label: "Authentication",
    query: "authentication and user management with login, signup, OAuth, SSO and session handling",
    keywords: ["auth", "authentication", "oauth", "sso", "login", "signup", "identity", "jwt", "saml", "user-management"],
    categories: ["auth-security"],
  },
  {
    key: "secrets",
    label: "Secrets management",
    query: "secrets manager for storing API keys, credentials and environment variables securely",
    keywords: ["secrets", "secrets-management", "api-keys", "vault", "credentials", "encryption", "env-vars"],
    categories: ["auth-security"],
  },
  {
    key: "security-scanning",
    label: "Security scanning",
    query: "security scanner that finds vulnerabilities, leaked secrets and insecure dependencies in code",
    keywords: ["security", "vulnerability", "scanner", "sast", "dependency-scanning", "pentest"],
    categories: ["auth-security", "developer-tools"],
  },
  {
    key: "password-manager",
    label: "Password management",
    query: "password manager and credential vault for a team",
    keywords: ["password-manager", "passwords", "vault", "credentials", "2fa", "totp"],
    categories: ["auth-security"],
  },
  {
    key: "backend-baas",
    label: "Backend platform",
    query: "backend as a service giving an application a database, auth, storage and auto generated APIs",
    keywords: ["baas", "backend-as-a-service", "firebase-alternative", "supabase-alternative", "auto-generated-api", "serverless"],
    categories: ["saas-development"],
  },
  {
    key: "api-framework",
    label: "API frameworks",
    query: "web framework for building REST and GraphQL APIs and server side applications",
    keywords: ["framework", "rest-api", "graphql", "http", "web-framework", "backend"],
    categories: ["saas-development", "developer-tools"],
  },
  {
    key: "realtime",
    label: "Realtime and collaboration",
    query: "realtime websocket and collaborative editing infrastructure for multiplayer features",
    keywords: ["websocket", "realtime", "collaboration", "crdt", "pubsub", "multiplayer"],
    categories: ["saas-development", "developer-tools"],
  },
  {
    key: "queue",
    label: "Background jobs and queues",
    query: "job queue and background worker system for running scheduled and asynchronous tasks",
    keywords: ["queue", "job-queue", "background-jobs", "worker", "task-scheduler", "cron", "message-queue"],
    categories: ["infrastructure-devops", "saas-development"],
  },
  {
    key: "cms",
    label: "CMS and content",
    query: "headless CMS for editing structured content and serving it to a site over an API",
    keywords: ["cms", "headless-cms", "content-management", "blog", "editor", "publishing"],
    categories: ["saas-development", "productivity-automation"],
  },
  {
    key: "ecommerce",
    label: "E-commerce",
    query: "e-commerce platform with a storefront, product catalogue, cart and order management",
    keywords: ["ecommerce", "shop", "storefront", "cart", "checkout", "orders", "commerce"],
    categories: ["ecommerce"],
  },
  {
    key: "search-engine",
    label: "Search",
    query: "search engine for adding fast full text search with typo tolerance and faceting to an application",
    keywords: ["search", "full-text-search", "search-engine", "elasticsearch", "faceted-search", "typo-tolerance"],
    categories: ["developer-tools", "databases"],
  },
  {
    key: "i18n",
    label: "Translation and i18n",
    query: "internationalisation and translation management for shipping an app in several languages",
    keywords: ["i18n", "internationalization", "localization", "translation", "l10n"],
    categories: ["developer-tools"],
  },
  {
    key: "file-storage",
    label: "File storage and uploads",
    query: "object storage and file upload handling for images, documents and user uploads",
    keywords: ["storage", "s3", "file-upload", "object-storage", "cdn", "media"],
    categories: ["infrastructure-devops", "developer-tools"],
  },

  // ---- Data ------------------------------------------------------------
  {
    key: "database",
    label: "Databases",
    query: "database server for storing and querying application data",
    keywords: ["database", "sql", "postgres", "nosql", "key-value", "storage-engine"],
    categories: ["databases"],
  },
  {
    key: "orm",
    label: "ORMs and database tooling",
    query: "ORM, query builder and schema migration tooling for talking to a database from code",
    keywords: ["orm", "query-builder", "migrations", "schema", "database-client", "sql-builder"],
    categories: ["databases", "developer-tools"],
  },

  // ---- Running it ------------------------------------------------------
  {
    key: "deploy-paas",
    label: "Deployment and hosting",
    query: "self-hosted platform as a service for deploying and hosting applications on your own server",
    keywords: ["paas", "deployment", "hosting", "heroku-alternative", "deploy", "dokku", "app-platform"],
    categories: ["infrastructure-devops"],
  },
  {
    key: "containers",
    label: "Containers and orchestration",
    query: "container runtime and orchestration for running services across machines",
    keywords: ["docker", "kubernetes", "containers", "orchestration", "helm", "cluster"],
    categories: ["infrastructure-devops"],
  },
  {
    key: "ci-cd",
    label: "CI/CD",
    query: "continuous integration and delivery that builds, tests and ships code automatically on every commit",
    keywords: ["ci", "cd", "ci-cd", "pipeline", "continuous-integration", "continuous-delivery", "buildkite"],
    categories: ["infrastructure-devops", "developer-tools"],
  },
  {
    key: "monitoring",
    label: "Monitoring and observability",
    query: "monitoring and observability with metrics, tracing, dashboards and alerting on service health",
    keywords: ["monitoring", "observability", "metrics", "tracing", "prometheus", "alerting", "uptime"],
    categories: ["infrastructure-devops"],
  },
  {
    key: "error-tracking",
    label: "Error tracking",
    query: "error tracking and crash reporting that captures exceptions and stack traces from production",
    keywords: ["error-tracking", "crash", "crash-reporting", "exceptions", "sentry-alternative", "bug-tracking", "stacktrace"],
    categories: ["infrastructure-devops", "developer-tools"],
  },
  {
    key: "logging",
    label: "Logs",
    query: "log collection, aggregation and search across services",
    keywords: ["logging", "logs", "log-management", "log-aggregation", "syslog"],
    categories: ["infrastructure-devops"],
  },
  {
    key: "backup",
    label: "Backups",
    query: "backup and restore tooling for databases, files and servers",
    keywords: ["backup", "restore", "snapshot", "disaster-recovery", "archive"],
    categories: ["infrastructure-devops"],
  },
  {
    key: "vpn-network",
    label: "Networking and access",
    query: "VPN, tunnel and reverse proxy for connecting to private services securely",
    keywords: ["vpn", "proxy", "reverse-proxy", "tunnel", "networking", "ingress", "wireguard"],
    categories: ["infrastructure-devops"],
  },

  // ---- Working ---------------------------------------------------------
  {
    key: "notes-docs",
    label: "Notes and knowledge base",
    query: "note taking and knowledge base app for writing documents, wikis and personal notes",
    keywords: ["notes", "knowledge-base", "wiki", "markdown", "note-taking", "notion-alternative", "docs"],
    categories: ["productivity-automation"],
  },
  {
    key: "project-mgmt",
    label: "Project management",
    query: "project management with issues, kanban boards, sprints and task tracking for a team",
    keywords: ["project-management", "kanban", "issue-tracking", "task-tracking", "agile", "scrum", "todo", "backlog"],
    categories: ["productivity-automation"],
  },
  {
    key: "automation",
    label: "Workflow automation",
    query: "workflow automation that connects apps together and runs no-code integrations between services",
    keywords: ["automation", "workflow", "no-code", "integration", "zapier-alternative", "low-code"],
    categories: ["productivity-automation"],
  },
  {
    key: "scheduling",
    label: "Scheduling and booking",
    query: "appointment scheduling and booking pages with calendar availability",
    keywords: ["scheduling", "booking", "calendar", "appointments", "availability", "meetings"],
    categories: ["productivity-automation"],
  },
  {
    key: "docs-site",
    label: "Documentation sites",
    query: "documentation site generator for publishing developer docs and API references",
    keywords: ["documentation", "docs", "api-docs", "docusaurus", "mkdocs", "openapi"],
    categories: ["developer-tools", "productivity-automation"],
  },

  // ---- Building it -----------------------------------------------------
  {
    key: "testing",
    label: "Testing",
    query: "testing framework for unit tests, integration tests and end to end browser testing",
    keywords: ["testing", "test-framework", "e2e", "unit-testing", "assertions", "test-runner"],
    categories: ["developer-tools"],
  },
  {
    key: "api-client",
    label: "API clients and debugging",
    query: "API client for sending HTTP requests, inspecting responses and testing endpoints while developing",
    keywords: ["api-client", "http-client", "rest-client", "postman-alternative", "api-testing", "debugging"],
    categories: ["developer-tools"],
  },
  {
    key: "scraping",
    label: "Scraping and crawling",
    query: "web scraping and crawling toolkit for extracting structured data from websites",
    keywords: ["scraping", "crawler", "web-scraping", "spider", "data-extraction", "headless-browser"],
    categories: ["developer-tools"],
  },
  {
    key: "video",
    label: "Video and media",
    query: "video streaming, transcoding and media processing",
    keywords: ["video", "streaming", "transcoding", "ffmpeg", "media", "audio"],
    categories: ["developer-tools"],
  },
]

export const NEED_BY_KEY = new Map(NEEDS.map((need) => [need.key, need]))

export function getNeed(key: string): NeedSpec | undefined {
  return NEED_BY_KEY.get(key)
}

/**
 * Goal patterns.
 *
 * A founder rarely names a need. They name an outcome — "users keep leaving",
 * "I want to build an AI SaaS" — and the needs are implied. Each entry maps
 * one outcome to the needs it decomposes into, most important first.
 *
 * Order matters: the first pattern that matches wins, so specific goals are
 * listed before general ones ("build an AI SaaS" before "build a SaaS").
 */
export type GoalSpec = {
  key: string
  /** Matched against the lowercased message. */
  patterns: RegExp[]
  /** Need keys, best first. */
  needs: string[]
  /** Used in the answer summary. */
  describes: string
}

export const GOALS: GoalSpec[] = [
  {
    key: "improve-ui-ux",
    patterns: [
      /\b(ui|ux)\b/,
      /user experience/,
      /user interface/,
      /\b(redesign|restyle)\b/,
      /(improve|better|modernis|moderniz|polish|refresh).{0,24}\b(design|look|interface|frontend|front-end)\b/,
      /\b(design|looks?)\b.{0,20}\b(bad|dated|ugly|outdated)\b/,
    ],
    needs: ["ui-components", "animation", "icons", "design-system", "accessibility", "ux-analytics"],
    describes: "improving the interface",
  },
  {
    key: "users-leaving",
    patterns: [
      /users? (keep |are )?(leav|drop|bounc|churn)/,
      /\b(churn|bounce rate|retention problem|drop ?off)\b/,
      /(people|visitors|users).{0,24}\b(leave|leaving|not (coming|sticking))/,
      /nobody (is )?(sign|stay|com)/,
    ],
    needs: ["ux-analytics", "session-replay", "web-analytics", "ab-testing", "support-desk"],
    describes: "finding out why people leave",
  },
  {
    key: "build-ai-saas",
    patterns: [
      /\b(ai|llm|gpt|genai)\b.{0,24}\b(saas|product|app|startup|platform)\b/,
      /\b(saas|product|app|startup|platform)\b.{0,24}\b(ai|llm|gpt)\b/,
      /\bai (powered|based|driven)\b/,
    ],
    needs: ["llm-apps", "vector-db", "auth", "backend-baas", "database", "deploy-paas"],
    describes: "building an AI product",
  },
  {
    key: "build-saas",
    patterns: [
      /\b(build|building|start|launch|ship|creat\w*)\b.{0,30}\b(saas|web app|webapp|startup|product|mvp|platform)\b/,
      /\b(saas|mvp) (boilerplate|starter|stack|from scratch)\b/,
      /what (do|should) i (use|need) to build/,
    ],
    needs: ["auth", "backend-baas", "database", "ui-components", "deploy-paas", "email-transactional"],
    describes: "standing up a new product",
  },
  {
    key: "track-users",
    patterns: [
      /track (what |how )?(users?|people|visitors)/,
      /\b(user|product|usage) (behaviou?r|tracking|analytics)\b/,
      /see (what|how) (users?|people) (do|use|click)/,
      /\b(heatmap|funnel|conversion rate)\b/,
    ],
    needs: ["ux-analytics", "session-replay", "web-analytics"],
    describes: "understanding what users do",
  },
  {
    key: "send-emails",
    patterns: [
      /send(ing)? (out )?(emails?|mail|newsletters?)/,
      /\bemail (customers?|users?|subscribers?|list)\b/,
      /\b(transactional|marketing) email/,
      /\bnewsletter\b/,
    ],
    needs: ["email-transactional", "email-marketing", "notifications"],
    describes: "sending email",
  },
  {
    key: "talk-to-customers",
    patterns: [
      /\b(support|helpdesk|help desk|live chat|ticketing)\b/,
      /(talk|chat|respond) to (customers?|users?)/,
      /customer (service|support|questions)/,
    ],
    needs: ["support-desk", "chatbot", "notifications", "forms"],
    describes: "handling customer conversations",
  },
  {
    key: "self-host-everything",
    patterns: [
      /self[- ]host(ing|ed)? (everything|my stack|all)/,
      /(get|move) off (the )?cloud/,
      /\b(own|my) (server|hardware|infrastructure)\b/,
    ],
    needs: ["deploy-paas", "containers", "monitoring", "backup", "vpn-network"],
    describes: "running things yourself",
  },
  {
    key: "ship-faster",
    patterns: [
      /\b(ship|deploy|release)\b.{0,16}\b(faster|quicker|more often)\b/,
      /\b(ci\/?cd|continuous (integration|delivery|deployment))\b/,
      /automate (my )?(deploy|release|build)/,
    ],
    needs: ["ci-cd", "deploy-paas", "containers", "testing"],
    describes: "shipping more often",
  },
  {
    key: "site-is-slow",
    patterns: [
      /\b(site|app|page|website)\b.{0,20}\b(slow|sluggish|laggy)\b/,
      /\b(performance|speed) (problem|issue)/,
      /\b(crash|error|bug|down|outage)\b.{0,24}\b(production|prod|live)\b/,
    ],
    needs: ["monitoring", "error-tracking", "logging", "web-analytics"],
    describes: "diagnosing a production problem",
  },
]

/**
 * Well-known commercial products mapped to the need they represent.
 *
 * Only used to interpret the *question* — "alternative to Notion" tells us the
 * user wants the notes-and-wiki shelf. No repo is ever named from this table;
 * what comes back is whatever the catalogue holds on that shelf.
 */
export const PRODUCT_NEEDS: Record<string, string[]> = {
  notion: ["notes-docs", "project-mgmt"],
  evernote: ["notes-docs"],
  obsidian: ["notes-docs"],
  confluence: ["notes-docs", "docs-site"],
  airtable: ["database", "notes-docs"],
  intercom: ["support-desk", "chatbot"],
  zendesk: ["support-desk"],
  freshdesk: ["support-desk"],
  drift: ["support-desk"],
  "google analytics": ["web-analytics"],
  ga4: ["web-analytics"],
  mixpanel: ["ux-analytics"],
  amplitude: ["ux-analytics"],
  heap: ["ux-analytics"],
  hotjar: ["session-replay"],
  fullstory: ["session-replay"],
  logrocket: ["session-replay", "error-tracking"],
  segment: ["data-pipeline", "ux-analytics"],
  launchdarkly: ["ab-testing"],
  optimizely: ["ab-testing"],
  auth0: ["auth"],
  okta: ["auth"],
  clerk: ["auth"],
  cognito: ["auth"],
  keycloak: ["auth"],
  "1password": ["password-manager"],
  lastpass: ["password-manager"],
  bitwarden: ["password-manager"],
  doppler: ["secrets"],
  mailchimp: ["email-marketing"],
  klaviyo: ["email-marketing"],
  substack: ["email-marketing", "cms"],
  sendgrid: ["email-transactional"],
  postmark: ["email-transactional"],
  mailgun: ["email-transactional"],
  resend: ["email-transactional"],
  twilio: ["notifications"],
  onesignal: ["notifications"],
  salesforce: ["crm"],
  hubspot: ["crm", "email-marketing"],
  pipedrive: ["crm"],
  shopify: ["ecommerce"],
  woocommerce: ["ecommerce"],
  magento: ["ecommerce"],
  heroku: ["deploy-paas"],
  vercel: ["deploy-paas"],
  netlify: ["deploy-paas"],
  render: ["deploy-paas"],
  "fly.io": ["deploy-paas"],
  datadog: ["monitoring"],
  "new relic": ["monitoring"],
  grafana: ["monitoring"],
  sentry: ["error-tracking"],
  bugsnag: ["error-tracking"],
  rollbar: ["error-tracking"],
  splunk: ["logging"],
  firebase: ["backend-baas"],
  supabase: ["backend-baas"],
  appwrite: ["backend-baas"],
  algolia: ["search-engine"],
  elasticsearch: ["search-engine"],
  zapier: ["automation"],
  make: ["automation"],
  ifttt: ["automation"],
  jira: ["project-mgmt"],
  asana: ["project-mgmt"],
  trello: ["project-mgmt"],
  linear: ["project-mgmt"],
  monday: ["project-mgmt"],
  clickup: ["project-mgmt"],
  basecamp: ["project-mgmt"],
  typeform: ["forms"],
  surveymonkey: ["forms"],
  "google forms": ["forms"],
  calendly: ["scheduling"],
  dropbox: ["file-storage"],
  "google drive": ["file-storage"],
  s3: ["file-storage"],
  wordpress: ["cms"],
  contentful: ["cms"],
  sanity: ["cms"],
  strapi: ["cms"],
  ghost: ["cms", "email-marketing"],
  postman: ["api-client"],
  insomnia: ["api-client"],
  figma: ["design-system", "ui-components"],
  storybook: ["design-system"],
  looker: ["bi-dashboard"],
  tableau: ["bi-dashboard"],
  metabase: ["bi-dashboard"],
  powerbi: ["bi-dashboard"],
  snowflake: ["database", "data-pipeline"],
  tailscale: ["vpn-network"],
  cloudflare: ["vpn-network"],
  docusaurus: ["docs-site"],
  gitbook: ["docs-site"],
  openai: ["llm-apps", "llm-serving"],
  langchain: ["llm-apps"],
  pinecone: ["vector-db"],
  huggingface: ["ml-ops", "llm-serving"],
  slack: ["notifications", "support-desk"],
  discord: ["notifications"],
  zoom: ["video"],
  loom: ["video"],
}
