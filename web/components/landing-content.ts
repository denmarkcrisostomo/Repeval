// Static code samples for the landing page, as highlighted HTML. They are fixed strings written here, never user input.
export const PAGES_SPEC = `<span class="cm">// Smoke test for every page: it loads, shows content, has no browser errors.</span>
<span class="kw">import</span> { expect, test } <span class="kw">from</span> <span class="st">'@playwright/test'</span>;
<span class="kw">import</span> { openPage } <span class="kw">from</span> <span class="st">'./_repeval'</span>;

<span class="kw">test</span>(<span class="st">"page /cart loads"</span>, <span class="kw">async</span> ({ page }) =&gt; {
  <span class="kw">const</span> { response, errors, screenshot } =
    <span class="kw">await</span> openPage(page, <span class="st">"/cart"</span>, <span class="st">"cart"</span>);
  <span class="kw">await</span> screenshot(<span class="st">'desktop'</span>);
  <span class="kw">await</span> page.setViewportSize({ width: 390, height: 844 });
  <span class="kw">await</span> screenshot(<span class="st">'mobile'</span>);

  expect(response?.status() ?? 0, <span class="st">'HTTP status'</span>).toBeLessThan(400);
  expect(errors, <span class="st">'browser errors on this page'</span>).toEqual([]);
});`;

export const API_SPEC = `<span class="cm">// Checks that each simple GET endpoint answers without a server error.</span>
<span class="kw">import</span> { expect, test } <span class="kw">from</span> <span class="st">'@playwright/test'</span>;

<span class="kw">test</span>(<span class="st">"GET /api/products responds"</span>, <span class="kw">async</span> ({ request }) =&gt; {
  <span class="kw">const</span> res = <span class="kw">await</span> request.get(<span class="st">"/api/products"</span>);
  expect(res.status(), <span class="st">'HTTP status (5xx means the server failed)'</span>)
    .toBeLessThan(500);
});

<span class="kw">test</span>(<span class="st">"GET /api/health responds"</span>, <span class="kw">async</span> ({ request }) =&gt; {
  <span class="kw">const</span> res = <span class="kw">await</span> request.get(<span class="st">"/api/health"</span>);
  expect(res.status(), <span class="st">'HTTP status (5xx means the server failed)'</span>)
    .toBeLessThan(500);
});`;

export const WORKFLOW_SNIPPET = `<span class="cm"># .github/workflows/repeval.yml (you add this file yourself)</span>
<span class="kw">on</span>:
  <span class="kw">workflow_dispatch</span>:        <span class="cm"># runs only when you start it</span>
<span class="kw">permissions</span>:
  <span class="kw">contents</span>: read             <span class="cm"># can read, never write</span>
<span class="kw">jobs</span>:
  <span class="kw">repeval</span>:
    <span class="kw">runs-on</span>: ubuntu-latest   <span class="cm"># a fresh machine, deleted after</span>
    <span class="kw">steps</span>:
      - <span class="kw">run</span>: npx --yes repeval@0.1 analyze
      - <span class="kw">run</span>: npx --yes repeval@0.1 test
      - <span class="kw">uses</span>: actions/upload-artifact@v4   <span class="cm"># report kept 7 days</span>`;

/** The terminal transcript of a real demo-shop run. The Terminal component types it out line by line. */
export const TERMINAL = `<span class="p">$</span> npx repeval run

<span class="y">Collect files</span>
  Scanned     3 source files, 0 existing tests
<span class="y">Understand the repo</span>
  Stack       javascript, Express
  Pages       /  /about  /cart  /help.html  /products/:id
  Start       npm run start  (port 4310)
<span class="y">Plan</span>
  Targets     9 of 13: 3 unit, 4 pages, 2 API
<span class="y">Make tests</span>
  Wrote       4 test files in .repeval/
<span class="y">Run</span>
  Running unit tests with Vitest       <span class="g">✓ 5 passed</span>
  Running E2E tests with Playwright    <span class="g">✓ 5 passed</span>  <span class="r">× 1 failed</span>
<span class="y">Results</span>
  <span class="g">10 passed</span>  <span class="r">1 possible bug</span>  0 broken tests  <span class="d">4 skipped</span>
  <span class="r">×</span> page /cart loads <span class="d">· browser errors on this page: cartTotal is not defined</span>
  Report: repeval-report/index.html`;
