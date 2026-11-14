import { env } from './env';

export function fromAddress(): string {
  return `hello@${new URL(env.NEXT_PUBLIC_APP_URL).hostname}`;
}
