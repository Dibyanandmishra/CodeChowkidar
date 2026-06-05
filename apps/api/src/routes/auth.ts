import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { users } from '../db/schema'
import { createOctokitForUser } from '../github/client'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Step 1: Redirect to GitHub OAuth
  fastify.get('/github', async (req, reply) => {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID,
      scope: 'repo read:user',
      redirect_uri: `${req.protocol}://${req.hostname}:${config.PORT}/api/auth/github/callback`,
    })
    return reply.redirect(`https://github.com/login/oauth/authorize?${params}`)
  })

  // Step 2: GitHub redirects back with a code
  fastify.get<{ Querystring: { code?: string; error?: string } }>(
    '/github/callback',
    async (req, reply) => {
      const { code, error } = req.query
      if (error || !code) {
        return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_denied`)
      }

      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.GITHUB_CLIENT_ID,
          client_secret: config.GITHUB_CLIENT_SECRET,
          code,
        }),
      })
      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }

      if (!tokenData.access_token) {
        return reply.redirect(`${config.FRONTEND_URL}/login?error=token_exchange_failed`)
      }

      // Fetch GitHub user
      const octokit = createOctokitForUser(tokenData.access_token)
      const { data: ghUser } = await octokit.users.getAuthenticated()

      // Upsert user in DB
      const [user] = await fastify.db
        .insert(users)
        .values({
          githubId: String(ghUser.id),
          githubLogin: ghUser.login,
          githubToken: tokenData.access_token,
          avatarUrl: ghUser.avatar_url,
        })
        .onConflictDoUpdate({
          target: users.githubId,
          set: {
            githubLogin: ghUser.login,
            githubToken: tokenData.access_token,
            avatarUrl: ghUser.avatar_url,
          },
        })
        .returning()

      const jwtToken = fastify.jwt.sign({ userId: user.id, githubLogin: user.githubLogin })
      return reply.redirect(`${config.FRONTEND_URL}/dashboard?token=${jwtToken}`)
    }
  )

  // Get current user
  fastify.get('/me', { preHandler: fastify.authenticate }, async (req) => {
    const user = await fastify.db.query.users.findFirst({
      where: eq(users.id, req.user.userId),
      columns: { githubToken: false },
    })
    return user
  })
}
