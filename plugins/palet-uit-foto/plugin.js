// Palet uit foto: haalt de hoofdkleuren uit een foto en zet ze als kleurvlakjes naast de foto.
// Eigen werk van GuusLab, MIT-licentie.
'use strict';

// ---- algemene hulpjes -----------------------------------------------------

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
const getal = (n, cijfers = 1) => Number(n).toLocaleString('nl-NL', { maximumFractionDigits: cijfers });
const rond = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const rust = () => new Promise((klaar) => requestAnimationFrame(() => klaar()));

/** Een eigen randomgenerator met zaadje (mulberry32), zodat elke variant terug te halen is. */
function willekeur(zaad) {
  let a = (zaad >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nieuwZaadje = () => 1 + Math.floor(Math.random() * 999999);

// ---- kleur ----------------------------------------------------------------
// Een eigen inktmodel: vier drukinkten op wit papier, die elkaar vermenigvuldigen (in lineair
// licht), met een puntaangroei van 15 % in de middentonen. RGB → CMYK lost dat model op met een
// paar Newton-stappen; zwart wordt pas in de diepere tonen ingezet, neutraal grijs gaat alleen
// in zwart, en de totale inkt blijft onder 300 %. Geen kleurprofiel, maar dicht bij wat een
// gestreken drukproef laat zien, en de voorvertoning rekent met precies hetzelfde model terug.

const lineair = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gamma = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const INKT = [[0, 159, 227], [230, 0, 126], [255, 237, 0], [29, 29, 27]].map((k) => k.map((v) => 0.999 * (1 - lineair(v / 255))));
const AANGROEI = 0.15;
const effectief = (a) => a + AANGROEI * 4 * a * (1 - a);
const helling = (a) => 1 + AANGROEI * 4 * (1 - 2 * a);
const reflectie = (a, ch) => {
  let r = 1;
  for (let i = 0; i < 4; i++) r *= 1 - effectief(a[i]) * INKT[i][ch];
  return Math.max(1e-6, r);
};
const det3 = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
  + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
const cmykCache = new Map();

/** RGB (0–255) → CMYK in hele procenten, met het inktmodel hierboven. */
function rgbNaarCmyk(r, g, b) {
  r = begrens(Math.round(r), 0, 255);
  g = begrens(Math.round(g), 0, 255);
  b = begrens(Math.round(b), 0, 255);
  const sleutel = (r << 16) | (g << 8) | b;
  const bekend = cmykCache.get(sleutel);
  if (bekend) return bekend.slice();
  let uit;
  const L = [r, g, b].map((v) => Math.max(1e-5, lineair(v / 255)));
  if (Math.max(r, g, b) - Math.min(r, g, b) <= 3) {
    // Neutraal grijs: alleen zwart, opgelost met dezelfde aangroei.
    const doel = (L[0] + L[1] + L[2]) / 3;
    let k = 0.5;
    for (let i = 0; i < 20; i++) {
      const f = 1 - effectief(k) * INKT[3][1] - doel;
      k = begrens(k + f / (helling(k) * INKT[3][1]), 0, 1);
    }
    uit = [0, 0, 0, Math.round(k * 100)];
  } else {
    const donker = 1 - Math.max(r, g, b) / 255;
    const a = [0.3, 0.3, 0.3, begrens((donker - 0.4) / 0.55, 0, 1) ** 1.3];
    for (let stap = 0; stap < 12; stap++) {
      const f = [0, 1, 2].map((ch) => Math.log(reflectie(a, ch)) - Math.log(L[ch]));
      const J = [0, 1, 2].map((ch) => [0, 1, 2].map((i) => -(INKT[i][ch] * helling(a[i])) / (1 - effectief(a[i]) * INKT[i][ch]) - 1e-6));
      const D = det3(J);
      if (Math.abs(D) < 1e-12) break;
      for (let i = 0; i < 3; i++) {
        const Ji = J.map((rij, ch) => rij.map((v, j) => (j === i ? -f[ch] : v)));
        a[i] = begrens(a[i] + det3(Ji) / D, 0, 1);
      }
    }
    const som = a[0] + a[1] + a[2];
    if (som + a[3] > 3) for (let i = 0; i < 3; i++) a[i] *= (3 - a[3]) / som;
    uit = a.map((v) => begrens(Math.round(v * 100), 0, 100));
  }
  if (cmykCache.size > 200000) cmykCache.clear();
  cmykCache.set(sleutel, uit);
  return uit.slice();
}
/** CMYK (0–100) → RGB (0–255) met hetzelfde inktmodel, voor de voorvertoning en RGB-documenten. */
function cmykNaarRgb(cmyk) {
  const a = cmyk.map((v) => begrens(v, 0, 100) / 100);
  return [0, 1, 2].map((ch) => Math.round(255 * gamma(reflectie(a, ch))));
}
const hexVanRgb = (rgb) => '#' + rgb.map((n) => begrens(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
const rgbVanHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function kleurCss(kleur) {
  if (!kleur) return 'transparent';
  if (kleur.hex) return kleur.hex;
  if (kleur.cmyk) return hexVanRgb(cmykNaarRgb(kleur.cmyk));
  if (kleur.steunkleur) return hexVanRgb(cmykNaarRgb(kleur.steunkleur.cmyk || [0, 0, 0, 100]));
  return '#000000';
}
/** Een kleur uit RGB voor dit document: CMYK in een CMYK-document, anders hex. */
const kleurVoor = (rgb, cmyk) => (cmyk ? { cmyk: rgbNaarCmyk(rgb[0], rgb[1], rgb[2]) } : { hex: hexVanRgb(rgb) });

/** Vaste kleuren voor een keuzelijst, als CMYK; in een RGB-document worden ze hex. */
const DRUKKLEUREN = {
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100] },
  diepzwart: { naam: 'Diepzwart (40 30 30 100)', cmyk: [40, 30, 30, 100] },
  cyaan: { naam: 'Cyaan', cmyk: [100, 0, 0, 0] },
  magenta: { naam: 'Magenta', cmyk: [0, 100, 0, 0] },
  geel: { naam: 'Geel', cmyk: [0, 0, 100, 0] },
  rood: { naam: 'Rood', cmyk: [0, 90, 85, 0] },
  blauw: { naam: 'Donkerblauw', cmyk: [100, 80, 0, 30] },
  bruin: { naam: 'Sepia', cmyk: [20, 55, 80, 45] },
  wit: { naam: 'Wit', cmyk: [0, 0, 0, 0] },
};
const drukKleur = (sleutel, cmyk) => {
  const k = DRUKKLEUREN[sleutel] || DRUKKLEUREN.zwart;
  return cmyk ? { cmyk: k.cmyk.slice() } : { hex: hexVanRgb(cmykNaarRgb(k.cmyk)) };
};

// ---- de foto lezen ----------------------------------------------------------

/**
 * Leest een foto als bron om op te rekenen: RGB, dekking, helderheid (op wit gezet)
 * en een canvas om het origineel te tonen. Pixels gaan naar punten via het kader.
 */
async function laadFoto(foto, maxZijde) {
  const b = await vexel.beeld(foto.id, { maxZijde });
  const n = b.breedte * b.hoogte;
  const px = b.pixels;
  const lum = new Float32Array(n);
  const alfa = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = px[j + 3] / 255;
    const l = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) / 255;
    alfa[i] = a;
    lum[i] = 1 - a * (1 - l);
  }
  const doek = el('canvas');
  doek.width = b.breedte;
  doek.height = b.hoogte;
  doek.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), b.breedte, b.hoogte), 0, 0);
  const k = foto.kader;
  return {
    foto,
    kader: k,
    b: b.breedte,
    h: b.hoogte,
    origineel: b.origineel,
    px,
    lum,
    alfa,
    doek,
    /** pt → pixel */
    pxX: (x) => ((x - k.x) / k.b) * b.breedte,
    pxY: (y) => ((y - k.y) / k.h) * b.hoogte,
    /** pixels per pt */
    dichtheid: b.breedte / k.b,
  };
}

