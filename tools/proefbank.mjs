// De proefbank: probeer een plugin uit zonder Vexel-account.
//
//   node tools/proefbank.mjs plugins/<id>      en open http://localhost:4321
//
// Een kleine pagina met een nagebootst tekengebied. De plugin draait daar
// zoals in Vexel: in een iframe met sandbox="allow-scripts", met een strenge
// CSP, en met dezelfde vexel-API en dezelfde controles op vormen, kleuren en
// rechten. Na een wijziging in plugin.js klik je gewoon opnieuw op het
// commando: de proefbank leest het bestand elke keer opnieuw. Geen
// afhankelijkheden; alleen Node.js 20 of nieuwer.
//
// Foto's (API 1.2): de knop "Testfoto" zet een zelfgemaakte foto van 1200×800
// px neer (JPEG, of PNG met doorzichtige hoeken; met "CMYK" doet hij alsof de
// foto CMYK is), en "Eigen foto…" plaatst een foto van je schijf. Selecteer de
// foto en start je commando: vexel.beeld(), vexel.zetBeeld() en maak() met
// soort 'beeld' werken zoals in Vexel (alleen ongedaan maken is er niet).
//
// Dit is een benadering van Vexel, geen kopie: hoe vormen er precies uitzien
// (lettertype, lijnen) kan in Vexel iets anders zijn. Heb je een account, probeer
// hem dan ook in Vexel met Plugins › Plugin uitproberen….
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, basename } from 'node:path';
import { valideerPlugin } from './valideer.mjs';

const map = resolve(process.argv[2] || '');
const POORT = Number(process.env.PORT) || 4321;
if (!process.argv[2] || !existsSync(join(map, 'plugin.json'))) {
  console.error('Gebruik: node tools/proefbank.mjs plugins/<id>');
  process.exit(1);
}

const sha = (s) => createHash('sha256').update(s).digest('base64');
const lees = (n) => readFileSync(join(map, n), 'utf8');

function controleer() {
  const { fouten } = valideerPlugin(map, { basis: process.cwd() });
  if (fouten.length) {
    console.log(`\nDe controle vond ${fouten.length} ${fouten.length === 1 ? 'fout' : 'fouten'} (in CI moet dit groen zijn):`);
    for (const f of fouten) console.log(`  ${f.bestand}${f.regel ? ':' + f.regel : ''}: ${f.melding}`);
  } else console.log('\nDe controle is groen.');
}

/* ---- in het venster van de plugin, vóór plugin.js (zoals in Vexel) */
const RUNTIME = `(function () {
  'use strict';
  ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel'].forEach(function (n) {
    try { Object.defineProperty(window, n, { value: undefined, writable: false, configurable: false }); } catch (x) {}
  });
  var kanaal = new MessageChannel(), poort = kanaal.port1, volgende = 1, wacht = new Map(), handlers = new Map(), gestart = null;
  /* API 1.2: pixels gaan als buffer met transfer (geen kopie); de plugin is de buffer daarna kwijt. */
  function buffers(v, lijst, diepte) {
    if (!v || typeof v !== 'object' || diepte > 12) return lijst;
    if (v instanceof ArrayBuffer) { lijst.add(v); return lijst; }
    if (ArrayBuffer.isView(v)) { if (v.buffer instanceof ArrayBuffer) lijst.add(v.buffer); return lijst; }
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) buffers(v[i], lijst, diepte + 1); return lijst; }
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) buffers(v[k], lijst, diepte + 1);
    return lijst;
  }
  function vraag(soort, data, metBuffers) {
    return new Promise(function (klaar, fout) {
      var id = volgende++; wacht.set(id, { klaar: klaar, fout: fout });
      var bericht = { id: id, soort: soort, data: data === undefined ? null : data };
      try { if (metBuffers) poort.postMessage(bericht, Array.from(buffers(data, new Set(), 0))); else poort.postMessage(bericht); }
      catch (e) { wacht.delete(id); fout(new Error('Deze gegevens kan Vexel niet ontvangen (is de buffer al eens verstuurd?).')); }
    });
  }
  poort.onmessage = function (e) {
    var m = e.data || {};
    if (m.antwoord) { var w = wacht.get(m.antwoord); if (!w) return; wacht.delete(m.antwoord); if (m.fout) w.fout(new Error(String(m.fout))); else w.klaar(m.data); }
    else if (m.start) { gestart = String(m.start); start(); }
  };
  function start() {
    var fn = handlers.get(gestart); if (!fn) return;
    Promise.resolve().then(fn).catch(function (e) { vraag('melding', { tekst: String((e && e.message) || e), soort: 'fout' }); vraag('sluit'); });
  }
  var PT = 72 / 25.4;
  var vexel = {
    opCommando: function (id, fn) { handlers.set(String(id), fn); if (gestart === String(id)) start(); },
    document: function () { return vraag('document'); },
    selectie: function () { return vraag('selectie'); },
    maak: function (v, o) { return vraag('maak', o ? { vormen: v, opties: o } : v, true); },
    wijzigSelectie: function (s) { return vraag('wijzigSelectie', s); },
    wijzig: function (l) { return vraag('wijzig', l); },
    beeld: function (id, o) { return vraag('beeld', { id: id, opties: o || null }).then(function (r) { if (r && r.pixels instanceof ArrayBuffer) r.pixels = new Uint8ClampedArray(r.pixels); return r; }); },
    zetBeeld: function (id, b) { return vraag('zetBeeld', { id: id, beeld: b }, true); },
    melding: function (t, s) { vraag('melding', { tekst: String(t), soort: s || 'info' }); },
    bewaar: function (k, w) { return vraag('bewaar', { sleutel: String(k), waarde: w }); },
    haal: function (k) { return vraag('haal', { sleutel: String(k) }); },
    sluit: function () { vraag('sluit'); },
    mm: function (v) { return v * PT; },
    naarMm: function (p) { return p / PT; },
    thema: Object.freeze({ bg: '#1c1d22', bg2: '#24262c', lijn: '#34363e', tekst: '#e8e9ec', tekstZacht: '#b4b7bf', accent: '#c6ff3d' }),
  };
  Object.freeze(vexel);
  Object.defineProperty(window, 'vexel', { value: vexel, writable: false, configurable: false });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); vraag('sluit'); } });
  function verstuur(form, knop) {
    var ev; try { ev = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: knop || null }); } catch (x) { ev = new Event('submit', { bubbles: true, cancelable: true }); }
    form.dispatchEvent(ev);
  }
  document.addEventListener('click', function (e) {
    var k = e.target && e.target.closest ? e.target.closest('button, input[type=submit]') : null;
    if (!k || !k.form || k.disabled) return;
    var t = (k.getAttribute('type') || 'submit').toLowerCase(); if (t !== 'submit') return;
    e.preventDefault(); verstuur(k.form, k);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.defaultPrevented || !e.target || !e.target.form || e.target.tagName !== 'INPUT') return;
    if (e.target.form.querySelector('button:not([type=button]):not([type=reset]), input[type=submit]')) return;
    e.preventDefault(); verstuur(e.target.form, null);
  });
  HTMLFormElement.prototype.requestSubmit = function (k) { verstuur(this, k); };
  HTMLFormElement.prototype.submit = function () { verstuur(this, null); };
  window.parent.postMessage({ vexelPlugin: 1 }, '*', [kanaal.port2]);
})();`;

