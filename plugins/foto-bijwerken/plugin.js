// Foto bijwerken: belichting, contrast, hooglichten, schaduwen, witten en zwarten, warmte en tint,
// levendigheid, verzadiging, helderheid (lokaal contrast), vervagen en kant-en-klare looks.
// Eigen werk van GuusLab, MIT-licentie.
'use strict';

// ---- algemene hulpjes -------------------------------------------------------

function maak(tag, opties = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [sleutel, waarde] of Object.entries(opties)) {
    if (sleutel === 'klasse') el.className = waarde;
    else if (sleutel === 'tekst') el.textContent = waarde;
    else if (sleutel === 'stijl') Object.assign(el.style, waarde);
    else if (sleutel.startsWith('bij')) el.addEventListener(sleutel.slice(3).toLowerCase(), waarde);
    else el.setAttribute(sleutel, String(waarde));
  }
  for (const kind of kinderen) if (kind) el.append(kind);
  return el;
}

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getal = (n, cijfers = 0) => n.toLocaleString('nl-NL', { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });
const metTeken = (n, cijfers = 0) => {
  const t = getal(Math.abs(n), cijfers);
  if (Math.abs(n) < Math.pow(10, -cijfers) / 2) return getal(0, cijfers);
  return (n > 0 ? '+' : '−') + t;
};
/** Wacht tot de browser het venster opnieuw heeft getekend (zodat "Bezig…" echt te zien is). */
const verf = () => new Promise((klaar) => requestAnimationFrame(() => setTimeout(klaar, 0)));
const meervoud = (n, een, veel) => (n === 1 ? een : veel);

function hexNaarRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const n = h ? parseInt(h[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const geldigHex = (hex) => /^#[0-9a-f]{6}$/i.test(String(hex || ''));

// ---- kleurrekenwerk ---------------------------------------------------------

/** sRGB (0..1) naar lineair licht en terug; boven 1 gaat de kromme gewoon door. */
const naarLineair = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const naarGamma = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) LIN[i] = naarLineair(i / 255);

const glad = (a, b, x) => {
  const t = begrens((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Vervaagt een rij getallen (b × h) met drie keer een kastvervaging: bijna een gaussische vervaging. */
function vervaag(bron, b, h, straal) {
  const r = Math.max(1, Math.round(straal / 1.7));
  let a = Float32Array.from(bron);
  let tmp = new Float32Array(a.length);
  for (let keer = 0; keer < 3; keer++) {
    kastH(a, tmp, b, h, r);
    kastV(tmp, a, b, h, r);
  }
  return a;
}
function kastH(van, naar, b, h, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const rij = y * b;
    let som = van[rij] * (r + 1);
    for (let x = 1; x <= r; x++) som += van[rij + Math.min(b - 1, x)];
    for (let x = 0; x < b; x++) {
      naar[rij + x] = som / n;
      som += van[rij + Math.min(b - 1, x + r + 1)] - van[rij + Math.max(0, x - r)];
    }
  }
}
function kastV(van, naar, b, h, r) {
  const n = 2 * r + 1;
  for (let x = 0; x < b; x++) {
    let som = van[x] * (r + 1);
    for (let y = 1; y <= r; y++) som += van[Math.min(h - 1, y) * b + x];
    for (let y = 0; y < h; y++) {
      naar[y * b + x] = som / n;
      som += van[Math.min(h - 1, y + r + 1) * b + x] - van[Math.max(0, y - r) * b + x];
    }
  }
}

// ---- de bewerking -----------------------------------------------------------

const STANDAARD = {
  belichting: 0, contrast: 0, hooglichten: 0, schaduwen: 0, witten: 0, zwarten: 0,
  warmte: 0, tint: 0, levendigheid: 0, verzadiging: 0, helderheid: 0, vervagen: 0,
  behandeling: 'kleur', duoDonker: '#1e2a5a', duoLicht: '#ffd29a',
};

const SCHUIVEN = [
  { kop: 'Licht' },
  { sleutel: 'belichting', label: 'Belichting', min: -3, max: 3, stap: 0.05, cijfers: 2 },
  { sleutel: 'contrast', label: 'Contrast', min: -100, max: 100, stap: 1 },
  { sleutel: 'hooglichten', label: 'Hooglichten', min: -100, max: 100, stap: 1 },
  { sleutel: 'schaduwen', label: 'Schaduwen', min: -100, max: 100, stap: 1 },
  { sleutel: 'witten', label: 'Witten', min: -100, max: 100, stap: 1 },
  { sleutel: 'zwarten', label: 'Zwarten', min: -100, max: 100, stap: 1 },
  { kop: 'Kleur' },
  { sleutel: 'warmte', label: 'Warmte', min: -100, max: 100, stap: 1, spoor: 'linear-gradient(90deg,#4f8dff,#d9d9d9,#ffbf3f)' },
  { sleutel: 'tint', label: 'Tint', min: -100, max: 100, stap: 1, spoor: 'linear-gradient(90deg,#3fcf6a,#d9d9d9,#e35ce0)' },
  { sleutel: 'levendigheid', label: 'Levendigheid', min: -100, max: 100, stap: 1 },
  { sleutel: 'verzadiging', label: 'Verzadiging', min: -100, max: 100, stap: 1 },
  { kop: 'Detail en sfeer' },
  { sleutel: 'helderheid', label: 'Helderheid', min: -100, max: 100, stap: 1 },
  { sleutel: 'vervagen', label: 'Vervagen', min: 0, max: 100, stap: 1 },
];

const VOORINSTELLINGEN = [
  { naam: 'Warm', w: { warmte: 30, tint: 6, levendigheid: 14, contrast: 8, schaduwen: 10, hooglichten: -8 } },
  { naam: 'Koel', w: { warmte: -28, tint: -4, levendigheid: 10, contrast: 10, hooglichten: -12, zwarten: -6 } },
  { naam: 'Zacht', w: { contrast: -28, hooglichten: -30, schaduwen: 32, helderheid: -25, verzadiging: -10, vervagen: 10, belichting: 0.1 } },
  { naam: 'Krachtig', w: { contrast: 45, helderheid: 55, levendigheid: 40, zwarten: -22, witten: 18, hooglichten: -30, schaduwen: 22 } },
  { naam: 'Vervaagd mat', w: { contrast: -12, vervagen: 45, verzadiging: -28, warmte: 10, hooglichten: -20, schaduwen: 12 } },
  { naam: 'Zwart-wit', w: { behandeling: 'zw', contrast: 22, helderheid: 18, zwarten: -10 } },
  { naam: 'Sepia', w: { behandeling: 'sepia', contrast: 10, vervagen: 12, schaduwen: 10 } },
  { naam: 'Duotoon', w: { behandeling: 'duo', contrast: 25, zwarten: -10 } },
];

/** Zet de instellingen om in opzoektabellen; dat maakt het rekenen per pixel licht. */
function bereid(w) {
  const t = w.warmte / 100;
  const tint = w.tint / 100;
  let kr = Math.pow(2, 0.42 * t);
  let kb = Math.pow(2, -0.42 * t);
  let kg = Math.pow(2, -0.3 * tint);
  kr *= Math.pow(2, 0.1 * tint);
  kb *= Math.pow(2, 0.1 * tint);
  const y = 0.2126 * kr + 0.7152 * kg + 0.0722 * kb;
  const licht = Math.pow(2, w.belichting);
  kr = (kr / y) * licht;
  kg = (kg / y) * licht;
  kb = (kb / y) * licht;
  const lr = new Float32Array(256);
  const lg = new Float32Array(256);
  const lb = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    lr[i] = naarGamma(LIN[i] * kr);
    lg[i] = naarGamma(LIN[i] * kg);
    lb[i] = naarGamma(LIN[i] * kb);
  }
  // de vervaagde helderheid van het origineel, met de belichting erop
  const basis = new Float32Array(1025);
  for (let i = 0; i <= 1024; i++) basis[i] = naarGamma(naarLineair(i / 1024) * licht);

  // hooglichten en schaduwen: een verschuiving per helderheid (0 tot 2,5)
  const s = w.schaduwen / 100;
  const hl = w.hooglichten / 100;
  const N = 2048;
  const MAXV = 2.5;
  const delta = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * MAXV;
    let d = 0;
    if (s !== 0 && x < 0.6) {
      const gewicht = Math.pow(1 - x / 0.6, 2);
      d += s * (s > 0 ? 1.7 : 0.8) * x * gewicht;
    }
    if (hl < 0) d += hl * 0.32 * glad(0.32, 1.05, x) * Math.max(1, x);
    else if (hl > 0) d += hl * 0.2 * Math.sin(Math.PI * begrens((x - 0.3) / 0.75, 0, 1));
    delta[i] = d;
  }
  // zwarten, witten en contrast: één kromme
  const laag = -(w.zwarten / 100) * 0.1;
  const hoog = 1 - (w.witten / 100) * 0.16;
  const c = w.contrast / 100;
  const kromme = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * MAXV;
    let v = (x - laag) / (hoog - laag);
    if (v > 0 && v < 1) v += c * (v * v * (3 - 2 * v) - v);
    kromme[i] = v;
  }
  // kleurbehandeling: een kleurverloop over de grijswaarde
  let verloop = null;
  if (w.behandeling === 'zw') verloop = maakVerloop([[0, '#000000'], [1, '#ffffff']]);
  else if (w.behandeling === 'sepia') verloop = maakVerloop([[0, '#140c06'], [0.45, '#7a5434'], [0.8, '#d6b98e'], [1, '#fff6e4']]);
  else if (w.behandeling === 'duo') {
    const d = geldigHex(w.duoDonker) ? w.duoDonker : STANDAARD.duoDonker;
    const l = geldigHex(w.duoLicht) ? w.duoLicht : STANDAARD.duoLicht;
    verloop = maakVerloop([[0, d], [1, l]]);
  }
  const f = w.vervagen / 100;
  return {
    lr, lg, lb, basis, delta, kromme, N, MAXV, verloop,
    lokaal: s !== 0 || hl !== 0,
    helder: (w.helderheid / 100) * 1.4,
    verz: w.verzadiging / 100,
    lev: w.levendigheid / 100,
    vLaag: f * 0.16,
    vHoog: 1 - f * 0.07,
  };
}

