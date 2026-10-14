// Sterrenhemel: een nachtelijke hemel met sterren, melkweg, sterrenbeelden en de maan.
// Eigen werk van GuusLab, MIT-licentie.
'use strict';

// ---- venster-hulpjes -------------------------------------------------------

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

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) && String(veld.value).trim() !== '' ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getal = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });

function getalVeld(waarde, min, max, stap, naam) {
  const veld = maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
  if (naam) veld.setAttribute('aria-label', naam);
  return veld;
}

const sleutelVan = (opties, waarde) => (Object.prototype.hasOwnProperty.call(opties, waarde) ? waarde : Object.keys(opties)[0]);
function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' },
    ...Object.entries(opties).map(([sleutel, tekst]) => maak('option', { value: sleutel, tekst })));
  veld.value = sleutelVan(opties, waarde);
  return veld;
}

/** Een rij met een label links en een of meer velden (met eenheid) rechts. */
function regel(label, ...velden) {
  const rij = maak('label', { klasse: 'rij', stijl: { margin: '0', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst: label, stijl: { minWidth: '78px' } }));
  for (const v of velden) {
    if (typeof v === 'string') rij.append(maak('span', { klasse: 'uitleg', tekst: v, stijl: { flex: 'none', minWidth: '20px' } }));
    else {
      if (v.classList && v.classList.contains('veld')) Object.assign(v.style, { flex: '1', minWidth: '0', width: '100%' });
      rij.append(v);
    }
  }
  return rij;
}
const twee = (...rijen) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' } }, ...rijen);

// ---- kleur ----------------------------------------------------------------
// Een eenvoudige omrekening zonder kleurprofiel, alleen voor het voorbeeld en RGB-documenten.

