import { Webhooks } from '@octokit/webhooks'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db'
import { repos, reviews } from '../db/schema'
import { reviewQueue } from '../queues'

export const webhooks = new Webhooks({ secret: config.GITHUB_WEBHOOK_SECRET })

async function handlePullRequest(
  repoFullName: string,
  prNumber: number,
  prTitle: string,
  prUrl: string,
  prAuthor: string
) {
  const repo = await db.query.repos.findFirst({
    where: eq(repos.fullName, repoFullName),
    with: { user: true },
  })

  if (!repo?.isActive) return

  const [review] = await db
    .insert(reviews)
    .values({ repoId: repo.id, prNumber, prTitle, prUrl, prAuthor, status: 'pending' })
    .returning()

  await reviewQueue.add(
    `review-pr-${repoFullName}-${prNumber}`,
    {
      reviewId: review.id,
      repoFullName,
      prNumber,
      githubToken: repo.user.githubToken,
    },
    { jobId: `review-${review.id}` }
  )
}

webhooks.on('pull_request.opened', async ({ payload }) => {
  await handlePullRequest(
    payload.repository.full_name,
    payload.pull_request.number,
    payload.pull_request.title,
    payload.pull_request.html_url,
    payload.pull_request.user.login
  )
})

// Re-review when new commits are pushed to the PR
webhooks.on('pull_request.synchronize', async ({ payload }) => {
  await handlePullRequest(
    payload.repository.full_name,
    payload.pull_request.number,
    payload.pull_request.title,
    payload.pull_request.html_url,
    payload.pull_request.user.login
  )
})
