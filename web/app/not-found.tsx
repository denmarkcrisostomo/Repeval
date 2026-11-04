import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

export default function NotFound() {
  return (
    <>
      <SiteHeader signedIn={false} nav={false} />
      <main className="wrap center">
        <div className="panel">
          <h1>Not found</h1>
          <p>This page, repo or run isn&apos;t here. Repos only show up after you allow them on GitHub, and reports are kept for 7 days.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/repos">
              Your repos
            </Link>
            <Link className="btn btn-soft" href="/">
              Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