const rgbVanCmyk = ([c, m, y, k]) => {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z].map(Math.round);
};
const hexVanRgb = (rgb) => '#' + rgb.map((n) => begrens(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
const kleurCss = (kleur) => (!kleur ? 'transparent' : kleur.hex || hexVanRgb(rgbVanCmyk(kleur.cmyk)));
const alsKleur = (cmykWaarden, cmyk) => (cmyk ? { cmyk: cmykWaarden.slice() } : { hex: hexVanRgb(rgbVanCmyk(cmykWaarden)) });

// ---- willekeur en ruis ----------------------------------------------------

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

/**
 * Simplexruis in twee richtingen, eigen uitwerking: het vlak wordt in driehoeken verdeeld,
 * elke hoek krijgt een willekeurige richting en draagt bij met een zacht aflopend gewicht.
 * Geeft ongeveer -1 tot 1.
 */
function maakSimplex(zaad) {
  const kans = willekeur(zaad);
  const perm = new Uint8Array(512);
  const volgorde = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(kans() * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = volgorde[i & 255];
  const hoeken = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);
  const SCHEEF = (Math.sqrt(3) - 1) / 2;
  const RECHT = (3 - Math.sqrt(3)) / 6;
  const bijdrage = (gi, x, y) => {
    const t = 0.5 - x * x - y * y;
    if (t <= 0) return 0;
    const g = hoeken[gi & 15];
    return t * t * t * t * (g[0] * x + g[1] * y);
  };
  return (x, y) => {
    const s = (x + y) * SCHEEF;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * RECHT;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + RECHT;
    const y1 = y0 - j1 + RECHT;
    const x2 = x0 - 1 + 2 * RECHT;
    const y2 = y0 - 1 + 2 * RECHT;
    const ii = i & 255;
    const jj = j & 255;
    const n = bijdrage(perm[ii + perm[jj]], x0, y0)
      + bijdrage(perm[ii + i1 + perm[jj + j1]], x1, y1)
      + bijdrage(perm[ii + 1 + perm[jj + 1]], x2, y2);
    return 70 * n;
  };
}

/** Een paar lagen ruis op elkaar (grof plus fijner), van ongeveer -1 tot 1. */
function maakVeldRuis(zaad, lagen) {
  const ruis = maakSimplex(zaad);
  return (x, y) => {
    let som = 0;
    let gewicht = 0;
    let f = 1;
    let a = 1;
    for (let l = 0; l < lagen; l++) {
      som += a * ruis(x * f + l * 19.3, y * f - l * 7.7);
      gewicht += a;
      f *= 2.03;
      a *= 0.45;
    }
    return som / gewicht;
  };
}

const rond = (n) => Math.round(n * 100) / 100;

// ---- tellen en voorbeeld ----------------------------------------------------

function tel(vormen) {
  let aantal = 0;
  let punten = 0;
  const loop = (v) => {
    aantal++;
    if (v.kinderen) v.kinderen.forEach(loop);
    if (v.subpaden) for (const s of v.subpaden) punten += s.punten.length;
    if (v.soort === 'ellips' || v.soort === 'rechthoek') punten += 4;
  };
  vormen.forEach(loop);
  return { vormen: aantal, punten };
}
const GRENS = { vormen: 5000, punten: 50000, subpaden: 1000 };

function padVanSubpaden(subpaden, sx, ox, oy) {
  const p = new Path2D();
  for (const s of subpaden) {
    const n = s.punten.length;
    if (!n) continue;
    const X = (q) => ox + q.x * sx;
    const Y = (q) => oy + q.y * sx;
    p.moveTo(X(s.punten[0]), Y(s.punten[0]));
    const eind = s.gesloten ? n : n - 1;
    for (let i = 1; i <= eind; i++) {
      const a = s.punten[i - 1];
      const b = s.punten[i % n];
      if (a.uit || b.in) {
        const c1 = a.uit || a;
        const c2 = b.in || b;
        p.bezierCurveTo(X(c1), Y(c1), X(c2), Y(c2), X(b), Y(b));
      } else p.lineTo(X(b), Y(b));
    }
    if (s.gesloten) p.closePath();
  }
  return p;
}

/** Tekent het tekengebied met de vormen erop, passend in het canvas; `zicht` in pt. */
function tekenVoorbeeld(doek, doc, vormen, zicht) {
  const schaal = devicePixelRatio || 1;
  const kader = doek.getBoundingClientRect();
  doek.width = Math.max(1, Math.round(kader.width * schaal));
  doek.height = Math.max(1, Math.round(kader.height * schaal));
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.fillStyle = vexel.thema.bg2;
  g.fillRect(0, 0, kader.width, kader.height);
  const tg = doc.tekengebied;
  const z = zicht || { x: 0, y: 0, b: tg.b, h: tg.h };
  const marge = 10;
  const sx = Math.min((kader.width - 2 * marge) / z.b, (kader.height - 2 * marge) / z.h);
  const ox = (kader.width - z.b * sx) / 2 - z.x * sx;
  const oy = (kader.height - z.h * sx) / 2 - z.y * sx;
  g.fillStyle = '#ffffff';
  g.fillRect(ox, oy, tg.b * sx, tg.h * sx);
  const loop = (v) => {
    if (v.soort === 'groep') return v.kinderen.forEach(loop);
    g.globalAlpha = v.dekking === undefined ? 1 : v.dekking;
    if (v.soort === 'tekst') {
      g.fillStyle = kleurCss(v.vulling);
      g.font = `${v.gewicht || 400} ${Math.max(1, v.grootte * sx)}px Inter, system-ui, sans-serif`;
      g.textAlign = v.uitlijning === 'midden' ? 'center' : 'left';
      g.fillText(v.inhoud, ox + v.x * sx, oy + v.y * sx);
      g.globalAlpha = 1;
      return;
    }
    let p;
    if (v.soort === 'pad') p = padVanSubpaden(v.subpaden, sx, ox, oy);
    else if (v.soort === 'rechthoek') {
      // Op hele beeldpunten, zodat de banden van een verloop geen naden tonen.
      const x0 = Math.round((ox + v.x * sx) * schaal) / schaal;
      const y0 = Math.round((oy + v.y * sx) * schaal) / schaal;
      const x1 = Math.round((ox + (v.x + v.b) * sx) * schaal) / schaal;
      const y1 = Math.round((oy + (v.y + v.h) * sx) * schaal) / schaal;
      p = new Path2D();
      p.rect(x0, y0, x1 - x0, y1 - y0);
    } else if (v.soort === 'ellips') {
      p = new Path2D();
      p.ellipse(ox + v.cx * sx, oy + v.cy * sx, v.rx * sx, v.ry * sx, 0, 0, Math.PI * 2);
    } else return;
    if (v.vulling) {
      g.fillStyle = kleurCss(v.vulling);
      g.fill(p);
    }
    if (v.lijn && v.lijndikte > 0) {
      g.strokeStyle = kleurCss(v.lijn);
      const breedte = v.lijndikte * sx;
      g.lineWidth = Math.max(0.5, breedte);
      if (breedte < 0.5) g.globalAlpha *= Math.max(0.25, breedte / 0.5);
      g.lineCap = 'round';
      g.stroke(p);
    }
    g.globalAlpha = 1;
  };
  vormen.forEach(loop);
  g.strokeStyle = vexel.thema.accent;
  g.globalAlpha = 0.9;
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.strokeRect(ox + 0.5, oy + 0.5, tg.b * sx - 1, tg.h * sx - 1);
  g.setLineDash([]);
  g.globalAlpha = 1;
}

/** Meng twee CMYK-kleuren; t van 0 tot 1. */
const meng = (a, b, t) => a.map((v, i) => Math.round((v + (b[i] - v) * t) * 10) / 10);

// ---- vormpjes ---------------------------------------------------------------

const KAPPA = 0.5523;

/** Een ellips als subpad met vier punten, eventueel gedraaid (hoek in radialen). */
function ellipsSubpad(cx, cy, rx, ry, hoek = 0) {
  const c = Math.cos(hoek);
  const s = Math.sin(hoek);
  const P = (x, y) => ({ x: rond(cx + x * c - y * s), y: rond(cy + x * s + y * c) });
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return { gesloten: true, punten: [
    { ...P(rx, 0), in: P(rx, -ky), uit: P(rx, ky) },
    { ...P(0, ry), in: P(kx, ry), uit: P(-kx, ry) },
    { ...P(-rx, 0), in: P(-rx, ky), uit: P(-rx, -ky) },
    { ...P(0, -ry), in: P(-kx, -ry), uit: P(kx, -ry) },
  ] };
}
const cirkel = (cx, cy, r) => ellipsSubpad(cx, cy, r, r);

/** Knipt een veelhoek af op een rechthoek (de rechthoek is bol, dus dat kan rand voor rand). */
function knipOpVak(punten, vak) {
  const randen = [
    [(p) => p.x >= vak.x, (a, b) => (vak.x - a.x) / (b.x - a.x)],
    [(p) => p.x <= vak.x + vak.b, (a, b) => (vak.x + vak.b - a.x) / (b.x - a.x)],
    [(p) => p.y >= vak.y, (a, b) => (vak.y - a.y) / (b.y - a.y)],
    [(p) => p.y <= vak.y + vak.h, (a, b) => (vak.y + vak.h - a.y) / (b.y - a.y)],
  ];
  let lijst = punten;
  for (const [binnen, snij] of randen) {
    const uit = [];
    for (let i = 0; i < lijst.length; i++) {
      const a = lijst[i];
      const b = lijst[(i + 1) % lijst.length];
      const ai = binnen(a);
      const bi = binnen(b);
      if (ai) uit.push(a);
      if (ai !== bi) {
        const t = snij(a, b);
        uit.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    lijst = uit;
    if (lijst.length < 3) return null;
  }
  return lijst;
}

/** Een zachte vlek: een gedraaide ellips; steekt hij buiten het vak, dan als afgeknipte veelhoek. */
function vlekSubpad(cx, cy, rx, ry, hoek, vak) {
  const c = Math.cos(hoek);
  const s = Math.sin(hoek);
  const punten = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    punten.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  }
  // Helemaal binnen het vak: een gewone ellips met vier punten is genoeg.
  const erin = (p) => p.x >= vak.x && p.x <= vak.x + vak.b && p.y >= vak.y && p.y <= vak.y + vak.h;
  if (punten.every(erin)) return ellipsSubpad(cx, cy, rx, ry, hoek);
  const binnen = knipOpVak(punten, vak);
  return binnen ? { gesloten: true, punten: binnen.map((p) => ({ x: rond(p.x), y: rond(p.y) })) } : null;
}

/** Een twinkel: een sterretje met vier punten en holle zijden. */
function twinkelSubpad(cx, cy, r, hoek) {
  const punten = [];
  for (let i = 0; i < 4; i++) {
    const a = hoek + (i * Math.PI) / 2;
    const lang = i % 2 ? r * 0.72 : r;
    const p = { x: cx + Math.cos(a) * lang, y: cy + Math.sin(a) * lang };
    const binnen = r * 0.1;
    const vorige = a - Math.PI / 4;
    const volgende = a + Math.PI / 4;
    punten.push({
      x: rond(p.x), y: rond(p.y),
      in: { x: rond(cx + Math.cos(vorige) * binnen), y: rond(cy + Math.sin(vorige) * binnen) },
      uit: { x: rond(cx + Math.cos(volgende) * binnen), y: rond(cy + Math.sin(volgende) * binnen) },
    });
  }
  return { gesloten: true, punten };
}

/**
 * Het verlichte deel van de maan. `f` is het verlichte deel (0 tot 1), `kant` 1 als de rechterkant
 * verlicht is (wassend) en -1 voor links (afnemend). De rand is een halve cirkel, de schaduwgrens
 * een halve ellips.
 */
function maanSubpad(cx, cy, r, f, kant) {
  const k = 1 - 2 * f;
  const K = r * KAPPA;
  const X = (d) => rond(cx + kant * d);
  return { gesloten: true, punten: [
    { x: X(0), y: rond(cy - r), in: { x: X(k * K), y: rond(cy - r) }, uit: { x: X(K), y: rond(cy - r) } },
    { x: X(r), y: rond(cy), in: { x: X(r), y: rond(cy - K) }, uit: { x: X(r), y: rond(cy + K) } },
    { x: X(0), y: rond(cy + r), in: { x: X(K), y: rond(cy + r) }, uit: { x: X(k * K), y: rond(cy + r) } },
    { x: X(k * r), y: rond(cy), in: { x: X(k * r), y: rond(cy + K) }, uit: { x: X(k * r), y: rond(cy - K) } },
  ] };
}

// ---- sterrenbeelden ---------------------------------------------------------
// Eigen, sterk vereenvoudigde schetsen van bekende sterrenbeelden: per ster een plek in een
// vak van 1 bij 1 (y omlaag) en een helderheid (3 = helderst), en welke sterren verbonden zijn.
// Zelf uitgezet naar het beeld aan de hemel; geen overgenomen sterrencatalogus.

const STERRENBEELDEN = [
  { naam: 'Grote Beer', sterren: [[0, 0.3, 2], [0.17, 0.2, 2], [0.31, 0.23, 2], [0.46, 0.3, 1], [0.5, 0.56, 2], [0.86, 0.56, 2], [0.9, 0.24, 3]],
    lijnen: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { naam: 'Orion', sterren: [[0.2, 0.08, 3], [0.68, 0.14, 2], [0.42, -0.08, 1], [0.37, 0.5, 2], [0.45, 0.47, 2], [0.53, 0.44, 2],
    [0.27, 0.92, 2], [0.76, 0.86, 3], [0.06, 0.3, 1], [0.86, 0.35, 1]],
  lijnen: [[0, 2], [2, 1], [0, 3], [1, 5], [3, 4], [4, 5], [3, 6], [5, 7], [0, 8], [1, 9]] },
  { naam: 'Cassiopeia', sterren: [[0, 0.32, 2], [0.24, 0.62, 2], [0.47, 0.4, 3], [0.72, 0.6, 2], [0.96, 0.28, 2]],
    lijnen: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { naam: 'Zwaan', sterren: [[0.46, 0, 3], [0.5, 0.36, 2], [0.55, 0.66, 1], [0.6, 1, 2], [0.08, 0.2, 2], [0.27, 0.29, 1], [0.74, 0.44, 1], [0.94, 0.6, 2]],
    lijnen: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 1], [1, 6], [6, 7]] },
  { naam: 'Leeuw', sterren: [[0.02, 0.84, 3], [0.06, 0.58, 1], [0.16, 0.42, 2], [0.12, 0.22, 1], [0.26, 0.08, 1], [0.37, 0.16, 1],
    [0.66, 0.38, 2], [0.98, 0.62, 2], [0.64, 0.66, 1]],
  lijnen: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 8], [8, 0], [6, 8]] },
  { naam: 'Schorpioen', sterren: [[0.02, 0.02, 1], [0.06, 0.18, 2], [0.1, 0.34, 1], [0.3, 0.32, 3], [0.38, 0.44, 1], [0.44, 0.6, 1],
    [0.47, 0.77, 1], [0.56, 0.92, 2], [0.72, 0.98, 1], [0.86, 0.9, 2], [0.9, 0.76, 2], [0.8, 0.7, 1]],
  lijnen: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11]] },
  { naam: 'Kleine Beer', sterren: [[0, 0.04, 3], [0.2, 0.16, 1], [0.36, 0.32, 1], [0.55, 0.38, 1], [0.6, 0.66, 2], [0.9, 0.7, 1], [0.86, 0.42, 2]],
    lijnen: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
];

