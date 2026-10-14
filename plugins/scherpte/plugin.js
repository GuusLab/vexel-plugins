// Vervagen en verscherpen: gaussisch vervagen, verscherpen met een onscherpmasker en bewegingsonscherpte.
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

// ---- vervagen ---------------------------------------------------------------------
// Een gaussische vervaging is hier (vanaf een straal van ruim een pixel) drie keer een
// vierkantvervaging met een lopende som: even snel bij straal 2 als bij straal 200.

/** Drie breedtes voor vierkantvervagingen die samen een gaussische vervaging met deze sigma benaderen. */
function vakBreedtes(sigma, n) {
  const ideaal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideaal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

/** Vierkantvervaging over een rij of kolom van `aantal` waarden met `kanalen` per pixel. */
function vakLijn(bron, doel, begin, stap, aantal, kanalen, r) {
  const deel = 1 / (2 * r + 1);
  for (let k = 0; k < kanalen; k++) {
    const eerste = bron[begin + k], laatste = bron[begin + (aantal - 1) * stap + k];
    let som = eerste * r;
    for (let j = 0; j < r; j++) som += bron[begin + Math.min(j, aantal - 1) * stap + k];
    for (let i = 0; i < aantal; i++) {
      const erbij = i + r < aantal ? bron[begin + (i + r) * stap + k] : laatste;
      som += erbij;
      doel[begin + i * stap + k] = som * deel;
      const eraf = i - r >= 0 ? bron[begin + (i - r) * stap + k] : eerste;
      som -= eraf;
    }
  }
}

/** Kleine gaussische kern direct, voor sigma tot ongeveer 1,2 pixel. */
function kernLijn(bron, doel, begin, stap, aantal, kanalen, kern) {
  const r = (kern.length - 1) / 2;
  for (let i = 0; i < aantal; i++) {
    for (let k = 0; k < kanalen; k++) {
      let som = 0;
      for (let j = -r; j <= r; j++) {
        const t = i + j < 0 ? 0 : i + j >= aantal ? aantal - 1 : i + j;
        som += bron[begin + t * stap + k] * kern[j + r];
      }
      doel[begin + i * stap + k] = som;
    }
  }
}

/** Verticale vierkantvervaging, rij voor rij (snel: het geheugen wordt op volgorde gelezen). */
function vakKolommen(bron, doel, B, H, kanalen, r) {
  const n = B * kanalen, deel = 1 / (2 * r + 1), som = new Float64Array(n);
  const rij = (y) => (y < 0 ? 0 : y >= H ? H - 1 : y) * n;
  for (let j = -r; j < r; j++) { const o = rij(j); for (let c = 0; c < n; c++) som[c] += bron[o + c]; }
  for (let y = 0; y < H; y++) {
    const erbij = rij(y + r), eraf = rij(y - r), o = y * n;
    for (let c = 0; c < n; c++) {
      som[c] += bron[erbij + c];
      doel[o + c] = som[c] * deel;
      som[c] -= bron[eraf + c];
    }
  }
}

/** Verticale kleine kern, rij voor rij. */
function kernKolommen(bron, doel, B, H, kanalen, kern) {
  const n = B * kanalen, r = (kern.length - 1) / 2, acc = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    acc.fill(0);
    for (let j = -r; j <= r; j++) {
      const t = y + j < 0 ? 0 : y + j >= H ? H - 1 : y + j, o = t * n, k = kern[j + r];
      for (let c = 0; c < n; c++) acc[c] += bron[o + c] * k;
    }
    doel.set(acc, y * n);
  }
}