/** Een integraalbeeld van een kanaal, voor snelle gemiddelden over een rechthoek. */
function integraal(kanaal, b, h) {
  const I = new Float64Array((b + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rij = 0;
    for (let x = 0; x < b; x++) {
      rij += kanaal[y * b + x];
      I[(y + 1) * (b + 1) + x + 1] = I[y * (b + 1) + x + 1] + rij;
    }
  }
  return I;
}
/** Gemiddelde van een kanaal in het pixelvak [x0, x1) × [y0, y1), begrensd tot de foto. */
function gemiddelde(I, b, h, x0, y0, x1, y1) {
  let a = Math.floor(begrens(x0, 0, b - 1));
  let c = Math.floor(begrens(y0, 0, h - 1));
  let e = Math.ceil(begrens(x1, a + 1, b));
  let f = Math.ceil(begrens(y1, c + 1, h));
  const w = b + 1;
  return (I[f * w + e] - I[c * w + e] - I[f * w + a] + I[c * w + a]) / ((e - a) * (f - c));
}

/** Integraalbeelden van R, G, B (0–255, op wit gezet), helderheid en dekking; één keer per foto. */
function kanalen(bron) {
  if (bron.kanalen) return bron.kanalen;
  const n = bron.b * bron.h;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const bl = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = bron.alfa[i];
    r[i] = 255 - a * (255 - bron.px[j]);
    g[i] = 255 - a * (255 - bron.px[j + 1]);
    bl[i] = 255 - a * (255 - bron.px[j + 2]);
  }
  bron.kanalen = {
    r: integraal(r, bron.b, bron.h),
    g: integraal(g, bron.b, bron.h),
    bl: integraal(bl, bron.b, bron.h),
    lum: integraal(bron.lum, bron.b, bron.h),
    alfa: integraal(bron.alfa, bron.b, bron.h),
  };
  return bron.kanalen;
}
/** Gemiddelde kleur en helderheid in een vierkant van `zijde` pt rond (x, y) in pt. */
function monster(bron, x, y, zijde) {
  const K = kanalen(bron);
  const d = Math.max(1, (zijde * bron.dichtheid) / 2);
  const px = bron.pxX(x);
  const py = bron.pxY(y);
  const a = [px - d, py - d, px + d, py + d];
  const gem = (I) => gemiddelde(I, bron.b, bron.h, ...a);
  return { r: gem(K.r), g: gem(K.g), b: gem(K.bl), lum: gem(K.lum), alfa: gem(K.alfa) };
}

/** Toonbewerking: helderheid en contrast (−100 tot 100) op een helderheid van 0 tot 1. */
function toonCurve(helderheid, contrast) {
  const c = contrast >= 0 ? 1 + contrast / 40 : 1 + contrast / 100;
  const h = helderheid / 100;
  return (v) => begrens((v - 0.5) * c + 0.5 + h, 0, 1);
}

// ---- geometrie --------------------------------------------------------------

const KAPPA3 = (4 / 3) * Math.tan(Math.PI / 6);
/** Een cirkel als gesloten subpad met drie punten (afwijking ≈ 0,15 %, onzichtbaar), met de klok mee. */
function cirkelSubpad(cx, cy, r) {
  const punten = [];
  for (let i = 0; i < 3; i++) {
    const h = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    const x = cx + r * Math.cos(h);
    const y = cy + r * Math.sin(h);
    const tx = -Math.sin(h) * r * KAPPA3;
    const ty = Math.cos(h) * r * KAPPA3;
    punten.push({ x: rond(x, 3), y: rond(y, 3), in: { x: rond(x - tx, 3), y: rond(y - ty, 3) }, uit: { x: rond(x + tx, 3), y: rond(y + ty, 3) } });
  }
  return { gesloten: true, punten };
}
/** Een cirkel als veelhoek (met de klok mee), om te knippen. */
function cirkelVeelhoek(cx, cy, r, n = 24) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 2 * Math.PI) / n - Math.PI / 2;
    p.push({ x: cx + r * Math.cos(h), y: cy + r * Math.sin(h) });
  }
  return p;
}
const binnenKader = (k, x, y, marge = 0) => x >= k.x + marge && x <= k.x + k.b - marge && y >= k.y + marge && y <= k.y + k.h - marge;

