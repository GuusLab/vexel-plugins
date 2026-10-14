// Dithering: maak van een foto een 1-bit- of beperkt-paletbeeld met foutverdeling of een geordend raster.
// Eigen werk van GuusLab, MIT-licentie.
'use strict';

// ---- Het fotovenster ---------------------------------------------------------
// Dezelfde opbouw in alle fotobewerkers: links een grote live voorvertoning,
// rechts de instellingen, onderin een samenvatting en Toepassen.

const MAX_PIXELS = 16000000;
const VOORBEELD_ZIJDE = 900;

function el(tag, opties = {}, ...kinderen) {
  const e = document.createElement(tag);
  for (const [sleutel, waarde] of Object.entries(opties)) {
    if (waarde === undefined || waarde === null) continue;
    if (sleutel === 'klasse') e.className = waarde;
    else if (sleutel === 'tekst') e.textContent = waarde;
    else if (sleutel === 'stijl') Object.assign(e.style, waarde);
    else if (sleutel.startsWith('bij')) e.addEventListener(sleutel.slice(3).toLowerCase(), waarde);
    else e.setAttribute(sleutel, String(waarde));
  }
  for (const kind of kinderen) if (kind !== null && kind !== undefined && kind !== false) e.append(kind);
  return e;
}

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getalTekst = (n, d = 0) => Number(n).toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
const pauze = () => new Promise((klaar) => requestAnimationFrame(() => setTimeout(klaar, 0)));
const meervoud = (n, een, veel) => `${getalTekst(n)} ${n === 1 ? een : veel}`;

/** De pixelmaat die vexel.beeld() zonder maxZijde teruggeeft (hooguit 16 miljoen pixels). */
function volleMaat(origineel) {
  const [b, h] = origineel;
  if (b * h <= MAX_PIXELS) return [b, h];
  const s = Math.sqrt(MAX_PIXELS / (b * h));
  return [Math.max(1, Math.floor(b * s)), Math.max(1, Math.floor(h * s))];
}

/** Een rechthoekig stuk uit een beeld, als nieuw beeld. */
function uitsnede(b, x0, y0, br, ho) {
  const uit = new Uint8ClampedArray(br * ho * 4);
  for (let y = 0; y < ho; y++) {
    const van = ((y0 + y) * b.breedte + x0) * 4;
    uit.set(b.pixels.subarray(van, van + br * 4), y * br * 4);
  }
  return { breedte: br, hoogte: ho, pixels: uit };
}

/** Een verkleinde kopie (voor vloeiend slepen bij zware filters). */
function verklein(b, factor) {
  const br = Math.max(1, Math.round(b.breedte * factor));
  const ho = Math.max(1, Math.round(b.hoogte * factor));
  const bron = new OffscreenCanvas(b.breedte, b.hoogte);
  bron.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(b.pixels), b.breedte, b.hoogte), 0, 0);
  const doel = new OffscreenCanvas(br, ho);
  const g = doel.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bron, 0, 0, br, ho);
  return { breedte: br, hoogte: ho, pixels: g.getImageData(0, 0, br, ho).data };
}

