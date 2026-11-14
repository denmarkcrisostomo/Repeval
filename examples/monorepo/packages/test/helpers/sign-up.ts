// A test helper: it needs the test setup, so Repeval should leave it alone.
import { LEGAL_VERSIONS } from '@repo/contracts';

export function signUpPayload(email: string) {
  return { email, accepted: LEGAL_VERSIONS };
}
