import Link from 'next/link';
import { signOutAction } from '@/app/actions';
import type { Access } from '@/lib/session';
import { Logo } from './Sprite';
import { ThemeSwitch } from './ThemeSwitch';

/** Header for the signed-in screens. */
export function AppBar({ access, repo, tab }: { access: Access; repo?: { owner: string; name: string }; tab?: 'repos' | 'runs' }) {
  const repoHref = repo ? `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}` : null;
  return (
    <header className="wrap bar app-bar">
      <Link className="word" href="/" aria-label="Repeval home">
        <Logo />
      </Link>
      {repo && repoHref && (
        <Link className="repo-pill" href="/repos" title="Pick another repo">
          <span>{repo.owner} /</span> <b>{repo.name}</b>
          <svg fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <use href="#i-chev" />
          </svg>
        </Link>
      )}
      <nav className="app-tabs" aria-label="App">
        <Link href="/repos" aria-current={tab === 'repos' ? 'page' : undefined}>
          Repos
        </Link>
        {repoHref && (
          <Link href={repoHref} aria-current={tab === 'runs' ? 'page' : undefined}>
            Runs
          </Link>
        )}
      </nav>
      <div style={{ marginLeft: 'auto' }}>
        <ThemeSwitch />
      </div>
      <form action={signOutAction}>
        <button className="signout" type="submit">
          Sign out
        </button>
      </form>
      <span className="me" title={`Signed in as ${access.login}`}>
        {access.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={access.image} alt="" width={32} height={32} />
        ) : (
          access.login.slice(0, 1).toUpperCase()
        )}
        <span className="sr">Signed in as {access.login}</span>
      </span>
    </header>
  );
}