/** Een kleurverloop als tabel van 256 × 3 (0..1), lineair gemengd. */
function maakVerloop(stops) {
  const tabel = new Float32Array(256 * 3);
  const rgb = stops.map(([p, hex]) => [p, hexNaarRgb(hex).map((v) => v / 255)]);
  for (let i = 0; i < 256; i++) {
    const p = i / 255;
    let j = 0;
    while (j < rgb.length - 2 && p > rgb[j + 1][0]) j++;
    const [pa, a] = rgb[j];
    const [pb, b] = rgb[j + 1];
    const t = begrens((p - pa) / (pb - pa || 1), 0, 1);
    for (let k = 0; k < 3; k++) tabel[i * 3 + k] = a[k] + (b[k] - a[k]) * t;
  }
  return tabel;
}

/**
 * Wat per foto (en per maat) maar één keer hoeft: de helderheid en twee vervaagde versies.
 * De stralen zijn een deel van de lange zijde, zodat de volle foto er net zo uitziet als de voorvertoning.
 */
function analyseer(px, b, h, nodig) {
  const n = b * h;
  const luma = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    luma[i] = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) / 255;
  }
  const lang = Math.max(b, h);
  const a = { b, h, luma, toon: null, detail: null };
  if (nodig.lokaal) a.toon = vervaag(luma, b, h, lang / 28);
  if (nodig.helder) a.detail = vervaag(luma, b, h, lang / 110);
  return a;
}

/** Rekent de foto uit: van `bron` naar `doel` (mag dezelfde array zijn). */
function bewerk(bron, doel, a, p) {
  const { lr, lg, lb, basis, delta, kromme, N, MAXV, verloop } = p;
  const n = a.b * a.h;
  const schaal = N / MAXV;
  const lokaal = p.lokaal && a.toon;
  const helder = p.helder !== 0 && a.detail ? p.helder : 0;
  const { verz, lev, vLaag, vHoog } = p;
  const vBereik = vHoog - vLaag;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let r = lr[bron[j]];
    let g = lg[bron[j + 1]];
    let bl = lb[bron[j + 2]];
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    let x = Y;
    if (lokaal) {
      const B = basis[(begrens(a.toon[i], 0, 1) * 1024) | 0];
      const dl = delta[Math.min(N, (B * schaal) | 0)];
      const dg = delta[Math.min(N, (begrens(Y, 0, MAXV) * schaal) | 0)];
      x = Y + 0.65 * dl + 0.35 * dg;
    } else if (p.lokaal) {
      x = Y + delta[Math.min(N, (begrens(Y, 0, MAXV) * schaal) | 0)];
    }
    let y = kromme[Math.min(N, (begrens(x, 0, MAXV) * schaal) | 0)];
    if (helder !== 0) {
      const midden = begrens(4 * y * (1 - y), 0, 1);
      y += helder * (a.luma[i] - a.detail[i]) * midden;
    }
    // de nieuwe helderheid terug naar de kleur
    if (Y > 0.004) {
      const k = y / Y;
      r *= k;
      g *= k;
      bl *= k;
    } else {
      const d = y - Y;
      r += d;
      g += d;
      bl += d;
    }
    // verzadiging en levendigheid
    if (verz !== 0 || lev !== 0) {
      const mx = Math.max(r, g, bl);
      const mn = Math.min(r, g, bl);
      const sat = begrens(mx - mn, 0, 1);
      let f = 1 + verz;
      if (lev > 0) f *= 1 + lev * 1.1 * (1 - sat) * (1 - sat);
      else if (lev < 0) f *= 1 + lev * (1 - sat * 0.4);
      r = y + (r - y) * f;
      g = y + (g - y) * f;
      bl = y + (bl - y) * f;
    }
    // buiten bereik: naar wit of zwart toe schuiven, zonder dat de kleur omslaat
    const mx = Math.max(r, g, bl);
    if (mx > 1) {
      if (y >= 1) r = g = bl = 1;
      else {
        const f = (1 - y) / (mx - y);
        r = y + (r - y) * f;
        g = y + (g - y) * f;
        bl = y + (bl - y) * f;
      }
    }
    const mn = Math.min(r, g, bl);
    if (mn < 0) {
      if (y <= 0) r = g = bl = 0;
      else {
        const f = y / (y - mn);
        r = y + (r - y) * f;
        g = y + (g - y) * f;
        bl = y + (bl - y) * f;
      }
    }
    if (verloop) {
      const k = Math.round(begrens(y, 0, 1) * 255) * 3;
      r = verloop[k];
      g = verloop[k + 1];
      bl = verloop[k + 2];
    }
    doel[j] = (vLaag + r * vBereik) * 255 + 0.5;
    doel[j + 1] = (vLaag + g * vBereik) * 255 + 0.5;
    doel[j + 2] = (vLaag + bl * vBereik) * 255 + 0.5;
    doel[j + 3] = bron[j + 3];
  }
}

