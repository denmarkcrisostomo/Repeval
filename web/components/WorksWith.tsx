import { STACK, type StackLogo } from './stack-logos';

/** "Works with" banner: the stack Repeval supports today, scrolling slowly. CSS only. */
export function WorksWith() {
  return (
    <section className="works" aria-label="Works with">
      <p className="works-label">Works with</p>
      <div className="marquee">
        <ul className="marquee-track">
          {STACK.map((s) => (
            <Item key={s.name} logo={s} />
          ))}
          {/* Second copy so the loop is seamless; screen readers only hear the first. */}
          {STACK.map((s) => (
            <Item key={`${s.name}-2`} logo={s} hidden />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Item({ logo, hidden }: { logo: StackLogo; hidden?: boolean }) {
  return (
    <li aria-hidden={hidden || undefined}>
      {logo.path ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={logo.path} />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="plain">
          <rect x="2.5" y="4" width="19" height="16" rx="3" />
          <path d="M2.5 9h19M6 6.5h.01M8.5 6.5h.01" />
        </svg>
      )}
      {logo.name}
    </li>
  );
}
