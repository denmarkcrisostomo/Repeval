import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import { revokeToken } from '@/lib/github';

/** Without GitHub App credentials the site runs as a self-contained demo. */
export const DEMO = !process.env.AUTH_GITHUB_ID;

// Demo sessions hold no real data, so a fixed fallback secret is acceptable there and only there.
export const AUTH_SECRET = process.env.AUTH_SECRET ?? (DEMO ? 'repeval-demo-mode-only-not-a-real-secret' : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
  trustHost: true,
  // No database: the session is an encrypted cookie that expires with the GitHub token (8 hours).
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/signin' },
  providers: DEMO
    ? [
        Credentials({
          id: 'demo',
          name: 'Demo',
          credentials: {},
          authorize: async () => ({ id: 'demo', name: 'Demo user' }),
        }),
      ]
    : [GitHub],
  callbacks: {
    jwt({ token, account, profile }) {
      if (account?.provider === 'github' && account.access_token) {
        token.gh = account.access_token;
        token.login = (profile as { login?: string } | undefined)?.login;
      }
      if (account?.provider === 'demo') {
        token.login = 'you';
        token.demo = true;
      }
      return token;
    },
    // The GitHub token stays inside the encrypted cookie. The browser only ever sees the login and avatar.
    session({ session, token }) {
      session.user.login = typeof token.login === 'string' ? token.login : '';
      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      if (token && typeof token.gh === 'string') await revokeToken(token.gh);
    },
  },
});
