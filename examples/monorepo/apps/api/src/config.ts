// Honours SKIP_ENV_VALIDATION, like a t3-env setup that allows CI builds without secrets.
const key = ['ANALYTICS', 'WRITE', 'KEY'].join('_');
if (!process.env.SKIP_ENV_VALIDATION && !process.env[key]) throw new Error('Invalid environment variables');

export function analyticsEnabled(): boolean {
  return Boolean(process.env[key]);
}
