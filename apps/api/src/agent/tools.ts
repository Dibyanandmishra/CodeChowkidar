import type Anthropic from '@anthropic-ai/sdk'

export const reviewTools: Anthropic.Tool[] = [
  {
    name: 'get_pr_diff',
    description: 'Get the full unified diff for the pull request showing all changed files and lines.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_file_content',
    description:
      'Get the full content of a specific file from the PR branch for deeper context around a change.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to repo root (e.g. src/auth/middleware.ts)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'post_review_comment',
    description: 'Post an inline review comment on a specific line of a changed file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        line: {
          type: 'number',
          description: 'Line number in the diff (the new file line number)',
        },
        comment: {
          type: 'string',
          description: 'The review comment. Be specific and suggest a fix.',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'suggestion'],
        },
        category: {
          type: 'string',
          enum: ['security', 'performance', 'error-handling', 'logic', 'style'],
        },
      },
      required: ['path', 'line', 'comment', 'severity', 'category'],
    },
  },
  {
    name: 'submit_review',
    description:
      'Submit the final GitHub review with an overall summary. Call this once when done — it ends the review.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Overall review summary (2-4 sentences). Mention critical issues first.',
        },
        verdict: {
          type: 'string',
          enum: ['approve', 'request_changes', 'comment'],
          description:
            'approve if no issues, request_changes if critical/warning issues, comment for suggestions only',
        },
      },
      required: ['summary', 'verdict'],
    },
  },
]