// ---- de hemel ---------------------------------------------------------------

const HEMELS = {
  middernacht: { naam: 'Middernacht', stops: [[95, 82, 42, 62], [88, 66, 30, 30]], ster: [0, 2, 10, 0],
    nevel: [[45, 35, 0, 0], [20, 45, 0, 0], [55, 10, 5, 0]], lijn: [35, 12, 0, 0] },
  schemering: { naam: 'Schemering', stops: [[95, 85, 40, 58], [80, 85, 20, 20], [30, 75, 30, 0], [0, 45, 50, 0]], ster: [0, 2, 10, 0],
    nevel: [[30, 50, 0, 0], [10, 50, 10, 0], [50, 25, 0, 0]], lijn: [15, 20, 0, 0] },
  blauwuur: { naam: 'Blauw uur', stops: [[100, 80, 25, 40], [95, 55, 10, 5], [65, 25, 5, 0]], ster: [0, 0, 6, 0],
    nevel: [[40, 15, 0, 0], [25, 30, 0, 0], [60, 5, 10, 0]], lijn: [25, 5, 0, 0] },
  inkt: { naam: 'Inktzwart', stops: [[75, 68, 60, 88]], ster: [0, 0, 4, 0],
    nevel: [[30, 25, 15, 0], [20, 20, 30, 0], [40, 20, 10, 0]], lijn: [20, 15, 10, 0] },
};