const VENSTERSTIJL = `:root{--bg:#1c1d22;--bg-2:#24262c;--bg-3:#2c2e35;--lijn:#34363e;--lijn-sterk:#464954;--tekst:#e8e9ec;--tekst-zacht:#b4b7bf;--tekst-zwak:#7f838f;--accent:#c6ff3d;--accent-tekst:#11130a;--rood:#ff5c5c;--radius:5px;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--tekst)}
body{padding:14px 16px 16px;font:12px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
h1,h2,h3{margin:0 0 8px;font-size:12px;font-weight:600}p{margin:0 0 10px}
.uitleg{color:var(--tekst-zacht);font-size:11.5px}.rij{display:flex;align-items:center;gap:10px;margin:0 0 8px}
.label{flex:0 0 auto;min-width:92px;color:var(--tekst-zacht)}
.veld,select.veld,input.veld{flex:1;min-width:0;height:26px;padding:0 8px;border:1px solid var(--lijn);border-radius:var(--radius);background:var(--bg-2);color:var(--tekst);font:inherit}
.veld:focus{outline:none;border-color:var(--accent)}input[type=range],input[type=checkbox],input[type=radio]{accent-color:var(--accent)}
.knoppen{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.knop{height:28px;padding:0 14px;border:1px solid var(--lijn-sterk);border-radius:var(--radius);background:var(--bg-3);color:var(--tekst);font:inherit;cursor:pointer}
.knop.primair{background:var(--accent);border-color:var(--accent);color:var(--accent-tekst);font-weight:600}
.knop:disabled{opacity:.45;cursor:not-allowed}.fout{color:var(--rood)}
canvas{display:block;max-width:100%;border-radius:var(--radius);background:var(--bg-2)}`;

function pluginPagina() {
  const code = lees('plugin.js');
  if (/<\/script|<!--/i.test(code)) return { status: 400, html: 'plugin.js bevat </script of <!--; dat kan Vexel niet laden.' };
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>${VENSTERSTIJL}</style></head><body><script>${RUNTIME}</script><script>${code}</script></body></html>`;
  const csp = `default-src 'none'; script-src 'sha256-${sha(RUNTIME)}' 'sha256-${sha(code)}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors http://localhost:${POORT}; sandbox allow-scripts`;
  return { status: 200, html, csp };
}

