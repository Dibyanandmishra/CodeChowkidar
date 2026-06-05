export interface ReviewJobData {
  reviewId: number
  repoFullName: string
  prNumber: number
  githubToken: string
}

export interface AgentResult {
  summary: string
  commentCount: number
  verdict: 'approve' | 'request_changes' | 'comment'
}

export interface ReviewFinding {
  filePath: string
  lineNumber: number | null
  category: 'security' | 'performance' | 'error-handling' | 'logic' | 'style'
  severity: 'critical' | 'warning' | 'suggestion'
  comment: string
}
