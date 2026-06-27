import { signIn, RateLimitedError } from '@/lib/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; retry?: string }>
}) {
  const { callbackUrl, error, retry } = await searchParams

  async function loginAction(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    try {
      await signIn('credentials', {
        email,
        password: formData.get('password') as string,
        redirectTo: callbackUrl ?? '/projects',
      })
    } catch (err) {
      const base = new URL('/login', process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
      if (callbackUrl) base.searchParams.set('callbackUrl', callbackUrl)
      if (err instanceof RateLimitedError) {
        base.searchParams.set('error', 'rate_limited')
        base.searchParams.set('retry', String(err.retryAfter))
        redirect(base.toString())
      }
      if (err instanceof AuthError) {
        base.searchParams.set('error', 'invalid_credentials')
        redirect(base.toString())
      }
      throw err
    }
  }

  const errorMessages: Record<string, string> = {
    invalid_credentials: '邮箱或密码不正确',
    rate_limited: '尝试次数过多，请稍后再试',
  }
  const errorMessage = error ? errorMessages[error] ?? '登录失败，请重试' : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">easyreq</h1>
          <p className="mt-1 text-sm text-gray-500">需求收集与状态跟踪工具</p>
        </div>

        <form action={loginAction} className="space-y-4 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
          {errorMessage && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {errorMessage}
              {error === 'rate_limited' && retry ? `（约 ${retry} 秒）` : null}
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="you@company.dev"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            登录
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          用户由管理员创建，如需账号请联系管理员
        </p>
      </div>
    </div>
  )
}
