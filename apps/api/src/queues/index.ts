import { Queue } from 'bullmq'
import { config } from '../config'
import type { ReviewJobData } from '@pr-agent/types'

const connection = { url: config.REDIS_URL }

export const reviewQueue = new Queue<ReviewJobData>('pr-review', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

export { type ReviewJobData }
