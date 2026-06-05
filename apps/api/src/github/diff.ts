export interface DiffFile {
  filename: string
  additions: number
  deletions: number
  patch?: string
}

/**
 * Extracts changed file paths from a unified diff string.
 * Used to pre-check which files were touched before the agent calls get_file_content.
 */
export function getChangedFiles(diff: string): string[] {
  const matches = diff.matchAll(/^diff --git a\/.+ b\/(.+)$/gm)
  return Array.from(matches, (m) => m[1])
}

/**
 * Returns true if the diff is large enough to warrant selective file fetching.
 * Prevents sending a 50k-character diff in a single message.
 */
export function isDiffLarge(diff: string, thresholdChars = 20_000): boolean {
  return diff.length > thresholdChars
}
