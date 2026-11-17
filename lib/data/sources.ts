import curatedData from "@/data/repos.json"
import discoveredData from "@/data/discovered.json"

import type { Repo } from "@/lib/schema"

/**
 * The two data files. `npm run validate` is the gate that proves both match
 * repoSchema, so the app can treat them as typed data without paying for a
 * runtime parse on every build. The assertion goes through `unknown` because
 * TypeScript infers `string` for the enum fields of a JSON import.
 */
export const curatedRepos = curatedData as unknown as Repo[]

/**
 * Filled by the auto-import in a later stage. Committed as `[]` rather than
 * left missing: a static import of a missing file is a build error, and the
 * merge needs to be real code rather than a branch nothing exercises.
 */
export const discoveredRepos = discoveredData as unknown as Repo[]
