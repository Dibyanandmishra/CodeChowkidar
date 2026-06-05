import type { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { repos } from '../db/schema'
import { createOctokitForUser } from '../github/client'
import { users } from '../db/schema'

const addRepoSchema = z.object({
  fullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'Must be in owner/repo format'),
})

export const repoRoutes: FastifyPluginAsync = async (fastify) => {
  // List repos registered by the current user
  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    return fastify.db.query.repos.findMany({
      where: eq(repos.userId, req.user.userId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    })
  })

  // Register a new repo for review
  fastify.post<{ Body: z.infer<typeof addRepoSchema> }>(
    '/',
    { preHandler: fastify.authenticate },
    async (req, reply) => {
      const body = addRepoSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { fullName } = body.data
      const [owner, repo] = fullName.split('/')

      // Fetch the user's GitHub token
      const user = await fastify.db.query.users.findFirst({
        where: eq(users.id, req.user.userId),
      })
      if (!user) return reply.code(401).send({ error: 'User not found' })

      // Verify the user has access to this repo
      const octokit = createOctokitForUser(user.githubToken)
      let repoData: { id: number }
      try {
        const { data } = await octokit.repos.get({ owner, repo })
        repoData = data
      } catch {
        return reply.code(404).send({ error: 'Repository not found or access denied' })
      }

      // Register a webhook on the repo
      let webhookId: string | undefined
      try {
        const { data: hook } = await octokit.repos.createWebhook({
          owner,
          repo,
          config: {
            url: `${req.protocol}://${req.hostname}/api/webhooks/github`,
            content_type: 'json',
            secret: process.env.GITHUB_WEBHOOK_SECRET,
          },
          events: ['pull_request'],
          active: true,
        })
        webhookId = String(hook.id)
      } catch {
        // Webhook creation failing shouldn't block registration
      }

      const [newRepo] = await fastify.db
        .insert(repos)
        .values({
          userId: req.user.userId,
          githubRepoId: String(repoData.id),
          fullName,
          webhookId,
        })
        .onConflictDoUpdate({
          target: repos.fullName,
          set: { isActive: true, webhookId },
        })
        .returning()

      return reply.code(201).send(newRepo)
    }
  )

  // Toggle repo active state
  fastify.patch<{ Params: { id: string }; Body: { isActive: boolean } }>(
    '/:id',
    { preHandler: fastify.authenticate },
    async (req, reply) => {
      const repoId = parseInt(req.params.id)
      const [updated] = await fastify.db
        .update(repos)
        .set({ isActive: req.body.isActive })
        .where(and(eq(repos.id, repoId), eq(repos.userId, req.user.userId)))
        .returning()
      if (!updated) return reply.code(404).send({ error: 'Repo not found' })
      return updated
    }
  )

  // Remove a repo
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: fastify.authenticate },
    async (req, reply) => {
      const repoId = parseInt(req.params.id)
      const [deleted] = await fastify.db
        .delete(repos)
        .where(and(eq(repos.id, repoId), eq(repos.userId, req.user.userId)))
        .returning()
      if (!deleted) return reply.code(404).send({ error: 'Repo not found' })
      return reply.code(204).send()
    }
  )
}
