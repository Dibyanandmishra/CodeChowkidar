import type { FastifyPluginAsync } from 'fastify'
import { webhooks } from '../github/webhook'

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Scope a raw-body content type parser to this plugin only.
  // Webhook signature verification requires the original raw bytes.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body)
  )

  fastify.post('/webhooks/github', async (req, reply) => {
    const rawBody = (req.body as Buffer).toString('utf-8')
    const signature = req.headers['x-hub-signature-256'] as string | undefined
    const eventName = req.headers['x-github-event'] as string | undefined
    const deliveryId = req.headers['x-github-delivery'] as string | undefined

    if (!signature || !eventName || !deliveryId) {
      return reply.code(400).send({ error: 'Missing required GitHub headers' })
    }

    const valid = await webhooks.verify(rawBody, signature)
    if (!valid) return reply.code(401).send({ error: 'Invalid webhook signature' })

    // Fire-and-forget — GitHub expects a fast 202 response
    setImmediate(async () => {
      try {
        await webhooks.receive({
          id: deliveryId,
          name: eventName as any,
          payload: JSON.parse(rawBody),
        })
      } catch (err) {
        fastify.log.error({ err }, 'Webhook processing error')
      }
    })

    return reply.code(202).send({ ok: true })
  })
}
