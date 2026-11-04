/* Repeval prototype behaviour: routing, theme, the departures board, and the app flow. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  /* ---------- shared chrome ---------- */
  $$('[data-slot="app-bar"]').forEach((slot) => slot.replaceWith($('#app-bar').content.cloneNode(true)));
  $$('[data-slot="theme"]').forEach((slot) => slot.appendChild($('#theme-switch').content.cloneNode(true)));

  /* ---------- theme: system (default), light, dark ---------- */
  function applyTheme(choice) {
    const root = document.documentElement;
    if (choice === 'light' || choice === 'dark') root.dataset.scheme = choice;
    else delete root.dataset.scheme;
    store.set('repeval-theme', choice);
    $$('.theme').forEach((group) => {
      const btns = $$('button', group);
      btns.forEach((b, i) => {
        const on = b.dataset.themeChoice === choice;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on) $('.pill-bg', group).style.transform = `translateX(${i * 32}px)`;
      });
    });
  }
  $$('.theme').forEach((group) => {
    group.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) applyTheme(b.dataset.themeChoice); });
    group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const btns = $$('button', group); const i = btns.findIndex((b) => b.getAttribute('aria-checked') === 'true');
      const next = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
      applyTheme(next.dataset.themeChoice); next.focus(); e.preventDefault();
    });
  });
  applyTheme(['light', 'dark'].includes(store.get('repeval-theme')) ? store.get('repeval-theme') : 'system');

  /* ---------- toast ---------- */
  const toastEl = $('#toast'); let toastTimer;
  function toast(msg) {
    clearTimeout(toastTimer); toastEl.textContent = msg; toastEl.classList.remove('hiding'); toastEl.classList.add('show');
    toastTimer = setTimeout(() => { toastEl.classList.add('hiding'); toastEl.classList.remove('show'); }, 3200);
  }
  $$('[data-toast]').forEach((b) => b.addEventListener('click', () => toast(b.dataset.toast)));

  /* ---------- copy buttons ---------- */
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); } catch (e) { toast('Copy is blocked here. Select the text and copy it instead.'); return; }
    btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 1600);
  }
  $$('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy, b)));

  /* ---------- the split-flap board ---------- */
  const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  function makeBoard(el, widths, count) {
    el.innerHTML = '';
    return Array.from({ length: count }, () => {
      const row = document.createElement('div'); row.className = 'row waiting';
      const groups = widths.map((w, gi) => {
        const g = document.createElement('div'); g.className = 'cells' + (gi === 1 ? ' dt' : gi === widths.length - 1 ? ' st' : '');
        for (let i = 0; i < w; i++) { const c = document.createElement('span'); c.className = 'c'; c.textContent = ' '; g.appendChild(c); }
        row.appendChild(g); return g;
      });
      el.appendChild(row); return { row, groups, status: null };
    });
  }
  function flipTo(group, text, delay) {
    [...group.children].forEach((cell, i) => {
      const target = text[i] ?? ' ';
      if (cell.textContent === target) return;
      if (reduce) { cell.textContent = target; return; }
      let n = target === ' ' ? 0 : 2 + Math.floor(Math.random() * 4);
      setTimeout(function tick() {
        cell.classList.remove('flip'); void cell.offsetWidth; cell.classList.add('flip');
        cell.textContent = n > 0 ? CH[(Math.random() * CH.length) | 0] : target;
        if (n-- > 0) setTimeout(tick, 65);
      }, delay + i * 18);
    });
  }

  /* ---------- FAQ (accordion) ---------- */
  const FAQ = [
    ['Is it really free?', 'Yes. Repeval is open source under the MIT licence. On the website, runs use GitHub Actions in your own repo: free for public repos, and private repos use the minutes included with your GitHub plan.'],
    ['Do I need to know how to write tests?', 'No. Repeval writes the tests, runs them and explains every result in plain words. If you want to learn, the generated files are a good place to start: they are normal Vitest and Playwright tests.'],
    ['Do I need AI or an API key?', "No. This version uses proven templates: it checks every page and API, and records a baseline of what your functions return. AI mode, with your own key or a local model, is coming later and stays optional."],
    ['Which projects does it work with?', 'JavaScript and TypeScript projects, including Next.js, Vite, Express, Fastify, Hono, SvelteKit, Remix and React Router. Other languages come later.'],
    ['Will it change my code?', "No. Generated tests go into a .repeval folder that git ignores, and the report goes into repeval-report. The website can't write to your repo at all."],
    ['My app needs a database or secrets to start. What happens?', "Repeval reads .env.example and tells you which values are missing. Unit tests still run; page tests need the app to start, so add those values as secrets in your repo's settings."],
  ];
  $('#faqList').innerHTML = FAQ.map(([q, a], i) => `<div class="faq-item" data-open="false"><button type="button" aria-expanded="false" aria-controls="faq${i}"><span>${q}</span><svg viewBox="0 0 24 24"><use href="#i-chev"/></svg></button><div class="faq-panel" id="faq${i}" role="region"><div><p>${a}</p></div></div></div>`).join('');
  $$('.faq-item button').forEach((b) => b.addEventListener('click', () => {
    const item = b.parentElement; const open = item.dataset.open !== 'true';
    item.dataset.open = String(open); b.setAttribute('aria-expanded', String(open));
  }));

  /* ---------- repos ---------- */
  const REPOS = [
    { name: 'demo-shop', vis: 'Public', pushed: 'Pushed 2 hours ago', wf: true, last: ['bug', 'Last run: 1 possible bug'] },
    { name: 'ts-lib', vis: 'Public', pushed: 'Pushed yesterday', wf: true, last: ['ok', 'Last run: 22 passed'] },
    { name: 'portfolio-site', vis: 'Private', pushed: 'Pushed 3 days ago', wf: false, last: ['skip', 'Needs the workflow file'] },
    { name: 'notes-api', vis: 'Private', pushed: 'Pushed last week', wf: false, last: ['skip', 'Needs the workflow file'] },
    { name: 'landing-v2', vis: 'Public', pushed: 'Pushed last month', wf: false, last: ['skip', 'Needs the workflow file'] },
  ];
  let repo = store.get('repeval-repo') || 'demo-shop';
  function setRepo(name) { repo = name; store.set('repeval-repo', name); $$('[data-repo-name]').forEach((el) => (el.textContent = name)); }
  function renderRepos(q = '') {
    const list = REPOS.filter((r) => r.name.includes(q.trim().toLowerCase()));
    $('#repoList').innerHTML = list.length
      ? list.map((r) => `<li class="repo-row"><div><h3>${r.name}</h3><span class="meta">${r.vis}</span></div><span class="meta">${r.pushed}</span><span><span class="status ${r.last[0]}">${r.last[1]}</span></span><a class="btn ${r.wf ? 'btn-primary' : 'btn-soft'}" href="#${r.wf ? 'start' : 'setup'}" data-pick="${r.name}">${r.wf ? 'Run tests' : 'Set up'}</a></li>`).join('')
      : `<li class="empty">No repo matches "${q.replace(/</g, '&lt;')}". If it's missing, allow it on GitHub first.</li>`;
    $$('[data-pick]').forEach((a) => a.addEventListener('click', () => setRepo(a.dataset.pick)));
  }
  $('#repoSearch').addEventListener('input', (e) => renderRepos(e.target.value));
  renderRepos();

  /* ---------- sign in (simulated) ---------- */
  $('#signinBtn').addEventListener('click', () => {
    const btn = $('#signinBtn'); btn.disabled = true;
    $('#signinLabel').textContent = 'Waiting for GitHub';
    btn.insertAdjacentHTML('afterbegin', '<span class="spinner" aria-hidden="true"></span>'); btn.querySelector('svg').remove();
    setTimeout(() => { location.hash = 'repos'; toast('Signed in. In the real app this step happens on github.com.'); }, 1300);
  });

  /* ---------- setup (workflow file) ---------- */
  const YAML = `# .github/workflows/repeval.yml
# Repeval generates and runs tests for this repo.
# It only runs when you start it.
name: Repeval

on:
  workflow_dispatch:
    inputs:
      ai:
        type: choice
        options: [none, anthropic, openai]
        default: none
      tests:
        type: choice
        options: [all, unit, e2e, load]
        default: all

permissions:
  contents: read

jobs:
  repeval:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Analyze
        run: npx --yes repeval@0.1.0 analyze
      - name: Plan
        run: npx --yes repeval@0.1.0 plan --tests "$TESTS"
        env:
          TESTS: \${{ inputs.tests }}
      - name: Generate
        run: npx --yes repeval@0.1.0 generate --ai "$AI"
        env:
          AI: \${{ inputs.ai }}
      - name: Test
        run: npx --yes repeval@0.1.0 test
      - name: Save report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: repeval-report
          path: repeval-report/
          retention-days: 7`;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('#yamlFull').innerHTML = YAML.split('\n').map((l) => {
    if (/^\s*#/.test(l)) return `<span class="cm">${esc(l)}</span>`;
    return esc(l).replace(/^(\s*-?\s*)([\w-]+)(:)/, '$1<span class="kw">$2</span>$3');
  }).join('\n');
  $('[data-copy-yaml]').addEventListener('click', (e) => copy(YAML, e.currentTarget));
  let opened = false;
  $('#openGh').addEventListener('click', () => { opened = true; toast("In the real app this opens GitHub's new-file page with the file filled in."); });
  $('#checkWf').addEventListener('click', () => {
    const btn = $('#checkWf'); btn.disabled = true; btn.textContent = 'Checking';
    setTimeout(() => {
      btn.disabled = false; btn.textContent = 'Check again';
      if (!opened) { toast('Not found yet. Commit the file on GitHub first, then check again.'); return; }
      $('#found').classList.add('show');
      const r = REPOS.find((x) => x.name === repo); if (r) { r.wf = true; r.last = ['ok', 'Ready to run']; renderRepos($('#repoSearch').value); }
      if (!$('#goRun')) $('#found').insertAdjacentHTML('afterend', '<a class="btn btn-primary btn-small" id="goRun" href="#start">Start a run</a>');
    }, 900);
  });

  /* ---------- start options ---------- */
  $$('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { toast(`${b.firstChild.textContent.trim()} is coming in a later release.`); return; }
    $$('button', seg).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  }));

  /* ---------- live run ---------- */
  const { STEPS, create, fmt } = window.RepevalSim;
  const LW = [11, 16, 7];
  const liveRows = makeBoard($('#liveRows'), LW, STEPS.length);
  const reportRows = makeBoard($('#reportRows'), LW, STEPS.length);
  let lastIndex = -2, logged = 0, shown = new Set();
  const LABEL = { waiting: 'waiting', running: 'running', passed: 'passed', bug: 'bug' };
  function renderLive(s) {
    $('#clock').textContent = fmt(s.elapsed);
    const pill = $('#livePill');
    pill.className = 'status ' + (s.phase === 'done' ? 'bug' : 'run');
    pill.textContent = s.phase === 'queued' ? 'Queued' : s.phase === 'running' ? 'Running' : 'Finished · 1 possible bug';
    $('#skip').disabled = s.phase === 'done';
    s.steps.forEach((st, i) => {
      const r = liveRows[i]; if (r.status === st) return;
      r.status = st; r.row.className = 'row ' + st; const step = STEPS[i];
      flipTo(r.groups[0], pad(step.name, LW[0]), 0);
      flipTo(r.groups[1], pad(st === 'waiting' ? '' : st === 'running' ? (step.doing || '') : step.detail, LW[1]), 60);
      flipTo(r.groups[2], pad(LABEL[st], LW[2]), 140);
    });
    if (s.index !== lastIndex) {
      lastIndex = s.index; const step = STEPS[s.index];
      const set = () => {
        if (s.phase === 'done') { $('#nowStep').textContent = 'Finished'; $('#nowText').textContent = 'Every page was opened and checked. One possible bug: the cart page throws "cartTotal is not defined" in the browser.'; }
        else if (step) { $('#nowStep').textContent = step.name; $('#nowText').textContent = step.explain; }
        $('#nowText').classList.remove('swap');
      };
      if (reduce || s.phase === 'queued') set(); else { $('#nowText').classList.add('swap'); setTimeout(set, 150); }
    }
    const lines = [];
    STEPS.forEach((step, i) => {
      if (s.steps[i] === 'passed' || s.steps[i] === 'bug') lines.push(...step.log);
      else if (s.steps[i] === 'running') lines.push(...step.log.slice(0, Math.ceil(step.log.length * s.progress)));
    });
    if (lines.length !== logged) {
      logged = lines.length;
      $('#liveLog').innerHTML = lines.slice(-10).map((l) => `<span class="${l.startsWith('×') ? 'x' : l.startsWith('✓') ? 'v' : ''}">${esc(l)}</span>`).join('\n');
    }
    const bar = $('#liveBar');
    bar.style.transform = `scaleX(${s.phase === 'done' ? 1 : s.index >= 0 ? s.progress : 0})`;
    bar.style.background = s.phase === 'done' ? 'var(--bug)' : '';
    const test = STEPS.find((x) => x.id === 'test'); const ti = STEPS.indexOf(test);
    test.shots.forEach((sh) => {
      const due = s.phase === 'done' || s.index > ti || (s.index === ti && s.progress >= sh.at);
      if (!due || shown.has(sh.src)) return;
      shown.add(sh.src);
      const f = document.createElement('figure'); f.className = 'shot';
      f.innerHTML = `<img src="${sh.src}" alt="Screenshot of ${sh.route}"><figcaption><span>${sh.route}</span><span class="status ${sh.ok ? 'ok' : 'bug'}">${sh.ok ? 'passed' : 'possible bug'}</span></figcaption>`;
      $('#liveShots').appendChild(f); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('in')));
    });
    if (!shown.size && !$('#liveShots').children.length) $('#liveShots').innerHTML = '<p class="empty" style="grid-column:1/-1;padding:8px 0">Pages appear here as the browser opens them.</p>';
    else $('#liveShots .empty')?.remove();
    $('#resultBar').classList.toggle('show', s.phase === 'done');
  }
  const sim = create(renderLive);
  function startLive() { lastIndex = -2; logged = 0; shown = new Set(); $('#liveShots').innerHTML = ''; liveRows.forEach((r) => (r.status = null)); sim.play(); }
  $('#replay').addEventListener('click', startLive);
  $('#skip').addEventListener('click', () => sim.finish());

  /* ---------- report ---------- */
  const TESTS = [
    { g: 'Pages', t: 'page /cart loads', s: 'bug', ms: 772, explain: 'The page loads and shows content, but its script throws an error, so "Total" never updates. Look for cartTotal in the cart page: it is used but never defined.', msg: 'Error: browser errors on this page: Uncaught error: cartTotal is not defined\n\nExpected: []\nReceived: ["Uncaught error: cartTotal is not defined"]', shots: ['img/cart.png', 'img/cart-m.png'] },
    { g: 'Pages', t: 'page / loads', s: 'ok', ms: 791, shots: ['img/home.png', 'img/home-m.png'] },
    { g: 'Pages', t: 'page /about loads', s: 'ok', ms: 738, shots: ['img/about.png'] },
    { g: 'Pages', t: 'page /help.html loads', s: 'ok', ms: 773, shots: ['img/help.png'] },
    { g: 'Pages', t: 'page /products/:id', s: 'skip', explain: 'Skipped: this page needs an example product ID. AI mode will be able to pick real IDs.' },
    { g: 'API', t: 'GET /api/health responds', s: 'ok', ms: 43 },
    { g: 'API', t: 'GET /api/products responds', s: 'ok', ms: 21 },
    { g: 'API', t: 'POST /api/orders', s: 'skip', explain: 'Skipped: sending an order needs a request body. AI mode will be able to write one.' },
    { g: 'API', t: 'Load test GET /api/health', s: 'skip', explain: 'Skipped: k6 load tests arrive in a later release.' },
    { g: 'API', t: 'Load test GET /api/products', s: 'skip', explain: 'Skipped: k6 load tests arrive in a later release.' },
    { g: 'Functions', t: 'lib/pricing.js loads without errors', s: 'ok', ms: 1 },
    { g: 'Functions', t: 'applyTax() is exported as a function', s: 'ok', explain: 'Only checked that it exists: plain JavaScript has no types to build sample inputs from. AI mode can write real checks.' },
    { g: 'Functions', t: 'isFreeShipping() is exported as a function', s: 'ok' },
    { g: 'Functions', t: 'lib/products.js loads without errors', s: 'ok', ms: 1 },
    { g: 'Functions', t: 'findProduct() is exported as a function', s: 'ok' },
  ];
  const SLABEL = { ok: 'Passed', bug: 'Possible bug', skip: 'Skipped' };
  const groups = [...new Set(TESTS.map((t) => t.g))];
  $('#testsPanel').innerHTML = groups.map((g) => `<div class="test-group"><h3>${g}</h3><ul class="tests">${TESTS.filter((t) => t.g === g).map((t, i) => {
    const has = t.explain || t.msg || t.shots;
    return `<li class="test" data-open="${t.s === 'bug'}"><button class="test-row" type="button" ${has ? `aria-expanded="${t.s === 'bug'}"` : 'disabled'}><span class="status ${t.s}">${SLABEL[t.s]}</span><span class="t-title">${t.t}</span><span class="t-time">${t.ms ? t.ms + ' ms' : ''}</span></button>${has ? `<div class="test-body"><div><div class="inner">${t.explain ? `<p class="explain">${t.explain}</p>` : ''}${t.msg ? `<pre class="msg">${esc(t.msg)}</pre>` : ''}${t.shots ? `<div class="thumbs">${t.shots.map((s) => `<img src="${s}" alt="Screenshot for ${t.t}" loading="lazy">`).join('')}</div>` : ''}</div></div></div>` : ''}</li>`;
  }).join('')}</ul></div>`).join('');
  $$('#testsPanel .test-row:not([disabled])').forEach((b) => b.addEventListener('click', () => {
    const li = b.parentElement; const open = li.dataset.open !== 'true'; li.dataset.open = String(open); b.setAttribute('aria-expanded', String(open));
  }));
  const PAGES = [['/cart', 'bug', 'img/cart.png', 'img/cart-m.png'], ['/', 'ok', 'img/home.png', 'img/home-m.png'], ['/about', 'ok', 'img/about.png', null], ['/help.html', 'ok', 'img/help.png', null]];
  $('#gallery').innerHTML = PAGES.map(([r, s, d, m]) => `<section><h3>${r}<span class="status ${s}">${SLABEL[s]}</span></h3><div class="pair"><img src="${d}" alt="${r} at desktop width" loading="lazy">${m ? `<img src="${m}" alt="${r} at phone width" loading="lazy">` : ''}</div></section>`).join('');
  const FILES = [
    ['tests/e2e/pages.spec.ts', 'Playwright', `// Generated by Repeval 0.1.0 (template writer, no AI).
// Smoke test for every page: it loads, shows content, has no browser errors.
import { expect, test } from '@playwright/test';
import { openPage } from './_repeval';

test("page /cart loads", async ({ page }) => {
  const { response, errors, screenshot } = await openPage(page, "/cart", "cart");
  await screenshot('desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('mobile');

  expect(response?.status() ?? 0, 'HTTP status').toBeLessThan(400);
  await expect(page.locator('body'), 'page has visible content').not.toBeEmpty();
  expect(errors, \`browser errors on this page: \${errors.join(' | ')}\`).toEqual([]);
});`],
    ['tests/e2e/api.spec.ts', 'Playwright', `// Generated by Repeval 0.1.0 (template writer, no AI).
// Checks that each simple GET endpoint answers without a server error.
import { expect, test } from '@playwright/test';

test("GET /api/products responds", async ({ request }) => {
  const res = await request.get("/api/products");
  expect(res.status(), 'HTTP status (5xx means the server failed)').toBeLessThan(500);
});`],
    ['tests/unit/lib__pricing.test.ts', 'Vitest', `// Generated by Repeval 0.1.0 (template writer, no AI).
// Source: lib/pricing.js
import { describe, expect, it } from 'vitest';
import * as mod from "../../../lib/pricing.js";

describe("lib/pricing.js", () => {
  it('loads without errors', () => {
    expect(typeof mod).toBe('object');
  });

  describe("applyTax()", () => {
    it('is exported as a function', () => {
      expect(typeof mod.applyTax).toBe('function');
    });
  });
});`],
    ['tests/unit/lib__products.test.ts', 'Vitest', `// Generated by Repeval 0.1.0 (template writer, no AI).
// Source: lib/products.js
import { describe, expect, it } from 'vitest';
import * as mod from "../../../lib/products.js";

describe("lib/products.js", () => {
  it('loads without errors', () => {
    expect(typeof mod).toBe('object');
  });

  describe("findProduct()", () => {
    it('is exported as a function', () => {
      expect(typeof mod.findProduct).toBe('function');
    });
  });
});`],
  ];
  $('#fileList').innerHTML = FILES.map(([p, fw], i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-file="${i}"><small>${fw}</small>${p}</button>`).join('');
  const showFile = (i) => { $('#fileCode').textContent = FILES[i][2]; $$('#fileList button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.file === String(i)))); };
  $('#fileList').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showFile(Number(b.dataset.file)); });
  showFile(0);
  // final state of the board for the "Run steps" tab
  STEPS.forEach((step, i) => { const r = reportRows[i]; const st = step.result === 'bug' ? 'bug' : 'passed'; r.row.className = 'row ' + st; r.groups[0].querySelectorAll('.c').forEach((c, k) => (c.textContent = pad(step.name, LW[0])[k])); r.groups[1].querySelectorAll('.c').forEach((c, k) => (c.textContent = pad(step.detail, LW[1])[k])); r.groups[2].querySelectorAll('.c').forEach((c, k) => (c.textContent = pad(LABEL[st], LW[2])[k])); });
  // sliding tab pill
  const tabs = $('.tabs'); const pill = $('.tab-pill', tabs);
  function selectTab(name, animate = true) {
    $$('[role="tab"]', tabs).forEach((b) => {
      const on = b.dataset.tabp === name; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      if (on) { pill.style.transition = animate ? '' : 'none'; pill.style.width = b.offsetWidth + 'px'; pill.style.transform = `translateX(${b.offsetLeft - 4}px)`; pill.style.left = '4px'; }
    });
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) selectTab(b.dataset.tabp); });
  tabs.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const btns = $$('[role="tab"]', tabs); const i = btns.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const next = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]; selectTab(next.dataset.tabp); next.focus(); e.preventDefault();
  });

  /* ---------- demo video: plays muted when visible, never on its own with reduced motion ---------- */
  const video = $('#demoVideo'), vToggle = $('#demoToggle');
  let userPaused = false;
  const syncVideo = () => {
    const playing = !video.paused;
    vToggle.classList.toggle('playing', playing);
    $('#demoLabel').textContent = playing ? 'Pause' : 'Play';
    vToggle.setAttribute('aria-label', playing ? 'Pause the demo video' : 'Play the demo video');
  };
  video.addEventListener('play', syncVideo); video.addEventListener('pause', syncVideo);
  vToggle.addEventListener('click', () => {
    if (video.paused) { userPaused = false; video.play().catch(() => {}); } else { userPaused = true; video.pause(); }
  });
  if (!reduce && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !userPaused) video.play().catch(() => {});
      else if (!entry.isIntersecting) video.pause();
    }, { threshold: 0.4 }).observe(video);
  }
  syncVideo();

  /* ---------- terminal: types the command, then prints the run line by line ---------- */
  const term = $('#term');
  const FINAL = term.innerHTML;
  const LINES = FINAL.split('\n');
  let termTimers = [];
  const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  function playTerminal() {
    termTimers.forEach(clearTimeout); termTimers = [];
    if (reduce) { term.innerHTML = FINAL; return; }
    term.style.minHeight = term.offsetHeight + 'px'; // no layout jump while it types
    const at = (ms, fn) => termTimers.push(setTimeout(fn, ms));
    const cmd = 'npx repeval run';
    let t = 300;
    const shown = [];
    const render = (extra = '') => { term.innerHTML = shown.join('\n') + extra + '<span class="cursor" aria-hidden="true"></span>'; };
    render('<span class="p">$</span> ');
    for (let i = 1; i <= cmd.length; i++) at((t += 55 + (i % 3) * 25), () => render('<span class="p">$</span> ' + cmd.slice(0, i)));
    at((t += 350), () => { shown.push(LINES[0]); render('\n'); });
    LINES.slice(1).forEach((line) => {
      const isRunLine = /Running (unit|E2E)/.test(line);
      if (isRunLine) {
        const label = line.slice(0, line.indexOf('<span'));
        // spinner while this suite runs, then the real result
        for (let k = 0; k < 12; k++) at((t += 80), () => render(label + '<span class="spin">' + SPIN[k % SPIN.length] + '</span>'));
        at((t += 80), () => { shown.push(line); render('\n'); });
      } else {
        const pause = line.trim() === '' ? 120 : /class="y"/.test(line) ? 380 : 140;
        at((t += pause), () => { shown.push(line); render('\n'); });
      }
    });
    at((t += 200), () => { term.innerHTML = FINAL + '\n<span class="p">$</span> <span class="cursor" aria-hidden="true"></span>'; });
  }
  $('#termReplay').addEventListener('click', playTerminal);
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); playTerminal(); } }, { threshold: 0.35 });
    io.observe(term);
  }

  /* ---------- prototype menu ---------- */
  const protoBtn = $('#protoBtn'), protoMenu = $('#protoMenu');
  const setMenu = (open) => { protoMenu.classList.toggle('open', open); protoBtn.setAttribute('aria-expanded', String(open)); };
  protoBtn.addEventListener('click', () => setMenu(!protoMenu.classList.contains('open')));
  protoMenu.addEventListener('click', () => setMenu(false));
  document.addEventListener('click', (e) => { if (!e.target.closest('#proto')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- router ---------- */
  const ROUTES = ['home', 'signin', 'repos', 'setup', 'start', 'live', 'report'];
  const ANCHORS = ['how', 'get', 'privacy', 'ways', 'faq'];
  let current = null;
  function route() {
    let name = location.hash.replace('#', '') || 'home';
    const anchor = ANCHORS.includes(name) ? name : null;
    if (anchor) name = 'home';
    if (!ROUTES.includes(name)) name = 'home';
    if (name !== current) {
      $$('[data-route]').forEach((el) => (el.hidden = el.dataset.route !== name));
      if (!anchor) window.scrollTo(0, 0);
      current = name;
      if (name === 'live') startLive();
      if (name === 'report') requestAnimationFrame(() => selectTab($('.tabs [aria-selected="true"]').dataset.tabp, false));
      if (name === 'setup' && REPOS.find((r) => r.name === repo)?.wf) setRepo('portfolio-site');
      $$('.app-tabs a').forEach((a) => (a.dataset.tab === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
      $$('.proto-menu a').forEach((a) => (a.getAttribute('href') === '#' + name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
      document.title = name === 'home' ? 'Repeval Prototype' : `Repeval · ${$(`.proto-menu a[href="#${name}"]`).textContent}`;
    }
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }));
  }
  setRepo(repo);
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if (current === 'report') selectTab($('.tabs [aria-selected="true"]').dataset.tabp, false); });
  route();
})();