/** Knipt een veelhoek af op een rechthoek (Sutherland–Hodgman). Lege lijst als er niets overblijft. */
function knipVeelhoek(punten, k) {
  const randen = [
    (p) => p.x >= k.x, (p) => p.x <= k.x + k.b, (p) => p.y >= k.y, (p) => p.y <= k.y + k.h,
  ];
  const snij = [
    (a, b) => ({ x: k.x, y: a.y + ((b.y - a.y) * (k.x - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: k.x + k.b, y: a.y + ((b.y - a.y) * (k.x + k.b - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (k.y - a.y)) / (b.y - a.y), y: k.y }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (k.y + k.h - a.y)) / (b.y - a.y), y: k.y + k.h }),
  ];
  let uit = punten;
  for (let r = 0; r < 4 && uit.length; r++) {
    const in_ = uit;
    uit = [];
    for (let i = 0; i < in_.length; i++) {
      const a = in_[(i + in_.length - 1) % in_.length];
      const b = in_[i];
      const ab = randen[r](a);
      const bb = randen[r](b);
      if (bb) {
        if (!ab) uit.push(snij[r](a, b));
        uit.push(b);
      } else if (ab) uit.push(snij[r](a, b));
    }
  }
  return uit.length >= 3 ? uit : [];
}
const veelhoekSubpad = (p) => ({ gesloten: true, punten: p.map((q) => ({ x: rond(q.x, 3), y: rond(q.y, 3) })) });
/** Een veelhoek als subpad, afgeknipt op het kader (of null als er niets overblijft). */
function geknipt(punten, k) {
  const alles = punten.every((p) => binnenKader(k, p.x, p.y));
  if (alles) return veelhoekSubpad(punten);
  const g = knipVeelhoek(punten, k);
  return g.length ? veelhoekSubpad(g) : null;
}
/** Een stip als subpad: een echte cirkel als hij binnen het kader valt, anders een afgeknipte veelhoek. */
function stipSubpad(cx, cy, r, k) {
  if (binnenKader(k, cx, cy, r)) return cirkelSubpad(cx, cy, r);
  if (cx + r < k.x || cx - r > k.x + k.b || cy + r < k.y || cy - r > k.y + k.h) return null;
  return geknipt(cirkelVeelhoek(cx, cy, r, 20), k);
}

/** Vereenvoudigt een open lijn van punten (Ramer–Douglas–Peucker) met tolerantie in pt. */
function vereenvoudig(punten, tol) {
  if (punten.length < 3) return punten.slice();
  const houd = new Uint8Array(punten.length);
  houd[0] = 1;
  houd[punten.length - 1] = 1;
  const stapel = [[0, punten.length - 1]];
  const t2 = tol * tol;
  while (stapel.length) {
    const [a, b] = stapel.pop();
    const A = punten[a];
    const B = punten[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const l2 = dx * dx + dy * dy || 1e-12;
    let max = -1;
    let waar = -1;
    for (let i = a + 1; i < b; i++) {
      const P = punten[i];
      let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / l2;
      t = begrens(t, 0, 1);
      const ex = A.x + t * dx - P.x;
      const ey = A.y + t * dy - P.y;
      const d = ex * ex + ey * ey;
      if (d > max) {
        max = d;
        waar = i;
      }
    }
    if (max > t2) {
      houd[waar] = 1;
      stapel.push([a, waar], [waar, b]);
    }
  }
  return punten.filter((_, i) => houd[i]);
}

/**
 * Een lint om een middenlijn: `stuk` is een lijst { x, y, nx, ny, d } (normaal en halve dikte).
 * Geeft een gesloten veelhoek met spitse uiteinden, vereenvoudigd met `tol`.
 */
function lintVeelhoek(stuk, tol, spits) {
  const links = stuk.map((p) => ({ x: p.x + p.nx * p.d, y: p.y + p.ny * p.d }));
  const rechts = stuk.map((p) => ({ x: p.x - p.nx * p.d, y: p.y - p.ny * p.d }));
  const a = stuk[0];
  const z = stuk[stuk.length - 1];
  const voor = spits ? [{ x: a.x - a.ny * spits, y: a.y + a.nx * spits }] : [];
  const na = spits ? [{ x: z.x + z.ny * spits, y: z.y - z.nx * spits }] : [];
  return [...voor, ...vereenvoudig(links, tol), ...na, ...vereenvoudig(rechts, tol).reverse()];
}

// ---- tellen en verdelen over maak-aanroepen -----------------------------------

const GRENS = { vormen: 5000, punten: 50000, subpaden: 1000 };
const DEEL = { vormen: 4900, punten: 49000 };

function tel(vormen) {
  let aantal = 0;
  let punten = 0;
  const loop = (v) => {
    aantal++;
    if (v.kinderen) v.kinderen.forEach(loop);
    if (v.subpaden) for (const s of v.subpaden) punten += s.punten.length;
  };
  vormen.forEach(loop);
  return { vormen: aantal, punten };
}

/** Splitst een pad met te veel subpaden in paden van hooguit 1000 subpaden. */
function splitsSubpaden(pad, max = GRENS.subpaden) {
  if (pad.subpaden.length <= max) return [pad];
  const uit = [];
  for (let i = 0; i < pad.subpaden.length; i += max) uit.push({ ...pad, subpaden: pad.subpaden.slice(i, i + max) });
  return uit;
}

/**
 * Verdeelt een lijst vormen over zo weinig mogelijk maak-aanroepen (elk binnen de grenzen),
 * in dezelfde volgorde, zodat de stapeling klopt. Een te grote groep wordt in delen geknipt
 * die dezelfde naam houden met "(deel i)". Geeft een lijst aanroepen (elk een lijst vormen).
 */
function verdeel(vormen) {
  const past = (t) => t.vormen <= DEEL.vormen && t.punten <= DEEL.punten;
  const knip = (v) => {
    const t = tel([v]);
    if (past(t)) return [v];
    if (v.soort === 'pad') {
      const delen = [];
      let huidig = [];
      let p = 0;
      for (const s of v.subpaden) {
        if (huidig.length && p + s.punten.length > DEEL.punten - 10) {
          delen.push({ ...v, subpaden: huidig });
          huidig = [];
          p = 0;
        }
        huidig.push(s);
        p += s.punten.length;
      }
      if (huidig.length) delen.push({ ...v, subpaden: huidig });
      return delen;
    }
    if (v.soort !== 'groep') return [v];
    const stukken = v.kinderen.flatMap(knip);
    const delen = [];
    let huidig = [];
    let tt = { vormen: 1, punten: 0 };
    for (const s of stukken) {
      const ts = tel([s]);
      if (huidig.length && !past({ vormen: tt.vormen + ts.vormen, punten: tt.punten + ts.punten })) {
        delen.push(huidig);
        huidig = [];
        tt = { vormen: 1, punten: 0 };
      }
      huidig.push(s);
      tt = { vormen: tt.vormen + ts.vormen, punten: tt.punten + ts.punten };
    }
    if (huidig.length) delen.push(huidig);
    return delen.map((k, i) => ({ ...v, naam: delen.length > 1 ? `${v.naam} (deel ${i + 1})` : v.naam, kinderen: k }));
  };
  const stukken = vormen.flatMap(knip);
  const aanroepen = [];
  let huidig = [];
  let tt = { vormen: 0, punten: 0 };
  for (const s of stukken) {
    const ts = tel([s]);
    if (huidig.length && !past({ vormen: tt.vormen + ts.vormen, punten: tt.punten + ts.punten })) {
      aanroepen.push(huidig);
      huidig = [];
      tt = { vormen: 0, punten: 0 };
    }
    huidig.push(s);
    tt = { vormen: tt.vormen + ts.vormen, punten: tt.punten + ts.punten };
  }
  if (huidig.length) aanroepen.push(huidig);
  return aanroepen;
}
const MAX_AANROEPEN = 4;

// ---- voorvertoning op een canvas ----------------------------------------------

const padCache = new WeakMap();
function path2d(v) {
  let p = padCache.get(v);
  if (p) return p;
  p = new Path2D();
  if (v.soort === 'pad') {
    for (const s of v.subpaden) {
      const n = s.punten.length;
      if (!n) continue;
      p.moveTo(s.punten[0].x, s.punten[0].y);
      const eind = s.gesloten ? n : n - 1;
      for (let i = 1; i <= eind; i++) {
        const a = s.punten[i - 1];
        const b = s.punten[i % n];
        if (a.uit || b.in) {
          const c1 = a.uit || a;
          const c2 = b.in || b;
          p.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
        } else p.lineTo(b.x, b.y);
      }
      if (s.gesloten) p.closePath();
    }
  } else if (v.soort === 'rechthoek') p.rect(v.x, v.y, v.b, v.h);
  else if (v.soort === 'ellips') p.ellipse(v.cx, v.cy, v.rx, v.ry, 0, 0, Math.PI * 2);
  padCache.set(v, p);
  return p;
}

/** Tekent vexel-vormen (in pt) met transformatie `m` = { s, ox, oy } op context g. */
function tekenVormen(g, vormen, m) {
  g.save();
  g.setTransform(m.s * m.dpr, 0, 0, m.s * m.dpr, m.ox * m.dpr, m.oy * m.dpr);
  const loop = (v) => {
    if (v.zichtbaar === false) return;
    if (v.soort === 'groep') return v.kinderen.forEach(loop);
    g.globalAlpha = v.dekking === undefined ? 1 : v.dekking;
    g.globalCompositeOperation = v.overdrukVulling ? 'multiply' : 'source-over';
    if (v.soort === 'tekst') {
      g.fillStyle = kleurCss(v.vulling || { cmyk: [0, 0, 0, 100] });
      g.font = `${v.gewicht || 400} ${v.grootte || 12}px Inter, system-ui, sans-serif`;
      g.textAlign = { midden: 'center', rechts: 'right' }[v.uitlijning] || 'left';
      g.textBaseline = 'alphabetic';
      const regels = v.inhoud.split('\n');
      regels.forEach((r, i) => g.fillText(r, v.x, v.y + i * (v.regelafstand || (v.grootte || 12) * 1.2)));
      return;
    }
    const p = path2d(v);
    if (v.vulling) {
      g.fillStyle = kleurCss(v.vulling);
      g.fill(p, v.vulregel === 'evenodd' ? 'evenodd' : 'nonzero');
    }
    if (v.lijn && v.lijndikte > 0) {
      g.strokeStyle = kleurCss(v.lijn);
      g.lineWidth = Math.max(v.lijndikte, 0.6 / m.s);
      g.lineJoin = v.lijnhoek === 'round' ? 'round' : 'miter';
      g.stroke(p);
    }
  };
  vormen.forEach(loop);
  g.restore();
}

// ---- het fotovenster ----------------------------------------------------------

const VENSTER_CSS = `
body{padding:0;height:100vh;overflow:hidden}
.fv{display:grid;grid-template-columns:minmax(0,1fr) 272px;height:100vh}
.fv-beeld{position:relative;min-width:0;background:var(--bg-2);border-right:1px solid var(--lijn)}
.fv-beeld canvas{position:absolute;inset:0;width:100%;height:100%;border-radius:0;background:transparent}
.fv-balk{position:absolute;left:10px;bottom:10px;display:flex;gap:6px;align-items:center}
.fv-balk .knop{height:26px;padding:0 10px;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(4px)}
.fv-balk .knop[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}
.fv-zoom{position:absolute;right:10px;bottom:10px;font-size:11px;color:var(--tekst-zacht);
  background:color-mix(in srgb,var(--bg) 82%,transparent);padding:3px 8px;border-radius:5px}
.fv-bezig{position:absolute;left:50%;top:14px;transform:translateX(-50%);font-size:11px;padding:4px 10px;border-radius:12px;
  background:color-mix(in srgb,var(--bg) 85%,transparent);color:var(--tekst-zacht);display:none}
.fv-paneel{display:flex;flex-direction:column;min-height:0}
.fv-instellingen{flex:1;overflow:auto;padding:12px 14px 6px}
.fv-voet{padding:10px 14px 12px;border-top:1px solid var(--lijn)}
.fv-voet .knoppen{margin-top:8px}
.fv-voet .knop{white-space:nowrap}
.fv-kop{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--tekst-zwak,#7f838f);margin:12px 0 6px}
.fv-kop:first-child{margin-top:0}
.fv-rij{display:grid;grid-template-columns:84px minmax(0,1fr) 44px;align-items:center;gap:8px;margin:0 0 7px}
.fv-rij.breed{grid-template-columns:84px minmax(0,1fr)}
.fv-rij .label{min-width:0}
.fv-rij input[type=range]{width:100%;margin:0}
.fv-waarde{font-variant-numeric:tabular-nums;text-align:right;color:var(--tekst-zacht);font-size:11px;white-space:nowrap}
.fv-vink{display:flex;gap:8px;align-items:center;margin:0 0 7px;color:var(--tekst-zacht)}
.fv-vink input{margin:0}
.fv-samen{margin:0;min-height:30px}
.fv-leeg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px;color:var(--tekst-zacht)}
.fv-staal{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--lijn);vertical-align:-3px}
`;

/** Een schuifje met label en waarde: { rij, lees(), zet(v) }. */
function schuif(label, min, max, stap, opmaak) {
  const invoer = el('input', { type: 'range', min, max, step: stap, 'aria-label': label });
  const waarde = el('span', { klasse: 'fv-waarde' });
  const bij = () => { waarde.textContent = opmaak ? opmaak(Number(invoer.value)) : invoer.value; };
  invoer.addEventListener('input', bij);
  const rij = el('label', { klasse: 'fv-rij' }, el('span', { klasse: 'label', tekst: label }), invoer, waarde);
  return { rij, invoer, lees: () => Number(invoer.value), zet: (v) => { invoer.value = String(v); bij(); } };
}
/** Een keuzelijst: { rij, lees(), zet(v) }. */
function keuze(label, opties) {
  const veld = el('select', { klasse: 'veld', 'aria-label': label },
    ...Object.entries(opties).map(([k, t]) => el('option', { value: k, tekst: t })));
  const rij = el('label', { klasse: 'fv-rij breed' }, el('span', { klasse: 'label', tekst: label }), veld);
  return {
    rij, veld, lees: () => veld.value,
    zet: (v) => { veld.value = Object.prototype.hasOwnProperty.call(opties, v) ? v : Object.keys(opties)[0]; },
  };
}
/** Een vinkje: { rij, lees(), zet(v) }. */
function vinkje(tekst) {
  const veld = el('input', { type: 'checkbox' });
  const rij = el('label', { klasse: 'fv-vink' }, veld, el('span', { tekst }));
  return { rij, veld, lees: () => veld.checked, zet: (v) => { veld.checked = Boolean(v); } };
}
/** Een tekstveld: { rij, lees(), zet(v) }. */
function tekstVeld(label, plaats) {
  const veld = el('input', { klasse: 'veld', type: 'text', placeholder: plaats || '', 'aria-label': label, maxlength: 400 });
  const rij = el('label', { klasse: 'fv-rij breed' }, el('span', { klasse: 'label', tekst: label }), veld);
  return { rij, veld, lees: () => veld.value, zet: (v) => { veld.value = v == null ? '' : String(v); } };
}
const kop = (tekst) => el('div', { klasse: 'fv-kop', tekst });

/**
 * Het venster voor een foto-naar-vector-plugin. `cfg`:
 *   naam, knop, standaard, maxZijde,
 *   velden(ctx) → { elementen: [...], lees() → w, zet(w), bij?(w) }
 *   bereken(bron, w, ctx) → { vormen, aantal } of { fout }   (mag async; ctx.verlopen() en ctx.tussen(r))
 *   samenvatting(r, w, ctx) → tekst
 *   melding(r, w, aantalFotos) → tekst na het maken
 *   tekenExtra?(g, m, r)  (bijv. een rand of legenda)
 *   zicht?(r, bron, ctx) → { x, y, b, h } in pt: wat de voorvertoning laat zien (standaard het fotokader)
 *   knip: false → de voorvertoning knipt het resultaat niet af op het fotokader
 *   papier?(w, ctx) → css-kleur van het vlak onder het resultaat; beginWaarden?(bron, ctx); teFijn?(r, w, ctx)
 */
async function fotoVenster(cfg) {
  document.head.append(el('style', { tekst: VENSTER_CSS }));
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  let selectie = [];
  try {
    selectie = await vexel.selectie();
  } catch (fout) {
    selectie = [];
  }
  const fotos = selectie.filter((o) => o.soort === 'beeld');
  const bewaard = await vexel.haal('instellingen');

  const doek = el('canvas', { 'aria-label': 'Voorvertoning' });
  const bezig = el('div', { klasse: 'fv-bezig', 'aria-live': 'polite' });
  const zoomTekst = el('div', { klasse: 'fv-zoom' });
  const voorNa = el('button', { klasse: 'knop', type: 'button', title: 'Ingedrukt houden (of de toets O) om de foto te zien', tekst: 'Voor/na' });
  const loepKnop = el('button', { klasse: 'knop', type: 'button', 'aria-pressed': 'false', title: 'Vergroot het stuk onder de muis (toets L)', tekst: 'Loep' });
  const balk = el('div', { klasse: 'fv-balk' }, voorNa, loepKnop);
  const beeldVak = el('div', { klasse: 'fv-beeld' }, doek, bezig, balk, zoomTekst);

  const samen = el('p', { klasse: 'uitleg fv-samen', 'aria-live': 'polite' });
  const maakKnop = el('button', { klasse: 'knop primair', type: 'submit', tekst: cfg.knop });
  const standaardKnop = el('button', { klasse: 'knop', type: 'button', tekst: 'Standaard', title: 'Alle instellingen terugzetten' });
  const annuleer = el('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const instellingen = el('div', { klasse: 'fv-instellingen' });
  const formulier = el('form', { klasse: 'fv-paneel' }, instellingen,
    el('div', { klasse: 'fv-voet' }, samen, el('div', { klasse: 'knoppen' }, annuleer, maakKnop)));
  document.body.append(el('div', { klasse: 'fv' }, beeldVak, formulier));

  const ctx = { doc, cmyk, fotos, aantalFotos: fotos.length };
  const ui = cfg.velden(ctx);
  ui.elementen.forEach((e) => instellingen.append(e));
  instellingen.append(el('div', { stijl: { display: 'flex', justifyContent: 'flex-end', margin: '10px 0 4px' } }, standaardKnop));
  const w0 = { ...cfg.standaard, ...(bewaard || {}) };
  ui.zet(w0);

  if (!fotos.length) {
    const wat = selectie.length ? 'Dit is geen foto. ' : '';
    beeldVak.append(el('div', { klasse: 'fv-leeg' }, el('div', {},
      el('p', { tekst: wat + 'Selecteer eerst een foto (Bestand › Plaatsen).', stijl: { color: 'var(--tekst)', fontWeight: '600' } }),
      el('p', { klasse: 'uitleg', tekst: 'Sluit dit venster, klik de foto aan en kies de plugin opnieuw.' }))));
    balk.style.display = 'none';
    maakKnop.disabled = true;
    samen.textContent = 'Geen foto geselecteerd.';
    return;
  }

  bezig.textContent = 'Foto lezen…';
  bezig.style.display = 'block';
  let bron;
  try {
    bron = await laadFoto(fotos[0], cfg.maxZijde || 1200);
  } catch (fout) {
    samen.textContent = 'De foto kon niet worden gelezen: ' + ((fout && fout.message) || fout);
    samen.classList.add('fout');
    maakKnop.disabled = true;
    bezig.style.display = 'none';
    return;
  }
  ctx.bron = bron;
  if (!bewaard && cfg.beginWaarden) ui.zet({ ...w0, ...cfg.beginWaarden(bron, ctx) });

  let resultaat = null;
  let toonFoto = false;
  let loep = null;
  let loepAan = false;
  let ronde = 0;

  function maatregel() {
    const kader = doek.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    // Het stuk dat in beeld moet: het kader van de foto, of wat de plugin vraagt (bijv. met een palet ernaast).
    const k = (cfg.zicht && cfg.zicht(resultaat, bron, ctx)) || bron.kader;
    const marge = 18;
    const s = Math.min((kader.width - 2 * marge) / k.b, (kader.height - 2 * marge - 30) / k.h);
    return { s, dpr, ox: (kader.width - k.b * s) / 2 - k.x * s, oy: (kader.height - 30 - k.h * s) / 2 - k.y * s + 4, b: kader.width, h: kader.height };
  }

  function tekenScene(g, m) {
    const k = bron.kader;
    g.save();
    g.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    const x = m.ox + k.x * m.s;
    const y = m.oy + k.y * m.s;
    g.fillStyle = cfg.papier ? cfg.papier(ui.lees(), ctx) : '#ffffff';
    g.fillRect(x, y, k.b * m.s, k.h * m.s);
    if (toonFoto) {
      g.imageSmoothingQuality = 'high';
      g.drawImage(bron.doek, x, y, k.b * m.s, k.h * m.s);
    }
    g.restore();
    if (!toonFoto && resultaat && resultaat.vormen) {
      g.save();
      if (cfg.knip !== false) {
        g.beginPath();
        g.rect(x * m.dpr - 1, y * m.dpr - 1, k.b * m.s * m.dpr + 2, k.h * m.s * m.dpr + 2);
        g.clip();
      }
      tekenVormen(g, resultaat.vormen, m);
      g.restore();
    }
    if (!toonFoto && cfg.tekenExtra && resultaat) cfg.tekenExtra(g, m, resultaat, ctx);
  }

  function teken() {
    const m = maatregel();
    doek.width = Math.max(1, Math.round(m.b * m.dpr));
    doek.height = Math.max(1, Math.round(m.h * m.dpr));
    const g = doek.getContext('2d');
    g.fillStyle = vexel.thema.bg2;
    g.fillRect(0, 0, doek.width, doek.height);
    tekenScene(g, m);
    const k = bron.kader;
    g.save();
    g.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    g.strokeStyle = vexel.thema.lijn;
    g.lineWidth = 1;
    g.strokeRect(m.ox + k.x * m.s - 0.5, m.oy + k.y * m.s - 0.5, k.b * m.s + 1, k.h * m.s + 1);
    g.restore();
    if (loep && loepAan) {
      const r = 78;
      const f = 4;
      const lm = { ...m, s: m.s * f, ox: loep.x - (loep.x - m.ox) * f, oy: loep.y - (loep.y - m.oy) * f };
      g.save();
      g.beginPath();
      g.arc(loep.x * m.dpr, loep.y * m.dpr, r * m.dpr, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = vexel.thema.bg2;
      g.fillRect(0, 0, doek.width, doek.height);
      tekenScene(g, lm);
      g.restore();
      g.save();
      g.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
      g.strokeStyle = vexel.thema.accent;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(loep.x, loep.y, r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    zoomTekst.textContent = toonFoto ? 'Origineel' : `${getal(bron.kader.b / (72 / 25.4), 0)} × ${getal(bron.kader.h / (72 / 25.4), 0)} mm`;
  }
  let tekenGepland = false;
  const planTeken = () => {
    if (tekenGepland) return;
    tekenGepland = true;
    requestAnimationFrame(() => { tekenGepland = false; teken(); });
  };

  function toonSamenvatting(w) {
    const r = resultaat;
    samen.classList.toggle('fout', Boolean(r && r.fout));
    if (doc.alleenLezen) {
      samen.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
      maakKnop.disabled = true;
      return;
    }
    if (!r) return;
    if (r.fout) {
      samen.textContent = r.fout;
      maakKnop.disabled = true;
      return;
    }
    const aanroepen = verdeel(r.vormen);
    r.aanroepen = aanroepen.length;
    const t = tel(r.vormen);
    let tekst = cfg.samenvatting(r, w, ctx) + ` · ${getal(t.vormen, 0)} vormen` + (t.punten ? `, ${getal(t.punten, 0)} ankerpunten` : '');
    if (aanroepen.length > MAX_AANROEPEN) {
      samen.classList.add('fout');
      samen.textContent = `Te fijn: ${getal(t.punten, 0)} ankerpunten in ${getal(t.vormen, 0)} vormen. ` + (cfg.teFijn ? cfg.teFijn(r, w, ctx) : 'Kies een grovere instelling.');
      maakKnop.disabled = true;
      return;
    }
    if (aanroepen.length > 1) {
      tekst += `. Te groot voor één keer: komt in ${aanroepen.length} groepen (${aanroepen.length}× ongedaan maken).`;
      if (cfg.teFijn && fotos.length === 1) tekst += ' ' + cfg.teFijn(r, w, ctx);
    }
    else tekst += '.';
    if (fotos.length > 1) tekst += ` Voorvertoning van de eerste van ${fotos.length} foto's; Maken doet ze allemaal.`;
    samen.textContent = tekst;
    maakKnop.disabled = false;
  }

  async function reken() {
    const mijn = ++ronde;
    const w = ui.lees();
    if (ui.bij) ui.bij(w);
    bezig.textContent = 'Rekenen…';
    const timer = setTimeout(() => { if (mijn === ronde) bezig.style.display = 'block'; }, 120);
    const rctx = {
      ...ctx,
      verlopen: () => mijn !== ronde,
      tussen: (r, tekst) => {
        if (mijn !== ronde) return;
        resultaat = r;
        if (tekst) {
          bezig.textContent = tekst;
          bezig.style.display = 'block';
        }
        planTeken();
      },
    };
    let r;
    try {
      r = await cfg.bereken(bron, w, rctx);
    } catch (fout) {
      r = { fout: 'Dat lukte niet: ' + ((fout && fout.message) || fout) };
    }
    clearTimeout(timer);
    if (mijn !== ronde || !r) return;
    document.body.dataset.rekent = '0';
    bezig.style.display = 'none';
    resultaat = r;
    toonSamenvatting(w);
    planTeken();
  }
  let rekenGepland = false;
  const planReken = () => {
    document.body.dataset.rekent = '1';
    if (rekenGepland) return;
    rekenGepland = true;
    requestAnimationFrame(() => { rekenGepland = false; reken(); });
  };

  formulier.addEventListener('input', planReken);
  formulier.addEventListener('change', planReken);
  standaardKnop.addEventListener('click', () => {
    ui.zet({ ...cfg.standaard, ...(cfg.beginWaarden ? cfg.beginWaarden(bron, ctx) : {}) });
    planReken();
  });
  const zetFoto = (aan) => { if (toonFoto !== aan) { toonFoto = aan; voorNa.setAttribute('aria-pressed', String(aan)); planTeken(); } };
  voorNa.addEventListener('pointerdown', (e) => { e.preventDefault(); zetFoto(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((s) => voorNa.addEventListener(s, () => zetFoto(false)));
  voorNa.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); zetFoto(true); } });
  voorNa.addEventListener('keyup', () => zetFoto(false));
  const zetLoep = (aan) => { loepAan = aan; loepKnop.setAttribute('aria-pressed', String(aan)); planTeken(); };
  loepKnop.addEventListener('click', () => zetLoep(!loepAan));
  document.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.key === 'o' || e.key === 'O') zetFoto(true);
    if (e.key === 'l' || e.key === 'L') zetLoep(!loepAan);
  });
  document.addEventListener('keyup', (e) => { if (e.key === 'o' || e.key === 'O') zetFoto(false); });
  doek.addEventListener('pointermove', (e) => {
    const k = doek.getBoundingClientRect();
    loep = { x: e.clientX - k.left, y: e.clientY - k.top };
    if (loepAan) planTeken();
  });
  doek.addEventListener('pointerleave', () => { loep = null; if (loepAan) planTeken(); });
  new ResizeObserver(planTeken).observe(beeldVak);

  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (maakKnop.disabled) return;
    const w = ui.lees();
    maakKnop.disabled = true;
    const knopTekst = maakKnop.textContent;
    maakKnop.textContent = 'Bezig…';
    ronde++;
    try {
      // Wacht tot de voorvertoning klaar is, en reken de andere foto's op dezelfde manier uit.
      const rctx = { ...ctx, verlopen: () => false, tussen: () => {}, definitief: true };
      const lijst = [];
      for (let i = 0; i < fotos.length; i++) {
        bezig.textContent = fotos.length > 1 ? `Foto ${i + 1} van ${fotos.length}…` : 'Maken…';
        bezig.style.display = 'block';
        await rust();
        const b = i === 0 ? bron : await laadFoto(fotos[i], cfg.maxZijde || 1200);
        const r = await cfg.bereken(b, w, rctx);
        if (r.fout) throw new Error(r.fout);
        lijst.push(r);
      }
      const vormen = lijst.flatMap((r) => r.vormen);
      const aanroepen = verdeel(vormen);
      if (aanroepen.length > MAX_AANROEPEN) throw new Error('Dat zijn te veel vormen in één keer. Kies een grovere instelling.');
      for (const a of aanroepen) await vexel.maak(a);
      await vexel.bewaar('instellingen', w);
      vexel.melding(cfg.melding(lijst[0], w, fotos.length) + (aanroepen.length > 1 ? ` (${aanroepen.length} groepen)` : ''), 'ok');
      vexel.sluit();
    } catch (fout) {
      bezig.style.display = 'none';
      maakKnop.textContent = knopTekst;
      maakKnop.disabled = false;
      vexel.melding((fout && fout.message) || 'Dat lukte niet.', 'fout');
    }
  });

  bezig.style.display = 'none';
  teken();
  await reken();
}

