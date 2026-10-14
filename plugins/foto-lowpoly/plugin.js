// Low-poly: maakt van een foto een vlak van driehoeken met de gemiddelde kleur.
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

// ---- Low-poly -----------------------------------------------------------------

const LP_MAX_PUNTEN = 2300; // ongeveer 2 driehoeken per punt: blijft onder 5000 vormen per keer
const LIJNEN = { naden: 'Naden dichten', geen: 'Geen lijn', wit: 'Witte lijn', donker: 'Donkere lijn' };

const STANDAARD = {
  aantal: 900, rand: 60, lijn: 'naden', dikte: 0.5, verzadiging: 0, helderheid: 0, zaad: 1234,
};

function velden() {
  let zaad = STANDAARD.zaad;
  const aantal = schuif('Punten', 60, LP_MAX_PUNTEN, 10, (v) => `${getal(v, 0)}`);
  const rand = schuif('Randen', 0, 100, 1, (v) => `${v} %`);
  const variant = el('button', { klasse: 'knop', type: 'button', tekst: 'Andere variant', title: 'Dezelfde instellingen, andere punten' });
  const zaadTekst = el('span', { klasse: 'uitleg' });
  variant.addEventListener('click', () => {
    zaad = nieuwZaadje();
    zaadTekst.textContent = `variant ${zaad}`;
    variant.closest('form').dispatchEvent(new Event('input', { bubbles: true }));
  });
  const lijn = keuze('Lijn', LIJNEN);
  const dikte = schuif('Lijndikte', 0.1, 3, 0.1, (v) => `${getal(v)} pt`);
  const verzadiging = schuif('Verzadiging', -100, 100, 1, (v) => (v > 0 ? '+' : '') + v);
  const helderheid = schuif('Helderheid', -50, 50, 1, (v) => (v > 0 ? '+' : '') + v);
  const uitleg = el('p', { klasse: 'uitleg', stijl: { margin: '0 0 8px' },
    tekst: 'Meer randen: de punten komen dichter bij de randen in de foto, zodat vormen herkenbaar blijven.' });

  return {
    elementen: [
      kop('Driehoeken'), aantal.rij, rand.rij, uitleg,
      el('div', { stijl: { display: 'flex', gap: '8px', alignItems: 'center', margin: '0 0 8px' } }, variant, zaadTekst),
      kop('Kleur en lijn'), verzadiging.rij, helderheid.rij, lijn.rij, dikte.rij,
    ],
    lees: () => ({
      aantal: aantal.lees(), rand: rand.lees(), lijn: lijn.lees(), dikte: dikte.lees(),
      verzadiging: verzadiging.lees(), helderheid: helderheid.lees(), zaad,
    }),
    zet(w) {
      aantal.zet(w.aantal);
      rand.zet(w.rand);
      lijn.zet(w.lijn);
      dikte.zet(w.dikte);
      verzadiging.zet(w.verzadiging);
      helderheid.zet(w.helderheid);
      zaad = w.zaad || STANDAARD.zaad;
      zaadTekst.textContent = `variant ${zaad}`;
      this.bij(w);
    },
    bij(w) {
      dikte.rij.style.display = w.lijn === 'wit' || w.lijn === 'donker' ? '' : 'none';
    },
  };
}

/** Randsterkte (Sobel op een verkleinde helderheid), één keer per foto. */
function randKaart(bron) {
  if (bron.lpRand) return bron.lpRand;
  const K = kanalen(bron);
  const f = Math.max(1, Math.max(bron.b, bron.h) / 420);
  const gb = Math.max(2, Math.round(bron.b / f));
  const gh = Math.max(2, Math.round(bron.h / f));
  const L = new Float32Array(gb * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gb; x++) {
      L[y * gb + x] = gemiddelde(K.lum, bron.b, bron.h, x * f, y * f, (x + 1) * f, (y + 1) * f);
    }
  }
  const E = new Float32Array(gb * gh);
  const v = (x, y) => L[begrens(y, 0, gh - 1) * gb + begrens(x, 0, gb - 1)];
  const waarden = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gb; x++) {
      const gx = v(x + 1, y - 1) + 2 * v(x + 1, y) + v(x + 1, y + 1) - v(x - 1, y - 1) - 2 * v(x - 1, y) - v(x - 1, y + 1);
      const gy = v(x - 1, y + 1) + 2 * v(x, y + 1) + v(x + 1, y + 1) - v(x - 1, y - 1) - 2 * v(x, y - 1) - v(x + 1, y - 1);
      const e = Math.hypot(gx, gy);
      E[y * gb + x] = e;
      if ((x + y) % 7 === 0) waarden.push(e);
    }
  }
  // Normaliseer op het 95e percentiel, zodat één harde rand niet alles bepaalt.
  waarden.sort((a, b) => a - b);
  const p95 = waarden[Math.floor(waarden.length * 0.95)] || 1;
  for (let i = 0; i < E.length; i++) E[i] = Math.min(1, E[i] / (p95 || 1));
  bron.lpRand = { E, gb, gh, f };
  return bron.lpRand;
}

