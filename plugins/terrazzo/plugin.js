// Terrazzo: stenen snippers, confetti-steen of marmer-aders als achtergrond, zonder overlap.
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

// ---- krommen --------------------------------------------------------------

/** Een vloeiende open kromme door de punten (handvatten volgens Catmull-Rom). */
function kromme(punten) {
  const n = punten.length;
  return punten.map((p, i) => {
    const vorige = punten[Math.max(0, i - 1)];
    const volgende = punten[Math.min(n - 1, i + 1)];
    const deler = i === 0 || i === n - 1 ? 3 : 6;
    const tx = (volgende.x - vorige.x) / deler;
    const ty = (volgende.y - vorige.y) / deler;
    const q = { x: rond(p.x), y: rond(p.y) };
    if (i > 0) q.in = { x: rond(p.x - tx), y: rond(p.y - ty) };
    if (i < n - 1) q.uit = { x: rond(p.x + tx), y: rond(p.y + ty) };
    return q;
  });
}
const rond = (n) => Math.round(n * 100) / 100;

/** Dezelfde kromme achterstevoren: in en uit wisselen. */
const omgekeerd = (k) => k.slice().reverse().map((p) => {
  const q = { x: p.x, y: p.y };
  if (p.uit) q.in = p.uit;
  if (p.in) q.uit = p.in;
  return q;
});

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
    let p;
    if (v.soort === 'pad') p = padVanSubpaden(v.subpaden, sx, ox, oy);
    else if (v.soort === 'rechthoek') {
      p = new Path2D();
      p.rect(ox + v.x * sx, oy + v.y * sx, v.b * sx, v.h * sx);
    } else return;
    g.globalAlpha = v.dekking === undefined ? 1 : v.dekking;
    if (v.vulling) {
      g.fillStyle = kleurCss(v.vulling);
      g.fill(p);
    }
    if (v.lijn && v.lijndikte > 0) {
      g.strokeStyle = kleurCss(v.lijn);
      const breedte = v.lijndikte * sx;
      g.lineWidth = Math.max(0.5, breedte);
      if (breedte < 0.5) g.globalAlpha *= Math.max(0.2, breedte / 0.5);
      g.lineJoin = 'round';
      g.lineCap = v.lijneinde === 'round' ? 'round' : 'butt';
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


/** Een taps lint rond de punten: links heen, rechts terug, als gesloten subpad. */
function lint(punten, breedtes) {
  const n = punten.length;
  const links = [];
  const rechts = [];
  for (let i = 0; i < n; i++) {
    const a = punten[Math.max(0, i - 1)];
    const b = punten[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const h = breedtes[i] / 2;
    links.push({ x: punten[i].x - ty * h, y: punten[i].y + tx * h });
    rechts.push({ x: punten[i].x + ty * h, y: punten[i].y - tx * h });
  }
  const kl = kromme(links);
  const kr = omgekeerd(kromme(rechts));
  // Een punt van nul breedte delen links en rechts: niet dubbel opnemen.
  if (breedtes[n - 1] < 0.02) kr.shift();
  if (breedtes[0] < 0.02) kr.pop();
  return { gesloten: true, punten: [...kl, ...kr] };
}

/** Alle vormen; `vak` is het gebied in pt. */

// ---- vormhulpjes ------------------------------------------------------------

/** Een gesloten vloeiende kromme door de punten; `strak` 0 = rond, 1 = hoekig (geen handvatten). */
function geslotenKromme(punten, strak) {
  const n = punten.length;
  const f = (1 - strak) / 6;
  return punten.map((p, i) => {
    const q = { x: rond(p.x), y: rond(p.y) };
    if (f > 0.001) {
      const vorige = punten[(i - 1 + n) % n];
      const volgende = punten[(i + 1) % n];
      const tx = (volgende.x - vorige.x) * f;
      const ty = (volgende.y - vorige.y) * f;
      q.in = { x: rond(p.x - tx), y: rond(p.y - ty) };
      q.uit = { x: rond(p.x + tx), y: rond(p.y + ty) };
    }
    return q;
  });
}

/** De kromme als rechte stukjes (voor het knippen aan de rand). */
function plat(subpad) {
  const p = subpad.punten;
  const n = p.length;
  const uit = [];
  const eind = subpad.gesloten ? n : n - 1;
  uit.push({ x: p[0].x, y: p[0].y });
  for (let i = 1; i <= eind; i++) {
    const a = p[i - 1];
    const b = p[i % n];
    if (a.uit || b.in) {
      const c1 = a.uit || a;
      const c2 = b.in || b;
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        const u = 1 - t;
        uit.push({
          x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
          y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
        });
      }
    } else uit.push({ x: b.x, y: b.y });
  }
  if (subpad.gesloten) uit.pop();
  return uit;
}

/** Knipt een veelhoek af op een rechthoek (randen een voor een). */
function knipVeelhoek(punten, vak) {
  const randen = [
    (p) => p.x >= vak.x, (p) => p.x <= vak.x + vak.b, (p) => p.y >= vak.y, (p) => p.y <= vak.y + vak.h,
  ];
  const snij = [vak.x, vak.x + vak.b, vak.y, vak.y + vak.h];
  let lijst = punten;
  for (let r = 0; r < 4; r++) {
    if (!lijst.length) break;
    const binnen = randen[r];
    const nieuw = [];
    for (let i = 0; i < lijst.length; i++) {
      const a = lijst[i];
      const b = lijst[(i + 1) % lijst.length];
      const ia = binnen(a);
      const ib = binnen(b);
      if (ia) nieuw.push(a);
      if (ia !== ib) {
        const grens = snij[r];
        if (r < 2) {
          const t = (grens - a.x) / (b.x - a.x);
          nieuw.push({ x: grens, y: a.y + (b.y - a.y) * t });
        } else {
          const t = (grens - a.y) / (b.y - a.y);
          nieuw.push({ x: a.x + (b.x - a.x) * t, y: grens });
        }
      }
    }
    lijst = nieuw;
  }
  return lijst;
}

const oppervlak = (pt) => {
  let s = 0;
  for (let i = 0; i < pt.length; i++) {
    const a = pt[i];
    const b = pt[(i + 1) % pt.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
};

/** Houdt een gesloten subpad binnen het vak: wat over de rand steekt, wordt afgeknipt. */
function binnenVak(subpad, vak) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of subpad.punten) {
    for (const q of [p, p.in, p.uit]) {
      if (!q) continue;
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
    }
  }
  if (x0 >= vak.x && y0 >= vak.y && x1 <= vak.x + vak.b && y1 <= vak.y + vak.h) return subpad;
  if (x1 < vak.x || y1 < vak.y || x0 > vak.x + vak.b || y0 > vak.y + vak.h) return null;
  const geknipt = knipVeelhoek(plat(subpad), vak);
  if (geknipt.length < 3 || oppervlak(geknipt) < 0.5) return null;
  // Punten die bijna samenvallen, weglaten.
  const schoon = geknipt.filter((p, i) => {
    const v = geknipt[(i - 1 + geknipt.length) % geknipt.length];
    return Math.abs(p.x - v.x) + Math.abs(p.y - v.y) > 0.05;
  });
  if (schoon.length < 3) return null;
  return { gesloten: true, punten: schoon.map((p) => ({ x: rond(p.x), y: rond(p.y) })) };
}

/** Kiest een index volgens de gewichten. */
function kiesGewogen(gewichten, kans) {
  const som = gewichten.reduce((a, b) => a + b, 0);
  let r = kans() * som;
  for (let i = 0; i < gewichten.length; i++) {
    r -= gewichten[i];
    if (r <= 0) return i;
  }
  return gewichten.length - 1;
}

// ---- paletten -------------------------------------------------------------
// Alles in CMYK; in een RGB-document wordt het omgerekend. Bij marmer: kleur 1 is de hoofdader,
// kleur 2 de haarlijnen, kleur 3 de wolken.

const PALETTEN = {
  terrazzo: {
    klassiek: { naam: 'Klassiek', achtergrond: [0, 4, 12, 2],
      kleuren: [[5, 70, 80, 20], [35, 12, 40, 30], [0, 28, 85, 8], [60, 50, 45, 80], [0, 32, 30, 4], [20, 8, 8, 30]],
      gewichten: [3, 3, 2, 2, 2, 2] },
    blos: { naam: 'Blos', achtergrond: [0, 18, 16, 0],
      kleuren: [[0, 70, 55, 10], [0, 8, 20, 0], [45, 15, 30, 25], [0, 35, 70, 0], [20, 60, 30, 45]], gewichten: [3, 3, 2, 2, 1] },
    donker: { naam: 'Antraciet', achtergrond: [70, 60, 55, 70],
      kleuren: [[0, 5, 15, 0], [0, 25, 70, 5], [0, 55, 55, 10], [30, 10, 20, 30], [10, 5, 5, 45]], gewichten: [3, 2, 2, 2, 2] },
    salie: { naam: 'Salie', achtergrond: [25, 5, 25, 5],
      kleuren: [[65, 25, 60, 35], [0, 5, 12, 0], [0, 45, 50, 5], [55, 40, 30, 60], [0, 20, 55, 0]], gewichten: [3, 3, 2, 2, 2] },
    zee: { naam: 'Zee', achtergrond: [8, 0, 3, 0],
      kleuren: [[95, 50, 25, 25], [55, 0, 20, 0], [0, 15, 35, 0], [0, 55, 45, 0], [30, 10, 0, 0]], gewichten: [3, 3, 2, 1, 2] },
  },
  confetti: {
    fel: { naam: 'Fel', achtergrond: [0, 2, 6, 0],
      kleuren: [[0, 80, 75, 5], [0, 38, 95, 0], [80, 30, 5, 5], [60, 10, 85, 10], [5, 72, 15, 0], [75, 80, 5, 10]] },
    snoep: { naam: 'Snoep', achtergrond: [0, 10, 5, 0],
      kleuren: [[0, 60, 15, 0], [40, 0, 15, 0], [0, 15, 60, 0], [35, 25, 0, 0], [0, 40, 45, 0], [5, 0, 0, 0]] },
    nacht: { naam: 'Nacht', achtergrond: [90, 80, 40, 60],
      kleuren: [[0, 75, 70, 0], [0, 20, 90, 0], [60, 0, 15, 0], [0, 60, 0, 0], [0, 0, 0, 0]] },
    retro: { naam: 'Retro', achtergrond: [0, 6, 18, 0],
      kleuren: [[0, 70, 90, 10], [0, 30, 95, 0], [80, 20, 50, 20], [10, 45, 35, 0], [80, 70, 40, 40]] },
  },
  marmer: {
    carrara: { naam: 'Wit marmer', achtergrond: [2, 1, 3, 2], kleuren: [[25, 15, 10, 40], [15, 8, 6, 22], [6, 3, 3, 10]] },
    nero: { naam: 'Zwart met goud', achtergrond: [70, 65, 60, 85], kleuren: [[0, 22, 65, 12], [5, 3, 8, 15], [55, 45, 40, 60]] },
    groen: { naam: 'Groen marmer', achtergrond: [90, 35, 70, 55], kleuren: [[10, 0, 12, 0], [35, 5, 30, 10], [80, 25, 60, 35]] },
    roze: { naam: 'Roze marmer', achtergrond: [0, 12, 12, 0], kleuren: [[15, 45, 35, 25], [5, 25, 20, 10], [0, 18, 18, 3]] },
    blauw: { naam: 'Blauw marmer', achtergrond: [5, 1, 0, 2], kleuren: [[90, 60, 20, 20], [55, 25, 5, 5], [20, 5, 0, 5]] },
  },
};

// ---- instellingen ---------------------------------------------------------

const SOORTEN = { terrazzo: 'Terrazzo', confetti: 'Confetti-steen', marmer: 'Marmer-aders' };
const VERDELINGEN = { 1: 'Ongeveer even groot', 1.8: 'Gemengd', 2.8: 'Veel klein, enkele groot', 4: 'Vooral splinters' };

const STANDAARD_PER_SOORT = {
  terrazzo: { palet: 'klassiek', grootste: 18, kleinste: 1.2, verdeling: 2.8, dichtheid: 75, voeg: 0.8, hoekigheid: 55,
    splinters: 20, draaiing: 180, zaad: 1907 },
  confetti: { palet: 'fel', grootste: 5.5, kleinste: 1.4, verdeling: 1.8, dichtheid: 80, voeg: 1.1, hoekigheid: 100,
    splinters: 35, draaiing: 180, zaad: 2024 },
  marmer: { palet: 'carrara', aders: 5, dikte: 2.2, vertakking: 45, kronkel: 55, richting: 35, haarlijnen: 14, wolken: true,
    zaad: 815 },
};
const STANDAARD = { soort: 'terrazzo', gebied: 'afloop', achtergrond: true, achteraan: true };

// ---- terrazzo en confetti -------------------------------------------------

/**
 * Strooit stenen zonder overlap. Elke steen past in een cirkel; de cirkels (plus de voeg) mogen
 * elkaar niet raken. Eerst de grote stenen, dan steeds kleinere in de ruimte ertussen.
 */
function strooiStenen(w, vak) {
  const kans = willekeur(w.zaad);
  const rMax = vexel.mm(Math.max(w.grootste, w.kleinste)) / 2;
  const rMin = vexel.mm(Math.min(w.grootste, w.kleinste)) / 2;
  const voeg = vexel.mm(w.voeg);
  const doel = (w.dichtheid / 100) * vak.b * vak.h * 1.1;
  const stralen = [];
  let som = 0;
  while (som < doel && stralen.length < 9000) {
    const r = rMin + (rMax - rMin) * Math.pow(kans(), w.verdeling);
    stralen.push(r);
    som += Math.PI * r * r;
  }
  stralen.sort((a, b) => b - a);

  // Een rooster: elke steen staat in alle vakjes die zijn cirkel raakt.
  const cel = Math.max(rMin * 4, (rMax + rMin) / 2);
  const kol = Math.ceil((vak.b + 2 * rMax) / cel) + 1;
  const rooster = new Map();
  const vakjes = (x, y, r, doe) => {
    const i0 = Math.floor((x - r - vak.x + rMax) / cel);
    const i1 = Math.floor((x + r - vak.x + rMax) / cel);
    const j0 = Math.floor((y - r - vak.y + rMax) / cel);
    const j1 = Math.floor((y + r - vak.y + rMax) / cel);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (doe(j * kol + i) === false) return false;
    return true;
  };
  const stenen = [];
  for (const r of stralen) {
    const pogingen = r > rMax * 0.5 ? 80 : 40;
    for (let p = 0; p < pogingen; p++) {
      // Het midden mag tot een halve steen buiten het vak: die steen wordt aan de rand afgeknipt.
      const x = vak.x - r * 0.5 + kans() * (vak.b + r);
      const y = vak.y - r * 0.5 + kans() * (vak.h + r);
      const vrij = vakjes(x, y, r + voeg, (k) => {
        const lijst = rooster.get(k);
        if (!lijst) return true;
        for (const s of lijst) if ((s.x - x) ** 2 + (s.y - y) ** 2 < (s.r + r + voeg) ** 2) return false;
        return true;
      });
      if (!vrij) continue;
      const steen = { x, y, r };
      stenen.push(steen);
      vakjes(x, y, r, (k) => {
        const lijst = rooster.get(k);
        if (lijst) lijst.push(steen);
        else rooster.set(k, [steen]);
      });
      break;
    }
  }
  return stenen;
}

/** De vorm van één steen: een onregelmatige veelhoek binnen zijn cirkel, hoekig of afgerond. */
function steenVorm(s, w, kans) {
  const splinter = kans() < w.splinters / 100;
  const n = splinter ? 4 + Math.floor(kans() * 3) : 5 + Math.floor(kans() * 4);
  const rek = splinter ? 0.22 + kans() * 0.25 : 0.7 + kans() * 0.3;
  const hoek = ((kans() - 0.5) * w.draaiing * Math.PI) / 180 + (w.draaiing >= 180 ? kans() * Math.PI : 0);
  const c = Math.cos(hoek);
  const z = Math.sin(hoek);
  const start = kans() * Math.PI * 2;
  const punten = [];
  for (let i = 0; i < n; i++) {
    const a = start + ((i + (kans() - 0.5) * 0.7) / n) * Math.PI * 2;
    const rr = s.r * (0.72 + 0.28 * kans());
    const lx = Math.cos(a) * rr;
    const ly = Math.sin(a) * rr * rek;
    punten.push({ x: s.x + lx * c - ly * z, y: s.y + lx * z + ly * c });
  }
  return punten;
}

/**
 * Maakt van de hoekpunten van een steen een vloeiende vorm. Steekt hij over de rand van het vak,
 * dan wordt eerst de veelhoek afgeknipt; de punten op de rand krijgen geen handvatten, zodat de
 * steen daar recht en precies op de rand eindigt.
 */
function steenBinnenVak(punten, strak, vak) {
  const binnen = punten.every((p) => p.x >= vak.x && p.x <= vak.x + vak.b && p.y >= vak.y && p.y <= vak.y + vak.h);
  if (binnen) return { gesloten: true, punten: geslotenKromme(punten, strak) };
  const geknipt = knipVeelhoek(punten, vak);
  if (geknipt.length < 3 || oppervlak(geknipt) < 0.3) return null;
  const opRand = (p) => Math.abs(p.x - vak.x) < 1e-6 || Math.abs(p.x - vak.x - vak.b) < 1e-6
    || Math.abs(p.y - vak.y) < 1e-6 || Math.abs(p.y - vak.y - vak.h) < 1e-6;
  const krom = geslotenKromme(geknipt, strak);
  geknipt.forEach((p, i) => {
    if (!opRand(p)) return;
    delete krom[i].in;
    delete krom[i].uit;
  });
  // Een handvat van een punt naast de rand mag niet buiten het vak wijzen.
  for (const q of krom) {
    for (const h of [q.in, q.uit]) {
      if (!h) continue;
      h.x = rond(begrens(h.x, vak.x, vak.x + vak.b));
      h.y = rond(begrens(h.y, vak.y, vak.y + vak.h));
    }
  }
  return { gesloten: true, punten: krom };
}

function maakStenen(w, vak, palet) {
  const stenen = strooiStenen(w, vak);
  const kans = willekeur(w.zaad * 13 + 5);
  const gewichten = palet.gewichten || palet.kleuren.map(() => 1);
  const perKleur = palet.kleuren.map(() => []);
  let bedekt = 0;
  for (const s of stenen) {
    const k = kiesGewogen(gewichten, kans);
    const vorm = steenBinnenVak(steenVorm(s, w, kans), w.hoekigheid / 100, vak);
    if (!vorm) continue;
    perKleur[k].push(vorm);
    bedekt += oppervlak(vorm.punten);
  }
  return { perKleur, aantal: perKleur.reduce((a, l) => a + l.length, 0), bedekt: bedekt / (vak.b * vak.h) };
}

// ---- marmer ---------------------------------------------------------------

/**
 * Eén ader: een lijn die kronkelend door het vak loopt, met een dikte die aan- en afzwelt, en
 * zijtakken die dunner worden en taps eindigen.
 */
function maakAders(w, vak, palet) {
  const kans = willekeur(w.zaad);
  const ruis = maakVeldRuis(w.zaad + 3, 3);
  const fijn = maakSimplex(w.zaad + 9);
  const maat = Math.max(vak.b, vak.h);
  const schaal = maat * 0.45;
  const stap = Math.max(vexel.mm(0.8), maat / 500);
  const basis = (w.richting * Math.PI) / 180;
  const zwaai = (w.kronkel / 100) * 1.4;
  const ruim = { x: vak.x - maat * 0.1, y: vak.y - maat * 0.1, b: vak.b + maat * 0.2, h: vak.h + maat * 0.2 };
  const binnen = (p) => p.x >= ruim.x && p.x <= ruim.x + ruim.b && p.y >= ruim.y && p.y <= ruim.y + ruim.h;
  const dik = vexel.mm(0.35) * w.dikte;
  const hoofd = [];
  const haar = [];

  const volg = (start, richting, lengte, breedte, diepte, tapsBegin, lijst) => {
    const punten = [start];
    let p = start;
    let eigenHoek = richting;
    const maxStappen = Math.ceil(lengte / stap);
    const takken = [];
    for (let s = 0; s < maxStappen; s++) {
      const a = eigenHoek + zwaai * ruis(p.x / schaal, p.y / schaal) * 1.6 + 0.35 * fijn(p.x / (schaal * 0.08), p.y / (schaal * 0.08));
      p = { x: p.x + Math.cos(a) * stap, y: p.y + Math.sin(a) * stap };
      punten.push(p);
      if (!binnen(p)) break;
      eigenHoek += (kans() - 0.5) * 0.04;
      if (diepte < 2 && s > 6 && kans() < (w.vertakking / 100) * 0.03) {
        takken.push({ p, a: a + (kans() < 0.5 ? -1 : 1) * (0.35 + kans() * 0.6), s });
      }
    }
    if (punten.length < 4) return;
    const n = punten.length;
    const breedtes = punten.map((q, i) => {
      const t = i / (n - 1);
      const zwel = 0.15 + 0.85 * Math.pow((fijn(q.x / (schaal * 0.15) + 40, q.y / (schaal * 0.15)) + 1) / 2, 1.4) * 1.5;
      const eind = Math.min(1, (1 - t) * 6);
      const begin = tapsBegin ? Math.min(1, t * 6) : 1;
      return breedte * zwel * Math.pow(Math.min(eind, begin), 0.7);
    });
    const elke = 3;
    const gedund = [];
    const dikten = [];
    for (let i = 0; i < n; i += elke) {
      gedund.push(punten[i]);
      dikten.push(breedtes[i]);
    }
    if (gedund[gedund.length - 1] !== punten[n - 1]) {
      gedund.push(punten[n - 1]);
      dikten.push(breedtes[n - 1]);
    }
    if (gedund.length >= 3) lijst.push(lint(gedund, dikten));
    for (const t of takken) {
      const rest = (n - t.s) / n;
      volg(t.p, t.a, lengte * (0.25 + kans() * 0.35) * Math.max(0.4, rest), breedte * (0.35 + kans() * 0.25), diepte + 1, true,
        diepte === 0 && kans() < 0.5 ? haar : lijst);
    }
  };

  const beginpunt = () => {
    // Begin buiten de linker- of bovenkant (afhankelijk van de richting), zodat de ader het vak doorkruist.
    const c = Math.cos(basis);
    const z = Math.sin(basis);
    const u = kans();
    const kantLinks = Math.abs(c) * vak.h > Math.abs(z) * vak.b ? kans() < 0.75 : kans() < 0.25;
    if (kantLinks) return { x: c >= 0 ? ruim.x + 1 : ruim.x + ruim.b - 1, y: ruim.y + u * ruim.h };
    return { x: ruim.x + u * ruim.b, y: z >= 0 ? ruim.y + 1 : ruim.y + ruim.h - 1 };
  };
  for (let i = 0; i < w.aders; i++) {
    volg(beginpunt(), basis + (kans() - 0.5) * 0.6, maat * 2.5, dik * (0.6 + kans() * 0.8), 0, false, hoofd);
  }
  for (let i = 0; i < w.haarlijnen; i++) {
    const start = { x: vak.x + kans() * vak.b, y: vak.y + kans() * vak.h };
    volg(start, basis + (kans() - 0.5) * 1.2, maat * (0.15 + kans() * 0.4), vexel.mm(0.12) + dik * 0.15 * kans(), 1, true, haar);
  }

  // Wolken: een paar zachte vlekken, elk als vier lagen die naar binnen kleiner worden. Met een
  // lage dekking per laag lijkt de rand vervaagd.
  const wolken = [[], [], [], []];
  if (w.wolken) {
    const aantal = 6 + Math.floor(kans() * 4);
    for (let i = 0; i < aantal; i++) {
      const cx = vak.x + kans() * vak.b;
      const cy = vak.y + kans() * vak.h;
      const r = maat * (0.1 + kans() * 0.16);
      const rek = 0.35 + kans() * 0.3;
      for (let laag = 0; laag < 4; laag++) {
        const punten = [];
        const n = 14;
        const f = 1 - laag * 0.2;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const rr = r * f * (0.7 + 0.5 * (fijn(Math.cos(a) * 1.3 + i * 5 + laag * 0.7, Math.sin(a) * 1.3 + laag) + 1) / 2);
          const lx = Math.cos(a) * rr;
          const ly = Math.sin(a) * rr * rek;
          punten.push({ x: cx + lx * Math.cos(basis) - ly * Math.sin(basis), y: cy + lx * Math.sin(basis) + ly * Math.cos(basis) });
        }
        const vorm = binnenVak({ gesloten: true, punten: geslotenKromme(punten, 0) }, vak);
        if (vorm) wolken[laag].push(vorm);
      }
    }
  }
  const knip = (lijst) => lijst.map((s) => binnenVak(s, vak)).filter(Boolean);
  return { hoofd: knip(hoofd), haar: knip(haar), wolken };
}

