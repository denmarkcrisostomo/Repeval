import { Icon } from './Sprite';

// "A second opinion, not a replacement": Repeval next to the kinds of tools people already use.
// Categories, not brand names, so it stays fair and doesn't go stale when one product changes.

type Cell = boolean | string | { yes: boolean; note: string };

const COLUMNS = ['Repeval', 'AI test agents', 'AI unit test generators', 'Hosted testing services'] as const;

const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: 'Price', cells: ['Free, open source (MIT)', 'Free tool, you pay for the AI', 'Free tier, then paid', 'Paid plans'] },
  { label: 'Works without AI or an API key', cells: [true, false, false, 'Varies'] },
  { label: 'Unit tests (functions)', cells: [true, false, true, false] },
  { label: 'Page and API tests', cells: [true, true, false, true] },
  { label: 'Screenshot of every page', cells: [true, 'Optional', false, true] },
  { label: 'Where your code runs', cells: ['Your own GitHub Actions', 'Your machine', 'Your machine or CI', 'Their cloud'] },
  { label: 'Tests you keep as code', cells: [{ yes: true, note: 'Vitest, Playwright' }, true, true, 'Often no'] },
  { label: 'Real user flows (sign in → checkout)', cells: ['Coming with AI mode', true, false, true] },
];

function Value({ cell }: { cell: Cell }) {
  if (typeof cell === 'string') return <span className="cmp-text">{cell}</span>;
  const yes = typeof cell === 'boolean' ? cell : cell.yes;
  const note = typeof cell === 'object' ? cell.note : null;
  return (
    <span className={`cmp-mark ${yes ? 'yes' : 'no'}`}>
      <Icon name={yes ? 'yes' : 'no'} />
      <span className="sr">{yes ? 'Yes' : 'No'}</span>
      {note && <span className="cmp-text">{note}</span>}
    </span>
  );
}

export function Compare() {
  return (
    <>
      {/* Wide screens: one table, Repeval first. */}
      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead>
            <tr>
              <td />
              {COLUMNS.map((c, i) => (
                <th key={c} scope="col" className={i === 0 ? 'mine' : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map((cell, i) => (
                  <td key={COLUMNS[i]} className={i === 0 ? 'mine' : undefined}>
                    <Value cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per tool, Repeval first. */}
      <div className="cmp-cards">
        {COLUMNS.map((c, i) => (
          <section key={c} className={`cmp-card${i === 0 ? ' mine' : ''}`} aria-label={c}>
            <h3>{c}</h3>
            <dl>
              {ROWS.map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>
                    <Value cell={r.cells[i]} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
