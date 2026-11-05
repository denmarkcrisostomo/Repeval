import Link from 'next/link';
import { CopyButton } from '@/components/CopyButton';
import { DemoVideo } from '@/components/DemoVideo';
import { Faq } from '@/components/Faq';
import { API_SPEC, PAGES_SPEC, WORKFLOW_SNIPPET } from '@/components/landing-content';
import { SiteHeader } from '@/components/SiteHeader';
import { Icon } from '@/components/Sprite';
import { WorksWith } from '@/components/WorksWith';
import { Terminal } from '@/components/Terminal';
import { getAccess } from '@/lib/session';
import { NPM_URL, REPO_URL } from '@/lib/site';

const SHOTS = [
  { src: 'home', route: '/', alt: 'Demo shop home page', ok: true },
  { src: 'about', route: '/about', alt: 'Demo shop about page', ok: true },
  { src: 'cart', route: '/cart', alt: 'Demo shop cart page', ok: false },
  { src: 'help', route: '/help.html', alt: 'Demo shop help page', ok: true },
];

export default async function Home() {
  const signedIn = (await getAccess()) !== null;
  const start = signedIn ? '/repos' : '/signin';
  const signInLabel = signedIn ? 'Go to your repos' : 'Sign in with GitHub';
  return (
    <div className="page-in">
      <SiteHeader signedIn={signedIn} />

      <main className="wrap">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <h1>
                <span style={{ display: 'block' }}>Tests for code</span> <span style={{ display: 'block' }}>you never tested</span>
              </h1>
              <p className="lede" style={{ maxWidth: '40ch' }}>
                Repeval tests your app inside your own GitHub Actions: it reads your code there, writes the tests, runs them and hands back a
                screenshot of every page. Your code never comes to us, and we keep no database.
              </p>
              <div className="actions">
                <Link className="btn btn-primary" href={start}>
                  <Icon name="gh" />
                  {signInLabel}
                </Link>
                <CopyButton text="npx repeval" />
              </div>
              <ul className="facts">
                <li>Free and open source</li>
                <li>Your code never leaves GitHub</li>
                <li>No database, nothing stored</li>
                <li>No AI required</li>
              </ul>
            </div>
            <DemoVideo />
          </div>
        </section>

        <WorksWith />

        <section className="section" id="how">
          <div className="sec-head">
            <h2>Six steps, nothing hidden</h2>
            <p>Every run goes through the same six steps on a fresh GitHub machine. You can watch each one happen, and every result is explained in plain words.</p>
          </div>
          <ol className="steps-list">
            <li>
              <b>Collect</b>
              <p>GitHub copies your repo onto a temporary machine. Repeval itself never receives your code.</p>
              <p className="see">
                Skips <code>node_modules</code>, build output and binaries.
              </p>
            </li>
            <li>
              <b>Understand</b>
              <p>Reads your stack, every exported function, every page and API endpoint, and how to start the app.</p>
              <p className="see">Next.js, Vite, Express, Fastify, Hono, SvelteKit, Remix, React Router.</p>
            </li>
            <li>
              <b>Plan</b>
              <p>Decides what to test. Anything it can&apos;t test yet is listed with the reason, never silently dropped.</p>
              <p className="see">Example: &quot;/products/:id needs example IDs&quot;.</p>
            </li>
            <li>
              <b>Make tests</b>
              <p>Writes real test files: Vitest for your functions, Playwright for your pages and API.</p>
              <p className="see">Your own files are never changed.</p>
            </li>
            <li>
              <b>Run</b>
              <p>Starts your app, opens every page in a real browser and takes a screenshot at desktop and phone width.</p>
              <p className="see">Possible bugs are reported, never hidden by weakening a test.</p>
            </li>
            <li>
              <b>Results</b>
              <p>Hands back a report with every test, every screenshot and the test files to keep.</p>
              <p className="see">Saved in your repo for 7 days, then deleted.</p>
            </li>
          </ol>
        </section>

        <section className="section" id="get">
          <div className="sec-head">
            <h2>Proof you can open</h2>
            <p>
              This is a real run on the demo shop from the examples folder. Every page was opened in a browser, and one of them had a bug nobody
              had noticed.
            </p>
          </div>
          <div className="proof">
            <div className="strip" data-ui>
              {SHOTS.map((s) => (
                <figure className="frame" key={s.src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="for-light" src={`/img/${s.src}.png`} alt={s.alt} loading="lazy" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="for-dark" src={`/img/${s.src}-dark.png`} alt={s.alt} loading="lazy" />
                  <figcaption>
                    <b>{s.route}</b>
                    <span className={s.ok ? 'ok-t' : 'bug-t'}>{s.ok ? 'passed' : 'possible bug'}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="bugcard">
              <span className="status bug" style={{ alignSelf: 'flex-start' }}>
                Possible bug
              </span>
              <h3>The cart page throws an error in the browser</h3>
              <p style={{ margin: 0 }}>
                The page loads, but its script uses <code>cartTotal</code>, which doesn&apos;t exist, so the total never updates. Visitors see a
                $28.00 subtotal and a $0.00 total.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="phone for-light" src="/img/cart-m.png" alt="Cart page on a phone" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="phone for-dark" src="/img/cart-m-dark.png" alt="Cart page on a phone" />
            </div>
          </div>
        </section>

        <section className="section" id="keep">
          <div className="sec-head">
            <h2>Tests you can keep</h2>
            <p>Every test Repeval writes is a normal file. Press Commit to a branch to send them all to your repo as a pull request, or download them. Once merged, they keep checking your app on every change.</p>
          </div>
          <div className="specs">
            <div className="editor" data-ui>
              <div className="term-bar">
                <span>tests/e2e/pages.spec.ts</span>
                <span>Playwright · pages</span>
              </div>
              <pre className="codebox" dangerouslySetInnerHTML={{ __html: PAGES_SPEC }} />
            </div>
            <div className="editor" data-ui>
              <div className="term-bar">
                <span>tests/e2e/api.spec.ts</span>
                <span>Playwright · API</span>
              </div>
              <pre className="codebox" dangerouslySetInnerHTML={{ __html: API_SPEC }} />
            </div>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="sec-head split">
            <div className="sec-main">
              <h2>Your code stays in GitHub</h2>
              <p>
                Runs happen inside your own repo&apos;s GitHub Actions. The website starts them and shows the results. It has no database and no
                permission to read your code.
              </p>
            </div>
            <div className="who">
              <h3 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,2.2vw,30px)', lineHeight: 1.2 }}>Who can see my code?</h3>
              <p style={{ margin: 0, fontSize: 19 }}>
                <b>Only GitHub.</b> The tests run on a temporary machine in your own GitHub account, which is deleted when the run ends. The
                Repeval website only sees your repo names and the run&apos;s results, and it doesn&apos;t keep those either. Sign out and nothing
                about you remains.
              </p>
            </div>
          </div>
          <div className="privacy">
            <div className="perm">
              <div className="yes">
                <h3>Repeval can</h3>
                <ul>
                  <li><Icon name="yes" /><span>See the names of repos you allow</span></li>
                  <li><Icon name="yes" /><span>Start the Repeval workflow when you press Run</span></li>
                  <li><Icon name="yes" /><span>Read that run&apos;s progress and report</span></li>
                </ul>
              </div>
              <div className="no">
                <h3>Repeval can&apos;t</h3>
                <ul>
                  <li><Icon name="no" /><span>Read your source code</span></li>
                  <li><Icon name="no" /><span>Push commits, edit files or open pull requests</span></li>
                  <li><Icon name="no" /><span>See your secrets, like an AI key</span></li>
                  <li><Icon name="no" /><span>Keep anything after you sign out</span></li>
                </ul>
              </div>
            </div>
            <div className="yaml-wrap">
              <pre className="codebox" data-ui dangerouslySetInnerHTML={{ __html: WORKFLOW_SNIPPET }} />
              <div className="yaml-note">
                <span className="status ok">Runs only when you press Run</span>
                <span className="status ok">Read-only</span>
                <span className="status ok">Delete the file to disconnect</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="ways">
          <div className="sec-head">
            <h2>Or run it in your terminal</h2>
            <p>The website and the command line run exactly the same steps. Locally, nothing leaves your computer at all.</p>
          </div>
          <div className="ways">
            <Terminal />
            <div className="way-card">
              <h3>From the website</h3>
              <ol className="way-steps">
                <li><b>Sign in with GitHub</b><span>Repeval asks only to run its workflow and see repo names, never to read your code.</span></li>
                <li><b>Pick a repo</b><span>Only the repos you allowed on GitHub are listed.</span></li>
                <li><b>Add one workflow file</b><span>You read it and commit it yourself, on GitHub&apos;s own page.</span></li>
                <li><b>Press Run and watch the board</b><span>Each step shows live, then the report opens with every screenshot.</span></li>
              </ol>
              <p style={{ margin: 0, color: 'var(--muted)', textAlign: 'center', textWrap: 'balance' }}>
                Free for public repos. Private repos use the Actions minutes included with your GitHub plan.
              </p>
              <Link className="btn btn-primary" href={start} style={{ alignSelf: 'center' }}>
                <Icon name="gh" />
                {signInLabel}
              </Link>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <h2>Questions people ask first</h2>
          <Faq />
        </section>

        <section className="cta">
          <h2>Catch it before your users do</h2>
          <div>
            <p>Point Repeval at a repo you&apos;ve never tested. Free, open source, and your code never leaves GitHub.</p>
            <div className="actions" style={{ marginTop: 0 }}>
              <Link className="btn btn-primary" href={start}>
                <Icon name="gh" />
                {signInLabel}
              </Link>
              <CopyButton text="npx repeval" />
            </div>
          </div>
        </section>
      </main>

      <footer className="wrap site">
        <p className="footer-word" aria-hidden="true">
          repeval
        </p>
        <div className="footer-row">
          <span>Repository + Evaluate. MIT licensed, free forever.</span>
          <nav aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#privacy">Privacy</a>
            <a href="#faq">FAQ</a>
            <a href={REPO_URL}>GitHub</a>
            <a href={NPM_URL}>npm</a>
          </nav>
        </div>
        <p className="footer-fine">
          Product names and logos are trademarks of their owners. Repeval is not affiliated with or endorsed by them. Logos from Simple Icons.
        </p>
      </footer>
    </div>
  );
}