/* ---- de pagina eromheen (de "editor") */
const HOST_JS = String.raw`
const M = JSON.parse(document.getElementById('manifest').textContent);
const PT = 72 / 25.4, B = 210 * PT, H = 297 * PT;
const svg = document.getElementById('vel'), lijst = document.getElementById('log');
let vormen = [], gekozen = new Set(), lopend = null, teller = 0;
const opslag = new Map();
const log = (t, soort = 'info') => { const li = document.createElement('li'); li.className = soort; li.textContent = t; lijst.prepend(li); };
const fout = (t) => { throw Object.assign(new Error(t), { plugin: true }); };
const getal = (v, min, max, wat) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) ? v : fout('Ongeldige waarde voor ' + wat + '.');
const G = 1e6;
/* ---- foto's (API 1.2) */
const MAXPX = 16000000;
function leesPixels(p) {
  if (!p || typeof p !== 'object') fout("Geef de pixels als { breedte, hoogte, pixels }.");
  const b = p.breedte, h = p.hoogte, d = p.pixels;
  if (!Number.isInteger(b) || !Number.isInteger(h) || b < 1 || h < 1 || b > 16384 || h > 16384) fout('breedte en hoogte zijn hele getallen van 1 tot 16384.');
  if (b * h > MAXPX) fout('Een foto heeft hooguit 16 000 000 pixels.');
  let data;
  if (d instanceof Uint8ClampedArray || d instanceof Uint8Array) data = new Uint8ClampedArray(d.buffer, d.byteOffset, d.byteLength);
  else if (d instanceof ArrayBuffer) data = new Uint8ClampedArray(d);
  else fout('pixels is een Uint8ClampedArray, Uint8Array of ArrayBuffer met RGBA-waarden.');
  if (data.length !== b * h * 4) fout('pixels moet precies ' + (b * h * 4) + ' bytes hebben (breedte × hoogte × 4).');
  return { breedte: b, hoogte: h, data };
}
async function codeer(p, mime) {
  const c = new OffscreenCanvas(p.breedte, p.hoogte);
  const data = (p.data.byteOffset || p.data.byteLength !== p.data.buffer.byteLength) ? p.data.slice() : p.data;
  c.getContext('2d').putImageData(new ImageData(data, p.breedte, p.hoogte), 0, 0);
  const blob = await c.convertToBlob(mime === 'image/jpeg' ? { type: mime, quality: 0.92 } : { type: 'image/png' });
  return { blob, url: URL.createObjectURL(blob), mime: blob.type, breedte: p.breedte, hoogte: p.hoogte, cmyk: false };
}
async function leesBron(bron, maxZijde) {
  const w0 = bron.breedte, h0 = bron.hoogte;
  let w = w0, h = h0;
  if (maxZijde !== undefined && Math.max(w0, h0) > maxZijde) { const s = maxZijde / Math.max(w0, h0); w = Math.min(Math.round(w0 * s), Math.floor(maxZijde)); h = Math.min(Math.round(h0 * s), Math.floor(maxZijde)); }
  else if (maxZijde === undefined && (w0 * h0 > MAXPX || Math.max(w0, h0) > 16384)) { const s = Math.min(Math.sqrt(MAXPX / (w0 * h0)), 16384 / Math.max(w0, h0)); w = Math.floor(w0 * s); h = Math.floor(h0 * s); }
  w = Math.max(1, w); h = Math.max(1, h);
  // net als Vexel: createImageBitmap met de standaardopties en tekenen op een canvas
  const bmp = await createImageBitmap(bron.blob);
  const c = new OffscreenCanvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
  return { breedte: w, hoogte: h, pixels: ctx.getImageData(0, 0, w, h).data.buffer, origineel: [w0, h0] };
}
function zoek(id, lijst = vormen) { for (const o of lijst) { if (o.id === id) return o; const k = o.kinderen && zoek(id, o.kinderen); if (k) return k; } return null; }
function geselecteerdeFoto(id) { const o = typeof id === 'string' && gekozen.has(id) ? zoek(id) : null; return o && o.soort === 'beeld' ? o : fout('Dit object is geen geselecteerde foto.'); }
async function beeld(data) {
  mag('beeld.lezen'); const o = geselecteerdeFoto(data && data.id), opties = (data && data.opties) || {};
  const maxZijde = opties.maxZijde === undefined ? undefined : getal(opties.maxZijde, 16, 8192, 'maxZijde');
  const r = await leesBron(o.bron, maxZijde);
  log('beeld: ' + o.id + ' ' + r.breedte + '×' + r.hoogte + (maxZijde ? ' (maxZijde ' + maxZijde + ')' : '') + ' van ' + r.origineel.join('×'), 'ok'); return r;
}
async function zetBeeld(data) {
  mag('beeld.schrijven'); schrijven(); const o = geselecteerdeFoto(data && data.id), p = leesPixels(data && data.beeld);
  let opaak = true; for (let i = 3; i < p.data.length; i += 4) if (p.data[i] !== 255) { opaak = false; break; }
  const mime = o.bron.mime === 'image/jpeg' && opaak ? 'image/jpeg' : 'image/png';
  const oud = o.bron, nieuw = await codeer(p, mime), cmykOmgezet = !!oud.cmyk;
  o.bron = nieuw; URL.revokeObjectURL(oud.url); teken();
  if (cmykOmgezet && lopend && !lopend.cmykGemeld) { lopend.cmykGemeld = true; log('De foto was CMYK; na de bewerking is hij RGB en gaat hij bij het drukken door het kleurprofiel.', 'let'); }
  log('zetBeeld: ' + o.id + ' ' + p.breedte + '×' + p.hoogte + ' → ' + nieuw.mime + ' (kader blijft ' + o.b.toFixed(1) + '×' + o.h.toFixed(1) + ' pt)', 'ok');
  return { id: o.id, mime: nieuw.mime, cmykOmgezet };
}
function rng(zaad) { let a = zaad >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* Een zelfgemaakte "foto" van 1200×800: lucht, zon, heuvels, water, een huisje, kleurstalen, ruis en vignet. */
async function testfoto(mime) {
  const W = 1200, HH = 800, c = new OffscreenCanvas(W, HH), g = c.getContext('2d'), r = rng(20261014);
  let lg = g.createLinearGradient(0, 0, 0, 470); lg.addColorStop(0, '#1d3f73'); lg.addColorStop(0.55, '#6f8fc0'); lg.addColorStop(1, '#f4b37a'); g.fillStyle = lg; g.fillRect(0, 0, W, 470);
  const rg = g.createRadialGradient(860, 360, 10, 860, 360, 280); rg.addColorStop(0, 'rgba(255,244,210,1)'); rg.addColorStop(0.18, 'rgba(255,220,150,0.85)'); rg.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, 470); g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(860, 360, 46, 0, 7); g.fill();
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.08 + r() * 0.14) + ')'; g.beginPath(); g.ellipse(r() * W, 50 + r() * 210, 60 + r() * 130, 10 + r() * 18, 0, 0, 7); g.fill(); }
  const heuvel = (basis, amp, kleur, f, fase) => { g.fillStyle = kleur; g.beginPath(); g.moveTo(0, 470);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, basis - amp * (0.55 + 0.45 * Math.sin(x * f + fase) * Math.cos(x * f * 0.37 + 0.4)) - r() * 4); g.lineTo(W, 470); g.closePath(); g.fill(); };
  heuvel(410, 170, '#6a7590', 0.006, 1.3); heuvel(445, 95, '#3f5a52', 0.011, 0.2); heuvel(472, 42, '#2c4636', 0.02, 2.1);
  lg = g.createLinearGradient(0, 470, 0, HH); lg.addColorStop(0, '#c99a74'); lg.addColorStop(0.25, '#557499'); lg.addColorStop(1, '#162b45'); g.fillStyle = lg; g.fillRect(0, 470, W, HH - 470);
  for (let i = 0; i < 40; i++) { const y = 478 + i * 7 + r() * 4, b = (72 - i) * (0.6 + r() * 0.8); g.fillStyle = 'rgba(255,230,170,' + (0.5 - i * 0.011) + ')'; g.fillRect(860 - b / 2 + (r() - 0.5) * 30, y, b, 2 + r() * 2); }
  g.fillStyle = '#b8322a'; g.fillRect(150, 404, 90, 62); g.fillStyle = '#5b1d17'; g.beginPath(); g.moveTo(140, 406); g.lineTo(195, 362); g.lineTo(250, 406); g.fill();
  g.fillStyle = '#ffe9a8'; g.fillRect(170, 424, 18, 16); g.fillRect(205, 424, 18, 16);
  for (let i = 0; i < 9; i++) { const x = 300 + i * 38 + r() * 20, hb = 60 + r() * 50; g.fillStyle = i % 2 ? '#1f3a25' : '#27482c'; g.beginPath(); g.moveTo(x, 472); g.lineTo(x + 14, 472 - hb); g.lineTo(x + 28, 472); g.fill(); }
  ['#d62828', '#f6c90e', '#2a9d3f', '#1fb5c9', '#2643b8', '#c4329b', '#ffffff', '#808080', '#000000'].forEach((k, i) => { g.fillStyle = k; g.fillRect(40 + i * 46, 724, 40, 40); });
  const d = g.getImageData(0, 0, W, HH), px = d.data, R = 70;
  for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, dx = (x - W / 2) / (W / 2), dy = (y - HH / 2) / (HH / 2), v = 1 - 0.3 * Math.min(1, (dx * dx + dy * dy) * 0.5), n = (r() + r() + r() - 1.5) * 18;
    px[i] = px[i] * v + n; px[i + 1] = px[i + 1] * v + n; px[i + 2] = px[i + 2] * v + n;
    if (mime === 'image/png') { const hx = x < R ? R - x : x >= W - R ? x - (W - R - 1) : 0, hy = y < R ? R - y : y >= HH - R ? y - (HH - R - 1) : 0;
      if (hx && hy) px[i + 3] = Math.max(0, Math.min(1, R + 0.5 - Math.hypot(hx, hy))) * 255; }
  }
  return codeer({ breedte: W, hoogte: HH, data: px }, mime);
}
function plaatsFoto(bron, naam) {
  let b = 475, h = b * bron.hoogte / bron.breedte; if (h > 720) { b = b * 720 / h; h = 720; }
  bron.cmyk = document.getElementById('fotoCmyk').checked;
  const o = { id: 'o' + (++teller), soort: 'beeld', naam, zichtbaar: true, x: 60, y: 60, b, h, bron };
  vormen.push(o); gekozen = new Set([o.id]); teken();
  log('foto geplaatst: ' + o.id + ', ' + bron.breedte + '×' + bron.hoogte + ' px, ' + bron.mime + (bron.cmyk ? ', CMYK' : ''), 'info');
}
const stalen = new Map();
function kleur(k, wat) {
  if (k === undefined) return undefined; if (k === null) return null;
  if (k && k.registratie === true) return { cmyk: [100, 100, 100, 100], registratie: true };
  if (k && k.steunkleur) {
    const naam = String(k.steunkleur.naam || '').trim(); if (!naam || naam.length > 60) fout('Een steunkleur heeft een naam van 1 tot 60 tekens (' + wat + ').');
    const tint = k.tint === undefined ? 100 : getal(k.tint, 0, 100, 'tint');
    let st = stalen.get(naam.toLowerCase());
    if (!st) { if (!Array.isArray(k.steunkleur.cmyk) || k.steunkleur.cmyk.length !== 4) fout('Geef bij een nieuwe steunkleur ook cmyk: [c, m, y, k] (' + wat + ').');
      st = { naam, cmyk: k.steunkleur.cmyk.map((v) => getal(v, 0, 100, wat)) }; stalen.set(naam.toLowerCase(), st); log('nieuwe steunkleur: ' + naam, 'info'); }
    return { cmyk: st.cmyk.map((v) => v * tint / 100), steunkleur: st.naam };
  }
  if (Array.isArray(k && k.cmyk) && k.cmyk.length === 4) return { cmyk: k.cmyk.map((v) => getal(v, 0, 100, wat)) };
  if (typeof (k && k.hex) === 'string' && /^#[0-9a-f]{6}$/i.test(k.hex)) return { hex: k.hex };
  return fout('Ongeldige kleur voor ' + wat + ": gebruik { cmyk: [c, m, y, k] } of { hex: '#rrggbb' }.");
}
const css = (k) => !k ? 'none' : k.hex || (() => { const [c, m, y, z] = k.cmyk.map((v) => v / 100); const f = (a) => Math.round(255 * (1 - a) * (1 - z)); return 'rgb(' + f(c) + ',' + f(m) + ',' + f(y) + ')'; })();
function stijl(v) {
  const s = {}; const vu = kleur(v.vulling, 'vulling'), li = kleur(v.lijn, 'lijn');
  if (vu !== undefined) s.vulling = vu; if (li !== undefined) s.lijn = li;
  if (v.lijndikte !== undefined) s.lijndikte = getal(v.lijndikte, 0, 1000, 'lijndikte');
  if (v.dekking !== undefined) s.dekking = getal(v.dekking, 0, 1, 'dekking');
  if (v.streep !== undefined) { if (!Array.isArray(v.streep) || v.streep.length > 20) fout('streep is een lijst van hooguit 20 getallen (pt).'); s.streep = v.streep.map((n) => getal(n, 0, 1000, 'streep')); }
  if (v.lijneinde !== undefined) s.lijneinde = ['butt', 'round', 'square'].includes(v.lijneinde) ? v.lijneinde : fout("lijneinde is 'butt', 'round' of 'square'.");
  if (v.overdrukLijn !== undefined) s.overdrukLijn = !!v.overdrukLijn;
  if (v.overdrukVulling !== undefined) s.overdrukVulling = !!v.overdrukVulling;
  if (v.lijnhoek !== undefined) s.lijnhoek = ['miter', 'round', 'bevel'].includes(v.lijnhoek) ? v.lijnhoek : fout("lijnhoek is 'miter', 'round' of 'bevel'.");
  return s;
}
function bouw(v, t, d = 0) {
  if (!v || typeof v !== 'object') fout('Een vorm moet een object zijn.');
  if (++t.n > 5000) fout('Te veel vormen in één keer (hooguit 5000).');
  if (v.naam !== undefined && (typeof v.naam !== 'string' || v.naam.length > 100)) fout('Ongeldige naam.');
  const x = (n, w) => getal(n, -G, G, w), m = (n, w) => getal(n, 0, G, w);
  const o = { id: 'o' + (++teller), soort: v.soort, naam: v.naam || '', zichtbaar: v.zichtbaar !== false, stijl: { vulling: { cmyk: [0, 0, 0, 0] }, lijn: { cmyk: [0, 0, 0, 100] }, lijndikte: 1, dekking: 1 } };
  switch (v.soort) {
    case 'rechthoek': Object.assign(o, { x: x(v.x, 'x'), y: x(v.y, 'y'), b: m(v.b, 'b'), h: m(v.h, 'h') }); break;
    case 'ellips': Object.assign(o, { cx: x(v.cx, 'cx'), cy: x(v.cy, 'cy'), rx: m(v.rx, 'rx'), ry: m(v.ry, 'ry') }); break;
    case 'pad':
      if (v.vulregel !== undefined && !['nonzero', 'evenodd'].includes(v.vulregel)) fout("vulregel is 'nonzero' of 'evenodd'.");
      o.vulregel = v.vulregel || 'nonzero';
      if (!Array.isArray(v.subpaden) || !v.subpaden.length || v.subpaden.length > 1000) fout('Een pad heeft 1 tot 1000 subpaden.');
      o.subpaden = v.subpaden.map((sp) => {
        if (!Array.isArray(sp && sp.punten) || !sp.punten.length) fout('Een subpad heeft punten nodig.');
        t.p += sp.punten.length; if (t.p > 50000) fout('Te veel punten in één keer (hooguit 50 000).');
        return { gesloten: !!sp.gesloten, punten: sp.punten.map((q) => ({ x: x(q && q.x, 'x'), y: x(q && q.y, 'y'),
          in: q && q.in ? { x: x(q.in.x, 'in.x'), y: x(q.in.y, 'in.y') } : null, uit: q && q.uit ? { x: x(q.uit.x, 'uit.x'), y: x(q.uit.y, 'uit.y') } : null })) };
      }); break;
    case 'tekst':
      if (typeof v.inhoud !== 'string' || !v.inhoud || v.inhoud.length > 10000) fout('Tekst moet 1 tot 10 000 tekens hebben.');
      Object.assign(o, { x: x(v.x, 'x'), y: x(v.y, 'y'), inhoud: v.inhoud, grootte: v.grootte === undefined ? 12 : getal(v.grootte, 1, 1000, 'grootte') });
      if (v.draai !== undefined) { const r = getal(v.draai, -360, 360, 'draai') * Math.PI / 180; o.m = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), o.x - (Math.cos(r) * o.x - Math.sin(r) * o.y), o.y - (Math.sin(r) * o.x + Math.cos(r) * o.y)]; }
      if (v.gewicht !== undefined) o.gewicht = [100, 200, 300, 400, 500, 600, 700, 800, 900].includes(v.gewicht) ? v.gewicht : fout('gewicht is 100, 200, … of 900.');
      if (v.uitlijning !== undefined) o.uitlijning = ['links', 'midden', 'rechts'].includes(v.uitlijning) ? v.uitlijning : fout("uitlijning is 'links', 'midden' of 'rechts'.");
      if (v.regelafstand !== undefined) o.regelafstand = getal(v.regelafstand, 1, 2000, 'regelafstand');
      if (v.letterafstand !== undefined) o.letterafstand = getal(v.letterafstand, -500, 2000, 'letterafstand');
      o.stijl.vulling = { cmyk: [0, 0, 0, 100] }; o.stijl.lijn = null; break;
    case 'groep':
      if (d >= 8) fout('Groepen gaan hooguit 8 diep.');
      if (!Array.isArray(v.kinderen) || !v.kinderen.length) fout('Een groep heeft kinderen nodig.');
      o.kinderen = v.kinderen.map((k) => bouw(k, t, d + 1)); delete o.stijl; return o;
    case 'beeld': { mag('beeld.schrijven');
      Object.assign(o, { x: x(v.x, 'x'), y: x(v.y, 'y'), b: getal(v.b, 0.01, G, 'b'), h: getal(v.h, 0.01, G, 'h') });
      const p = leesPixels(v.pixels); t.px = (t.px || 0) + p.breedte * p.hoogte; if (t.px > MAXPX) fout('Te veel pixels in één keer (hooguit 16 000 000 per aanroep).');
      o.nieuwePixels = p; delete o.stijl; return o; }
    default: fout('Onbekende soort vorm: ' + String(v.soort).slice(0, 20) + '.');
  }
  Object.assign(o.stijl, stijl(v));
  return o;
}
// rechthoek en ellips zijn in Vexel paden: zo leest de plugin ze ook
const soortVoorPlugin = (o) => (o.soort === 'rechthoek' || o.soort === 'ellips') ? 'pad' : o.soort;
function alsPad(o) {
  if (o.soort === 'rechthoek') return [{ gesloten: true, punten: [{ x: o.x, y: o.y }, { x: o.x + o.b, y: o.y }, { x: o.x + o.b, y: o.y + o.h }, { x: o.x, y: o.y + o.h }] }];
  if (o.soort === 'ellips') { const k = 0.5522847498, ox = o.rx * k, oy = o.ry * k, cx = o.cx, cy = o.cy, rx = o.rx, ry = o.ry;
    return [{ gesloten: true, punten: [{ x: cx, y: cy - ry, in: { x: cx - ox, y: cy - ry }, uit: { x: cx + ox, y: cy - ry } }, { x: cx + rx, y: cy, in: { x: cx + rx, y: cy - oy }, uit: { x: cx + rx, y: cy + oy } },
      { x: cx, y: cy + ry, in: { x: cx + ox, y: cy + ry }, uit: { x: cx - ox, y: cy + ry } }, { x: cx - rx, y: cy, in: { x: cx - rx, y: cy + oy }, uit: { x: cx - rx, y: cy - oy } }] }]; }
  return o.subpaden;
}
function geometrie(o) {
  if (o.soort === 'beeld') return { beeld: { px: [o.bron.breedte, o.bron.hoogte], mime: o.bron.mime, masker: false, cmyk: !!o.bron.cmyk } };
  if (o.soort === 'tekst') return { inhoud: o.inhoud, grootte: o.grootte };
  if (o.soort === 'groep') return { aantal: o.kinderen.length };
  return { subpaden: JSON.parse(JSON.stringify(alsPad(o))), vulregel: o.vulregel || 'nonzero' };
}
function transformeer(o, m) {
  const tp = (p) => { const x = m[0] * p.x + m[2] * p.y + m[4], y = m[1] * p.x + m[3] * p.y + m[5]; p.x = x; p.y = y; };
  if (o.soort === 'groep') { o.kinderen.forEach((k) => transformeer(k, m)); return; }
  if (o.soort === 'tekst' || o.soort === 'beeld') { const a = o.m || [1, 0, 0, 1, 0, 0]; o.m = [m[0] * a[0] + m[2] * a[1], m[1] * a[0] + m[3] * a[1], m[0] * a[2] + m[2] * a[3], m[1] * a[2] + m[3] * a[3], m[0] * a[4] + m[2] * a[5] + m[4], m[1] * a[4] + m[3] * a[5] + m[5]]; return; }
  if (o.soort === 'rechthoek' || o.soort === 'ellips') { o.subpaden = alsPad(o); o.soort = 'pad'; }
  for (const s of o.subpaden) for (const p of s.punten) { tp(p); if (p.in) tp(p.in); if (p.uit) tp(p.uit); }
}
function kader(o) {
  if (o.soort === 'beeld') { const m = o.m || [1, 0, 0, 1, 0, 0]; const hk = [[o.x, o.y], [o.x + o.b, o.y], [o.x, o.y + o.h], [o.x + o.b, o.y + o.h]].map(([a, c]) => [m[0] * a + m[2] * c + m[4], m[1] * a + m[3] * c + m[5]]);
    const xs = hk.map((q) => q[0]), ys = hk.map((q) => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys); return { x: x0, y: y0, b: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; }
  if (o.soort === 'rechthoek') return { x: o.x, y: o.y, b: o.b, h: o.h };
  if (o.soort === 'ellips') return { x: o.cx - o.rx, y: o.cy - o.ry, b: 2 * o.rx, h: 2 * o.ry };
  if (o.soort === 'tekst') return { x: o.x, y: o.y - o.grootte, b: o.inhoud.length * o.grootte * 0.5, h: o.grootte * 1.2 };
  const pts = o.soort === 'pad' ? o.subpaden.flatMap((s) => s.punten) : null;
  const ks = pts ? pts.map((p) => ({ x: p.x, y: p.y, b: 0, h: 0 })) : o.kinderen.map(kader);
  const x0 = Math.min(...ks.map((k) => k.x)), y0 = Math.min(...ks.map((k) => k.y));
  return { x: x0, y: y0, b: Math.max(...ks.map((k) => k.x + k.b)) - x0, h: Math.max(...ks.map((k) => k.y + k.h)) - y0 };
}
const NS = 'http://www.w3.org/2000/svg';
function teken() {
  svg.replaceChildren();
  const vel = document.createElementNS(NS, 'rect'); Object.entries({ width: B, height: H, fill: '#fff' }).forEach(([k, v]) => vel.setAttribute(k, v)); svg.append(vel);
  const el = (o) => {
    let e;
    if (o.soort === 'groep') { e = document.createElementNS(NS, 'g'); o.kinderen.forEach((k) => e.append(el(k))); }
    else if (o.soort === 'rechthoek') { e = document.createElementNS(NS, 'rect'); [['x', o.x], ['y', o.y], ['width', o.b], ['height', o.h]].forEach(([k, v]) => e.setAttribute(k, v)); }
    else if (o.soort === 'ellips') { e = document.createElementNS(NS, 'ellipse'); [['cx', o.cx], ['cy', o.cy], ['rx', o.rx], ['ry', o.ry]].forEach(([k, v]) => e.setAttribute(k, v)); }
    else if (o.soort === 'beeld') { e = document.createElementNS(NS, 'image'); [['href', o.bron.url], ['x', o.x], ['y', o.y], ['width', o.b], ['height', o.h], ['preserveAspectRatio', 'none']].forEach(([k, v]) => e.setAttribute(k, v)); }
    else if (o.soort === 'tekst') { e = document.createElementNS(NS, 'text'); e.setAttribute('x', o.x); e.setAttribute('y', o.y); e.setAttribute('font-size', o.grootte); e.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      if (o.gewicht) e.setAttribute('font-weight', o.gewicht);
      if (o.letterafstand) e.setAttribute('letter-spacing', o.letterafstand / 1000 * o.grootte);
      e.setAttribute('text-anchor', { midden: 'middle', rechts: 'end' }[o.uitlijning] || 'start');
      o.inhoud.split('\n').forEach((r, i) => { const t = document.createElementNS(NS, 'tspan'); t.setAttribute('x', o.x); t.setAttribute('y', o.y + i * (o.regelafstand || o.grootte * 1.2)); t.textContent = r; e.append(t); }); }
    else { e = document.createElementNS(NS, 'path'); e.setAttribute('fill-rule', o.vulregel === 'evenodd' ? 'evenodd' : 'nonzero'); e.setAttribute('d', o.subpaden.map((s) => { let d = 'M' + s.punten[0].x + ' ' + s.punten[0].y; const n = s.punten.length;
        for (let i = 1; i <= (s.gesloten ? n : n - 1); i++) { const a = s.punten[i - 1], b = s.punten[i % n]; const c1 = a.uit || a, c2 = b.in || b; d += ' C' + c1.x + ' ' + c1.y + ' ' + c2.x + ' ' + c2.y + ' ' + b.x + ' ' + b.y; }
        return d + (s.gesloten ? 'Z' : ''); }).join(' ')); }
    if (o.stijl) { e.setAttribute('fill', css(o.stijl.vulling)); e.setAttribute('stroke', css(o.stijl.lijn)); e.setAttribute('stroke-width', o.stijl.lijndikte); e.setAttribute('opacity', o.stijl.dekking);
      if (o.stijl.streep && o.stijl.streep.length) e.setAttribute('stroke-dasharray', o.stijl.streep.join(' '));
      if (o.stijl.lijneinde) e.setAttribute('stroke-linecap', o.stijl.lijneinde);
      if (o.stijl.lijnhoek) e.setAttribute('stroke-linejoin', o.stijl.lijnhoek); }
    if (o.m) e.setAttribute('transform', 'matrix(' + o.m.join(' ') + ')');
    if (!o.zichtbaar) e.setAttribute('display', 'none');
    e.setAttribute('data-id', o.id);
    if (gekozen.has(o.id)) { e.setAttribute('outline', '1'); e.style.filter = 'drop-shadow(0 0 2px #4f7cff)'; }
    e.addEventListener('click', (ev) => { ev.stopPropagation(); if (!ev.shiftKey) gekozen.clear(); gekozen.add(o.id); teken(); });
    return e;
  };
  vormen.forEach((o) => svg.append(el(o)));
  document.getElementById('telling').textContent = vormen.length + ' objecten · ' + gekozen.size + ' gekozen';
}
svg.addEventListener('click', () => { gekozen.clear(); teken(); });
const mag = (r) => M.rechten.includes(r) || fout(M.naam + ' heeft geen toestemming hiervoor (' + r + ' staat niet in plugin.json).');
function schrijven() { if (document.getElementById('alleenLezen').checked) fout('Je kunt dit document alleen bekijken.'); }
async function maak(data) {
  mag('document.schrijven'); schrijven();
  const lijstV = Array.isArray(data) ? data : data && data.vormen, opties = Array.isArray(data) ? {} : (data && data.opties) || {};
  if (!Array.isArray(lijstV) || !lijstV.length) fout('Geef een lijst met vormen.');
  if (opties.vervangSelectie && !gekozen.size) fout('Selecteer eerst wat er vervangen moet worden.');
  const t = { n: 0, p: 0 }; const nieuw = lijstV.map((v) => bouw(v, t));
  const fotos = []; const verzamel = (o) => { if (o.nieuwePixels) fotos.push(o); (o.kinderen || []).forEach(verzamel); }; nieuw.forEach(verzamel);
  await Promise.all(fotos.map(async (o) => { o.bron = await codeer(o.nieuwePixels, 'image/png'); delete o.nieuwePixels; }));
  if (opties.vervangSelectie) { const plek = vormen.findIndex((o) => gekozen.has(o.id)); vormen = vormen.filter((o) => !gekozen.has(o.id)); vormen.splice(Math.max(0, plek), 0, ...nieuw); }
  else if (opties.achteraan) vormen.unshift(...nieuw); else vormen.push(...nieuw);
  gekozen = new Set(nieuw.map((o) => o.id)); teken();
  log('maak: ' + nieuw.length + ' vorm(en), ' + t.n + ' in totaal, ' + t.p + ' punten' + (fotos.length ? ', ' + fotos.length + ' foto(s)' : '') + (opties.vervangSelectie ? ' (selectie vervangen)' : ''), 'ok'); return nieuw.map((o) => o.id);
}
function voer(soort, data) {
  switch (soort) {
    case 'document': return { naam: 'Proefbank', eenheid: 'mm', kleurruimte: document.getElementById('ruimte').value, tekengebied: { b: B, h: H }, afloop: { boven: 3 * PT, rechts: 3 * PT, onder: 3 * PT, links: 3 * PT }, alleenLezen: document.getElementById('alleenLezen').checked };
    case 'selectie': mag('selectie.lezen'); return vormen.filter((o) => gekozen.has(o.id)).map((o) => ({ id: o.id, soort: soortVoorPlugin(o), naam: o.naam, kader: kader(o), vulling: o.stijl ? o.stijl.vulling : null, lijn: o.stijl ? o.stijl.lijn : null, lijndikte: o.stijl && o.stijl.lijn ? o.stijl.lijndikte : 0, dekking: o.stijl ? o.stijl.dekking : 1, ...geometrie(o) }));
    case 'maak': return maak(data);
    case 'beeld': return beeld(data);
    case 'zetBeeld': return zetBeeld(data);
    case 'wijzig': { mag('document.schrijven'); schrijven(); if (!Array.isArray(data) || !data.length) fout('Geef een lijst met wijzigingen: [{ id, … }].');
      const plan = data.map((w) => { if (!w || !gekozen.has(w.id)) fout('Je kunt alleen objecten wijzigen die geselecteerd zijn.'); return w; });
      for (const w of plan) { const o = vormen.find((x) => x.id === w.id); const k = kader(o), cx = k.x + k.b / 2, cy = k.y + k.h / 2;
        let m = [1, 0, 0, 1, 0, 0]; const maal = (a) => { const [p, q, r, s2, t2, u] = m, [A, B2, C, D2, E, F] = a; m = [A * p + C * q, B2 * p + D2 * q, A * r + C * s2, B2 * r + D2 * s2, A * t2 + C * u + E, B2 * t2 + D2 * u + F]; };
        if (w.schaal !== undefined) { const sx = getal(typeof w.schaal === 'number' ? w.schaal : w.schaal.x, 0.001, 1000, 'schaal'), sy = getal(typeof w.schaal === 'number' ? w.schaal : w.schaal.y, 0.001, 1000, 'schaal'); maal([sx, 0, 0, sy, cx - sx * cx, cy - sy * cy]); }
        if (w.draai !== undefined) { const r = getal(w.draai, -36000, 36000, 'draai') * Math.PI / 180, c = Math.cos(r), s2 = Math.sin(r); maal([c, s2, -s2, c, cx - c * cx + s2 * cy, cy - s2 * cx - c * cy]); }
        if (w.verplaats !== undefined) maal([1, 0, 0, 1, getal(w.verplaats.dx, -G, G, 'verplaats.dx'), getal(w.verplaats.dy, -G, G, 'verplaats.dy')]);
        if (m.join() !== '1,0,0,1,0,0') transformeer(o, m);
        const s3 = stijl(w); if (Object.keys(s3).length) { const zet = (x) => { if (x.stijl) Object.assign(x.stijl, s3); (x.kinderen || []).forEach(zet); }; zet(o); }
        if (w.naam !== undefined) o.naam = String(w.naam).slice(0, 200); }
      teken(); log('wijzig: ' + plan.length + ' object(en)', 'ok'); return { aangepast: plan.length }; }
    case 'wijzigSelectie': { mag('document.schrijven'); schrijven(); const s = stijl(data || {}); if (!Object.keys(s).length) fout('Er is niets om te veranderen.'); if (!gekozen.size) fout('Selecteer eerst iets.');
      const zet = (o) => { if (o.stijl) Object.assign(o.stijl, s); (o.kinderen || []).forEach(zet); }; vormen.filter((o) => gekozen.has(o.id)).forEach(zet); teken(); log('wijzigSelectie: ' + JSON.stringify(s), 'ok'); return { aangepast: gekozen.size }; }
    case 'melding': log(M.naam + ': ' + String(data && data.tekst).slice(0, 300), (data && data.soort) || 'info'); return null;
    case 'bewaar': { const j = JSON.stringify(data.waarde === undefined ? null : data.waarde); if (j.length > 65536) fout('Dat is te groot om te bewaren (hooguit 64 kB).'); opslag.set(data.sleutel, j); return null; }
    case 'haal': return opslag.has(data.sleutel) ? JSON.parse(opslag.get(data.sleutel)) : null;
    case 'sluit': setTimeout(stop); return null;
    default: fout('Onbekende aanroep: ' + soort);
  }
}
function stop() { if (!lopend) return; try { lopend.poort && lopend.poort.close(); } catch (e) {} lopend.frame.remove(); window.removeEventListener('message', lopend.luister); lopend = null; document.getElementById('venster').hidden = true; }
function start(c) {
  stop();
  const plek = document.getElementById('venster'), frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts'); frame.src = '/plugin?c=' + encodeURIComponent(c.id) + '&t=' + Date.now();
  const l = { frame, poort: null, laden: 0 };
  l.luister = (e) => {
    if (lopend !== l || e.source !== frame.contentWindow || l.poort || !e.data || e.data.vexelPlugin !== 1 || !e.ports[0]) return;
    l.poort = e.ports[0];
    l.poort.onmessage = (m) => { const q = m.data || {}; Promise.resolve().then(() => voer(q.soort, q.data)).then((d) => l.poort.postMessage({ antwoord: q.id, data: d }, d && d.pixels instanceof ArrayBuffer ? [d.pixels] : []),
      (x) => { log((x.plugin ? 'geweigerd: ' : 'fout in de proefbank: ') + x.message, 'fout'); l.poort.postMessage({ antwoord: q.id, fout: x.plugin ? x.message : 'Dat lukte niet.' }); }); };
    l.poort.postMessage({ start: c.id });
  };
  frame.addEventListener('load', () => { if (++l.laden > 1 && lopend === l) { log('De plugin probeerde een andere pagina te openen en is gestopt.', 'fout'); stop(); } });
  window.addEventListener('message', l.luister); lopend = l;
  document.getElementById('venster-titel').textContent = c.titel;
  if (c.venster) { frame.style.width = c.venster.breedte + 'px'; frame.style.height = c.venster.hoogte + 'px'; plek.hidden = false; plek.append(frame); }
  else { frame.hidden = true; document.body.append(frame); }
  log('start: ' + c.titel);
}
document.getElementById('sluit').addEventListener('click', stop);
document.getElementById('wis').addEventListener('click', () => { vormen = []; gekozen.clear(); teken(); });
document.getElementById('foto').addEventListener('click', async () => { const mime = document.getElementById('fotoSoort').value; plaatsFoto(await testfoto(mime), mime === 'image/png' ? 'Testfoto (PNG)' : 'Testfoto'); });
document.getElementById('eigenFoto').addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const bmp = await createImageBitmap(f); const bron = { blob: f, url: URL.createObjectURL(f), mime: f.type || 'image/png', breedte: bmp.width, hoogte: bmp.height, cmyk: false }; bmp.close(); plaatsFoto(bron, f.name.slice(0, 100)); }
  catch (x) { log('Deze foto kan de proefbank niet openen: ' + x.message, 'fout'); } });
document.getElementById('voorbeeld').addEventListener('click', () => { const o = bouw({ soort: 'rechthoek', x: 60, y: 60, b: 160, h: 100, vulling: { cmyk: [0, 60, 100, 0] }, naam: 'Voorbeeld' }, { n: 0, p: 0 }); vormen.push(o); gekozen = new Set([o.id]); teken(); });
const knoppen = document.getElementById('commandos');
M.commandos.forEach((c) => { const k = document.createElement('button'); k.className = 'knop primair'; k.textContent = c.titel; k.addEventListener('click', () => start(c)); knoppen.append(k); });
teken();
`;