const FASEN = {
  geen: { naam: 'Geen maan' },
  sikkel: { naam: 'Wassende sikkel', f: 0.18, kant: 1 },
  eerste: { naam: 'Eerste kwartier', f: 0.5, kant: 1 },
  wassend: { naam: 'Wassende maan', f: 0.78, kant: 1 },
  vol: { naam: 'Volle maan', f: 1, kant: 1 },
  afnemend: { naam: 'Afnemende maan', f: 0.78, kant: -1 },
  laatste: { naam: 'Laatste kwartier', f: 0.5, kant: -1 },
  oudesikkel: { naam: 'Afnemende sikkel', f: 0.18, kant: -1 },
};

const STANDAARD = {
  gebied: 'afloop', hemel: 'middernacht', verloop: true, dichtheid: 140, grootte: 100, twinkels: 9, melkweg: 60, hoek: -32,
  beelden: 4, namen: false, fase: 'sikkel', maan: 30, zaad: 1969, achteraan: true,
};

/** Kleur van de hemel op hoogte t (0 boven, 1 onder). */
function hemelKleur(stops, t) {
  if (stops.length === 1) return stops[0].slice();
  const s = begrens(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(s));
  return meng(stops[i], stops[i + 1], s - i);
}

/** Alle vormen; `vak` is het gebied in pt. */
function maakHemel(w, vak, cmyk) {
  const hemel = HEMELS[w.hemel] || HEMELS.middernacht;
  const K = (c) => alsKleur(c, cmyk);
  const kans = willekeur(w.zaad);
  const ruis = maakVeldRuis(w.zaad + 5, 3);
  const korte = Math.min(vak.b, vak.h);
  const groot = w.grootte / 100;
  const cx = vak.x + vak.b / 2;
  const cy = vak.y + vak.h / 2;
  const kinderen = [];

  // Achtergrond: één vlak of banden die van kleur verlopen.
  const banden = [];
  const n = w.verloop && hemel.stops.length > 1 ? (hemel.stops.length > 2 ? 96 : 64) : 1;
  for (let i = 0; i < n; i++) {
    const y0 = vak.y + (vak.h * i) / n;
    const h = vak.h / n + (i < n - 1 ? 1.5 : 0);
    banden.push({ soort: 'rechthoek', naam: n > 1 ? `Band ${i + 1}` : 'Hemel', x: rond(vak.x), y: rond(y0), b: rond(vak.b), h: rond(h),
      vulling: K(hemelKleur(w.verloop ? hemel.stops : [hemel.stops[0]], n > 1 ? (i + 0.5) / n : 0)), lijn: null, lijndikte: 0 });
  }
  kinderen.push(n > 1 ? { soort: 'groep', naam: 'Hemel', kinderen: banden } : banden[0]);

  // De maan, met wat vrije ruimte eromheen.
  const fase = FASEN[w.fase] || FASEN.geen;
  const mr = Math.min(vexel.mm(w.maan) / 2, korte * 0.2);
  const vrij = [];
  let maan = null;
  if (fase.f && mr > 0) {
    const mx = Math.min(vak.x + vak.b - mr * 1.4, vak.x + vak.b * (0.68 + kans() * 0.14));
    const my = vak.y + Math.max(mr * 1.6, vak.h * (0.14 + kans() * 0.08));
    maan = { x: mx, y: my, r: mr };
    vrij.push({ x: mx, y: my, r: mr * 1.9 });
  }

  // De melkweg: een licht gebogen band schuin over het vlak.
  const hoek = (w.hoek * Math.PI) / 180;
  const ux = Math.cos(hoek);
  const uy = Math.sin(hoek);
  const breedte = korte * 0.16;
  const lengte = Math.hypot(vak.b, vak.h);
  const bochtVan = (u) => Math.sin((u / lengte) * Math.PI * 1.3 + 0.6) * korte * 0.1;
  const inBand = (x, y) => {
    const u = (x - cx) * ux + (y - cy) * uy;
    const v = -(x - cx) * uy + (y - cy) * ux;
    return (v - bochtVan(u)) / breedte;
  };
  const melkweg = w.melkweg / 100;

  // Sterren in vier helderheden: per helderheid één samengesteld pad (of meer bij heel veel).
  const KLASSEN = [
    { naam: 'Sterren, zwak', r: 0.32, dekking: 0.55, deel: 0.56 },
    { naam: 'Sterren, klein', r: 0.55, dekking: 0.75, deel: 0.28 },
    { naam: 'Sterren, middel', r: 0.9, dekking: 0.92, deel: 0.12 },
    { naam: 'Sterren, helder', r: 1.45, dekking: 1, deel: 0.04 },
  ];
  const sterren = KLASSEN.map(() => []);
  const oppervlak = (vak.b / vexel.mm(100)) * (vak.h / vexel.mm(100));
  const aantal = Math.round(w.dichtheid * oppervlak);
  const klasseVan = () => {
    let r = kans();
    for (let i = 0; i < KLASSEN.length; i++) {
      r -= KLASSEN[i].deel;
      if (r <= 0) return i;
    }
    return 0;
  };
  const inMaan = (x, y, extra) => maan && Math.hypot(x - maan.x, y - maan.y) < maan.r + extra;
  const zet = (x, y, k) => {
    if (inMaan(x, y, 2)) return;
    const r = KLASSEN[k].r * groot * (0.85 + kans() * 0.3);
    sterren[k].push(cirkel(rond(x), rond(y), rond(r)));
  };
  for (let i = 0; i < aantal; i++) {
    const x = vak.x + kans() * vak.b;
    const y = vak.y + kans() * vak.h;
    // Iets minder sterren onderin, waar de hemel lichter is.
    if (w.verloop && kans() < ((y - vak.y) / vak.h) * 0.35) continue;
    zet(x, y, klasseVan());
  }
  const melkwegSterren = Math.round(aantal * melkweg * 2.8);
  let pogingen = 0;
  for (let i = 0; i < melkwegSterren && pogingen < melkwegSterren * 30; pogingen++) {
    const x = vak.x + kans() * vak.b;
    const y = vak.y + kans() * vak.h;
    const d = inBand(x, y);
    const dicht = Math.exp(-d * d * 1.6) * (0.25 + 0.75 * begrens((ruis(x / (korte * 0.18), y / (korte * 0.18)) + 1) / 2, 0, 1) ** 1.5);
    if (kans() > dicht) continue;
    i++;
    zet(x, y, kans() < 0.8 ? 0 : 1);
  }

  // Nevels langs de melkweg: veel zachte, gedraaide vlekken met weinig dekking over elkaar.
  const nevels = [];
  if (melkweg > 0) {
    const aantalNevels = Math.round(40 + 60 * melkweg);
    for (let i = 0; i < aantalNevels; i++) {
      const u = (kans() - 0.5) * lengte;
      const breed = i < aantalNevels * 0.3;
      const v = bochtVan(u) + (kans() + kans() + kans() - 1.5) * breedte * (breed ? 0.3 : 0.6);
      const x = cx + u * ux - v * uy;
      const y = cy + u * uy + v * ux;
      const rx = breedte * (breed ? 1.1 + kans() * 0.8 : 0.3 + kans() * 0.6);
      const sub = vlekSubpad(x, y, rx, rx * (0.3 + kans() * 0.3), hoek + (kans() - 0.5) * 0.5, vak);
      if (!sub) continue;
      const kleur = hemel.nevel[Math.floor(kans() * hemel.nevel.length)];
      nevels.push({ soort: 'pad', naam: `Nevel ${nevels.length + 1}`, subpaden: [sub],
        vulling: K(kleur), lijn: null, lijndikte: 0, dekking: rond((breed ? 0.035 : 0.045 + kans() * 0.04) * (0.5 + melkweg * 0.7)) });
    }
    // Een paar smalle, donkere stofbanen door het midden.
    for (let i = 0; i < Math.round(10 * melkweg); i++) {
      const u = (kans() - 0.5) * lengte * 0.8;
      const v = bochtVan(u) + (kans() - 0.5) * breedte * 0.25;
      const x = cx + u * ux - v * uy;
      const y = cy + u * uy + v * ux;
      const rx = breedte * (0.5 + kans() * 0.7);
      const sub = vlekSubpad(x, y, rx, rx * 0.09, hoek + (kans() - 0.5) * 0.25, vak);
      if (!sub) continue;
      const stof = hemelKleur(w.verloop ? hemel.stops : [hemel.stops[0]], (y - vak.y) / vak.h);
      stof[3] = Math.min(100, stof[3] + 25);
      nevels.push({ soort: 'pad', naam: `Stofbaan ${i + 1}`, subpaden: [sub], vulling: K(stof), lijn: null, lijndikte: 0, dekking: 0.16 });
    }
    kinderen.push({ soort: 'groep', naam: 'Melkweg', kinderen: nevels });
  }

  // Sterrenbeelden: verspreid, niet over elkaar en niet over de maan.
  const beelden = [];
  const volgorde = STERRENBEELDEN.map((_, i) => i);
  for (let i = volgorde.length - 1; i > 0; i--) {
    const j = Math.floor(kans() * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }
  const lijnKleur = K(hemel.lijn);
  const sterKleur = K(hemel.ster);
  for (const index of volgorde.slice(0, w.beelden)) {
    const beeld = STERRENBEELDEN[index];
    let plek = null;
    let punten = null;
    const fijn = begrens(korte / 500, 0.45, 1.3);
    for (let poging = 0; poging < 120 && !plek; poging++) {
      const maat = korte * (0.2 + kans() * 0.1) * (w.beelden > 4 ? 0.85 : 1);
      const px = vak.x + maat * 0.65 + kans() * (vak.b - maat * 1.3);
      const py = vak.y + maat * 0.65 + kans() * (vak.h - maat * 1.3);
      const r = maat * 0.72;
      if (!vrij.every((o) => Math.hypot(o.x - px, o.y - py) > o.r + r)) continue;
      const draai = (kans() - 0.5) * 0.7;
      const c = Math.cos(draai);
      const s = Math.sin(draai);
      const lijst = beeld.sterren.map(([x, y, helder]) => {
        const lx = (x - 0.5) * maat;
        const ly = (y - 0.5) * maat;
        return { x: px + lx * c - ly * s, y: py + lx * s + ly * c, r: (0.9 + helder * 0.75) * groot * fijn };
      });
      const rand = 4;
      if (lijst.every((p) => p.x > vak.x + rand && p.x < vak.x + vak.b - rand && p.y > vak.y + rand && p.y < vak.y + vak.h - rand)) {
        plek = { x: px, y: py, r, maat };
        punten = lijst;
      }
    }
    if (!plek) continue;
    vrij.push(plek);
    const lijnen = beeld.lijnen.map(([a, b]) => {
      const p = punten[a];
      const q = punten[b];
      const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const ta = Math.min(0.4, (p.r + 2.2) / l);
      const tb = Math.min(0.4, (q.r + 2.2) / l);
      return { gesloten: false, punten: [
        { x: rond(p.x + (q.x - p.x) * ta), y: rond(p.y + (q.y - p.y) * ta) },
        { x: rond(q.x + (p.x - q.x) * tb), y: rond(q.y + (p.y - q.y) * tb) },
      ] };
    });
    const delen = [
      { soort: 'pad', naam: 'Lijnen', subpaden: lijnen, vulling: null, lijn: lijnKleur, lijndikte: rond(0.5 * groot * begrens(korte / 500, 0.6, 1.5)), lijneinde: 'round', dekking: 0.6 },
      { soort: 'pad', naam: 'Sterren', subpaden: punten.map((p) => cirkel(rond(p.x), rond(p.y), rond(p.r))), vulling: sterKleur, lijn: null, lijndikte: 0 },
    ];
    if (w.namen) {
      const onder = Math.max(...punten.map((p) => p.y));
      delen.push({ soort: 'tekst', naam: 'Naam', x: rond(plek.x), y: rond(Math.min(vak.y + vak.h - 6, onder + 12)), inhoud: beeld.naam.toUpperCase(),
        grootte: rond(begrens(korte * 0.016, 5, 11)), gewicht: 500, letterafstand: 180, uitlijning: 'midden', vulling: lijnKleur, dekking: 0.75 });
    }
    beelden.push({ soort: 'groep', naam: beeld.naam, kinderen: delen });
  }

  // Twinkels: een paar heldere sterren met vier punten en een zachte gloed.
  const twinkels = [];
  for (let i = 0; i < w.twinkels; i++) {
    let x = 0;
    let y = 0;
    for (let poging = 0; poging < 30; poging++) {
      x = vak.x + vak.b * (0.04 + kans() * 0.92);
      y = vak.y + vak.h * (0.04 + kans() * 0.92);
      if (vrij.every((o) => Math.hypot(o.x - x, o.y - y) > o.r * 0.8)) break;
    }
    const r = (3 + kans() * kans() * 6) * groot * begrens(korte / 500, 0.45, 2);
    twinkels.push({ soort: 'groep', naam: `Twinkel ${i + 1}`, kinderen: [
      { soort: 'pad', naam: 'Gloed', subpaden: [cirkel(rond(x), rond(y), rond(r * 0.55))], vulling: sterKleur, lijn: null, lijndikte: 0, dekking: 0.18 },
      { soort: 'pad', naam: 'Ster', subpaden: [twinkelSubpad(x, y, r, (kans() - 0.5) * 0.3 - Math.PI / 2)], vulling: sterKleur, lijn: null, lijndikte: 0 },
    ] });
  }

  // Sterren als samengestelde paden, hooguit 1000 cirkels per pad.
  const sterGroep = [];
  sterren.forEach((lijst, k) => {
    for (let i = 0; i < lijst.length; i += GRENS.subpaden) {
      sterGroep.push({ soort: 'pad', naam: KLASSEN[k].naam + (lijst.length > GRENS.subpaden ? ` (${i / GRENS.subpaden + 1})` : ''),
        subpaden: lijst.slice(i, i + GRENS.subpaden), vulling: sterKleur, lijn: null, lijndikte: 0, dekking: KLASSEN[k].dekking });
    }
  });
  if (sterGroep.length) kinderen.push({ soort: 'groep', naam: 'Sterren', kinderen: sterGroep });
  if (twinkels.length) kinderen.push({ soort: 'groep', naam: 'Twinkels', kinderen: twinkels });
  if (beelden.length) kinderen.push({ soort: 'groep', naam: 'Sterrenbeelden', kinderen: beelden });

  if (maan) {
    const maanKleur = meng(hemel.ster, [0, 6, 22, 0], 0.6);
    const delen = [];
    // De gloed blijft binnen het vak.
    const ruimte = Math.min(maan.x - vak.x, vak.x + vak.b - maan.x, maan.y - vak.y, vak.y + vak.h - maan.y);
    for (let i = 6; i >= 1; i--) {
      const gr = Math.min(maan.r * (1 + i * 0.13), ruimte);
      if (gr <= maan.r * 1.02) continue;
      delen.push({ soort: 'ellips', naam: `Gloed ${i}`, cx: rond(maan.x), cy: rond(maan.y), rx: rond(gr), ry: rond(gr),
        vulling: K(maanKleur), lijn: null, lijndikte: 0, dekking: 0.028 });
    }
    // Het donkere deel, net iets lichter dan de hemel (aardschijn).
    delen.push({ soort: 'ellips', naam: 'Schaduwkant', cx: rond(maan.x), cy: rond(maan.y), rx: rond(maan.r), ry: rond(maan.r),
      vulling: K(meng(hemelKleur(hemel.stops, (maan.y - vak.y) / vak.h), maanKleur, 0.14)), lijn: null, lijndikte: 0 });
    delen.push({ soort: 'pad', naam: 'Verlicht', subpaden: [maanSubpad(maan.x, maan.y, maan.r, fase.f, fase.kant)], vulling: K(maanKleur), lijn: null, lijndikte: 0 });
    // Kraters, alleen op het verlichte deel.
    const k = 1 - 2 * fase.f;
    const verlicht = (x, y) => {
      const dy = (y - maan.y) / maan.r;
      const dx = (x - maan.x) / maan.r;
      return dx * dx + dy * dy < 0.92 && fase.kant * dx > k * Math.sqrt(Math.max(0, 1 - dy * dy)) + 0.04;
    };
    const kraters = [];
    for (let i = 0; i < 40 && kraters.length < 7; i++) {
      const a = kans() * Math.PI * 2;
      const d = Math.sqrt(kans()) * maan.r * 0.8;
      const x = maan.x + Math.cos(a) * d;
      const y = maan.y + Math.sin(a) * d;
      const r = maan.r * (0.06 + kans() * 0.12);
      const rand = [0, 1, 2, 3, 4, 5].every((j) => verlicht(x + Math.cos(j * 1.05) * r, y + Math.sin(j * 1.05) * r));
      if (rand && kraters.every((q) => Math.hypot(q.x - x, q.y - y) > q.r + r)) kraters.push({ x, y, r });
    }
    if (kraters.length) {
      delen.push({ soort: 'pad', naam: 'Kraters', subpaden: kraters.map((q) => ellipsSubpad(q.x, q.y, q.r, q.r * 0.9, kans())),
        vulling: K(meng(maanKleur, [10, 15, 30, 10], 0.7)), lijn: null, lijndikte: 0, dekking: 0.55 });
    }
    kinderen.push({ soort: 'groep', naam: `Maan (${fase.naam.toLowerCase()})`, kinderen: delen });
  }

  const totaalSterren = sterren.reduce((s, l) => s + l.length, 0);
  return { vormen: [{ soort: 'groep', naam: 'Sterrenhemel', kinderen }], sterren: totaalSterren, beelden: beelden.length };
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const opgeslagen = await vexel.haal('instellingen');
  const w0 = { ...STANDAARD, ...(opgeslagen || {}) };
  let selectie = [];
  try {
    selectie = await vexel.selectie();
  } catch (fout) {
    selectie = [];
  }

  const velden = {
    gebied: keuzeVeld({ afloop: 'Tekengebied met afloop', tekengebied: 'Tekengebied', selectie: 'Selectie (het kader)' }, w0.gebied),
    hemel: keuzeVeld(Object.fromEntries(Object.entries(HEMELS).map(([k, v]) => [k, v.naam])), w0.hemel),
    dichtheid: getalVeld(w0.dichtheid, 0, 2000, 10),
    grootte: getalVeld(w0.grootte, 20, 400, 10),
    twinkels: getalVeld(w0.twinkels, 0, 100, 1),
    melkweg: getalVeld(w0.melkweg, 0, 100, 10),
    hoek: getalVeld(w0.hoek, -180, 180, 5),
    beelden: getalVeld(w0.beelden, 0, STERRENBEELDEN.length, 1),
    fase: keuzeVeld(Object.fromEntries(Object.entries(FASEN).map(([k, v]) => [k, v.naam])), w0.fase),
    maan: getalVeld(w0.maan, 2, 400, 1),
    zaad: getalVeld(w0.zaad, 1, 999999, 1),
  };
  const vink = (aan) => {
    const v = maak('input', { type: 'checkbox' });
    v.checked = aan;
    return v;
  };
  const verloop = vink(w0.verloop !== false);
  const namen = vink(Boolean(w0.namen));
  const achteraan = vink(w0.achteraan !== false);
  const vinkje = (vak, tekst) => maak('label', { klasse: 'rij', stijl: { margin: '0', gap: '6px', flex: 'none' } }, vak, maak('span', { tekst }));
  const stalen = maak('span', { 'aria-hidden': 'true', stijl: { display: 'flex', gap: '2px', flex: 'none' } });
  const anders = maak('button', { klasse: 'knop', type: 'button', tekst: 'Anders', title: 'Een ander zaadje: dezelfde instellingen, een andere hemel',
    stijl: { flex: 'none' },
    bijClick: () => {
      velden.zaad.value = String(1 + Math.floor(Math.random() * 999998));
      plan();
    } });

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '230px', borderRadius: '6px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '30px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Sterrenhemel maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const achteraanRij = vinkje(achteraan, 'Achteraan in de laag');
  const maanRij = maak('span', { klasse: 'rij', stijl: { margin: '0', gap: '8px', flex: '1' } },
    maak('span', { klasse: 'uitleg', tekst: 'Grootte' }), velden.maan, maak('span', { klasse: 'uitleg', tekst: 'mm' }));
  Object.assign(velden.maan.style, { width: '64px', flex: 'none' });

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Vullen', velden.gebied),
    regel('Hemel', velden.hemel, stalen, vinkje(verloop, 'Verloop')),
    twee(regel('Sterren', velden.dichtheid, 'per dm²'), regel('Stergrootte', velden.grootte, '%')),
    twee(regel('Melkweg', velden.melkweg, '%'), regel('Hoek', velden.hoek, '°')),
    twee(regel('Twinkels', velden.twinkels), regel('Beelden', velden.beelden, vinkje(namen, 'Namen'))),
    regel('Maan', velden.fase, maanRij),
    regel('Zaadje', velden.zaad, anders),
    maak('div', { klasse: 'rij', stijl: { margin: '0' } }, achteraanRij),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    gebied: velden.gebied.value,
    hemel: velden.hemel.value,
    verloop: verloop.checked,
    dichtheid: begrens(leesGetal(velden.dichtheid, STANDAARD.dichtheid), 0, 2000),
    grootte: begrens(leesGetal(velden.grootte, STANDAARD.grootte), 20, 400),
    twinkels: Math.round(begrens(leesGetal(velden.twinkels, STANDAARD.twinkels), 0, 100)),
    melkweg: begrens(leesGetal(velden.melkweg, STANDAARD.melkweg), 0, 100),
    hoek: begrens(leesGetal(velden.hoek, STANDAARD.hoek), -180, 180),
    beelden: Math.round(begrens(leesGetal(velden.beelden, STANDAARD.beelden), 0, STERRENBEELDEN.length)),
    namen: namen.checked,
    fase: velden.fase.value,
    maan: begrens(leesGetal(velden.maan, STANDAARD.maan), 2, 400),
    zaad: Math.round(begrens(leesGetal(velden.zaad, 1), 1, 999999)),
    achteraan: achteraan.checked,
  });

  const gebiedVan = (w, items) => {
    const tg = doc.tekengebied;
    if (w.gebied === 'tekengebied') return { x: 0, y: 0, b: tg.b, h: tg.h };
    if (w.gebied === 'afloop') {
      const a = doc.afloop || { boven: 0, rechts: 0, onder: 0, links: 0 };
      return { x: -a.links, y: -a.boven, b: tg.b + a.links + a.rechts, h: tg.h + a.boven + a.onder };
    }
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Vullen.' };
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    if (!(x1 - x0 > 10) || !(y1 - y0 > 10)) return { fout: 'De selectie is te klein voor een sterrenhemel.' };
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  };

  function bouw(w, items) {
    const gebied = gebiedVan(w, items);
    if (gebied.fout) return gebied;
    const uitkomst = maakHemel(w, gebied, cmyk);
    const t = tel(uitkomst.vormen);
    if (t.punten > GRENS.punten || t.vormen > GRENS.vormen) {
      return { fout: `Te veel sterren (${getal(uitkomst.sterren, 0)}; hooguit ongeveer 11.000). Kies minder sterren per dm² of minder melkweg.`, gebied };
    }
    return { ...uitkomst, gebied, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    achteraanRij.style.visibility = w.gebied === 'selectie' ? 'hidden' : '';
    maanRij.style.visibility = w.fase === 'geen' ? 'hidden' : '';
    const hemel = HEMELS[w.hemel] || HEMELS.middernacht;
    stalen.replaceChildren(...hemel.stops.map((c) => maak('span', { stijl: {
      width: '10px', height: '18px', borderRadius: '3px', border: '1px solid var(--lijn)', background: kleurCss({ cmyk: c }) } })));
    const uitkomst = bouw(w, selectie);
    const g = uitkomst.gebied;
    const zicht = !g ? null : {
      x: Math.min(0, g.x), y: Math.min(0, g.y),
      b: Math.max(doc.tekengebied.b, g.x + g.b) - Math.min(0, g.x),
      h: Math.max(doc.tekengebied.h, g.y + g.h) - Math.min(0, g.y),
    };
    tekenVoorbeeld(doek, doc, uitkomst.vormen || [], zicht);
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout) || doc.alleenLezen);
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      const fase = FASEN[w.fase] || FASEN.geen;
      samenvatting.textContent = `${getal(uitkomst.sterren, 0)} sterren, ${uitkomst.beelden} sterrenbeeld${uitkomst.beelden === 1 ? '' : 'en'}, `
        + `${w.twinkels} twinkel${w.twinkels === 1 ? '' : 's'}${fase.f ? ', ' + fase.naam.toLowerCase() : ''} `
        + `(${getal(g.b / vexel.mm(1), 0)} × ${getal(g.h / vexel.mm(1), 0)} mm).`;
    }
  }
  function plan() {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  }

  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    maakKnop.disabled = true;
    try {
      const items = w.gebied === 'selectie' ? await vexel.selectie() : [];
      const uitkomst = bouw(w, items);
      if (uitkomst.fout) {
        vexel.melding(uitkomst.fout, 'let');
        maakKnop.disabled = false;
        return;
      }
      // In de selectie komt de hemel bovenop de vorm, anders zou de vorm hem afdekken.
      await vexel.maak(uitkomst.vormen, w.achteraan && w.gebied !== 'selectie' ? { achteraan: true } : undefined);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Sterrenhemel gemaakt: ${getal(uitkomst.sterren, 0)} sterren.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De sterrenhemel kon niet worden gemaakt.', 'fout');
    }
  });

  if (velden.gebied.value === 'selectie' && !selectie.length) velden.gebied.value = 'afloop';
  else if (selectie.length && !opgeslagen) velden.gebied.value = 'selectie';
  teken();
  velden.dichtheid.focus();
  velden.dichtheid.select();
}

vexel.opCommando('maken', toonVenster);
