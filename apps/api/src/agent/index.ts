import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db'
import { reviewFindings } from '../db/schema'
import { createOctokitForUser } from '../github/client'
import { REVIEW_SYSTEM_PROMPT } from './prompts'
import { reviewTools } from './tools'
import type { AgentResult, ReviewJobData } from '@pr-agent/types'

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })

export async function runReviewAgent(input: ReviewJobData): Promise<AgentResult> {
  const { reviewId, repoFullName, prNumber, githubToken } = input
  const [owner, repo] = repoFullName.split('/')
  const octokit = createOctokitForUser(githubToken)

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Review pull request #${prNumber} in ${repoFullName}. Focus on bugs, security issues, and significant problems. Skip minor style nits.`,
    },
  ]

  let commentCount = 0
  let summary = ''
  let verdict: AgentResult['verdict'] = 'comment'

  // Agent loop — runs until the model calls submit_review or stops on its own
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      // Cache the system prompt and tools — they never change across turns
      system: [
        {
          type: 'text',
          text: REVIEW_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: reviewTools,
      messages,
    })

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') break

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      let result: string
      let doneAfterThis = false

      try {
        if (block.name === 'get_pr_diff') {
          const { data } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
            mediaType: { format: 'diff' },
          })
          result = String(data)
        } else if (block.name === 'get_file_content') {
          const { path } = block.input as { path: string }
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: `refs/pull/${prNumber}/head`,
          })
          if (Array.isArray(data)) {
            result = '[directory listing not supported]'
          } else if ('content' in data) {
            result = Buffer.from(data.content, 'base64').toString('utf-8')
          } else {
            result = '[file content unavailable]'
          }
        } else if (block.name === 'post_review_comment') {
          const inp = block.input as {
            path: string
            line: number
            comment: string
            severity: string
            category: string
          }
          await db.insert(reviewFindings).values({
            reviewId,
            filePath: inp.path,
            lineNumber: inp.line,
            category: inp.category as any,
            severity: inp.severity as any,
            comment: inp.comment,
          })
          commentCount++
          result = `Recorded finding on ${inp.path}:${inp.line}`
        } else if (block.name === 'submit_review') {
          const inp = block.input as { summary: string; verdict: string }
          summary = inp.summary
          verdict = inp.verdict as AgentResult['verdict']

          // Post the review to GitHub
          const findings = await db.query.reviewFindings.findMany({
            where: eq(reviewFindings.reviewId, reviewId),
          })

          const comments = findings
            .filter((f) => f.lineNumber !== null)
            .map((f) => ({ path: f.filePath, line: f.lineNumber!, body: `**[${f.severity}]** ${f.comment}` }))

          await octokit.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            body: summary,
            event: verdict.toUpperCase() as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
            comments,
          })

          result = 'Review submitted to GitHub'
          doneAfterThis = true
        } else {
          result = `Unknown tool: ${block.name}`
        }
      } catch (err) {
        result = `Tool error: ${err instanceof Error ? err.message : String(err)}`
      }

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })

      if (doneAfterThis) {
        messages.push({ role: 'user', content: toolResults })
        return { summary, commentCount, verdict }
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults })
    }
  }

  return { summary, commentCount, verdict }
}
