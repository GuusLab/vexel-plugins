#!/usr/bin/env node
// Bouwt _site/ voor GitHub Pages:
//   _site/index.json                 de index die Vexel leest
//   _site/plugins/<id>/<sha256>.js   de code, op inhoud-adres
//   _site/index.html                 een eenvoudige galerij zonder JavaScript
//   _site/.nojekyll
//
// Draait eerst dezelfde controle als tools/valideer.mjs en stopt bij fouten.
// De commit komt uit GITHUB_SHA, anders uit `git rev-parse HEAD`.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT, CATEGORIEEN, canoniekManifest, pluginHash, sha256, toonFouten, valideerAlles,
} from './valideer.mjs';

const REPO = 'https://github.com/GuusLab/vexel-plugins';
const SITE = join(ROOT, '_site');

function bepaalCommit() {
  const uitOmgeving = process.env.GITHUB_SHA;
  if (uitOmgeving && /^[0-9a-f]{40}$/.test(uitOmgeving)) return uitOmgeving;
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^[0-9a-f]{40}$/.test(sha)) {
      const status = execFileSync('git', ['status', '--porcelain', '--', 'plugins', 'ingetrokken.json'], { cwd: ROOT, encoding: 'utf8' });
      if (status.trim()) console.warn('Let op: plugins/ heeft wijzigingen die nog niet gecommit zijn; "commit" en "bron" kloppen dan niet.');
      return sha;
    }
  } catch {
    // geen git of nog geen commit
  }
  if (process.env.CI) {
    console.error('Kan de commit niet bepalen (geen GITHUB_SHA en geen git).');
    process.exit(1);
  }
  console.warn('Let op: geen commit gevonden; "commit" wordt 40 nullen (alleen voor lokaal proberen).');
  return '0'.repeat(40);
}

const nu = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function maakIndex({ plugins, ingetrokken }, commit, gemaakt = nu()) {
  const ingetrokkenIds = new Set(ingetrokken.map((x) => x.id));
  const lijst = [];
  for (const p of plugins) {
    if (ingetrokkenIds.has(p.id)) continue; // ingetrokken: niet meer aanbieden
    const m = canoniekManifest(p.manifest);
    const js = p.bestanden['plugin.js'];
    lijst.push({
      ...m,
      icoon: 'data:image/svg+xml;base64,' + p.bestanden['icoon.svg'].toString('base64'),
      bron: `${REPO}/tree/${commit}/plugins/${p.id}`,
      hash: pluginHash(p.manifest, js),
      bestanden: { 'plugin.js': { sha256: sha256(js), grootte: js.length } },
    });
  }
  return { schema: 1, gemaakt, commit, plugins: lijst, ingetrokken };
}

// ---- galerij ---------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const RECHT_UITLEG = {
  'selectie.lezen': 'Ziet wat je hebt geselecteerd: soort, plaats, maat en kleuren.',
  'document.schrijven': 'Mag vormen aan je document toevoegen en de selectie aanpassen. Elke wijziging kun je ongedaan maken.',
};
const CATEGORIE_NAAM = {
  vormen: 'Vormen', kleur: 'Kleur', tekst: 'Tekst', ordenen: 'Ordenen', patronen: 'Patronen', hulpmiddelen: 'Hulpmiddelen',
};

function kaart(p) {
  const rechten = p.rechten.length
    ? p.rechten.map((r) => `<li>${esc(RECHT_UITLEG[r])}</li>`).join('')
    : '<li>Vraagt geen rechten: ziet je selectie niet en kan niets in je document veranderen.</li>';
  const auteur = p.auteur.github
    ? `<a href="https://github.com/${esc(p.auteur.github)}">${esc(p.auteur.naam)}</a>`
    : esc(p.auteur.naam);
  return `
    <article class="kaart">
      <header>
        <img src="${esc(p.icoon)}" width="56" height="56" alt="">
        <div>
          <h2>${esc(p.naam)}</h2>
          <p class="meta">${esc(CATEGORIE_NAAM[p.categorie])} · ${esc(p.licentie)} · door ${auteur}</p>
        </div>
      </header>
      <p>${esc(p.beschrijving)}</p>
      <h3>Wat de plugin mag</h3>
      <ul>${rechten}</ul>
      <p class="voet"><a href="${esc(p.bron)}">Bekijk de broncode</a></p>
    </article>`;
}

