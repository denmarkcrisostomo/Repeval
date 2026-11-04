import 'server-only';
import { decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_SECRET } from '@/auth';

export type Access =
  | { kind: 'demo'; login: string; name: string; image: null }
  | { kind: 'github'; login: string; name: string; image: string | null; token: string };

// Auth.js names the cookie differently on https. Both are checked so local http and production work.
const COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token'];

/** Reads the signed-in user, including their GitHub token, from the encrypted session cookie. Server only. */
export async function getAccess(): Promise<Access | null> {
  if (!AUTH_SECRET) return null;
  const jar = await cookies();
  for (const name of COOKIES) {
    const value = jar.get(name)?.value;
    if (!value) continue;
    const t = await decode({ token: value, secret: AUTH_SECRET, salt: name }).catch(() => null);
    if (!t?.login) continue;
    if (t.demo) return { kind: 'demo', login: t.login, name: 'Demo user', image: null };
    if (typeof t.gh === 'string')
      return { kind: 'github', login: t.login, name: t.name ?? t.login, image: typeof t.picture === 'string' ? t.picture : null, token: t.gh };
  }
  return null;
}

export async function requireAccess(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect('/signin');
  return access;
}
