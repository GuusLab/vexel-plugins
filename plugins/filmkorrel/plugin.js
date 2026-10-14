// Filmkorrel: echte, klonterige korrel op een foto, met een zaadje zodat elke variant terug te halen is.
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

// ---- de korrel -------------------------------------------------------------------
// Korrel is hier geen ruis per pixel, maar een zacht veld van klontjes: willekeurige waarden op
// een rooster (in de maat van de volle foto), vloeiend geïnterpoleerd (kubische B-spline) en in
// drie lagen opgeteld: grove vlekken, de korrel zelf en een fijne laag die de korrel ruw maakt.
// Omdat het rooster aan de volle foto vastzit, ziet de voorvertoning er hetzelfde uit als het resultaat.

/** Een vast getal tussen -1 en 1 voor roosterpunt (ix, iy) en zaadje z. */
function roosterWaarde(ix, iy, z) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(z | 0, 0x2545f491);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2147483648 - 1;
}

/** De vier B-spline-gewichten voor positie t (0–1) tussen twee roosterpunten. */
function splineGewichten(t, uit, o) {
  const t2 = t * t, t3 = t2 * t, s = 1 - t;
  uit[o] = s * s * s / 6;
  uit[o + 1] = (3 * t3 - 6 * t2 + 4) / 6;
  uit[o + 2] = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6;
  uit[o + 3] = t3 / 6;
}

// De spreiding van het geïnterpoleerde veld, om elke laag op dezelfde sterkte te brengen.
const VELD_SPREIDING = (() => {
  const g = new Float64Array(4);
  let som = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    splineGewichten((i + 0.5) / n, g, 0);
    som += g[0] * g[0] + g[1] * g[1] + g[2] * g[2] + g[3] * g[3];
  }
  return (som / n) * Math.sqrt(1 / 3);
})();
const WAARDE_SPREIDING = Math.sqrt(1 / 3);

/**
 * Een laag korrel voor een beeld van breedte B dat op (ox, oy) in de hele foto begint.
 * cel = afstand tussen roosterpunten in pixels van dit beeld. Geeft een functie die rijen vult.
 */
function korrelLaag(B, ox, oy, cel, verschuif, zaad) {
  if (cel <= 1) {
    // Kleiner dan een pixel: één waarde per pixel, zwakker naarmate de korrel kleiner is
    // (zoals korrel die bij het verkleinen uitmiddelt).
    const sterk = cel / WAARDE_SPREIDING;
    return (doel, y0, rijen) => {
      for (let r = 0; r < rijen; r++) {
        const iy = oy + y0 + r, o = r * B;
        for (let x = 0; x < B; x++) doel[o + x] = roosterWaarde(ox + x, iy, zaad) * sterk;
      }
    };
  }
  const xi = new Int32Array(B), xw = new Float32Array(B * 4);
  let gx0 = Infinity, gx1 = -Infinity;
  for (let x = 0; x < B; x++) {
    const t = (ox + x + 0.5) / cel + verschuif, i = Math.floor(t);
    xi[x] = i - 1;
    splineGewichten(t - i, xw, x * 4);
    if (i - 1 < gx0) gx0 = i - 1;
    if (i + 2 > gx1) gx1 = i + 2;
  }
  const gb = gx1 - gx0 + 1;
  const norm = 1 / VELD_SPREIDING;
  const yw = new Float32Array(4);
  let tmp = new Float32Array(0);
  return (doel, y0, rijen) => {
    const ta = (oy + y0 + 0.5) / cel + verschuif, tb = (oy + y0 + rijen - 0.5) / cel + verschuif;
    const gy0 = Math.floor(ta) - 1, gy1 = Math.floor(tb) + 2, gh = gy1 - gy0 + 1;
    if (tmp.length < gh * B) tmp = new Float32Array(gh * B);
    const rij = new Float32Array(gb);
    for (let j = 0; j < gh; j++) {
      for (let k = 0; k < gb; k++) rij[k] = roosterWaarde(gx0 + k, gy0 + j, zaad);
      const o = j * B;
      for (let x = 0; x < B; x++) {
        const k = xi[x] - gx0, q = x * 4;
        tmp[o + x] = rij[k] * xw[q] + rij[k + 1] * xw[q + 1] + rij[k + 2] * xw[q + 2] + rij[k + 3] * xw[q + 3];
      }
    }
    for (let r = 0; r < rijen; r++) {
      const t = (oy + y0 + r + 0.5) / cel + verschuif, i = Math.floor(t);
      splineGewichten(t - i, yw, 0);
      const a = (i - 1 - gy0) * B, o = r * B;
      const w0 = yw[0] * norm, w1 = yw[1] * norm, w2 = yw[2] * norm, w3 = yw[3] * norm;
      for (let x = 0; x < B; x++) {
        doel[o + x] = tmp[a + x] * w0 + tmp[a + B + x] * w1 + tmp[a + 2 * B + x] * w2 + tmp[a + 3 * B + x] * w3;
      }
    }
  };
}

/** De korrelgrootte (afstand tussen roosterpunten) in pixels van de volle foto. */
function korrelCel(w, langeZijde) {
  return Math.max(1, langeZijde * 0.00055 * Math.pow(1.27, w.grootte - 1));
}

const BAND = 64;