const FV_STIJL = `
body{padding:0;overflow:hidden}
[hidden]{display:none!important}
.fv{display:grid;grid-template-columns:minmax(0,1fr) 252px;grid-template-rows:minmax(0,1fr) auto;height:100vh}
.fv-links{display:flex;flex-direction:column;min-width:0;min-height:0;padding:12px 0 0 12px;gap:8px}
.fv-beeld{position:relative;flex:1;min-height:0;background:var(--bg-2);border:1px solid var(--lijn);border-radius:6px;overflow:hidden}
.fv-beeld canvas{position:absolute;left:0;top:0;width:100%;height:100%;border-radius:0;background:transparent}
.fv-beeld.pannen canvas{cursor:grab}.fv-beeld.pannen.sleept canvas{cursor:grabbing}.fv-beeld.klikbaar canvas{cursor:crosshair}
.fv-merk{position:absolute;left:8px;top:8px;padding:2px 8px;border-radius:10px;background:#000a;color:#fff;font-size:11px;pointer-events:none}
.fv-leeg{position:absolute;inset:0;display:grid;place-content:center;gap:6px;padding:24px;text-align:center}
.fv-leeg strong{font-size:13px;font-weight:600}
.fv-balk{display:flex;align-items:center;gap:8px;min-height:26px}
.fv-balk .knop{height:26px;padding:0 10px}.fv-balk .fv-keus{flex:0 0 auto}.fv-balk .fv-keus button{flex:0 0 auto;padding:0 10px}.fv-balk .uitleg{margin-left:auto;white-space:nowrap}
.fv-paneel{overflow:auto;padding:12px 14px 8px;display:grid;align-content:start;gap:12px}
.fv-regel{display:grid;gap:5px}
.fv-kop{display:flex;align-items:center;gap:6px;min-height:22px}
.fv-kop .label{min-width:0;flex:1}
.fv-getal{width:58px;height:22px;padding:0 6px;border:1px solid var(--lijn);border-radius:4px;background:var(--bg-2);
  color:var(--tekst);font:inherit;text-align:right}
.fv-getal:focus{outline:none;border-color:var(--accent)}
.fv-eenheid{color:var(--tekst-zacht);font-size:11px;min-width:16px}
.fv-regel input[type=range]{width:100%;margin:0;height:16px}
.fv-uiteinden{display:flex;justify-content:space-between;color:var(--tekst-zwak,#7f838f);font-size:10.5px;margin-top:-3px}
.fv-keus{display:flex;border:1px solid var(--lijn);border-radius:5px;overflow:hidden}
.fv-keus button{flex:1;min-width:0;height:26px;padding:0 4px;border:0;border-left:1px solid var(--lijn);background:var(--bg-2);
  color:var(--tekst-zacht);font:inherit;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fv-keus button:first-child{border-left:0}
.fv-keus button[aria-pressed=true]{background:var(--bg-3,#2c2e35);color:var(--tekst);box-shadow:inset 0 -2px 0 var(--accent)}
.fv-vink{display:flex;align-items:center;gap:8px;color:var(--tekst);cursor:pointer}
.fv-kleuren{display:flex;gap:8px}.fv-kleuren label{flex:1;display:grid;gap:4px}
.fv-kleuren input[type=color]{width:100%;height:26px;padding:2px;border:1px solid var(--lijn);border-radius:5px;background:var(--bg-2)}
.fv-zaad{display:flex;align-items:center;gap:8px}.fv-zaad .knop{flex:1}
.fv-voet{grid-column:1/3;display:flex;align-items:center;gap:8px;padding:10px 14px 12px 12px}
.fv-voet .uitleg{flex:1;margin:0;min-width:0;line-height:1.35}
.fv-voet .fout{color:var(--rood,#ff5c5c)}
`;

/**
 * Opent het fotovenster voor een bewerking `def`:
 *   naam, standaard(info), regelaars[], reken(bron, w, ctx), samenvatting(w, info), klaar(w, n)
 *   en optioneel: zwaar, scherp, ware, marge(w), klik(u, v, w), overlay(g, kader, w).
 * reken() krijgt ctx = { f, ox, oy, volB, volH }: f = pixels van dit beeld per pixel van de volle foto,
 * ox/oy = waar dit beeld in de (verkleinde) hele foto begint, volB/volH = de hele foto in deze maat.
 */