/** Vervaagt een vlak van B × H met `kanalen` waarden per pixel, in de plaats. tmp is even groot. */
function gauss(vlak, tmp, B, H, kanalen, sigma) {
  if (sigma < 0.2) return;
  const rijen = (bron, doel, lijn) => { for (let y = 0; y < H; y++) lijn(bron, doel, y * B * kanalen, kanalen, B); };
  if (sigma < 1.2) {
    const r = Math.ceil(sigma * 3), kern = new Float32Array(2 * r + 1);
    let s = 0;
    for (let j = -r; j <= r; j++) { kern[j + r] = Math.exp(-(j * j) / (2 * sigma * sigma)); s += kern[j + r]; }
    for (let j = 0; j < kern.length; j++) kern[j] /= s;
    rijen(vlak, tmp, (bron, doel, begin, stap, aantal) => kernLijn(bron, doel, begin, stap, aantal, kanalen, kern));
    kernKolommen(tmp, vlak, B, H, kanalen, kern);
    return;
  }
  for (const breedte of vakBreedtes(sigma, 3)) {
    const r = (breedte - 1) / 2;
    if (r < 1) continue;
    rijen(vlak, tmp, (bron, doel, begin, stap, aantal) => vakLijn(bron, doel, begin, stap, aantal, kanalen, r));
    vakKolommen(tmp, vlak, B, H, kanalen, r);
  }
}

const isDekkend = (p) => { for (let i = 3; i < p.length; i += 4) if (p[i] !== 255) return false; return true; };

function rekenVervagen(b, w, ctx) {
  const { breedte: B, hoogte: H, pixels: p } = b;
  const n = B * H, sigma = w.straal * ctx.f;
  const dekkend = isDekkend(p);
  // Per kanaal in kommagetallen (geen afronding tussen de stappen, dus geen banden in een egale lucht),
  // en vooraf vermenigvuldigd met de dekking, zodat doorzichtige randen niet donker worden.
  const vlak = new Float32Array(n), tmp = new Float32Array(n);
  let dek = null;
  if (!dekkend) {
    dek = new Float32Array(n);
    for (let j = 0; j < n; j++) dek[j] = p[j * 4 + 3];
    gauss(dek, tmp, B, H, 1, sigma);
  }
  const uit = new Uint8ClampedArray(p.length);
  for (let k = 0; k < 3; k++) {
    if (dekkend) for (let j = 0; j < n; j++) vlak[j] = p[j * 4 + k];
    else for (let j = 0; j < n; j++) vlak[j] = p[j * 4 + k] * p[j * 4 + 3];
    gauss(vlak, tmp, B, H, 1, sigma);
    if (dekkend) for (let j = 0; j < n; j++) uit[j * 4 + k] = vlak[j];
    else for (let j = 0; j < n; j++) uit[j * 4 + k] = dek[j] > 0.001 ? vlak[j] / dek[j] : 0;
  }
  for (let j = 3; j < p.length; j += 4) uit[j] = p[j];
  return uit;
}

// ---- verscherpen ------------------------------------------------------------------
// Onscherpmasker op de helderheid: het verschil tussen de foto en een vervaagde versie wordt
// versterkt. Alleen op de helderheid, dus zonder gekleurde randjes. De drempel laat egale vlakken
// (lucht, huid) met rust.

function rekenVerscherpen(b, w, ctx) {
  const { breedte: B, hoogte: H, pixels: p } = b;
  const n = B * H;
  const Y = new Float32Array(n);
  for (let j = 0, i = 0; j < n; j++, i += 4) Y[j] = p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722;
  const vaag = new Float32Array(Y);
  gauss(vaag, new Float32Array(n), B, H, 1, Math.max(0.2, w.straal * ctx.f));
  const sterkte = w.hoeveelheid / 100, drempel = w.drempel;
  const uit = new Uint8ClampedArray(p.length);
  for (let j = 0, i = 0; j < n; j++, i += 4) {
    let d = Y[j] - vaag[j];
    if (drempel > 0) {
      const a = Math.abs(d);
      if (a < drempel) { const t = a / drempel; d *= t * t; }
    }
    d *= sterkte;
    uit[i] = p[i] + d;
    uit[i + 1] = p[i + 1] + d;
    uit[i + 2] = p[i + 2] + d;
    uit[i + 3] = p[i + 3];
  }
  return uit;
}

