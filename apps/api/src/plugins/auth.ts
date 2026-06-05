import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema'

export interface JwtPayload {
  userId: number
  githubLogin: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (req: FastifyRequest) => {
    const payload = await req.jwtVerify<JwtPayload>()
    // Verify user still exists
    const user = await fastify.db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    })
    if (!user) throw fastify.httpErrors.unauthorized('User not found')
    req.user = payload
  })
}

export default fp(authPlugin, { name: 'auth', dependencies: ['db'] })
