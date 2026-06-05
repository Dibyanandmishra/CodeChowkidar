import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-4xl font-bold">PR Review Agent</h1>
      <p className="text-gray-400 text-center max-w-md">
        AI-powered pull request reviews using Claude. Automatically detects security issues, bugs,
        and performance problems in your code.
      </p>
      <a
        href={`${API}/api/auth/github`}
        className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
      >
        Sign in with GitHub
      </a>
    </main>
  )
}
