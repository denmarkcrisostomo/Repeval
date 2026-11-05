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
                  <Perm icon="yes" title="Actions: read and write" text="Start the Repeval workflow and read its results" />
                  <Perm icon="yes" title="Metadata: read" text="See the names of the repos you allow" />
                </ul>
              </div>
              <div className="no">
                <h2>Repeval never asks for</h2>
                <ul>
                  <Perm icon="no" title="Contents" text="Your code. Without it, Repeval can't open a single file" />
                  <Perm icon="no" title="Write access, pull requests or secrets" text="Repeval can't change your repo or see your keys" />
                </ul>
              </div>
            </div>
          </div>
          <form action={signInAction} className="actions actions-center">
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

function Perm({ icon, title, text }: { icon: 'yes' | 'no'; title: string; text: string }) {
  return (
    <li>
      <Icon name={icon} />
      <span>
        <b>{title}</b>
        <small>{text}</small>
      </span>
    </li>
  );
}
