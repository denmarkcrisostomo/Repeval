import Link from 'next/link';
import { Icon, Logo } from './Sprite';
import { ThemeSwitch } from './ThemeSwitch';

/** Header for the landing page and sign-in. */
export function SiteHeader({ signedIn, nav = true }: { signedIn: boolean; nav?: boolean }) {
  return (
    <header className="wrap bar">
      <Link className="word" href="/" aria-label="Repeval home">
        <Logo />
      </Link>
      {nav && (
        <nav aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#get">What you get</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
        </nav>
      )}
      <div style={nav ? undefined : { marginLeft: 'auto' }}>
        <ThemeSwitch />
      </div>
      {nav && (
        <Link className="btn btn-primary btn-sign" href={signedIn ? '/repos' : '/signin'}>
          <Icon name="gh" />
          <span>{signedIn ? 'Your repos' : 'Sign in'}</span>
        </Link>
      )}
    </header>
  );
}
