'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface Repo {
  id: number
  fullName: string
  isActive: boolean
  createdAt: string
}

interface Review {
  id: number
  prNumber: number
  prTitle: string
  prUrl: string
  prAuthor: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  verdict: string | null
  commentCount: number
  createdAt: string
  repo: { fullName: string }
}

const STATUS_COLOR = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
}

export default function Dashboard() {
  const params = useSearchParams()
  const router = useRouter()
  const [repos, setRepos] = useState<Repo[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [newRepo, setNewRepo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (token) {
      localStorage.setItem('token', token)
      router.replace('/dashboard')
    }
    load()
  }, [])

  async function load() {
    const [r, rv] = await Promise.all([api.repos.list(), api.reviews.list()])
    setRepos(r)
    setReviews(rv)
  }

  async function addRepo(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.repos.add(newRepo)
      setNewRepo('')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Add repo */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Watched Repositories</h2>
        <form onSubmit={addRepo} className="flex gap-2 mb-4">
          <input
            value={newRepo}
            onChange={(e) => setNewRepo(e.target.value)}
            placeholder="owner/repo"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-sm font-medium">
            Add
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <ul className="space-y-2">
          {repos.map((r) => (
            <li key={r.id} className="flex items-center justify-between bg-gray-900 rounded p-3">
              <span className="font-mono text-sm">{r.fullName}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => api.repos.toggle(r.id, !r.isActive).then(load)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  {r.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => api.repos.remove(r.id).then(load)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Reviews */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Reviews</h2>
        {reviews.length === 0 && (
          <p className="text-gray-500 text-sm">
            No reviews yet. Open a PR in a watched repo to trigger one.
          </p>
        )}
        <ul className="space-y-2">
          {reviews.map((rv) => (
            <li key={rv.id} className="bg-gray-900 rounded p-4 space-y-1">
              <div className="flex items-center justify-between">
                <a href={rv.prUrl} target="_blank" className="font-medium hover:text-indigo-400">
                  {rv.repo.fullName} #{rv.prNumber}
                </a>
                <span className={`text-xs font-mono ${STATUS_COLOR[rv.status]}`}>
                  {rv.status}
                </span>
              </div>
              <p className="text-sm text-gray-400">{rv.prTitle}</p>
              {rv.status === 'completed' && (
                <p className="text-xs text-gray-500">
                  {rv.commentCount} comment{rv.commentCount !== 1 ? 's' : ''} · {rv.verdict}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