async function fotoVenster(def) {
  document.head.append(el('style', { tekst: FV_STIJL }));
  const [doc, selectie, opgeslagen] = await Promise.all([vexel.document(), vexel.selectie(), vexel.haal(def.sleutel)]);
  const fotos = selectie.filter((o) => o.soort === 'beeld');
  const eerste = fotos[0] || null;
  const [refB, refH] = eerste ? volleMaat(eerste.beeld.px) : [1200, 800];
  const info = { refB, refH, lang: Math.max(refB, refH), aantal: fotos.length };

  // ---- instellingen ----
  const standaard = () => ({ ...def.standaard(info) });
  let w = normaliseer({ ...standaard(), ...(opgeslagen && typeof opgeslagen === 'object' ? opgeslagen : {}) });

  function normaliseer(x) {
    const st = standaard();
    for (const r of def.regelaars) {
      if (!r.sleutel) continue;
      const v = x[r.sleutel];
      if (r.soort === 'schuif') x[r.sleutel] = Number.isFinite(v) ? begrens(v, r.min, r.max) : st[r.sleutel];
      else if (r.soort === 'keuze' || r.soort === 'lijst') x[r.sleutel] = r.opties.some((o) => o[0] === v) ? v : st[r.sleutel];
      else if (r.soort === 'vink') x[r.sleutel] = typeof v === 'boolean' ? v : st[r.sleutel];
      else if (r.soort === 'kleuren') {
        for (const k of r.sleutels) x[k] = typeof x[k] === 'string' && x[k].length === 7 && x[k][0] === '#' ? x[k] : st[k];
      }
    }
    if (def.normaliseer) def.normaliseer(x, st);
    if (!Number.isInteger(x.zaad)) x.zaad = st.zaad || 1;
    return x;
  }

  // ---- opbouw ----
  const doek = el('canvas', { 'aria-label': 'Voorvertoning' });
  const merk = el('div', { klasse: 'fv-merk', tekst: 'Origineel', hidden: '' });
  const leeg = el('div', { klasse: 'fv-leeg', hidden: '' });
  const beeldVak = el('div', { klasse: 'fv-beeld' }, doek, merk, leeg);
  const voorNa = el('button', { klasse: 'knop', type: 'button', tekst: 'Voor/na', title: 'Ingedrukt houden (of de toets V) toont het origineel' });
  const maatTekst = el('span', { klasse: 'uitleg' });
  let modus = 'passend';
  const zoomKeus = def.ware ? keuzeKnoppen([['passend', 'Passend'], ['ware', '100 %']], () => modus, (v) => {
    modus = v;
    zetModus();
  }) : null;
  const balk = el('div', { klasse: 'fv-balk' }, voorNa, zoomKeus && zoomKeus.el, maatTekst);
  const links = el('div', { klasse: 'fv-links' }, beeldVak, balk);

  const paneel = el('div', { klasse: 'fv-paneel' });
  const samenvatting = el('p', { klasse: 'uitleg', 'aria-live': 'polite' });
  const standaardKnop = el('button', { klasse: 'knop', type: 'button', tekst: 'Standaard', title: 'Alle instellingen terugzetten' });
  const annuleer = el('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const toepassen = el('button', { klasse: 'knop primair', type: 'submit', tekst: 'Toepassen' });
  const voet = el('div', { klasse: 'fv-voet' }, samenvatting, standaardKnop, annuleer, toepassen);
  const formulier = el('form', { klasse: 'fv', novalidate: '' }, links, paneel, voet);
  document.body.append(formulier);

  function keuzeKnoppen(opties, haal, zet) {
    const knoppen = opties.map(([waarde, tekst, titel]) => el('button', {
      type: 'button', tekst, title: titel || tekst, 'aria-pressed': 'false',
      bijClick: () => { zet(waarde); bij(); },
    }));
    const bij = () => knoppen.forEach((k, i) => k.setAttribute('aria-pressed', String(opties[i][0] === haal())));
    bij();
    return { el: el('div', { klasse: 'fv-keus', role: 'group' }, ...knoppen), bij };
  }

  // regelaars
  const bijwerkers = [];
  let sleept = false;
  for (const r of def.regelaars) {
    const rij = maakRegelaar(r);
    if (!rij) continue;
    paneel.append(rij.el);
    bijwerkers.push(() => {
      rij.bij();
      if (r.toon) rij.el.hidden = !r.toon(w, info);
    });
  }

  function maakRegelaar(r) {
    const verander = () => { cache = null; plan(); werkTekstBij(); bijwerkers.forEach((f) => f()); };
    if (r.soort === 'schuif') {
      const log = r.schaal === 'log';
      const naarSchuif = (v) => log ? Math.round(1000 * Math.log(v / r.min) / Math.log(r.max / r.min)) : v;
      const vanSchuif = (s) => {
        if (!log) return Number(s);
        const v = r.min * Math.pow(r.max / r.min, Number(s) / 1000);
        return Math.round(v / r.stap) * r.stap;
      };
      const schuif = el('input', { type: 'range', min: log ? 0 : r.min, max: log ? 1000 : r.max, step: log ? 1 : r.stap, 'aria-label': r.label });
      const getal = el('input', { klasse: 'fv-getal', type: 'number', min: r.min, max: r.max, step: r.stap, 'aria-label': r.label });
      const decimalen = String(r.stap).includes('.') ? String(r.stap).split('.')[1].length : 0;
      const bij = () => {
        schuif.value = String(naarSchuif(w[r.sleutel]));
        if (document.activeElement !== getal) getal.value = w[r.sleutel].toFixed(decimalen);
      };
      schuif.addEventListener('pointerdown', () => { sleept = true; });
      const los = () => { if (sleept) { sleept = false; cache = null; plan(); } };
      schuif.addEventListener('pointerup', los);
      schuif.addEventListener('pointercancel', los);
      schuif.addEventListener('input', () => { w[r.sleutel] = vanSchuif(schuif.value); getal.value = w[r.sleutel].toFixed(decimalen); verander(); });
      schuif.addEventListener('change', los);
      getal.addEventListener('input', () => {
        const n = Number(String(getal.value).replace(',', '.'));
        if (getal.value === '' || !Number.isFinite(n)) return;
        w[r.sleutel] = begrens(n, r.min, r.max);
        verander();
      });
      getal.addEventListener('change', () => { getal.value = w[r.sleutel].toFixed(decimalen); });
      const kop = el('div', { klasse: 'fv-kop' }, el('span', { klasse: 'label', tekst: r.label }), getal,
        el('span', { klasse: 'fv-eenheid', tekst: r.eenheid || '' }));
      const kinderen = [kop, schuif];
      if (r.uiteinden) kinderen.push(el('div', { klasse: 'fv-uiteinden' }, el('span', { tekst: r.uiteinden[0] }), el('span', { tekst: r.uiteinden[1] })));
      const blok = el('div', { klasse: 'fv-regel', title: r.uitleg || null }, ...kinderen);
      return { el: blok, bij };
    }
    if (r.soort === 'keuze') {
      const k = keuzeKnoppen(r.opties, () => w[r.sleutel], (v) => { w[r.sleutel] = v; verander(); });
      return { el: el('div', { klasse: 'fv-regel' }, r.label ? el('span', { klasse: 'label', tekst: r.label }) : null, k.el), bij: k.bij };
    }
    if (r.soort === 'lijst') {
      const lijst = el('select', { klasse: 'veld', 'aria-label': r.label }, ...r.opties.map(([v, t]) => el('option', { value: v, tekst: t })));
      lijst.addEventListener('change', () => { w[r.sleutel] = lijst.value; verander(); });
      return { el: el('label', { klasse: 'fv-regel' }, el('span', { klasse: 'label', tekst: r.label }), lijst), bij: () => { lijst.value = w[r.sleutel]; } };
    }
    if (r.soort === 'vink') {
      const vak = el('input', { type: 'checkbox' });
      vak.addEventListener('change', () => { w[r.sleutel] = vak.checked; verander(); });
      return { el: el('label', { klasse: 'fv-vink' }, vak, el('span', { tekst: r.label })), bij: () => { vak.checked = w[r.sleutel]; } };
    }
    if (r.soort === 'kleuren') {
      const velden = r.sleutels.map((k, i) => {
        const v = el('input', { type: 'color', 'aria-label': r.labels[i] });
        v.addEventListener('input', () => { w[k] = v.value; verander(); });
        return v;
      });
      const rij = el('div', { klasse: 'fv-kleuren' }, ...velden.map((v, i) => el('label', {}, el('span', { klasse: 'uitleg', tekst: r.labels[i] }), v)));
      return { el: el('div', { klasse: 'fv-regel' }, r.label ? el('span', { klasse: 'label', tekst: r.label }) : null, rij),
        bij: () => velden.forEach((v, i) => { v.value = w[r.sleutels[i]]; }) };
    }
    if (r.soort === 'knop') {
      const knop = el('button', { klasse: 'knop', type: 'button', tekst: r.label, bijClick: () => { r.actie(w, info); verander(); } });
      return { el: knop, bij: () => {} };
    }
    if (r.soort === 'zaad') {
      const nummer = el('span', { klasse: 'uitleg' });
      const knop = el('button', { klasse: 'knop', type: 'button', tekst: 'Andere variant', bijClick: () => {
        w.zaad = 1 + Math.floor(Math.random() * 99998);
        verander();
      } });
      return { el: el('div', { klasse: 'fv-zaad' }, knop, nummer), bij: () => { nummer.textContent = `variant ${w.zaad}`; } };
    }
    return null;
  }

  // ---- de voorvertoning ----
  let voorbeeld = null;   // { breedte, hoogte, pixels } van de eerste foto, hooguit 900 px
  let half = null;        // half zo groot, voor slepen bij zware filters
  let vol = null;         // volle resolutie, alleen voor 100 %
  let laadtVol = false;
  let cache = null;       // { sleutel, beeld }
  let toonOrigineel = false;
  let kader = null;       // waar het beeld in het doek staat (css-pixels)
  const pan = { x: refB / 2, y: refH / 2 };
  let melding = '';
  let zweeft = false;
  let rafId = 0;
  const werkDoek = new OffscreenCanvas(1, 1);

  function plan() {
    if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; teken(); });
  }

  function toonLeeg(kop, uitleg) {
    leeg.replaceChildren(el('strong', { tekst: kop }), uitleg ? el('span', { klasse: 'uitleg', tekst: uitleg }) : null);
    leeg.hidden = false;
  }

  function bereken() {
    if (modus === 'ware') {
      if (!vol) return null;
      const vak = beeldVak.getBoundingClientRect();
      const br = Math.min(vol.breedte, Math.max(1, Math.floor(vak.width)));
      const ho = Math.min(vol.hoogte, Math.max(1, Math.floor(vak.height)));
      pan.x = begrens(pan.x, br / 2, vol.breedte - br / 2);
      pan.y = begrens(pan.y, ho / 2, vol.hoogte - ho / 2);
      const x0 = Math.round(pan.x - br / 2);
      const y0 = Math.round(pan.y - ho / 2);
      const m = Math.ceil(def.marge ? def.marge(w) : 0);
      const mx0 = Math.max(0, x0 - m), my0 = Math.max(0, y0 - m);
      const mx1 = Math.min(vol.breedte, x0 + br + m), my1 = Math.min(vol.hoogte, y0 + ho + m);
      const sleutel = `ware|${x0}|${y0}|${br}|${ho}|${JSON.stringify(w)}`;
      if (cache && cache.sleutel === sleutel) return cache;
      const stuk = uitsnede(vol, mx0, my0, mx1 - mx0, my1 - my0);
      const ctx = { f: 1, ox: mx0, oy: my0, volB: vol.breedte, volH: vol.hoogte, voorbeeld: true };
      const uit = def.reken(stuk, w, ctx);
      const res = { breedte: stuk.breedte, hoogte: stuk.hoogte, pixels: uit };
      const bron = uitsnede(stuk, x0 - mx0, y0 - my0, br, ho);
      cache = { sleutel, beeld: uitsnede(res, x0 - mx0, y0 - my0, br, ho), bron };
      return cache;
    }
    const snel = sleept && def.zwaar;
    const b = snel ? (half || (half = verklein(voorbeeld, 0.5))) : voorbeeld;
    const sleutel = `pas|${snel}|${JSON.stringify(w)}`;
    if (cache && cache.sleutel === sleutel) return cache;
    const ctx = { f: b.breedte / refB, ox: 0, oy: 0, volB: b.breedte, volH: b.hoogte, voorbeeld: true };
    cache = { sleutel, beeld: { breedte: b.breedte, hoogte: b.hoogte, pixels: def.reken(b, w, ctx) }, bron: b };
    return cache;
  }

  function teken() {
    const vak = beeldVak.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    const dw = Math.max(1, Math.round(vak.width * dpr)), dh = Math.max(1, Math.round(vak.height * dpr));
    if (doek.width !== dw || doek.height !== dh) { doek.width = dw; doek.height = dh; }
    const g = doek.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, dw, dh);
    merk.hidden = true;
    if (!voorbeeld) return;
    if (modus === 'ware' && !vol) { toonLeeg('Ware grootte laden…'); return; }
    leeg.hidden = true;
    let r;
    try {
      r = bereken();
    } catch (fout) {
      toonLeeg('Dit lukt niet in de voorvertoning.', fout && fout.message ? fout.message : String(fout));
      return;
    }
    const b = toonOrigineel ? r.bron : r.beeld;
    if (werkDoek.width !== b.breedte || werkDoek.height !== b.hoogte) { werkDoek.width = b.breedte; werkDoek.height = b.hoogte; }
    werkDoek.getContext('2d').putImageData(new ImageData(b.pixels, b.breedte, b.hoogte), 0, 0);
    let s;
    if (modus === 'ware') s = dpr;
    else s = Math.min((dw - 2 * dpr) / b.breedte, (dh - 2 * dpr) / b.hoogte, 4 * dpr);
    const bw = b.breedte * s, bh = b.hoogte * s;
    const x = Math.round((dw - bw) / 2), y = Math.round((dh - bh) / 2);
    // scherpe pixels alleen bij een hele vergroting; anders zacht schalen (geen moiré)
    g.imageSmoothingEnabled = !(modus === 'ware' || (def.scherp && s >= 1.9));
    g.imageSmoothingQuality = 'high';
    g.drawImage(werkDoek, x, y, Math.round(bw), Math.round(bh));
    kader = { x: x / dpr, y: y / dpr, b: bw / dpr, h: bh / dpr };
    if (toonOrigineel) merk.hidden = false;
    else if (def.overlay && modus === 'passend') {
      g.save();
      g.scale(dpr, dpr);
      def.overlay(g, kader, w, zweeft);
      g.restore();
    }
  }

  async function zetModus() {
    beeldVak.classList.toggle('pannen', modus === 'ware');
    beeldVak.classList.toggle('klikbaar', modus === 'passend' && Boolean(def.klik));
    cache = null;
    werkTekstBij();
    if (modus === 'ware' && !vol && !laadtVol && eerste) {
      laadtVol = true;
      plan();
      try {
        vol = await vexel.beeld(eerste.id);
        pan.x = vol.breedte / 2;
        pan.y = vol.hoogte / 2;
      } catch (fout) {
        melding = fout && fout.message ? fout.message : 'De foto kon niet op ware grootte worden gelezen.';
        modus = 'passend';
        if (zoomKeus) zoomKeus.bij();
      }
      laadtVol = false;
      werkTekstBij();
    }
    plan();
  }

  // voor/na
  const zetOrigineel = (aan) => { if (toonOrigineel !== aan) { toonOrigineel = aan; plan(); } };
  voorNa.addEventListener('pointerdown', (e) => { e.preventDefault(); zetOrigineel(true); });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) voorNa.addEventListener(t, () => zetOrigineel(false));
  document.addEventListener('keydown', (e) => {
    const veld = e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox';
    if ((e.key === 'v' || e.key === 'V') && !veld && !e.metaKey && !e.ctrlKey) zetOrigineel(true);
  });
  document.addEventListener('keyup', (e) => { if (e.key === 'v' || e.key === 'V') zetOrigineel(false); });

  // klikken en slepen in de voorvertoning
  let pannen = null;
  doek.addEventListener('pointerdown', (e) => {
    if (!voorbeeld) return;
    if (modus === 'ware') {
      pannen = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      beeldVak.classList.add('sleept');
      doek.setPointerCapture(e.pointerId);
      return;
    }
    if (def.klik && kader) {
      const vak = doek.getBoundingClientRect();
      const u = (e.clientX - vak.left - kader.x) / kader.b, v = (e.clientY - vak.top - kader.y) / kader.h;
      if (u < 0 || u > 1 || v < 0 || v > 1) return;
      def.klik(u, v, w);
      cache = null;
      bijwerkers.forEach((f) => f());
      werkTekstBij();
      plan();
    }
  });
  doek.addEventListener('pointermove', (e) => {
    if (!pannen) return;
    pan.x = pannen.px - (e.clientX - pannen.x);
    pan.y = pannen.py - (e.clientY - pannen.y);
    plan();
  });
  doek.addEventListener('pointerenter', () => { zweeft = true; if (def.overlay) plan(); });
  doek.addEventListener('pointerleave', () => { zweeft = false; if (def.overlay) plan(); });
  const stopPannen = () => { pannen = null; beeldVak.classList.remove('sleept'); };
  doek.addEventListener('pointerup', stopPannen);
  doek.addEventListener('pointercancel', stopPannen);
  new ResizeObserver(() => { cache = modus === 'ware' ? null : cache; plan(); }).observe(beeldVak);

  // ---- tekst onderin ----
  function werkTekstBij() {
    samenvatting.classList.remove('fout');
    if (!eerste) {
      samenvatting.textContent = selectie.length ? 'Je selectie bevat geen foto.' : 'Er is niets geselecteerd.';
      return;
    }
    const delen = [def.samenvatting(w, info)];
    if (fotos.length > 1) delen.push(`Op alle ${fotos.length} geselecteerde foto's (voorbeeld: de eerste).`);
    if (fotos.some((f) => f.beeld && f.beeld.cmyk)) delen.push('Een CMYK-foto wordt na toepassen RGB.');
    if (doc.alleenLezen) delen.push('Dit document is alleen-lezen: je kunt kijken, niet toepassen.');
    if (melding) delen.push(melding);
    samenvatting.textContent = delen.join(' ');
    maatTekst.textContent = modus === 'ware' ? `100 % · ${refB} × ${refH} px · sleep om te verschuiven`
      : `${eerste.beeld.px[0]} × ${eerste.beeld.px[1]} px`;
  }

  // ---- toepassen ----
  let bezig = false;
  async function pasToe() {
    if (bezig || !eerste || doc.alleenLezen) return;
    bezig = true;
    toepassen.disabled = true;
    standaardKnop.disabled = true;
    toepassen.textContent = 'Bezig…';
    samenvatting.textContent = 'Bezig met de foto op volle resolutie…';
    const begin = performance.now();
    try {
      for (let i = 0; i < fotos.length; i++) {
        if (fotos.length > 1) samenvatting.textContent = `Bezig met foto ${i + 1} van ${fotos.length}…`;
        await pauze();
        const b = await vexel.beeld(fotos[i].id);
        const [vb] = volleMaat(fotos[i].beeld.px);
        const ctx = { f: b.breedte / vb, ox: 0, oy: 0, volB: b.breedte, volH: b.hoogte, voorbeeld: false };
        const pixels = def.reken(b, w, ctx);
        await vexel.zetBeeld(fotos[i].id, { breedte: b.breedte, hoogte: b.hoogte, pixels });
      }
      await vexel.bewaar(def.sleutel, w);
      const sec = (performance.now() - begin) / 1000;
      vexel.melding(`${def.klaar(w, fotos.length)} (${getalTekst(sec, 1)} s)`, 'ok');
      vexel.sluit();
    } catch (fout) {
      bezig = false;
      toepassen.disabled = false;
      standaardKnop.disabled = false;
      toepassen.textContent = 'Toepassen';
      const tekst = fout && fout.message ? fout.message : 'Het toepassen is niet gelukt.';
      samenvatting.textContent = tekst;
      samenvatting.classList.add('fout');
      vexel.melding(tekst, 'fout');
    }
  }
  formulier.addEventListener('submit', (e) => { e.preventDefault(); pasToe(); });
  standaardKnop.addEventListener('click', () => {
    w = normaliseer(standaard());
    cache = null;
    bijwerkers.forEach((f) => f());
    werkTekstBij();
    plan();
  });

  // ---- starten ----
  bijwerkers.forEach((f) => f());
  werkTekstBij();
  zetModus();
  if (!eerste) {
    toepassen.disabled = true;
    voorNa.disabled = true;
    if (zoomKeus) zoomKeus.el.querySelectorAll('button').forEach((k) => { k.disabled = true; });
    toonLeeg('Selecteer eerst een foto (Bestand › Plaatsen).',
      selectie.length ? 'Je selectie bevat vormen, maar geen foto. Klik een foto aan en open dit venster opnieuw.'
        : 'Klik een foto aan en open dit venster opnieuw.');
    return;
  }
  if (doc.alleenLezen) toepassen.disabled = true;
  toonLeeg('Voorvertoning laden…');
  try {
    voorbeeld = await vexel.beeld(eerste.id, { maxZijde: VOORBEELD_ZIJDE });
  } catch (fout) {
    toepassen.disabled = true;
    toonLeeg('De foto kon niet worden gelezen.', fout && fout.message ? fout.message : '');
    return;
  }
  leeg.hidden = true;
  plan();
  toepassen.focus();
}

