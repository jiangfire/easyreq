import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = request.nextUrl.pathname.startsWith('/login')
      const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth')

      if (isApiAuth) return true
      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL('/', request.nextUrl))
        return true
      }
      return isLoggedIn
    },
  },
}