/** Is er iets ingesteld? (Anders hoeft Toepassen niets te doen.) */
function isNeutraal(w) {
  for (const s of SCHUIVEN) if (s.sleutel && Math.abs(w[s.sleutel]) > 1e-9) return false;
  return w.behandeling === 'kleur';
}

/** Verkleint RGBA-pixels tot een klein voorbeeldje (voor de voorinstellingen). */
function verklein(px, b, h, maxZijde) {
  const bron = new OffscreenCanvas(b, h);
  bron.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), b, h), 0, 0);
  const f = Math.min(1, maxZijde / Math.max(b, h));
  const nb = Math.max(1, Math.round(b * f));
  const nh = Math.max(1, Math.round(h * f));
  const doel = new OffscreenCanvas(nb, nh);
  const g = doel.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bron, 0, 0, nb, nh);
  return { breedte: nb, hoogte: nh, pixels: g.getImageData(0, 0, nb, nh).data };
}

// ---- het venster ------------------------------------------------------------

const STIJL = `
[hidden]{display:none!important}
body{padding:12px 14px;overflow:hidden}
.fv{display:grid;grid-template-columns:minmax(0,1fr) 262px;grid-template-rows:minmax(0,1fr) auto;gap:10px 14px;height:calc(100vh - 24px)}
.fv-links{display:flex;flex-direction:column;gap:8px;min-height:0;min-width:0}
.fv-beeld{position:relative;flex:1;min-height:0;border-radius:6px;background:var(--bg-2);display:flex;align-items:center;justify-content:center;
  overflow:hidden;user-select:none;-webkit-user-select:none;cursor:pointer}
.fv-beeld canvas{background:transparent;border-radius:2px;box-shadow:0 1px 6px #0006}
.fv-beeld .fv-etiket{position:absolute;left:8px;top:8px;padding:2px 7px;border-radius:4px;background:#000b;color:#fff;font-size:11px;pointer-events:none}
.fv-leeg{max-width:300px;text-align:center;color:var(--tekst-zacht);line-height:1.5;cursor:default}
.fv-leeg b{display:block;color:var(--tekst);font-size:13px;margin-bottom:4px}
.fv-rechts{min-height:0;overflow-y:auto;padding-right:4px;margin-right:-4px}
.fv-kop{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--tekst-zwak,#7f838f);margin:12px 0 4px;font-weight:600}
.fv-kop:first-child{margin-top:0}
.fv-schuif{display:grid;grid-template-columns:86px minmax(0,1fr) 40px;align-items:center;gap:6px;height:24px}
.fv-schuif span:first-child{color:var(--tekst-zacht)}
.fv-schuif .fv-waarde{text-align:right;font-variant-numeric:tabular-nums;color:var(--tekst-zacht)}
.fv-schuif.gewijzigd span:first-child,.fv-schuif.gewijzigd .fv-waarde{color:var(--tekst)}
input[type=range]{width:100%;margin:0;height:16px;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--spoor,var(--lijn-sterk,#464954))}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4.5px;border-radius:50%;background:var(--tekst);
  border:2px solid var(--bg);box-shadow:0 0 0 1px #0008}
input[type=range]:focus{outline:none}input[type=range]:focus::-webkit-slider-thumb{background:var(--accent)}
input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:var(--spoor,var(--lijn-sterk,#464954))}
input[type=range]::-moz-range-thumb{width:10px;height:10px;border-radius:50%;background:var(--tekst);border:2px solid var(--bg)}
.fv-histo{width:100%;height:74px;border-radius:5px;background:var(--bg-2);display:block}
.fv-histo-uitleg{display:flex;justify-content:space-between;color:var(--tekst-zwak,#7f838f);font-size:10.5px;margin:3px 0 0}
.fv-voor{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;flex:0 0 auto}
.fv-voor button{flex:1 1 0;min-width:0;padding:3px 3px 4px;border:1px solid var(--lijn);border-radius:6px;background:var(--bg-2);color:var(--tekst-zacht);
  font:10.5px/1.2 inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px}
.fv-voor button:hover{border-color:var(--lijn-sterk,#464954);color:var(--tekst)}
.fv-voor button.actief{border-color:var(--accent);color:var(--tekst)}
.fv-voor canvas{width:100%;height:auto;aspect-ratio:108/76;border-radius:3px;background:var(--bg)}
.fv-onder{grid-column:1/-1;display:flex;align-items:center;gap:8px}
.fv-onder .uitleg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fv-rij{display:flex;align-items:center;gap:8px;margin:6px 0}
.fv-rij .label{min-width:86px}
.fv-rij input[type=color]{width:34px;height:24px;padding:0;border:1px solid var(--lijn);border-radius:4px;background:var(--bg-2);cursor:pointer}
`;

