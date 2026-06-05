import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { config } from './config'
import dbPlugin from './plugins/db'
import authPlugin from './plugins/auth'
import { authRoutes } from './routes/auth'
import { repoRoutes } from './routes/repos'
import { reviewRoutes } from './routes/reviews'
import { webhookRoutes } from './routes/webhooks'
import { reviewWorker } from './workers/review.worker'

async function main() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  })

  // Core plugins
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  })
  await app.register(cookie)
  await app.register(jwt, { secret: config.JWT_SECRET })
  await app.register(dbPlugin)
  await app.register(authPlugin)

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(repoRoutes, { prefix: '/api/repos' })
  await app.register(reviewRoutes, { prefix: '/api/reviews' })
  await app.register(webhookRoutes, { prefix: '/api' })

  app.get('/health', async () => ({ ok: true, uptime: process.uptime() }))

  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  app.log.info(`API running on http://localhost:${config.PORT}`)

  // Ensure worker is initialized and listening
  app.log.info(`Review worker ready (concurrency: 3)`)
  reviewWorker // imported for side-effect — starts the BullMQ worker

  // Graceful shutdown
  const shutdown = async () => {
    await reviewWorker.close()
    await app.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