// ---- bewegingsonscherpte ------------------------------------------------------------
// De foto wordt gedraaid zodat de beweging horizontaal loopt, dan per rij uitgesmeerd met een
// lopende som (gewogen met de dekking, zodat de rand van de foto niet donker wordt), en terug gedraaid.

function smeerRijen(d, B, H, r) {
  const uit = new Uint8ClampedArray(d.length);
  const rr = new Float64Array(B + 1), rg = new Float64Array(B + 1), rb = new Float64Array(B + 1), ra = new Float64Array(B + 1);
  for (let y = 0; y < H; y++) {
    const o = y * B * 4;
    for (let x = 0; x < B; x++) {
      const i = o + x * 4, a = d[i + 3];
      rr[x + 1] = rr[x] + d[i] * a; rg[x + 1] = rg[x] + d[i + 1] * a; rb[x + 1] = rb[x] + d[i + 2] * a; ra[x + 1] = ra[x] + a;
    }
    for (let x = 0; x < B; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(B, x + r + 1);
      const a = ra[x1] - ra[x0], i = o + x * 4;
      if (a <= 0) continue;
      uit[i] = (rr[x1] - rr[x0]) / a; uit[i + 1] = (rg[x1] - rg[x0]) / a; uit[i + 2] = (rb[x1] - rb[x0]) / a; uit[i + 3] = 255;
    }
  }
  return uit;
}

function rekenBeweging(b, w, ctx) {
  const { breedte: B, hoogte: H, pixels: p } = b;
  const r = Math.max(0, Math.round((w.afstand * ctx.f) / 2));
  const uit = new Uint8ClampedArray(p.length);
  if (r < 1) { uit.set(p); return uit; }
  const hoek = ((w.hoek % 180) + 180) % 180;
  let gesmeerd;
  if (hoek === 0) {
    gesmeerd = smeerRijen(p, B, H, r);
  } else {
    const rad = (hoek * Math.PI) / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    const pariteit = (n, ref) => (n % 2 === ref % 2 ? n : n + 1);
    const W2 = pariteit(Math.ceil(B * c + H * s) + 2 * r + 4, c >= s ? B : H);
    const H2 = pariteit(Math.ceil(B * s + H * c) + 4, c >= s ? H : B);
    const bron = new OffscreenCanvas(B, H);
    bron.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p), B, H), 0, 0);
    const draai = new OffscreenCanvas(W2, H2), g2 = draai.getContext('2d', { willReadFrequently: true });
    g2.imageSmoothingQuality = 'high';
    g2.translate(W2 / 2, H2 / 2);
    g2.rotate(rad);
    g2.drawImage(bron, -B / 2, -H / 2);
    const smeer = smeerRijen(g2.getImageData(0, 0, W2, H2).data, W2, H2, r);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.putImageData(new ImageData(smeer, W2, H2), 0, 0);
    const terug = new OffscreenCanvas(B, H), g3 = terug.getContext('2d', { willReadFrequently: true });
    g3.imageSmoothingQuality = 'high';
    g3.translate(B / 2, H / 2);
    g3.rotate(-rad);
    g3.drawImage(draai, -W2 / 2, -H2 / 2);
    gesmeerd = g3.getImageData(0, 0, B, H).data;
  }
  for (let i = 0; i < p.length; i += 4) {
    uit[i] = gesmeerd[i]; uit[i + 1] = gesmeerd[i + 1]; uit[i + 2] = gesmeerd[i + 2]; uit[i + 3] = p[i + 3];
  }
  return uit;
}

function tekenRichting(g, kader, w, zweeft) {
  if (!zweeft) return;
  const rad = (w.hoek * Math.PI) / 180, l = Math.min(kader.b, kader.h) * 0.18;
  const cx = kader.x + kader.b / 2, cy = kader.y + kader.h / 2, dx = Math.cos(rad) * l, dy = -Math.sin(rad) * l;
  for (const [kleur, dikte] of [['rgba(0,0,0,0.55)', 4], ['#ffffff', 1.5]]) {
    g.strokeStyle = kleur;
    g.lineWidth = dikte;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - dx, cy - dy);
    g.lineTo(cx + dx, cy + dy);
    g.stroke();
  }
}

