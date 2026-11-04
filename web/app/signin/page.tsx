import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DEMO } from '@/auth';
import { signInAction } from '@/app/actions';
import { SiteHeader } from '@/components/SiteHeader';
import { Icon } from '@/components/Sprite';
import { SubmitButton } from '@/components/SubmitButton';
import { getAccess } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignIn() {
  if (await getAccess()) redirect('/repos');
  return (
    <div className="page-in">
      <SiteHeader signedIn={false} nav={false} />
      <main className="wrap center">
        <div className="panel">
          <h1>Sign in with GitHub</h1>
          <p>GitHub will show you this exact list before you agree. You choose which repos Repeval can see.</p>
          <div className="ask">
            <div className="perm">
              <div className="yes">
                <h2>Repeval asks for</h2>
                <ul>
                  <li><Icon name="yes" /><span><b>Actions</b>, read and write: start the Repeval workflow and read its results</span></li>
                  <li><Icon name="yes" /><span><b>Metadata</b>, read: see the names of the repos you allow</span></li>
                </ul>
              </div>
              <div className="no">
                <h2>Repeval never asks for</h2>
                <ul>
                  <li><Icon name="no" /><span>Your code (GitHub calls this &quot;Contents&quot;)</span></li>
                  <li><Icon name="no" /><span>Write access, pull requests or your secrets</span></li>
                </ul>
              </div>
            </div>
          </div>
          <form action={signInAction} className="actions">
            <SubmitButton pendingLabel={DEMO ? 'Signing in' : 'Waiting for GitHub'}>
              <Icon name="gh" />
              {DEMO ? 'Continue with the demo' : 'Continue to GitHub'}
            </SubmitButton>
            <Link className="btn btn-soft" href="/">
              Back
            </Link>
          </form>
          <p className="fine">Your sign-in lasts 8 hours and lives only in an encrypted cookie. There is no Repeval account or database.</p>
        </div>
      </main>
    </div>
  );
}
