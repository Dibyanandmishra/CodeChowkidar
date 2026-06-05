import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db'
import { reviews } from '../db/schema'
import { runReviewAgent } from '../agent'
import type { ReviewJobData } from '@pr-agent/types'

const connection = { url: config.REDIS_URL }

export const reviewWorker = new Worker<ReviewJobData>(
  'pr-review',
  async (job) => {
    const { reviewId, repoFullName, prNumber, githubToken } = job.data

    await db.update(reviews).set({ status: 'processing' }).where(eq(reviews.id, reviewId))

    const result = await runReviewAgent({ reviewId, repoFullName, prNumber, githubToken })

    await db
      .update(reviews)
      .set({
        status: 'completed',
        summary: result.summary,
        verdict: result.verdict,
        commentCount: result.commentCount,
        completedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))

    return result
  },
  {
    connection,
    concurrency: 3,
  }
)

reviewWorker.on('failed', async (job, err) => {
  if (!job) return
  await db
    .update(reviews)
    .set({ status: 'failed' })
    .where(eq(reviews.id, job.data.reviewId))
  console.error(`Review job ${job.id} failed:`, err.message)
})