// ---- de bewerking -------------------------------------------------------------------
// 1. De foto wordt verdeeld in cellen van "pixelgrootte" (in pixels van de volle foto).
// 2. Per cel de gemiddelde helderheid (dekking telt mee), daarna helderheid en contrast.
// 3. Ditheren op de gewone (sRGB-)waarden: dat oogt op scherm en papier (met puntaanwas) het natuurlijkst.
// 4. Elke cel krijgt een kleur uit het palet; de dekking van de foto blijft zoals hij was.

function bayer(n) {
  let m = [[0]];
  while (m.length < n) {
    const k = m.length, nieuw = [];
    for (let y = 0; y < 2 * k; y++) {
      nieuw.push([]);
      for (let x = 0; x < 2 * k; x++) {
        const basis = 4 * m[y % k][x % k];
        nieuw[y].push(basis + [[0, 2], [3, 1]][Math.floor(y / k)][Math.floor(x / k)]);
      }
    }
    m = nieuw;
  }
  const uit = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) uit[y * n + x] = (m[y][x] + 0.5) / (n * n);
  return uit;
}
const BAYER = { bayer4: bayer(4), bayer8: bayer(8) };

const hexNaarRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Het palet: rgb per niveau, van donker naar licht. */
function palet(w) {
  if (w.palet === 'twee') {
    const a = hexNaarRgb(w.kleur1), b = hexNaarRgb(w.kleur2);
    const helder = (k) => 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
    return helder(a) <= helder(b) ? [a, b] : [b, a];
  }
  const n = w.palet === 'grijs' ? Math.round(w.tinten) : 2;
  return Array.from({ length: n }, (_, k) => { const v = Math.round(255 * k / (n - 1)); return [v, v, v]; });
}

