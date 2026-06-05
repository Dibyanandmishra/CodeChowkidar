import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  githubId: text('github_id').notNull().unique(),
  githubLogin: text('github_login').notNull(),
  githubToken: text('github_token').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const repos = pgTable('repos', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  githubRepoId: text('github_repo_id').notNull(),
  fullName: text('full_name').notNull().unique(),
  webhookId: text('webhook_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  repoId: integer('repo_id')
    .references(() => repos.id, { onDelete: 'cascade' })
    .notNull(),
  prNumber: integer('pr_number').notNull(),
  prTitle: text('pr_title').notNull(),
  prUrl: text('pr_url').notNull(),
  prAuthor: text('pr_author').notNull(),
  status: text('status', {
    enum: ['pending', 'processing', 'completed', 'failed'],
  })
    .notNull()
    .default('pending'),
  summary: text('summary'),
  verdict: text('verdict', { enum: ['approve', 'request_changes', 'comment'] }),
  commentCount: integer('comment_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

export const reviewFindings = pgTable('review_findings', {
  id: serial('id').primaryKey(),
  reviewId: integer('review_id')
    .references(() => reviews.id, { onDelete: 'cascade' })
    .notNull(),
  filePath: text('file_path').notNull(),
  lineNumber: integer('line_number'),
  category: text('category', {
    enum: ['security', 'performance', 'error-handling', 'logic', 'style'],
  }).notNull(),
  severity: text('severity', {
    enum: ['critical', 'warning', 'suggestion'],
  }).notNull(),
  comment: text('comment').notNull(),
  githubCommentId: text('github_comment_id'),
})

// Relations for Drizzle query builder
export const usersRelations = relations(users, ({ many }) => ({
  repos: many(repos),
}))

export const reposRelations = relations(repos, ({ one, many }) => ({
  user: one(users, { fields: [repos.userId], references: [users.id] }),
  reviews: many(reviews),
}))

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  repo: one(repos, { fields: [reviews.repoId], references: [repos.id] }),
  findings: many(reviewFindings),
}))

export const reviewFindingsRelations = relations(reviewFindings, ({ one }) => ({
  review: one(reviews, { fields: [reviewFindings.reviewId], references: [reviews.id] }),
}))