function rekenKorrel(b, w, ctx) {
  const { breedte: B, hoogte: H, pixels: p } = b;
  const uit = new Uint8ClampedArray(p.length);
  const langeZijde = Math.max(ctx.volB, ctx.volH) / ctx.f;
  const cel = korrelCel(w, langeZijde) * ctx.f;
  const ruw = w.ruwheid / 100;
  const lagen = [[2.6, 0.25, 0.37], [1, 1, 0], [0.5, 0.15 + 0.85 * ruw, 0.71]];
  // de kleurlagen hebben geen grove vlekken: die zouden als kleurvlekken opvallen
  const kleurLagen = lagen.slice(1);
  const som = (l) => Math.sqrt(l.reduce((s, x) => s + x[1] * x[1], 0));
  const kleur = w.kleur / 100;
  const velden = kleur > 0 ? 4 : 1;
  const makers = [];
  for (let v = 0; v < velden; v++) {
    const l = v ? kleurLagen : lagen, somG = som(l);
    makers.push(l.map(([schaal, gewicht, verschuif], i) => ({
      vul: korrelLaag(B, ctx.ox, ctx.oy, cel * schaal, verschuif + v * 0.13, w.zaad * 977 + v * 131 + i * 17),
      gewicht: gewicht / somG,
    })));
  }
  // Hoeveel korrel bij welke helderheid: film heeft de meeste korrel in de middentonen.
  const sterkte = (w.sterkte / 100) * 64;
  const gewichtVan = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const l = i / 255;
    gewichtVan[i] = sterkte * (w.verdeling === 'gelijk' ? 0.78 : 0.12 + 0.88 * Math.pow(4 * l * (1 - l), 0.7));
  }
  const kn = 1 / Math.sqrt((1 - kleur) * (1 - kleur) + kleur * kleur || 1);
  const band = new Float32Array(BAND * B), laag = new Float32Array(BAND * B);
  const kanaal = velden > 1 ? [new Float32Array(BAND * B), new Float32Array(BAND * B), new Float32Array(BAND * B)] : null;

  const vulVeld = (maker, doel, y0, rijen) => {
    const n = rijen * B;
    doel.fill(0, 0, n);
    for (const { vul, gewicht } of maker) {
      vul(laag, y0, rijen);
      for (let i = 0; i < n; i++) doel[i] += laag[i] * gewicht;
    }
  };

  for (let y0 = 0; y0 < H; y0 += BAND) {
    const rijen = Math.min(BAND, H - y0);
    vulVeld(makers[0], band, y0, rijen);
    if (kanaal) for (let c = 0; c < 3; c++) vulVeld(makers[c + 1], kanaal[c], y0, rijen);
    const n = rijen * B;
    for (let j = 0, i = y0 * B * 4; j < n; j++, i += 4) {
      const r = p[i], g = p[i + 1], bl = p[i + 2];
      const a = gewichtVan[(r * 54 + g * 183 + bl * 19) >> 8];
      let k = band[j];
      k = k * (1 + 0.18 * k * k) / 1.4;   // iets klonteriger: pieken wat sterker dan de rest
      if (kanaal) {
        const m = k * (1 - kleur);
        uit[i] = r + a * (m + kanaal[0][j] * kleur) * kn;
        uit[i + 1] = g + a * (m + kanaal[1][j] * kleur) * kn;
        uit[i + 2] = bl + a * (m + kanaal[2][j] * kleur) * kn;
      } else {
        const d = a * k;
        uit[i] = r + d;
        uit[i + 1] = g + d;
        uit[i + 2] = bl + d;
      }
      uit[i + 3] = p[i + 3];
    }
  }
  return uit;
}

const FILMKORREL = {
  naam: 'Filmkorrel',
  sleutel: 'instellingen',
  ware: true,
  standaard: () => ({ sterkte: 35, grootte: 4, ruwheid: 45, kleur: 15, verdeling: 'film', zaad: 1 }),
  regelaars: [
    { soort: 'schuif', sleutel: 'sterkte', label: 'Sterkte', min: 0, max: 100, stap: 1, eenheid: '%' },
    { soort: 'schuif', sleutel: 'grootte', label: 'Korrelgrootte', min: 1, max: 10, stap: 0.1, eenheid: '', uiteinden: ['fijn', 'grof'],
      uitleg: 'Groeit mee met de foto: op een grote foto worden de korrels in pixels groter.' },
    { soort: 'schuif', sleutel: 'ruwheid', label: 'Ruwheid', min: 0, max: 100, stap: 1, eenheid: '%', uiteinden: ['zacht', 'ruw'] },
    { soort: 'schuif', sleutel: 'kleur', label: 'Kleur in de korrel', min: 0, max: 100, stap: 1, eenheid: '%', uiteinden: ['zwart-wit', 'kleur'] },
    { soort: 'keuze', sleutel: 'verdeling', label: 'Verdeling', opties: [
      ['film', 'Als film', 'Meer korrel in de middentonen, minder in wit en diep zwart'],
      ['gelijk', 'Overal gelijk', 'Even veel korrel in licht en donker'],
    ] },
    { soort: 'zaad' },
  ],
  reken: rekenKorrel,
  marge: () => 0,
  samenvatting: (w, info) => {
    const cel = korrelCel(w, info.lang);
    const soort = w.kleur === 0 ? 'zwart-witkorrel' : w.kleur < 50 ? 'korrel met wat kleur' : 'kleurkorrel';
    return `${soort[0].toUpperCase()}${soort.slice(1)}, ${w.sterkte} % sterk, korrels van ongeveer ${getalTekst(cel * 1.6, 1)} px`
      + ` op de volle foto. Kies 100 % om de korrel echt te zien.`;
  },
  klaar: (w, n) => `Filmkorrel toegevoegd aan ${meervoud(n, 'foto', "foto's")}.`,
};

vexel.opCommando('korrel', () => fotoVenster(FILMKORREL));