/** Hoeveel pixels van dit beeld één punt van het raster is (minstens 1). */
function celMaat(w, ctx) {
  return Math.max(1, w.pixel * ctx.f);
}

function rekenDither(b, w, ctx) {
  const { breedte: B, hoogte: H, pixels: p } = b;
  const cs = celMaat(w, ctx);
  const gx0 = Math.floor(ctx.ox / cs), gy0 = Math.floor(ctx.oy / cs);
  const GW = Math.floor((ctx.ox + B - 1) / cs) - gx0 + 1, GH = Math.floor((ctx.oy + H - 1) / cs) - gy0 + 1;
  const n = GW * GH;
  const som = new Float32Array(n), dek = new Float32Array(n);
  const kolom = new Int32Array(B);
  for (let x = 0; x < B; x++) kolom[x] = Math.min(GW - 1, Math.floor((ctx.ox + x) / cs) - gx0);
  for (let y = 0; y < H; y++) {
    const rij = Math.min(GH - 1, Math.floor((ctx.oy + y) / cs) - gy0) * GW;
    for (let x = 0, i = y * B * 4; x < B; x++, i += 4) {
      const a = p[i + 3] + 0.5;
      som[rij + kolom[x]] += (p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722) * a;
      dek[rij + kolom[x]] += a;
    }
  }
  // helderheid en contrast
  const c = w.contrast >= 0 ? 1 + w.contrast / 40 : 1 + w.contrast / 100;
  const hd = w.helderheid / 100;
  const veld = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = (som[i] / dek[i]) / 255;
    v = (v - 0.5) * c + 0.5 + hd;
    veld[i] = begrens(v, 0, 1);
  }
  const kleuren = palet(w);
  const N = kleuren.length;
  const niveaus = new Float32Array(N);
  for (let k = 0; k < N; k++) niveaus[k] = k / (N - 1);
  const idx = new Uint8Array(n);
  const dichtst = (v) => {
    let k = 0;
    while (k < N - 1 && v > (niveaus[k] + niveaus[k + 1]) / 2) k++;
    return k;
  };
  const kaart = BAYER[w.methode];
  if (kaart) {
    const m = w.methode === 'bayer8' ? 8 : 4;
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const i = gy * GW + gx, v = veld[i];
        let k = 0;
        while (k < N - 2 && v >= niveaus[k + 1]) k++;
        const d = niveaus[k + 1] - niveaus[k], f = d > 0 ? (v - niveaus[k]) / d : 0;
        const drempel = kaart[((gy + gy0) % m) * m + ((gx + gx0) % m)];
        idx[i] = f > drempel ? k + 1 : k;
      }
    }
  } else if (w.methode === 'atkinson') {
    const buren = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const i = gy * GW + gx, v = veld[i], k = dichtst(v);
        idx[i] = k;
        const fout = (v - niveaus[k]) / 8;
        for (const [dx, dy] of buren) {
          const x = gx + dx, y = gy + dy;
          if (x >= 0 && x < GW && y < GH) veld[y * GW + x] += fout;
        }
      }
    }
  } else {
    // Floyd–Steinberg, slingerend (afwisselend links en rechts beginnen) tegen strepen
    for (let gy = 0; gy < GH; gy++) {
      const links = gy % 2 === 0, stap = links ? 1 : -1;
      for (let t = 0; t < GW; t++) {
        const gx = links ? t : GW - 1 - t;
        const i = gy * GW + gx, v = veld[i], k = dichtst(v);
        idx[i] = k;
        const fout = v - niveaus[k];
        const x1 = gx + stap;
        if (x1 >= 0 && x1 < GW) veld[i + stap] += fout * 7 / 16;
        if (gy + 1 < GH) {
          const o = i + GW;
          if (gx - stap >= 0 && gx - stap < GW) veld[o - stap] += fout * 3 / 16;
          veld[o] += fout * 5 / 16;
          if (x1 >= 0 && x1 < GW) veld[o + stap] += fout * 1 / 16;
        }
      }
    }
  }
  const uit = new Uint8ClampedArray(p.length);
  for (let y = 0; y < H; y++) {
    const rij = Math.min(GH - 1, Math.floor((ctx.oy + y) / cs) - gy0) * GW;
    for (let x = 0, i = y * B * 4; x < B; x++, i += 4) {
      const k = kleuren[idx[rij + kolom[x]]];
      uit[i] = k[0];
      uit[i + 1] = k[1];
      uit[i + 2] = k[2];
      uit[i + 3] = p[i + 3];
    }
  }
  return uit;
}