/** Punten in pixels van de bron: rand en hoeken van het kader, en binnenin gewogen naar de randen. */
function kiesPunten(bron, w) {
  const { E, gb, gh, f } = randKaart(bron);
  const rnd = willekeur(w.zaad * 7919 + w.aantal);
  const B = bron.b;
  const H = bron.h;
  const s = w.rand / 100;
  const stap = Math.sqrt((B * H) / w.aantal);
  const punten = [];
  // Rand: de hoeken en gelijkmatig met een beetje speling langs de zijden.
  punten.push([0, 0], [B, 0], [B, H], [0, H]);
  const langs = (lengte, maak) => {
    const n = Math.max(1, Math.round(lengte / (stap * 1.1)));
    for (let i = 1; i < n; i++) maak(((i + (rnd() - 0.5) * 0.5) / n) * lengte);
  };
  langs(B, (t) => punten.push([t, 0]));
  langs(B, (t) => punten.push([t, H]));
  langs(H, (t) => punten.push([0, t]));
  langs(H, (t) => punten.push([B, t]));
  const randAantal = punten.length;
  // Binnenin: afwijzend trekken met gewicht (1 − s) + s · 4 · rand, met een minimale afstand.
  const minAfstand = stap * (0.62 - 0.32 * s);
  const cel = minAfstand;
  const cb = Math.ceil(B / cel) + 1;
  const emmers = new Map();
  const vrij = (x, y, d) => {
    const cx = Math.floor(x / cel);
    const cy = Math.floor(y / cel);
    for (let j = cy - 1; j <= cy + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        const l = emmers.get(j * cb + i);
        if (!l) continue;
        for (const p of l) if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < d * d) return false;
      }
    }
    return true;
  };
  const leg = (p) => {
    const k = Math.floor(p[1] / cel) * cb + Math.floor(p[0] / cel);
    if (!emmers.has(k)) emmers.set(k, []);
    emmers.get(k).push(p);
  };
  punten.forEach(leg);
  const max = 1 - s + s * 4;
  let pogingen = 0;
  while (punten.length - randAantal < w.aantal && pogingen < w.aantal * 60) {
    pogingen++;
    const x = rnd() * B;
    const y = rnd() * H;
    const e = E[Math.min(gh - 1, Math.floor(y / f)) * gb + Math.min(gb - 1, Math.floor(x / f))];
    const gewicht = 1 - s + s * 4 * e;
    if (rnd() * max > gewicht) continue;
    // In drukke stukken mogen punten iets dichter op elkaar.
    const d = minAfstand * (1 - 0.45 * s * e);
    if (x < d * 0.5 || y < d * 0.5 || x > B - d * 0.5 || y > H - d * 0.5) continue;
    if (!vrij(x, y, d)) continue;
    const p = [x, y];
    punten.push(p);
    leg(p);
  }
  return punten;
}

/**
 * Delaunay-driehoeken (Bowyer–Watson, eigen code). Punten op x gesorteerd, zodat driehoeken
 * waarvan de omgeschreven cirkel al links van het punt ligt, klaar zijn en niet meer getest worden.
 * Geeft een lijst [a, b, c] met indexen in `punten`.
 */
function delaunay(punten) {
  const n = punten.length;
  const P = punten.slice();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of P) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const d = Math.max(maxX - minX, maxY - minY) * 40;
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  P.push([mx - d, my - d], [mx + d, my - d], [mx, my + d]);
  const driehoek = (a, b, c) => {
    const [ax, ay] = P[a];
    const [bx, by] = P[b];
    const [cx, cy] = P[c];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(D) < 1e-12) return { a, b, c, x: ax, y: ay, r2: Infinity };
    const a2 = ax * ax + ay * ay;
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    const x = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / D;
    const y = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / D;
    return { a, b, c, x, y, r2: (ax - x) ** 2 + (ay - y) ** 2 };
  };
  const volgorde = [...Array(n).keys()].sort((i, j) => P[i][0] - P[j][0] || P[i][1] - P[j][1]);
  let open = [driehoek(n, n + 1, n + 2)];
  const klaar = [];
  for (const i of volgorde) {
    const [px, py] = P[i];
    const randen = new Map();
    const blijft = [];
    const voegRand = (a, b) => {
      const sleutel = a < b ? a * 100003 + b : b * 100003 + a;
      if (randen.has(sleutel)) randen.delete(sleutel);
      else randen.set(sleutel, [a, b]);
    };
    for (const t of open) {
      const dx = px - t.x;
      if (dx > 0 && dx * dx > t.r2) {
        klaar.push(t);
        continue;
      }
      if (dx * dx + (py - t.y) ** 2 < t.r2) {
        voegRand(t.a, t.b);
        voegRand(t.b, t.c);
        voegRand(t.c, t.a);
      } else blijft.push(t);
    }
    for (const [a, b] of randen.values()) blijft.push(driehoek(a, b, i));
    open = blijft;
  }
  return klaar.concat(open).filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

