import type { FastifyPluginAsync } from 'fastify'
import { eq, desc, and } from 'drizzle-orm'
import { reviews, repos } from '../db/schema'

export const reviewRoutes: FastifyPluginAsync = async (fastify) => {
  // List all reviews for the current user's repos
  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const userRepos = await fastify.db.query.repos.findMany({
      where: eq(repos.userId, req.user.userId),
      columns: { id: true },
    })
    const repoIds = userRepos.map((r) => r.id)
    if (repoIds.length === 0) return []

    return fastify.db.query.reviews.findMany({
      where: (r, { inArray }) => inArray(r.repoId, repoIds),
      with: { repo: { columns: { fullName: true } } },
      orderBy: [desc(reviews.createdAt)],
      limit: 50,
    })
  })

  // Get a single review with all findings
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authenticate },
    async (req, reply) => {
      const reviewId = parseInt(req.params.id)
      const review = await fastify.db.query.reviews.findFirst({
        where: eq(reviews.id, reviewId),
        with: {
          repo: true,
          findings: { orderBy: (f, { asc }) => [asc(f.severity)] },
        },
      })
      if (!review) return reply.code(404).send({ error: 'Review not found' })

      // Ensure this review belongs to the requesting user
      if (review.repo.userId !== req.user.userId) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      return review
    }
  )
}