const METHODEN = [
  ['fs', 'Foutverdeling (Floyd–Steinberg)'],
  ['atkinson', 'Foutverdeling, contrastrijk (Atkinson)'],
  ['bayer4', 'Geordend raster 4 × 4 (Bayer)'],
  ['bayer8', 'Geordend raster 8 × 8 (Bayer)'],
];

const DITHERING = {
  naam: 'Dithering',
  sleutel: 'instellingen',
  ware: true,
  scherp: true,
  standaard: (info) => ({
    methode: 'fs', palet: 'zw', tinten: 4, kleur1: '#1d2433', kleur2: '#f2e9d8',
    pixel: Math.max(1, Math.round(info.lang / 600)), helderheid: 0, contrast: 10, zaad: 1,
  }),
  regelaars: [
    { soort: 'lijst', sleutel: 'methode', label: 'Methode', opties: METHODEN },
    { soort: 'keuze', sleutel: 'palet', label: 'Palet', opties: [['zw', 'Zwart-wit'], ['grijs', 'Grijs'], ['twee', '2 kleuren', 'Twee eigen kleuren']] },
    { soort: 'schuif', sleutel: 'tinten', label: 'Aantal tinten', min: 3, max: 8, stap: 1, eenheid: '', toon: (w) => w.palet === 'grijs' },
    { soort: 'kleuren', sleutels: ['kleur1', 'kleur2'], labels: ['Donker', 'Licht'], toon: (w) => w.palet === 'twee' },
    { soort: 'schuif', sleutel: 'pixel', label: 'Pixelgrootte', min: 1, max: 24, stap: 1, eenheid: 'px',
      uitleg: 'In pixels van de volle foto.' },
    { soort: 'schuif', sleutel: 'helderheid', label: 'Helderheid', min: -50, max: 50, stap: 1, eenheid: '' },
    { soort: 'schuif', sleutel: 'contrast', label: 'Contrast', min: -50, max: 100, stap: 1, eenheid: '' },
  ],
  reken: rekenDither,
  samenvatting: (w, info) => {
    const gb = Math.ceil(info.refB / w.pixel), gh = Math.ceil(info.refH / w.pixel);
    const pal = w.palet === 'zw' ? 'zwart-wit' : w.palet === 'grijs' ? `${w.tinten} grijstinten` : 'twee eigen kleuren';
    const fijn = Math.max(gb, gh) > VOORBEELD_ZIJDE ? ' Op ware grootte is het raster fijner dan passend: kies 100 % om het echt te zien.' : '';
    return `${gb} × ${gh} punten in ${pal}, elk ${w.pixel} × ${w.pixel} px.${fijn}`;
  },
  klaar: (w, n) => `Dithering toegepast op ${meervoud(n, 'foto', "foto's")}.`,
};

vexel.opCommando('dithering', () => fotoVenster(DITHERING));