/** Gemiddelde kleur en dekking van de pixels in een driehoek (pixelcentra), in bronpixels. */
function driehoekKleur(bron, A, B, C) {
  const px = bron.px;
  const W = bron.b;
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
  const y1 = Math.min(bron.h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  const opp = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  if (Math.abs(opp) > 1e-9) {
    const zijde = (P, Q, x, y) => ((Q[0] - P[0]) * (y - P[1]) - (x - P[0]) * (Q[1] - P[1])) * Math.sign(opp);
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5;
        if (zijde(A, B, cx, cy) < 0 || zijde(B, C, cx, cy) < 0 || zijde(C, A, cx, cy) < 0) continue;
        const j = (y * W + x) * 4;
        const al = px[j + 3] / 255;
        r += px[j] * al;
        g += px[j + 1] * al;
        b += px[j + 2] * al;
        a += al;
        n++;
      }
    }
  }
  if (!n) {
    // Heel kleine driehoek: neem het zwaartepunt.
    const x = begrens(Math.floor((A[0] + B[0] + C[0]) / 3), 0, W - 1);
    const y = begrens(Math.floor((A[1] + B[1] + C[1]) / 3), 0, bron.h - 1);
    const j = (y * W + x) * 4;
    const al = px[j + 3] / 255;
    return { rgb: [px[j], px[j + 1], px[j + 2]], alfa: al };
  }
  return { rgb: a > 0 ? [r / a, g / a, b / a] : [255, 255, 255], alfa: a / n };
}

/** Verzadiging en helderheid op een RGB-kleur. */
function bewerkKleur(rgb, w) {
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const f = 1 + w.verzadiging / 100;
  const h = w.helderheid * 2.2;
  return rgb.map((c) => begrens(l + (c - l) * f + h, 0, 255));
}

function lijnStijl(w, kleur, cmyk) {
  if (w.lijn === 'naden') return { lijn: kleur, lijndikte: 0.25, lijnhoek: 'round' };
  if (w.lijn === 'wit') return { lijn: drukKleur('wit', cmyk), lijndikte: w.dikte, lijnhoek: 'round' };
  if (w.lijn === 'donker') return { lijn: cmyk ? { cmyk: [60, 50, 40, 90] } : { hex: '#1b1d22' }, lijndikte: w.dikte, lijnhoek: 'round' };
  return { lijn: null };
}

function bereken(bron, w, ctx) {
  const punten = kiesPunten(bron, w);
  const driehoeken = delaunay(punten);
  const k = bron.kader;
  const sx = k.b / bron.b;
  const sy = k.h / bron.h;
  const naarPt = (p) => ({ x: rond(k.x + p[0] * sx, 3), y: rond(k.y + p[1] * sy, 3) });
  // Driehoeken met precies dezelfde (afgeronde) kleur gaan samen in één samengesteld pad.
  const perKleur = new Map();
  let aantal = 0;
  let weg = 0;
  for (const [a, b, c] of driehoeken) {
    const A = punten[a];
    const B = punten[b];
    const C = punten[c];
    const m = driehoekKleur(bron, A, B, C);
    if (m.alfa < 0.5) {
      weg++;
      continue;
    }
    const kleur = kleurVoor(bewerkKleur(m.rgb, w), ctx.cmyk);
    const sleutel = kleur.cmyk ? kleur.cmyk.join(',') : kleur.hex;
    // Met de klok mee (op het scherm), zodat alle subpaden dezelfde draairichting hebben.
    const opp = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
    const hoeken = opp >= 0 ? [A, B, C] : [A, C, B];
    if (!perKleur.has(sleutel)) perKleur.set(sleutel, { kleur, subpaden: [] });
    perKleur.get(sleutel).subpaden.push({ gesloten: true, punten: hoeken.map(naarPt) });
    aantal++;
  }
  if (!aantal) return { fout: 'Er blijft niets over: de foto is (bijna) helemaal doorzichtig.' };
  const paden = [];
  let nr = 0;
  for (const { kleur, subpaden } of perKleur.values()) {
    nr++;
    const pad = { soort: 'pad', naam: subpaden.length > 1 ? `Driehoeken ${nr}` : `Driehoek ${nr}`, subpaden, vulling: kleur, ...lijnStijl(w, kleur, ctx.cmyk) };
    paden.push(...splitsSubpaden(pad));
  }
  const naam = `Low-poly, ${getal(aantal, 0)} driehoeken`;
  return { vormen: [fotoGroep(naam, bron, paden)], aantal, kleuren: perKleur.size, weg, punten: punten.length };
}

vexel.opCommando('maken', () => fotoVenster({
  knop: 'Low-poly maken',
  standaard: STANDAARD,
  maxZijde: 1200,
  velden,
  bereken,
  samenvatting: (r) => `${getal(r.aantal, 0)} driehoeken in ${getal(r.kleuren, 0)} kleuren` + (r.weg ? `, ${getal(r.weg, 0)} doorzichtig weggelaten` : ''),
  teFijn: () => 'Kies minder punten.',
  melding: (r, w, n) => `Low-poly gemaakt: ${getal(r.aantal, 0)} driehoeken` + (n > 1 ? ` (eerste van ${n} foto's).` : '.'),
}));
