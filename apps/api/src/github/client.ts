import { Octokit } from '@octokit/rest'

export function createOctokitForUser(token: string): Octokit {
  return new Octokit({ auth: token })
}