function hostPagina() {
  const manifest = JSON.parse(lees('plugin.json'));
  const veilig = JSON.stringify(manifest).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Proefbank · ${manifest.naam ? String(manifest.naam).replace(/[<&"]/g, '') : ''}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#111216;color:#e8e9ec;font:13px/1.45 Inter,system-ui,sans-serif;display:grid;grid-template-columns:minmax(0,1fr) auto;height:100vh}
main{overflow:auto;display:grid;place-items:center;padding:24px;background:#0b0c0f}#vel{width:min(100%,560px);height:auto;box-shadow:0 8px 30px #0008;cursor:default}
aside{min-width:360px;max-width:860px;border-left:1px solid #2c2e35;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:auto;background:#17181c}
h1{font-size:15px;margin:0}.zacht{color:#9a9eaa;font-size:12px}.rij{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.knop{height:28px;padding:0 12px;border:1px solid #464954;border-radius:5px;background:#2c2e35;color:#e8e9ec;font:inherit;cursor:pointer}.knop.primair{background:#c6ff3d;border-color:#c6ff3d;color:#11130a;font-weight:600}
select,label{font:inherit;color:#e8e9ec}select{background:#24262c;border:1px solid #34363e;border-radius:5px;height:26px}
#venster{border:1px solid #464954;border-radius:10px;overflow:hidden;background:#1c1d22}#venster-kop{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid #34363e;font-weight:600}
#venster iframe{display:block;border:0;max-width:100%}#log{list-style:none;margin:0;padding:0;font:12px/1.4 ui-monospace,monospace;max-height:40vh;overflow:auto}
#log li{padding:4px 0;border-bottom:1px solid #24262c}#log .ok{color:#9be37a}#log .fout{color:#ff7b7b}#log .let{color:#ffc35c}
</style></head><body>
<main><svg id="vel" viewBox="0 0 595.28 841.89" xmlns="http://www.w3.org/2000/svg"></svg></main>
<aside>
  <div><h1>Proefbank</h1><div class="zacht">${String(manifest.naam || '').replace(/[<&"]/g, '')} · rechten: ${(manifest.rechten || []).join(', ').replace(/[<&"]/g, '') || 'geen'}</div></div>
  <div class="rij" id="commandos"></div>
  <div id="venster" hidden><div id="venster-kop"><span id="venster-titel"></span><button class="knop" id="sluit" title="Sluiten (Esc)">×</button></div></div>
  <div class="rij"><label>Kleurruimte <select id="ruimte"><option value="cmyk">CMYK</option><option value="rgb">RGB</option></select></label>
    <label><input type="checkbox" id="alleenLezen"> alleen-lezen</label></div>
  <div class="rij"><button class="knop" id="voorbeeld">Voorbeeldvorm (geselecteerd)</button><button class="knop" id="wis">Alles wissen</button></div>
  <div class="rij"><button class="knop" id="foto">Testfoto (geselecteerd)</button>
    <select id="fotoSoort" title="Bestandssoort van de testfoto"><option value="image/jpeg">JPEG</option><option value="image/png">PNG, doorzichtige hoeken</option></select>
    <label title="Doe alsof de foto CMYK is (zetBeeld zet hem dan om naar RGB)"><input type="checkbox" id="fotoCmyk"> CMYK</label>
    <label class="knop" style="display:inline-flex;align-items:center">Eigen foto…<input type="file" id="eigenFoto" accept="image/*" hidden></label></div>
  <div class="zacht" id="telling"></div>
  <div class="zacht">Klik een vorm of foto om hem te selecteren (Shift voor meer). Wat de plugin doet en wat er geweigerd wordt, staat hieronder.</div>
  <ul id="log"></ul>
</aside>
<script type="application/json" id="manifest">${veilig}</script><script src="/bank.js"></script>
</body></html>`;
}

const HOST_CSP = `default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: blob:; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

http.createServer((q, r) => {
  const pad = q.url.split('?')[0];
  const stuur = (status, type, body, extra = {}) => { r.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra }); r.end(body); };
  try {
    if (pad === '/') return stuur(200, 'text/html; charset=utf-8', hostPagina(), { 'content-security-policy': HOST_CSP });
    if (pad === '/bank.js') return stuur(200, 'text/javascript; charset=utf-8', HOST_JS);
    if (pad === '/plugin') {
      const p = pluginPagina();
      return stuur(p.status, 'text/html; charset=utf-8', p.html, p.csp ? { 'content-security-policy': p.csp } : {});
    }
    stuur(404, 'text/plain; charset=utf-8', 'Niet gevonden.');
  } catch (e) {
    stuur(500, 'text/plain; charset=utf-8', 'De proefbank kon dit niet laden: ' + e.message);
  }
}).listen(POORT, '127.0.0.1', () => {
  console.log(`Proefbank voor ${basename(map)}: http://localhost:${POORT}`);
  controleer();
  console.log('\nPas plugin.js aan en klik opnieuw op het commando. Stoppen: Ctrl+C.');
});