// ---- alles samen ----------------------------------------------------------

function maakTerrazzo(w, vak, cmyk) {
  const palet = PALETTEN[w.soort][w.palet] || Object.values(PALETTEN[w.soort])[0];
  const kinderen = [];
  if (w.achtergrond) {
    kinderen.push({ soort: 'rechthoek', naam: 'Achtergrond', x: rond(vak.x), y: rond(vak.y), b: rond(vak.b), h: rond(vak.h),
      vulling: alsKleur(palet.achtergrond, cmyk), lijn: null, lijndikte: 0 });
  }
  /** Eén pad per kleur, opgedeeld als er meer dan 1000 subpaden zijn. */
  const paden = (subpaden, naam, kleur, extra) => {
    const uit = [];
    for (let i = 0; i < subpaden.length; i += GRENS.subpaden) {
      const deel = subpaden.slice(i, i + GRENS.subpaden);
      uit.push({ soort: 'pad', naam: naam + (subpaden.length > GRENS.subpaden ? ` (${i / GRENS.subpaden + 1})` : ''),
        subpaden: deel, vulling: alsKleur(kleur, cmyk), lijn: null, lijndikte: 0, ...extra });
    }
    return uit;
  };
  if (w.soort === 'marmer') {
    const a = maakAders(w, vak, palet);
    if (a.wolken[0].length) {
      kinderen.push({ soort: 'groep', naam: 'Wolken', kinderen: a.wolken.map((lijst, i) => ({ soort: 'pad', naam: `Wolken, laag ${i + 1}`,
        subpaden: lijst, vulling: alsKleur(palet.kleuren[2], cmyk), lijn: null, lijndikte: 0, dekking: 0.22 })) });
    }
    kinderen.push({ soort: 'groep', naam: 'Aders', kinderen: [
      ...paden(a.haar, 'Haarlijnen', palet.kleuren[1]),
      ...paden(a.hoofd, 'Hoofdaders', palet.kleuren[0]),
    ] });
    return { vormen: [{ soort: 'groep', naam: 'Marmer', kinderen }], aders: a.hoofd.length + a.haar.length };
  }
  const s = maakStenen(w, vak, palet);
  const stenen = [];
  s.perKleur.forEach((lijst, k) => stenen.push(...paden(lijst, `Kleur ${k + 1}`, palet.kleuren[k])));
  kinderen.push({ soort: 'groep', naam: 'Stenen', kinderen: stenen });
  return { vormen: [{ soort: 'groep', naam: w.soort === 'confetti' ? 'Confetti-steen' : 'Terrazzo', kinderen }],
    stenen: s.aantal, bedekt: s.bedekt };
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const opgeslagen = await vexel.haal('instellingen');
  const algemeen = { ...STANDAARD, ...(opgeslagen || {}) };
  const perSoort = {};
  for (const soort of Object.keys(SOORTEN)) {
    perSoort[soort] = { ...STANDAARD_PER_SOORT[soort], ...((opgeslagen && opgeslagen.perSoort && opgeslagen.perSoort[soort]) || {}) };
  }
  let selectie = [];
  try {
    selectie = await vexel.selectie();
  } catch (fout) {
    selectie = [];
  }

  const velden = {
    soort: keuzeVeld(SOORTEN, algemeen.soort),
    gebied: keuzeVeld({ afloop: 'Tekengebied met afloop', tekengebied: 'Tekengebied', selectie: 'Selectie (het kader)' }, algemeen.gebied),
    palet: maak('select', { klasse: 'veld' }),
    grootste: getalVeld(18, 0.5, 300, 0.5),
    kleinste: getalVeld(1.2, 0.3, 100, 0.1),
    verdeling: keuzeVeld(VERDELINGEN, '2.8'),
    dichtheid: getalVeld(75, 5, 100, 5),
    voeg: getalVeld(0.8, 0, 20, 0.1),
    hoekigheid: getalVeld(55, 0, 100, 5),
    splinters: getalVeld(20, 0, 100, 5),
    draaiing: getalVeld(180, 0, 180, 15),
    aders: getalVeld(5, 0, 40, 1),
    dikte: getalVeld(2.2, 0.1, 30, 0.1),
    vertakking: getalVeld(45, 0, 100, 5),
    kronkel: getalVeld(55, 0, 100, 5),
    richting: getalVeld(35, -360, 360, 5),
    haarlijnen: getalVeld(14, 0, 200, 1),
    zaad: getalVeld(1, 1, 999999, 1),
  };
  const wolken = maak('input', { type: 'checkbox' });
  const achtergrond = maak('input', { type: 'checkbox' });
  achtergrond.checked = algemeen.achtergrond !== false;
  const achteraan = maak('input', { type: 'checkbox' });
  achteraan.checked = algemeen.achteraan !== false;
  const stalen = maak('span', { 'aria-hidden': 'true', stijl: { display: 'flex', gap: '2px', flex: 'none' } });
  const anders = maak('button', { klasse: 'knop', type: 'button', tekst: 'Anders', title: 'Een ander zaadje: dezelfde instellingen, een andere verdeling',
    stijl: { flex: 'none' },
    bijClick: () => {
      velden.zaad.value = String(1 + Math.floor(Math.random() * 999998));
      plan();
    } });

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '230px', borderRadius: '6px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '30px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Terrazzo maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const vinkje = (vak, tekst) => maak('label', { klasse: 'rij', stijl: { margin: '0', gap: '6px' } }, vak, maak('span', { tekst }));

  const stenenDeel = maak('div', { stijl: { display: 'grid', gap: '8px' } },
    twee(regel('Grootste', velden.grootste, 'mm'), regel('Kleinste', velden.kleinste, 'mm')),
    regel('Maten', velden.verdeling),
    twee(regel('Dichtheid', velden.dichtheid, '%'), regel('Voeg', velden.voeg, 'mm')),
    twee(regel('Hoekigheid', velden.hoekigheid, '%'), regel('Splinters', velden.splinters, '%')),
    twee(regel('Draaiing', velden.draaiing, '°'), maak('span')),
  );
  const marmerDeel = maak('div', { stijl: { display: 'grid', gap: '8px' } },
    twee(regel('Aders', velden.aders), regel('Dikte', velden.dikte, 'pt')),
    twee(regel('Vertakking', velden.vertakking, '%'), regel('Kronkel', velden.kronkel, '%')),
    twee(regel('Richting', velden.richting, '°'), regel('Haarlijnen', velden.haarlijnen)),
    vinkje(wolken, 'Zachte wolken in de steen'),
  );
  const achteraanRij = vinkje(achteraan, 'Achteraan in de laag');
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Soort', velden.soort),
    regel('Vullen', velden.gebied),
    regel('Palet', velden.palet, stalen),
    stenenDeel,
    marmerDeel,
    regel('Zaadje', velden.zaad, anders),
    maak('div', { klasse: 'rij', stijl: { margin: '0', gap: '18px' } }, vinkje(achtergrond, 'Achtergrondvlak'), achteraanRij),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  // De velden die per soort apart onthouden worden.
  const EIGEN = ['grootste', 'kleinste', 'dichtheid', 'voeg', 'hoekigheid', 'splinters', 'draaiing', 'aders', 'dikte',
    'vertakking', 'kronkel', 'richting', 'haarlijnen', 'zaad'];
  let huidig = velden.soort.value;
  const zetSoort = (soort) => {
    const s = perSoort[soort];
    const paletten = PALETTEN[soort];
    velden.palet.replaceChildren(...Object.entries(paletten).map(([k, v]) => maak('option', { value: k, tekst: v.naam })));
    velden.palet.value = sleutelVan(paletten, s.palet);
    for (const k of EIGEN) if (s[k] !== undefined) velden[k].value = String(s[k]);
    if (s.verdeling !== undefined) velden.verdeling.value = sleutelVan(VERDELINGEN, String(s.verdeling));
    wolken.checked = s.wolken !== false;
    stenenDeel.style.display = soort === 'marmer' ? 'none' : 'grid';
    marmerDeel.style.display = soort === 'marmer' ? 'grid' : 'none';
    maakKnop.textContent = `${SOORTEN[soort]} maken`;
  };

  const lees = (k, min, max) => begrens(leesGetal(velden[k], STANDAARD_PER_SOORT[huidig][k] || min), min, max);
  const waarden = () => ({
    soort: huidig,
    gebied: velden.gebied.value,
    palet: velden.palet.value,
    grootste: lees('grootste', 0.5, 300),
    kleinste: lees('kleinste', 0.3, 100),
    verdeling: Number(velden.verdeling.value) || 2.8,
    dichtheid: lees('dichtheid', 5, 100),
    voeg: lees('voeg', 0, 20),
    hoekigheid: lees('hoekigheid', 0, 100),
    splinters: lees('splinters', 0, 100),
    draaiing: lees('draaiing', 0, 180),
    aders: Math.round(lees('aders', 0, 40)),
    dikte: lees('dikte', 0.1, 30),
    vertakking: lees('vertakking', 0, 100),
    kronkel: lees('kronkel', 0, 100),
    richting: lees('richting', -360, 360),
    haarlijnen: Math.round(lees('haarlijnen', 0, 200)),
    wolken: wolken.checked,
    zaad: Math.round(begrens(leesGetal(velden.zaad, 1), 1, 999999)),
    achtergrond: achtergrond.checked,
    achteraan: achteraan.checked,
  });
  const onthoud = () => {
    const w = waarden();
    const eigen = { palet: w.palet, verdeling: w.verdeling, wolken: w.wolken };
    for (const k of EIGEN) eigen[k] = w[k];
    perSoort[huidig] = eigen;
  };
  velden.soort.addEventListener('change', () => {
    onthoud();
    huidig = velden.soort.value;
    zetSoort(huidig);
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
    if (!(x1 - x0 > 5) || !(y1 - y0 > 5)) return { fout: 'De selectie is te klein om te vullen.' };
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  };

  function bouw(w, items) {
    const gebied = gebiedVan(w, items);
    if (gebied.fout) return gebied;
    if (w.soort !== 'marmer') {
      const rKlein = vexel.mm(Math.min(w.grootste, w.kleinste)) / 2;
      const rGroot = vexel.mm(Math.max(w.grootste, w.kleinste)) / 2;
      const gemiddeld = rKlein + (rGroot - rKlein) / (w.verdeling + 1);
      const schatting = ((w.dichtheid / 100) * gebied.b * gebied.h * 0.6) / (Math.PI * gemiddeld * gemiddeld);
      if (schatting > 7000) {
        return { fout: `Dat worden te veel stenen (ongeveer ${getal(schatting, 0)}). Maak de kleinste steen groter of de dichtheid lager.`, gebied };
      }
    }
    const uitkomst = maakTerrazzo(w, gebied, cmyk);
    const t = tel(uitkomst.vormen);
    if (t.punten > GRENS.punten || t.vormen > GRENS.vormen) {
      const raad = w.soort === 'marmer' ? 'Kies minder aders of haarlijnen.' : 'Maak de kleinste steen groter of de dichtheid lager.';
      return { fout: `Te veel punten (${getal(t.punten, 0)}, hooguit 50.000). ${raad}`, gebied };
    }
    if (w.soort === 'marmer' ? !uitkomst.aders && !w.wolken : !uitkomst.stenen) {
      return { fout: w.soort === 'marmer' ? 'Er zijn geen aders. Kies minstens één ader of haarlijn.' : 'Er past geen enkele steen. Maak de stenen kleiner.', gebied };
    }
    return { ...uitkomst, gebied, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    achteraanRij.style.visibility = w.gebied === 'selectie' ? 'hidden' : '';
    const palet = PALETTEN[w.soort][w.palet] || Object.values(PALETTEN[w.soort])[0];
    stalen.replaceChildren(...[palet.achtergrond, ...palet.kleuren].map((c, i) => maak('span', { stijl: {
      width: i ? '10px' : '14px', height: '18px', borderRadius: '3px', border: '1px solid var(--lijn)', background: kleurCss({ cmyk: c }) } })));
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
      const maat = `${getal(g.b / vexel.mm(1), 0)} × ${getal(g.h / vexel.mm(1), 0)} mm`;
      if (w.soort === 'marmer') {
        samenvatting.textContent = `${getal(uitkomst.aders, 0)} aders en takken${w.wolken ? ' met wolken' : ''}, `
          + `op ${maat} (${getal(uitkomst.punten, 0)} punten).`;
      } else {
        samenvatting.textContent = `${getal(uitkomst.stenen, 0)} stenen in ${palet.kleuren.length} kleuren, `
          + `${getal(uitkomst.bedekt * 100, 0)} % bedekt, op ${maat} (${getal(uitkomst.punten, 0)} punten).`;
      }
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
      // In de selectie komt het bovenop de vorm, anders zou de vorm het afdekken.
      await vexel.maak(uitkomst.vormen, w.achteraan && w.gebied !== 'selectie' ? { achteraan: true } : undefined);
      onthoud();
      await vexel.bewaar('instellingen', { soort: w.soort, gebied: w.gebied, achtergrond: w.achtergrond, achteraan: w.achteraan, perSoort });
      vexel.melding(w.soort === 'marmer' ? `Marmer gemaakt: ${getal(uitkomst.aders, 0)} aders en takken.`
        : `${SOORTEN[w.soort]} gemaakt: ${getal(uitkomst.stenen, 0)} stenen.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het terrazzo kon niet worden gemaakt.', 'fout');
    }
  });

  zetSoort(huidig);
  if (velden.gebied.value === 'selectie' && !selectie.length) velden.gebied.value = 'afloop';
  else if (selectie.length && !opgeslagen) velden.gebied.value = 'selectie';
  teken();
  velden.soort.focus();
}

vexel.opCommando('maken', toonVenster);
