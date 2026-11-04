import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: { login: string; name?: string | null; image?: string | null; email?: string | null };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    gh?: string;
    login?: string;
    demo?: boolean;
  }
}
