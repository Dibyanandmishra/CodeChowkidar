import Link from 'next/link'

export default function Login({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errors: Record<string, string> = {
    oauth_denied: 'GitHub authorization was denied.',
    token_exchange_failed: 'Failed to exchange token with GitHub. Try again.',
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">Sign In</h1>
      {searchParams.error && (
        <p className="text-red-400 text-sm">{errors[searchParams.error] ?? 'An error occurred.'}</p>
      )}
      <Link href="/" className="text-indigo-400 hover:underline text-sm">
        Back to home
      </Link>
    </main>
  )
}
