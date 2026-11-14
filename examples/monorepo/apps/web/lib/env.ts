// Like @t3-oss/env: the environment is checked as soon as this file loads.
const rules: Record<string, RegExp> = {
  DATABASE_URL: /^postgres(ql)?:\/\//,
  RESEND_API_KEY: /^.{10,}$/,
  NEXT_PUBLIC_APP_URL: /^https?:\/\//,
};
const bad = Object.keys(rules).filter((k) => !rules[k].test(process.env[k] ?? ''));
if (bad.length) {
  console.error('Invalid environment variables:', bad);
  throw new Error('Invalid environment variables');
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
};