export function maakGalerij(index) {
  const volgorde = (a, b) => CATEGORIEEN.indexOf(a.categorie) - CATEGORIEEN.indexOf(b.categorie) || a.naam.localeCompare(b.naam, 'nl');
  const kaarten = [...index.plugins].sort(volgorde).map(kaart).join('');
  const datum = index.gemaakt.slice(0, 10);
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer">
<title>Vexel-plugins</title>
<style>
  :root { --bg: #141417; --bg-2: #1c1c21; --kaart: #202027; --lijn: #2e2e38; --tekst: #ececf1; --zacht: #a3a3b2; --accent: #7cb4ff; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--tekst); font: 15px/1.55 Inter, system-ui, sans-serif; }
  a { color: var(--accent); text-underline-offset: 2px; }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
  .pagina { max-width: 1080px; margin: 0 auto; padding: 48px 16px 64px; }
  .kop h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: -0.02em; }
  .kop p { margin: 0; color: var(--zacht); max-width: 64ch; }
  .stappen { margin: 24px 0 32px; padding: 14px 16px; background: var(--bg-2); border: 1px solid var(--lijn); border-radius: 10px; color: var(--zacht); }
  .stappen strong { color: var(--tekst); font-weight: 600; }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .kaart { background: var(--kaart); border: 1px solid var(--lijn); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; }
  .kaart header { display: flex; gap: 14px; align-items: center; }
  .kaart img { border-radius: 12px; flex: none; }
  .kaart h2 { margin: 0; font-size: 18px; }
  .kaart h3 { margin: 16px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--zacht); font-weight: 600; }
  .kaart p { margin: 14px 0 0; }
  .kaart .meta { margin: 2px 0 0; color: var(--zacht); font-size: 13px; }
  .kaart ul { margin: 0; padding-left: 18px; color: var(--zacht); font-size: 14px; }
  .kaart .voet { margin-top: auto; padding-top: 16px; font-size: 14px; }
  .leeg { color: var(--zacht); }
  footer { margin-top: 40px; color: var(--zacht); font-size: 13px; }
  @media (max-width: 420px) { .pagina { padding-top: 32px; } .raster { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main class="pagina">
  <div class="kop">
    <h1>Vexel-plugins</h1>
    <p>Kleine uitbreidingen voor Vexel, gemaakt door de gemeenschap. Elke plugin draait afgeschermd,
    zonder internet, en kan alleen wat hieronder bij &ldquo;Wat de plugin mag&rdquo; staat.</p>
  </div>
  <p class="stappen">Installeren: open in Vexel <strong>Plugins › Plugins beheren…</strong>, kies een plugin en klik
  <strong>Installeren</strong>. Een plugin maken? Lees de <a href="${REPO}#readme">uitleg in de repo</a>.</p>
  <div class="raster">${kaarten || '<p class="leeg">Nog geen plugins.</p>'}
  </div>
  <footer>${index.plugins.length} plugin${index.plugins.length === 1 ? '' : 's'} · bijgewerkt op ${esc(datum)} ·
  commit <a href="${REPO}/tree/${esc(index.commit)}">${esc(index.commit.slice(0, 7))}</a> ·
  <a href="index.json">index.json</a></footer>
</main>
</body>
</html>
`;
}

// ---- bouwen ----------------------------------------------------------------

function hoofd() {
  const resultaat = valideerAlles();
  if (resultaat.fouten.length) {
    toonFouten(resultaat.fouten);
    console.error(`\n${resultaat.fouten.length} fout(en); er is niets gebouwd.`);
    process.exit(1);
  }
  const commit = bepaalCommit();
  const index = maakIndex(resultaat, commit);

  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(SITE, { recursive: true });
  const ingetrokken = new Set(index.ingetrokken.map((x) => x.id));
  for (const p of resultaat.plugins) {
    if (ingetrokken.has(p.id)) continue; // de code van een ingetrokken plugin wordt niet meer aangeboden
    const js = p.bestanden['plugin.js'];
    const map = join(SITE, 'plugins', p.id);
    mkdirSync(map, { recursive: true });
    writeFileSync(join(map, `${sha256(js)}.js`), js);
  }
  writeFileSync(join(SITE, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  writeFileSync(join(SITE, 'index.html'), maakGalerij(index));
  writeFileSync(join(SITE, '.nojekyll'), '');
  console.log(`_site/ gebouwd: ${index.plugins.length} plugin(s), ${index.ingetrokken.length} ingetrokken, commit ${commit.slice(0, 7)}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) hoofd();