/** Een groep precies over het kader van de foto, met een onzichtbaar kader-vlak als eerste kind
 *  (zo staat de groep op de millimeter over de foto, ook als de rand leeg is). */
function fotoGroep(naam, bron, kinderen, achtergrond) {
  const k = bron.kader;
  const vlak = achtergrond
    ? { soort: 'rechthoek', naam: 'Achtergrond', x: k.x, y: k.y, b: k.b, h: k.h, vulling: achtergrond, lijn: null }
    : { soort: 'rechthoek', naam: 'Kader', x: k.x, y: k.y, b: k.b, h: k.h, vulling: null, lijn: null };
  return { soort: 'groep', naam, kinderen: [vlak, ...kinderen] };
}

// ---- Palet uit foto -----------------------------------------------------------

const STANDAARD = {
  aantal: 6, methode: 'kmeans', sorteer: 'aandeel', waarden: 'auto', plaats: 'auto', stalen: false, zaad: 7,
};
const SORTEER = { aandeel: 'Meest voorkomend eerst', helderheid: 'Van licht naar donker', tint: 'Op tint (kleurenwiel)' };

// ---- kleurruimte: sRGB → Lab (D65) --------------------------------------------

function labVan(r, g, b) {
  const R = lineair(r / 255);
  const G = lineair(g / 255);
  const B = lineair(b / 255);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** Tint (0–360) zoals op een kleurenwiel: rood 0, geel 60, groen 120, blauw 240. */
function tintVan([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Een Nederlandse naam uit tint, licht en verzadiging, zoals "Diepblauw" of "Zandgeel". */
function kleurNaam(rgb) {
  const [L, a, b] = labVan(...rgb);
  const chroma = Math.hypot(a, b);
  if (chroma < 8) {
    if (L > 93) return 'Wit';
    if (L > 72) return 'Lichtgrijs';
    if (L > 42) return 'Grijs';
    if (L > 16) return 'Donkergrijs';
    return 'Zwart';
  }
  const h = tintVan(rgb);
  let basis;
  if (h < 12 || h >= 345) basis = 'rood';
  else if (h < 40) basis = 'oranje';
  else if (h < 68) basis = 'geel';
  else if (h < 90) basis = 'limoen';
  else if (h < 160) basis = 'groen';
  else if (h < 195) basis = 'turkoois';
  else if (h < 250) basis = 'blauw';
  else if (h < 290) basis = 'paars';
  else basis = 'magenta';
  if ((basis === 'oranje' || basis === 'rood') && chroma < 20) basis = L > 70 ? 'zand' : 'grijsbruin';
  else if (basis === 'oranje' && L < 52) basis = 'bruin';
  else if (basis === 'oranje' && L > 70 && chroma < 40) basis = 'zand';
  else if (basis === 'geel' && L < 62) basis = 'oker';
  else if (basis === 'geel' && L > 80 && chroma < 45) basis = 'zandgeel';
  else if (basis === 'limoen' && L < 60) basis = 'olijf';
  else if ((basis === 'rood' || basis === 'magenta') && L > 72) basis = 'roze';
  else if (basis === 'rood' && L < 45 && chroma < 45) basis = 'roodbruin';
  let voor = '';
  if (chroma < 20 && !['bruin', 'grijsbruin', 'zand', 'zandgeel', 'oker', 'olijf', 'roodbruin'].includes(basis)) voor = 'grijs';
  else if (L > 80 && !['zand', 'zandgeel', 'roze'].includes(basis)) voor = 'licht';
  else if (L < 28) voor = chroma > 30 ? 'diep' : 'donker';
  else if (L < 45) voor = 'donker';
  const naam = voor + basis;
  return naam.charAt(0).toUpperCase() + naam.slice(1);
}

// ---- kleuren zoeken --------------------------------------------------------------

/** Een steekproef van niet-doorzichtige pixels: [{ rgb, lab }]. */
function steekproef(bron, zaad, max = 14000) {
  const rnd = willekeur(zaad * 7919 + 13);
  const n = bron.b * bron.h;
  const stap = Math.max(1, n / max);
  const uit = [];
  for (let f = rnd() * stap; f < n; f += stap) {
    const i = Math.min(n - 1, Math.floor(f + (rnd() - 0.5) * stap * 0.9));
    const j = Math.max(0, i) * 4;
    if (bron.px[j + 3] < 200) continue; // doorzichtig of half: telt niet mee
    const rgb = [bron.px[j], bron.px[j + 1], bron.px[j + 2]];
    uit.push({ rgb, lab: labVan(...rgb) });
  }
  return uit;
}
const afstand2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

/** k-means in Lab, met een k-means++-start uit het zaadje. */
function kMeans(punten, k, zaad) {
  const rnd = willekeur(zaad);
  const centra = [punten[Math.floor(rnd() * punten.length)].lab.slice()];
  const d = new Float64Array(punten.length).fill(Infinity);
  while (centra.length < k) {
    const c = centra[centra.length - 1];
    let som = 0;
    for (let i = 0; i < punten.length; i++) {
      d[i] = Math.min(d[i], afstand2(punten[i].lab, c));
      som += d[i];
    }
    if (!som) break;
    let doel = rnd() * som;
    let i = 0;
    for (; i < punten.length - 1; i++) {
      doel -= d[i];
      if (doel <= 0) break;
    }
    centra.push(punten[i].lab.slice());
  }
  const toewijzing = new Int32Array(punten.length);
  for (let ronde = 0; ronde < 24; ronde++) {
    let veranderd = 0;
    for (let i = 0; i < punten.length; i++) {
      let beste = 0;
      let bd = Infinity;
      for (let c = 0; c < centra.length; c++) {
        const a = afstand2(punten[i].lab, centra[c]);
        if (a < bd) {
          bd = a;
          beste = c;
        }
      }
      if (toewijzing[i] !== beste || ronde === 0) veranderd++;
      toewijzing[i] = beste;
    }
    const som = centra.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < punten.length; i++) {
      const s = som[toewijzing[i]];
      const l = punten[i].lab;
      s[0] += l[0];
      s[1] += l[1];
      s[2] += l[2];
      s[3]++;
    }
    som.forEach((s, c) => { if (s[3]) centra[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
    if (!veranderd) break;
  }
  let fout = 0;
  for (let i = 0; i < punten.length; i++) fout += afstand2(punten[i].lab, centra[toewijzing[i]]);
  return { kleuren: groepeer(punten, toewijzing, centra.length), fout };
}

/** Vier starts uit hetzelfde zaadje; de beste (kleinste spreiding binnen de groepen) wint. */
function besteKMeans(punten, k, zaad) {
  let beste = null;
  for (let poging = 0; poging < 4; poging++) {
    const r = kMeans(punten, k, zaad * 31 + poging);
    if (!beste || r.fout < beste.fout) beste = r;
  }
  return beste.kleuren;
}

/** Mediaan-snede in RGB: steeds het vak met de grootste spreiding doormidden. */
function mediaanSnede(punten, k) {
  let vakken = [punten.slice()];
  while (vakken.length < k) {
    let beste = -1;
    let bereik = 0;
    let as = 0;
    vakken.forEach((v, i) => {
      if (v.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const p of v) {
          lo = Math.min(lo, p.rgb[c]);
          hi = Math.max(hi, p.rgb[c]);
        }
        // Grote vakken eerst: spreiding gewogen met de wortel van het aantal.
        const r = (hi - lo) * Math.sqrt(v.length);
        if (r > bereik) {
          bereik = r;
          beste = i;
          as = c;
        }
      }
    });
    if (beste < 0) break;
    const v = vakken[beste].sort((p, q) => p.rgb[as] - q.rgb[as]);
    const helft = v.length >> 1;
    vakken.splice(beste, 1, v.slice(0, helft), v.slice(helft));
  }
  // Elk punt naar het dichtstbijzijnde vakmidden (in Lab), zodat het aandeel echt iets zegt:
  // de snede zelf verdeelt de punten in gelijke stukken.
  const midden = vakken.map((v) => {
    const s = [0, 0, 0];
    v.forEach((p) => { s[0] += p.lab[0]; s[1] += p.lab[1]; s[2] += p.lab[2]; });
    return s.map((x) => x / v.length);
  });
  const toewijzing = new Int32Array(punten.length);
  punten.forEach((p, i) => {
    let bd = Infinity;
    midden.forEach((c, j) => { const a = afstand2(p.lab, c); if (a < bd) { bd = a; toewijzing[i] = j; } });
  });
  return groepeer(punten, toewijzing, vakken.length);
}

/** Gemiddelde kleur (in lineair licht, dus zonder vergrauwen) en aandeel per groep. */
function groepeer(punten, toewijzing, k) {
  const som = Array.from({ length: k }, () => [0, 0, 0, 0]);
  for (let i = 0; i < punten.length; i++) {
    const s = som[toewijzing[i]];
    const p = punten[i].rgb;
    s[0] += lineair(p[0] / 255);
    s[1] += lineair(p[1] / 255);
    s[2] += lineair(p[2] / 255);
    s[3]++;
  }
  return som.filter((s) => s[3]).map((s) => ({
    rgb: [0, 1, 2].map((c) => Math.round(255 * gamma(s[c] / s[3]))),
    aandeel: s[3] / punten.length,
  }));
}

/** Voegt bijna gelijke kleuren samen (ΔE < 4), zodat er geen dubbele vlakjes komen. */
function voegSamen(kleuren) {
  const uit = [];
  for (const k of kleuren.sort((a, b) => b.aandeel - a.aandeel)) {
    const lab = labVan(...k.rgb);
    const zelfde = uit.find((u) => afstand2(labVan(...u.rgb), lab) < 16);
    if (zelfde) zelfde.aandeel += k.aandeel;
    else uit.push({ ...k });
  }
  return uit;
}

function sorteer(kleuren, hoe) {
  const L = (k) => labVan(...k.rgb)[0];
  const grijs = (k) => { const [, a, b] = labVan(...k.rgb); return Math.hypot(a, b) < 8; };
  if (hoe === 'helderheid') return kleuren.sort((a, b) => L(b) - L(a));
  if (hoe === 'tint') {
    return kleuren.sort((a, b) => {
      if (grijs(a) !== grijs(b)) return grijs(a) ? 1 : -1;
      if (grijs(a)) return L(b) - L(a);
      return ((tintVan(a.rgb) + 345) % 360) - ((tintVan(b.rgb) + 345) % 360);
    });
  }
  return kleuren.sort((a, b) => b.aandeel - a.aandeel);
}

// ---- de vlakjes neerzetten ----------------------------------------------------------

const breedteTekst = (t, grootte, vet) => t.length * grootte * (vet ? 0.6 : 0.56);
const cmykTekst = (c) => `C ${c[0]} M ${c[1]} Y ${c[2]} K ${c[3]}`;

/** De regels met waarden voor één kleur. */
function waardeRegels(kleur, w, cmykDoc) {
  const hex = hexVanRgb(kleur.rgb).toUpperCase();
  const cmyk = cmykTekst(kleur.cmyk);
  if (w.waarden === 'hex') return [hex];
  if (w.waarden === 'cmyk') return [cmyk];
  if (w.waarden === 'beide') return [cmyk, hex];
  return [cmykDoc ? cmyk : hex];
}

/**
 * Rekent de plek en maten uit. Geeft { plaats, vormen, kader } met kader het gebied van het palet.
 * plaats: 'rechts' | 'onder' | 'over'.
 */
function legPaletNeer(bron, kleuren, w, ctx) {
  const k = bron.kader;
  const tg = ctx.doc.tekengebied;
  const mm = vexel.mm;
  const n = kleuren.length;
  const tekstKleur = ctx.cmyk ? { cmyk: [0, 0, 0, 85] } : { hex: '#262626' };
  const zachtKleur = ctx.cmyk ? { cmyk: [0, 0, 0, 60] } : { hex: '#666666' };
  const tussen = Math.max(mm(4), Math.min(mm(10), Math.min(k.b, k.h) * 0.04));
  const vulling = (kl) => {
    if (w.stalen) return { steunkleur: { naam: `${kl.naam} ${hexVanRgb(kl.rgb).slice(1).toUpperCase()}`, cmyk: kl.cmyk }, tint: 100 };
    return ctx.cmyk ? { cmyk: kl.cmyk.slice() } : { hex: hexVanRgb(kl.rgb) };
  };
  const regels = kleuren.map((kl) => waardeRegels(kl, w, ctx.cmyk));
  const kleurGroep = (kl, staal, teksten) => ({
    soort: 'groep',
    naam: kl.naam,
    kinderen: [
      { soort: 'rechthoek', naam: 'Kleurvlak', ...staal, vulling: vulling(kl), lijn: null },
      ...teksten,
    ],
  });

  // 1. Naast de foto: een kolom vlakjes met de tekst rechts ervan.
  const rechts = () => {
    const rij = k.h / n;
    const staal = Math.min(rij * 0.8, mm(26));
    const groot = begrens(staal * 0.28, 6, 11);
    const klein = groot * 0.84;
    const ruimte = Math.max(mm(2), staal * 0.22);
    const tekstB = Math.max(...kleuren.map((kl, i) => Math.max(breedteTekst(kl.naam, groot, true),
      ...regels[i].map((r) => breedteTekst(r, klein, false)))));
    const x0 = k.x + k.b + tussen;
    const breedte = staal + ruimte + tekstB;
    const vormen = kleuren.map((kl, i) => {
      const y = k.y + i * rij + (rij - staal) / 2;
      const regelsHoog = groot + regels[i].length * klein * 1.25;
      const y1 = y + (staal - regelsHoog) / 2 + groot * 0.95;
      const tx = x0 + staal + ruimte;
      return kleurGroep(kl, { x: x0, y, b: staal, h: staal }, [
        { soort: 'tekst', naam: 'Naam', x: tx, y: y1, inhoud: kl.naam, grootte: rond(groot), gewicht: 600, vulling: tekstKleur },
        { soort: 'tekst', naam: 'Waarde', x: tx, y: y1 + klein * 1.3, inhoud: regels[i].join('\n'), grootte: rond(klein),
          regelafstand: rond(klein * 1.25), vulling: zachtKleur },
      ]);
    });
    return { plaats: 'rechts', vormen, kader: { x: x0, y: k.y, b: breedte, h: k.h }, past: x0 + breedte <= tg.b };
  };

  // 2. Onder de foto (of over de onderrand): een rij vlakjes, de tekst eronder.
  const onder = (over) => {
    const pad = over ? Math.max(mm(2), k.b * 0.015) : 0;
    const b = k.b - 2 * pad;
    // Veel kleuren: twee rijen, zodat de tekst leesbaar blijft.
    const rijen = n > (over ? 10 : 7) ? 2 : 1;
    const perRij = Math.ceil(n / rijen);
    const goot = Math.min(mm(3), b * 0.025);
    const kolom = (b - goot * (perRij - 1)) / perRij;
    const staalH = Math.min(kolom * 0.7, mm(20), k.h * (over ? 0.1 / rijen : 0.3));
    const langst = Math.max(...regels.flat().map((r) => r.length), 6);
    // CMYK past niet op één regel in een smalle kolom: dan over twee regels.
    let groot = begrens(Math.min(staalH * 0.3, kolom / (Math.max(...kleuren.map((kl) => kl.naam.length)) * 0.6)), 4.5, 10);
    let klein = groot * 0.84;
    const opsplitsen = langst * klein * 0.56 > kolom;
    const regelsVan = (i) => (opsplitsen ? regels[i].flatMap((r) => (r.startsWith('C ') ? [r.split(' Y ')[0], 'Y ' + r.split(' Y ')[1]] : [r])) : regels[i]);
    const maxRegels = Math.max(...kleuren.map((_, i) => regelsVan(i).length));
    const breedsteRegel = Math.max(...kleuren.map((_, i) => Math.max(...regelsVan(i).map((r) => r.length))));
    klein = Math.min(klein, kolom / (breedsteRegel * 0.56));
    groot = Math.min(groot, klein / 0.84);
    const rijHoog = staalH + groot * 1.5 + maxRegels * klein * 1.25 + klein * 0.3;
    const rijGoot = goot * 1.5;
    const hoog = rijen * rijHoog + (rijen - 1) * rijGoot;
    const y0 = over ? k.y + k.h - hoog - pad : k.y + k.h + tussen;
    const vormen = kleuren.map((kl, i) => {
      const x = k.x + pad + (i % perRij) * (kolom + goot);
      const yr = y0 + Math.floor(i / perRij) * (rijHoog + rijGoot);
      const ty = yr + staalH + groot * 1.35;
      return kleurGroep(kl, { x, y: yr, b: kolom, h: staalH }, [
        { soort: 'tekst', naam: 'Naam', x, y: ty, inhoud: kl.naam, grootte: rond(groot), gewicht: 600, vulling: tekstKleur },
        { soort: 'tekst', naam: 'Waarde', x, y: ty + klein * 1.3, inhoud: regelsVan(i).join('\n'), grootte: rond(klein),
          regelafstand: rond(klein * 1.25), vulling: zachtKleur },
      ]);
    });
    if (over) {
      const wit = ctx.cmyk ? { cmyk: [0, 0, 0, 0] } : { hex: '#ffffff' };
      vormen.unshift({ soort: 'rechthoek', naam: 'Ondergrond', x: k.x, y: y0 - pad, b: k.b, h: hoog + 2 * pad, vulling: wit, lijn: null, dekking: 0.92 });
    }
    return { plaats: over ? 'over' : 'onder', vormen, kader: { x: k.x, y: y0 - pad, b: k.b, h: hoog + 2 * pad }, past: y0 + hoog <= tg.h };
  };

  let r;
  if (w.plaats === 'over') r = onder(true);
  else if (w.plaats === 'onder') {
    r = onder(false);
    if (!r.past) r = onder(true);
  } else {
    r = rechts();
    if (!r.past) r = onder(false);
    if (!r.past) r = onder(true);
  }
  return r;
}

const PLAATS_TEKST = { rechts: 'rechts naast de foto', onder: 'onder de foto', over: 'over de onderrand van de foto' };

// ---- het venster -------------------------------------------------------------------

function velden(ctx) {
  const aantal = schuif('Kleuren', 3, 12, 1, (v) => `${v}`);
  const methode = keuze('Methode', { kmeans: 'Clusters (k-means)', mediaan: 'Mediaan-snede' });
  const sorteerVeld = keuze('Sorteren', SORTEER);
  const variant = el('button', { klasse: 'knop', type: 'button', tekst: 'Andere variant', title: 'Een andere start voor het zoeken' });
  const variantRij = el('div', { stijl: { display: 'flex', justifyContent: 'flex-end', margin: '-2px 0 8px' } }, variant);
  const waarden = keuze('Waarden', { auto: ctx.cmyk ? 'CMYK (dit document)' : 'Hex (dit document)', cmyk: 'CMYK', hex: 'Hex', beide: 'CMYK en hex' });
  const plaats = keuze('Plaats', { auto: 'Naast de foto (anders eronder)', onder: 'Onder de foto', over: 'Over de onderrand' });
  const stalen = vinkje('Als stalen (steunkleuren) toevoegen');
  const stalenUitleg = el('p', { klasse: 'uitleg', stijl: { margin: '-2px 0 8px 22px' },
    tekst: 'Elke steunkleur wordt in drukwerk een eigen drukplaat; laat dit uit voor gewoon vierkleurendruk.' });
  const lijst = el('div', { 'aria-live': 'polite', stijl: { display: 'grid', gap: '4px', margin: '0 0 6px' } });
  let zaad = STANDAARD.zaad;
  variant.addEventListener('click', () => {
    zaad = nieuwZaadje();
    variant.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return {
    elementen: [
      kop('Kleuren zoeken'), aantal.rij, methode.rij, variantRij, sorteerVeld.rij,
      kop('Palet maken'), waarden.rij, plaats.rij, stalen.rij, stalenUitleg,
      kop('Gevonden kleuren'), lijst,
    ],
    lijst,
    lees: () => ({
      aantal: aantal.lees(), methode: methode.lees(), sorteer: sorteerVeld.lees(), waarden: waarden.lees(),
      plaats: plaats.lees(), stalen: stalen.lees(), zaad,
    }),
    zet(w) {
      aantal.zet(w.aantal);
      methode.zet(w.methode);
      sorteerVeld.zet(w.sorteer);
      waarden.zet(w.waarden);
      plaats.zet(w.plaats);
      stalen.zet(w.stalen);
      zaad = w.zaad || STANDAARD.zaad;
      this.bij(w);
    },
    bij(w) {
      variant.disabled = w.methode !== 'kmeans';
    },
  };
}

let paletLijst = null;
function toonLijst(r, cmykDoc) {
  if (!paletLijst) return;
  paletLijst.replaceChildren(...r.kleuren.map((kl) => el('div', {
    stijl: { display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) auto', gap: '8px', alignItems: 'center', fontSize: '11px' },
    title: `${kl.naam}: ${hexVanRgb(kl.rgb).toUpperCase()}, ${cmykTekst(kl.cmyk)}`,
  },
  el('span', { klasse: 'fv-staal', stijl: { width: '18px', height: '18px', background: kleurCss({ cmyk: kl.cmyk }) } }),
  el('span', { stijl: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
    el('span', { tekst: kl.naam, stijl: { color: 'var(--tekst)' } }),
    el('span', { klasse: 'uitleg', tekst: '  ' + (cmykDoc ? cmykTekst(kl.cmyk) : hexVanRgb(kl.rgb).toUpperCase()) })),
  el('span', { klasse: 'fv-waarde', tekst: kl.aandeel < 0.005 ? '< 1 %' : `${getal(kl.aandeel * 100, 0)} %` }))));
}

async function bereken(bron, w, ctx) {
  const punten = steekproef(bron, w.zaad);
  if (punten.length < 20) return { fout: 'Deze foto is (bijna) helemaal doorzichtig: er zijn geen kleuren om te meten.' };
  let kleuren = w.methode === 'mediaan' ? mediaanSnede(punten, w.aantal) : besteKMeans(punten, w.aantal, w.zaad);
  kleuren = voegSamen(kleuren); // op aandeel, zodat "Blauw" de grootste is en "Blauw 2" de volgende
  const namen = new Map();
  kleuren.forEach((kl) => {
    kl.cmyk = rgbNaarCmyk(...kl.rgb);
    // In een CMYK-document toont het vlak precies de CMYK-waarde die erbij staat.
    const naam = kleurNaam(kl.rgb);
    const n = (namen.get(naam) || 0) + 1;
    namen.set(naam, n);
    kl.naam = n > 1 ? `${naam} ${n}` : naam;
  });
  kleuren = sorteer(kleuren, w.sorteer);
  const neer = legPaletNeer(bron, kleuren, w, ctx);
  const fotoNaam = (bron.foto.naam || 'foto').slice(0, 60);
  const groep = { soort: 'groep', naam: `Palet: ${fotoNaam}`, kinderen: neer.vormen };
  return { vormen: [groep], kleuren, plaats: neer.plaats, kader: neer.kader, aantal: kleuren.length };
}

vexel.opCommando('maken', () => fotoVenster({
  knop: 'Palet maken',
  standaard: STANDAARD,
  maxZijde: 800,
  velden(ctx) {
    const ui = velden(ctx);
    paletLijst = ui.lijst;
    return ui;
  },
  bereken,
  knip: false,
  zicht(r, bron) {
    const k = bron.kader;
    if (!r || !r.kader) return k;
    const x0 = Math.min(k.x, r.kader.x);
    const y0 = Math.min(k.y, r.kader.y);
    const x1 = Math.max(k.x + k.b, r.kader.x + r.kader.b);
    const y1 = Math.max(k.y + k.h, r.kader.y + r.kader.h);
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  },
  tekenExtra(g, m, r, ctx) {
    // De foto blijft zichtbaar; het palet komt op wit papier ernaast (of erover) en wordt opnieuw getekend.
    if (!ctx.bron || !r.vormen) return;
    const k = ctx.bron.kader;
    g.save();
    g.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    if (r.kader && r.plaats !== 'over') {
      const p = 6;
      g.fillStyle = '#ffffff';
      g.fillRect(m.ox + r.kader.x * m.s - p, m.oy + r.kader.y * m.s - p, r.kader.b * m.s + 2 * p, r.kader.h * m.s + 2 * p);
    }
    g.imageSmoothingQuality = 'high';
    g.drawImage(ctx.bron.doek, m.ox + k.x * m.s, m.oy + k.y * m.s, k.b * m.s, k.h * m.s);
    g.restore();
    tekenVormen(g, r.vormen, m);
  },
  samenvatting(r, w, ctx) {
    toonLijst(r, ctx.cmyk);
    // Een palet heeft geen ankerpunten (alleen vlakken en tekst): dat stukje van de kern weglaten.
    queueMicrotask(() => {
      const s = document.querySelector('.fv-samen');
      if (s) s.textContent = s.textContent.replace(/, 0 ankerpunten/, '');
    });
    return `${r.kleuren.length} kleuren, ${PLAATS_TEKST[r.plaats]}` + (w.stalen ? ', als steunkleuren' : '');
  },
  melding: (r, w, n) => `Palet gemaakt: ${r.kleuren.length} kleuren ${PLAATS_TEKST[r.plaats]}` + (n > 1 ? `, bij elk van de ${n} foto's.` : '.'),
}));