async function venster() {
  document.head.append(maak('style', { tekst: STIJL }));
  const doc = await vexel.document();
  const selectie = await vexel.selectie();
  const fotos = selectie.filter((o) => o.soort === 'beeld');
  const bewaard = (await vexel.haal('instellingen')) || {};
  const w = { ...STANDAARD };
  for (const k of Object.keys(STANDAARD)) {
    if (typeof bewaard[k] === typeof STANDAARD[k]) w[k] = bewaard[k];
  }

  // -- opbouw
  const beeldVak = maak('div', { klasse: 'fv-beeld', title: 'Ingedrukt houden: origineel' });
  const etiket = maak('div', { klasse: 'fv-etiket', tekst: 'Origineel' });
  etiket.hidden = true;
  const doek = maak('canvas');
  beeldVak.append(doek, etiket);
  const voorRij = maak('div', { klasse: 'fv-voor' });
  const links = maak('div', { klasse: 'fv-links' }, beeldVak, voorRij);

  const histo = maak('canvas', { klasse: 'fv-histo', width: 524, height: 148 });
  const rechts = maak('div', { klasse: 'fv-rechts' },
    maak('div', { klasse: 'fv-kop', tekst: 'Histogram' }), histo,
    maak('div', { klasse: 'fv-histo-uitleg' }, maak('span', { tekst: 'Schaduwen' }), maak('span', { tekst: 'Hooglichten' })));

  const schuiven = new Map();
  for (const s of SCHUIVEN) {
    if (s.kop) {
      rechts.append(maak('div', { klasse: 'fv-kop', tekst: s.kop }));
      continue;
    }
    const invoer = maak('input', { type: 'range', min: s.min, max: s.max, step: s.stap, 'aria-label': s.label });
    if (s.spoor) invoer.style.setProperty('--spoor', s.spoor);
    const waarde = maak('span', { klasse: 'fv-waarde' });
    const rij = maak('label', { klasse: 'fv-schuif', title: 'Dubbelklik om terug te zetten' }, maak('span', { tekst: s.label }), invoer, waarde);
    invoer.addEventListener('input', () => {
      w[s.sleutel] = Number(invoer.value);
      gewijzigd();
    });
    invoer.addEventListener('dblclick', () => {
      w[s.sleutel] = STANDAARD[s.sleutel];
      gewijzigd();
    });
    schuiven.set(s.sleutel, { s, invoer, waarde, rij });
    rechts.append(rij);
  }
  const behandeling = maak('select', { klasse: 'veld', 'aria-label': 'Kleur of zwart-wit' },
    maak('option', { value: 'kleur', tekst: 'Kleur' }),
    maak('option', { value: 'zw', tekst: 'Zwart-wit' }),
    maak('option', { value: 'sepia', tekst: 'Sepia' }),
    maak('option', { value: 'duo', tekst: 'Duotoon' }));
  behandeling.addEventListener('change', () => {
    w.behandeling = behandeling.value;
    gewijzigd();
  });
  const duoDonker = maak('input', { type: 'color', title: 'Kleur voor de donkere delen' });
  const duoLicht = maak('input', { type: 'color', title: 'Kleur voor de lichte delen' });
  for (const [veld, sleutel] of [[duoDonker, 'duoDonker'], [duoLicht, 'duoLicht']]) {
    veld.addEventListener('input', () => {
      w[sleutel] = veld.value;
      gewijzigd();
    });
  }
  const duoRij = maak('div', { klasse: 'fv-rij' }, maak('span', { klasse: 'label', tekst: 'Duotoon' }),
    duoDonker, maak('span', { klasse: 'uitleg', tekst: 'donker' }), duoLicht, maak('span', { klasse: 'uitleg', tekst: 'licht' }));
  rechts.append(maak('div', { klasse: 'fv-rij' }, maak('span', { klasse: 'label', tekst: 'Behandeling' }), behandeling), duoRij);

  const samenvatting = maak('div', { klasse: 'uitleg' });
  const voorNa = maak('button', { type: 'button', klasse: 'knop', tekst: 'Voor/na', title: 'Ingedrukt houden om het origineel te zien (of houd de toets V ingedrukt)' });
  const standaard = maak('button', { type: 'button', klasse: 'knop', tekst: 'Standaard', title: 'Alles terug op nul' });
  const annuleer = maak('button', { type: 'button', klasse: 'knop', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const toepassen = maak('button', { type: 'submit', klasse: 'knop primair', tekst: 'Toepassen' });
  const onder = maak('div', { klasse: 'fv-onder' }, voorNa, standaard, samenvatting, annuleer, toepassen);
  const formulier = maak('form', { klasse: 'fv' }, links, rechts, onder);
  document.body.append(formulier);

  // -- geen foto: netjes zeggen wat je moet doen
  const zonderFoto = (titel, tekst) => {
    doek.remove();
    beeldVak.style.cursor = 'default';
    beeldVak.removeAttribute('title');
    beeldVak.append(maak('div', { klasse: 'fv-leeg' }, maak('b', { tekst: titel }), maak('span', { tekst: tekst })));
    for (const el of formulier.querySelectorAll('input, select, button')) el.disabled = el !== annuleer;
    for (const el of [rechts, voorRij, voorNa, standaard, toepassen]) el.hidden = true;
    formulier.style.gridTemplateColumns = 'minmax(0,1fr)';
    annuleer.textContent = 'Sluiten';
    samenvatting.textContent = 'Er is niets om bij te werken.';
    formulier.addEventListener('submit', (e) => e.preventDefault());
    tekenHisto(null);
  };
  if (!fotos.length) {
    if (selectie.length) zonderFoto('Dit is geen foto', 'Je selectie bevat geen foto. Selecteer een foto (Bestand › Plaatsen) en open Foto bijwerken opnieuw.');
    else zonderFoto('Selecteer eerst een foto', 'Selecteer eerst een foto (Bestand › Plaatsen) en open Foto bijwerken opnieuw.');
    annuleer.focus();
    return;
  }

  // -- de foto (klein) ophalen
  samenvatting.textContent = 'Foto laden…';
  let klein;
  try {
    klein = await vexel.beeld(fotos[0].id, { maxZijde: 900 });
  } catch (fout) {
    zonderFoto('Deze foto kan ik niet lezen', fout.message);
    return;
  }
  const bron = klein.pixels;
  const uit = new ImageData(klein.breedte, klein.hoogte);
  doek.width = klein.breedte;
  doek.height = klein.hoogte;
  const g = doek.getContext('2d');
  const origineel = new ImageData(new Uint8ClampedArray(bron), klein.breedte, klein.hoogte);
  let analyse = analyseer(bron, klein.breedte, klein.hoogte, { lokaal: true, helder: true });

  const pasMaat = () => {
    const r = beeldVak.getBoundingClientRect();
    const f = Math.min((r.width - 16) / klein.breedte, (r.height - 16) / klein.hoogte, 2);
    doek.style.width = Math.max(1, Math.floor(klein.breedte * f)) + 'px';
    doek.style.height = Math.max(1, Math.floor(klein.hoogte * f)) + 'px';
  };
  pasMaat();
  addEventListener('resize', pasMaat);

  // -- voorinstellingen met een eigen voorbeeldje
  const mini = verklein(bron, klein.breedte, klein.hoogte, 140);
  const miniAnalyse = analyseer(mini.pixels, mini.breedte, mini.hoogte, { lokaal: true, helder: true });
  const voorKnoppen = [];
  for (const v of VOORINSTELLINGEN) {
    const c = maak('canvas', { width: 108, height: 76 });
    const knop = maak('button', { type: 'button', title: v.naam }, c, maak('span', { tekst: v.naam }));
    knop.addEventListener('click', () => {
      const duo = { duoDonker: w.duoDonker, duoLicht: w.duoLicht };
      Object.assign(w, STANDAARD, duo, v.w);
      gewijzigd();
    });
    voorKnoppen.push({ v, knop, c });
    voorRij.append(knop);
  }
  const tekenMinis = () => {
    for (const { v, c } of voorKnoppen) {
      const p = bereid({ ...STANDAARD, duoDonker: w.duoDonker, duoLicht: w.duoLicht, ...v.w });
      const px = new Uint8ClampedArray(mini.pixels.length);
      bewerk(mini.pixels, px, miniAnalyse, p);
      const tmp = new OffscreenCanvas(mini.breedte, mini.hoogte);
      tmp.getContext('2d').putImageData(new ImageData(px, mini.breedte, mini.hoogte), 0, 0);
      const cg = c.getContext('2d');
      cg.clearRect(0, 0, c.width, c.height);
      const f = Math.max(c.width / mini.breedte, c.height / mini.hoogte);
      const db = mini.breedte * f;
      const dh = mini.hoogte * f;
      cg.drawImage(tmp, (c.width - db) / 2, (c.height - dh) / 2, db, dh);
    }
  };
  tekenMinis();

  // -- histogram
  function tekenHisto(px) {
    const hg = histo.getContext('2d');
    const B = histo.width;
    const H = histo.height;
    hg.clearRect(0, 0, B, H);
    hg.strokeStyle = 'rgba(255,255,255,0.07)';
    hg.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      hg.beginPath();
      hg.moveTo(Math.round((B * i) / 4) + 0.5, 0);
      hg.lineTo(Math.round((B * i) / 4) + 0.5, H);
      hg.stroke();
    }
    if (!px) return;
    const bakken = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    const stap = px.length > 1600000 ? 8 : 4;
    for (let j = 0; j < px.length; j += stap) {
      if (px[j + 3] < 8) continue;
      bakken[0][px[j]]++;
      bakken[1][px[j + 1]]++;
      bakken[2][px[j + 2]]++;
    }
    // schaal op de hoogste piek, maar laat één uitschieter (puur wit of zwart) de rest niet platdrukken
    const alle = [];
    for (const b of bakken) for (let i = 1; i < 255; i++) alle.push(b[i]);
    alle.sort((a, b) => a - b);
    const max = Math.max(1, alle[Math.floor(alle.length * 0.995)] * 1.1);
    const kleuren = ['rgba(255,84,84,0.75)', 'rgba(84,220,110,0.75)', 'rgba(90,140,255,0.8)'];
    hg.globalCompositeOperation = 'lighter';
    bakken.forEach((b, k) => {
      hg.fillStyle = kleuren[k];
      hg.beginPath();
      hg.moveTo(0, H);
      for (let i = 0; i < 256; i++) hg.lineTo((i / 255) * B, H - Math.min(1, b[i] / max) * (H - 4));
      hg.lineTo(B, H);
      hg.closePath();
      hg.fill();
    });
    hg.globalCompositeOperation = 'source-over';
  }

  // -- tekenen
  let vraagTeken = 0;
  let toonOrigineel = false;
  function teken() {
    vraagTeken = 0;
    if (toonOrigineel) {
      g.putImageData(origineel, 0, 0);
      tekenHisto(origineel.data);
      return;
    }
    const p = bereid(w);
    bewerk(bron, uit.data, analyse, p);
    g.putImageData(uit, 0, 0);
    tekenHisto(uit.data);
  }
  const plan = () => {
    if (!vraagTeken) vraagTeken = requestAnimationFrame(teken);
  };

  const pixelTekst = `${getal(klein.origineel[0])} × ${getal(klein.origineel[1])} px`;
  const samen = () => {
    const delen = [];
    if (fotos.length > 1) delen.push(`${fotos.length} foto's geselecteerd; je ziet de eerste, Toepassen werkt ze allemaal bij`);
    else delen.push(`${fotos[0].naam || 'Foto'} · ${pixelTekst}`);
    if (fotos.some((f) => f.beeld && f.beeld.cmyk)) delen.push('CMYK-foto wordt RGB');
    if (doc.alleenLezen) delen.push('dit document is alleen-lezen');
    samenvatting.textContent = delen.join(' · ');
    samenvatting.title = samenvatting.textContent;
  };

  let bewaarKlok = 0;
  function gewijzigd() {
    for (const { s, invoer, waarde, rij } of schuiven.values()) {
      invoer.value = String(w[s.sleutel]);
      waarde.textContent = s.min < 0 ? metTeken(w[s.sleutel], s.cijfers || 0) : getal(w[s.sleutel], s.cijfers || 0);
      rij.classList.toggle('gewijzigd', Math.abs(w[s.sleutel]) > 1e-9);
    }
    behandeling.value = w.behandeling;
    duoDonker.value = w.duoDonker;
    duoLicht.value = w.duoLicht;
    duoRij.hidden = w.behandeling !== 'duo';
    for (const { v, knop } of voorKnoppen) {
      const doel = { ...STANDAARD, ...v.w };
      const zelfde = Object.keys(STANDAARD).every((k) => k.startsWith('duo') || doel[k] === w[k]);
      knop.classList.toggle('actief', zelfde);
    }
    toepassen.disabled = doc.alleenLezen;
    plan();
    clearTimeout(bewaarKlok);
    bewaarKlok = setTimeout(() => vexel.bewaar('instellingen', w), 400);
  }
  let duoKlok = 0;
  for (const veld of [duoDonker, duoLicht]) {
    veld.addEventListener('change', () => {
      clearTimeout(duoKlok);
      duoKlok = setTimeout(tekenMinis, 50);
    });
  }

  standaard.addEventListener('click', () => {
    Object.assign(w, STANDAARD, { duoDonker: w.duoDonker, duoLicht: w.duoLicht });
    gewijzigd();
  });

  // voor/na: ingedrukt houden op de knop, op de foto, of de toets V
  const zetOrigineel = (aan) => {
    if (toonOrigineel === aan) return;
    toonOrigineel = aan;
    etiket.hidden = !aan;
    voorNa.classList.toggle('primair', aan);
    plan();
  };
  for (const el of [voorNa, beeldVak]) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      zetOrigineel(true);
    });
  }
  addEventListener('pointerup', () => zetOrigineel(false));
  addEventListener('pointercancel', () => zetOrigineel(false));
  addEventListener('blur', () => zetOrigineel(false));
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.repeat) zetOrigineel(true);
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'v' || e.key === 'V') zetOrigineel(false);
  });

  // -- toepassen op de volle foto's
  formulier.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (doc.alleenLezen) {
      vexel.melding('Dit document is alleen-lezen; de foto kan niet worden aangepast.', 'let');
      return;
    }
    if (isNeutraal(w)) {
      vexel.melding('Er is niets ingesteld; de foto blijft zoals hij was.', 'info');
      vexel.sluit();
      return;
    }
    clearTimeout(bewaarKlok);
    vexel.bewaar('instellingen', w);
    for (const el of formulier.querySelectorAll('input, select, button')) el.disabled = true;
    toepassen.textContent = 'Bezig…';
    let klaar = 0;
    try {
      const p = bereid(w);
      for (const foto of fotos) {
        samenvatting.textContent = fotos.length > 1 ? `Bezig met foto ${klaar + 1} van ${fotos.length}…` : 'Bezig met de volle foto…';
        await verf();
        const groot = await vexel.beeld(foto.id);
        const a = analyseer(groot.pixels, groot.breedte, groot.hoogte, { lokaal: p.lokaal, helder: p.helder !== 0 });
        bewerk(groot.pixels, groot.pixels, a, p);
        await vexel.zetBeeld(foto.id, { breedte: groot.breedte, hoogte: groot.hoogte, pixels: groot.pixels });
        klaar++;
      }
      vexel.melding(fotos.length > 1 ? `${klaar} foto's bijgewerkt.` : 'Foto bijgewerkt.', 'ok');
      vexel.sluit();
    } catch (fout) {
      vexel.melding((klaar ? `${klaar} ${meervoud(klaar, 'foto', "foto's")} bijgewerkt, daarna ging het mis: ` : '') + fout.message, 'fout');
      for (const el of formulier.querySelectorAll('input, select, button')) el.disabled = false;
      toepassen.textContent = 'Toepassen';
      samen();
    }
  });

  samen();
  gewijzigd();
  if (doc.alleenLezen) toepassen.title = 'Dit document is alleen-lezen.';
  toepassen.focus();
}

vexel.opCommando('bijwerken', venster);