const foto = (n) => meervoud(n, 'foto', "foto's");
const PX = (n) => getalTekst(n, n < 10 && n % 1 ? 1 : 0);

const VERVAGEN = {
  naam: 'Vervagen',
  sleutel: 'vervagen',
  ware: true,
  zwaar: true,
  standaard: (info) => ({ straal: Math.max(1, Math.round(info.lang / 300)), zaad: 1 }),
  regelaars: [
    { soort: 'schuif', sleutel: 'straal', label: 'Straal', min: 0.3, max: 250, stap: 0.1, eenheid: 'px', schaal: 'log',
      uitleg: 'In pixels van de volle foto.' },
  ],
  reken: rekenVervagen,
  marge: (w) => w.straal * 3 + 2,
  samenvatting: (w) => `Gaussische vervaging met een straal van ${PX(w.straal)} px op de volle foto.`,
  klaar: (w, n) => `Vervaagd: ${foto(n)}.`,
};

const VERSCHERPEN = {
  naam: 'Verscherpen',
  sleutel: 'verscherpen',
  ware: true,
  zwaar: true,
  standaard: () => ({ hoeveelheid: 80, straal: 1.2, drempel: 2, zaad: 1 }),
  regelaars: [
    { soort: 'schuif', sleutel: 'hoeveelheid', label: 'Hoeveelheid', min: 0, max: 400, stap: 1, eenheid: '%' },
    { soort: 'schuif', sleutel: 'straal', label: 'Straal', min: 0.3, max: 30, stap: 0.1, eenheid: 'px', schaal: 'log',
      uitleg: 'Hoe breed de randjes worden: klein voor fijne details, groot voor meer diepte.' },
    { soort: 'schuif', sleutel: 'drempel', label: 'Drempel', min: 0, max: 60, stap: 1, eenheid: '',
      uitleg: 'Kleine verschillen (ruis, huid, lucht) onder deze waarde blijven met rust.' },
  ],
  reken: rekenVerscherpen,
  marge: (w) => w.straal * 3 + 2,
  samenvatting: (w) => `Onscherpmasker: ${w.hoeveelheid} %, straal ${PX(w.straal)} px, drempel ${w.drempel}.`
    + ' Bekijk het op 100 %: verkleind zie je verscherping maar half.',
  klaar: (w, n) => `Verscherpt: ${foto(n)}.`,
};

const BEWEGING = {
  naam: 'Bewegingsonscherpte',
  sleutel: 'beweging',
  ware: true,
  zwaar: true,
  standaard: (info) => ({ hoek: 0, afstand: Math.max(4, Math.round(info.lang / 40)), zaad: 1 }),
  regelaars: [
    { soort: 'schuif', sleutel: 'hoek', label: 'Hoek', min: 0, max: 180, stap: 1, eenheid: '°', uiteinden: ['horizontaal', 'verticaal'],
      uitleg: '0° is horizontaal, 90° verticaal.' },
    { soort: 'schuif', sleutel: 'afstand', label: 'Afstand', min: 1, max: 600, stap: 1, eenheid: 'px', schaal: 'log',
      uitleg: 'Hoe ver de beweging gaat, in pixels van de volle foto.' },
  ],
  reken: rekenBeweging,
  overlay: tekenRichting,
  marge: (w) => w.afstand + 4,
  samenvatting: (w) => `Beweging van ${w.afstand} px onder ${w.hoek}°. Houd de muis op de voorvertoning om de richting te zien.`,
  klaar: (w, n) => `Bewegingsonscherpte toegepast op ${foto(n)}.`,
};

vexel.opCommando('vervagen', () => fotoVenster(VERVAGEN));
vexel.opCommando('verscherpen', () => fotoVenster(VERSCHERPEN));
vexel.opCommando('beweging', () => fotoVenster(BEWEGING));
