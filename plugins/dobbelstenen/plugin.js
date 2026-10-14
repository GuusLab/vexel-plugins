// Spelmateriaal: dobbelsteenvlakken en een bouwplaat voor een kubus met lijmranden,
// speelkaarten met hoekindices en eigen kleursymbolen (als vector), en een speelbord met
// een spiraal of slinger van genummerde vakken.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const r3 = (n) => Math.round(n * 1000) / 1000;
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const K = 0.5522847498;

function willekeur(zaad) {
  let s = (Math.imul((zaad | 0) ^ 0x6a09e667, 0x9e3779b1) >>> 0) || 1;
  const volgende = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 6; i++) volgende();
  return volgende;
}

// ---- kleine vormen ----------------------------------------------------------------

function afgerond(x, y, b, h, r) {
  r = Math.min(Math.max(0, r), b / 2, h / 2);
  if (r <= 0.01) return { gesloten: true, punten: [{ x: r3(x), y: r3(y) }, { x: r3(x + b), y: r3(y) }, { x: r3(x + b), y: r3(y + h) }, { x: r3(x), y: r3(y + h) }] };
  const k = r * K;
  const p = (px, py, ix, iy, ux, uy) => ({ x: r3(px), y: r3(py), in: { x: r3(ix), y: r3(iy) }, uit: { x: r3(ux), y: r3(uy) } });
  return {
    gesloten: true,
    punten: [
      p(x + r, y, x + r - k, y, x + r, y), p(x + b - r, y, x + b - r, y, x + b - r + k, y),
      p(x + b, y + r, x + b, y + r - k, x + b, y + r), p(x + b, y + h - r, x + b, y + h - r, x + b, y + h - r + k),
      p(x + b - r, y + h, x + b - r + k, y + h, x + b - r, y + h), p(x + r, y + h, x + r, y + h, x + r - k, y + h),
      p(x, y + h - r, x, y + h - r + k, x, y + h - r), p(x, y + r, x, y + r, x, y + r - k),
    ],
  };
}

/** Een cirkel als subpad, met de klok mee (in een stelsel met y omlaag). */
function cirkel(cx, cy, r) {
  const k = r * K;
  const p = (x, y, ix, iy, ux, uy) => ({ x: r3(x), y: r3(y), in: { x: r3(ix), y: r3(iy) }, uit: { x: r3(ux), y: r3(uy) } });
  return {
    gesloten: true,
    punten: [
      p(cx, cy - r, cx - k, cy - r, cx + k, cy - r), p(cx + r, cy, cx + r, cy - k, cx + r, cy + k),
      p(cx, cy + r, cx + k, cy + r, cx - k, cy + r), p(cx - r, cy, cx - r, cy + k, cx - r, cy - k),
    ],
  };
}

/** Teken van de oppervlakte van een subpad (alleen de hoekpunten), om de draairichting te kennen. */
function draairichting(sp) {
  let a = 0;
  const n = sp.punten.length;
  for (let i = 0; i < n; i++) {
    const p = sp.punten[i];
    const q = sp.punten[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.sign(a);
}
function omgekeerd(sp) {
  return { gesloten: sp.gesloten, punten: sp.punten.slice().reverse().map((p) => ({ x: p.x, y: p.y, in: p.uit, uit: p.in })) };
}

// Kleursymbolen in een eenheidsvak (-1..1), eigen tekening.
const HART = [
  { x: 0, y: 0.95, in: { x: 0.42, y: 0.58 }, uit: { x: -0.42, y: 0.58 } },
  { x: -0.98, y: -0.28, in: { x: -0.98, y: 0.14 }, uit: { x: -0.98, y: -0.86 } },
  { x: 0, y: -0.52, in: { x: -0.22, y: -1.02 }, uit: { x: 0.22, y: -1.02 } },
  { x: 0.98, y: -0.28, in: { x: 0.98, y: -0.86 }, uit: { x: 0.98, y: 0.14 } },
];
const STEEL = [
  { x: 0, y: 0.05 },
  { x: 0.12, y: 0.55, uit: { x: 0.18, y: 0.8 } },
  { x: 0.46, y: 1, in: { x: 0.3, y: 0.96 } },
  { x: -0.46, y: 1, uit: { x: -0.3, y: 0.96 } },
  { x: -0.12, y: 0.55, in: { x: -0.18, y: 0.8 } },
];

/** De subpaden van een kleursymbool, gecentreerd op (cx, cy) met hoogte h. Omgedraaid met `om`. */
function symbool(kleur, cx, cy, h, om = false) {
  const s = h / 2;
  const zet = (lijst, sx, sy, dy) => ({
    gesloten: true,
    punten: lijst.map((p) => {
      const t = (q) => ({ x: r3(cx + q.x * s * sx), y: r3(cy + (q.y * sy + dy) * s * (om ? -1 : 1)) });
      const uit = t(p);
      if (p.in) uit.in = t(p.in);
      if (p.uit) uit.uit = t(p.uit);
      return uit;
    }),
  });
  let delen;
  if (kleur === 'harten') delen = [zet(HART, 0.98, 1, 0)];
  else if (kleur === 'ruiten') {
    delen = [{
      gesloten: true,
      punten: [[0, -1], [0.74, 0], [0, 1], [-0.74, 0]].map(([x, y]) => ({ x: r3(cx + x * s), y: r3(cy + y * s * (om ? -1 : 1)) })),
    }];
  } else if (kleur === 'schoppen') {
    // een omgekeerd hart met een uitlopende steel
    delen = [zet(HART, 0.98, -0.8, -0.24), zet(STEEL, 1, 1, 0)];
  } else {
    // klaveren: drie rondjes en een steel
    const r = 0.36 * s;
    const m = (x, y) => ({ x: cx + x * s, y: cy + y * s * (om ? -1 : 1) });
    const a = m(0, -0.56);
    const b = m(-0.5, 0.06);
    const c = m(0.5, 0.06);
    delen = [cirkel(a.x, a.y, r), cirkel(b.x, b.y, r), cirkel(c.x, c.y, r), zet(STEEL, 0.9, 1, 0),
      { gesloten: true, punten: [m(0, -0.3), m(0.22, 0.02), m(0, 0.25), m(-0.22, 0.02)].map((p) => ({ x: r3(p.x), y: r3(p.y) })) }];
  }
  // alle delen dezelfde draairichting, zodat ze met 'nonzero' samen één vorm zijn
  const richting = draairichting(delen[0]);
  return delen.map((d, i) => (i && draairichting(d) !== richting ? omgekeerd(d) : d));
}

// ---- kleuren ------------------------------------------------------------------------

function kleurMaker(cmyk) {
  return (paar) => (paar ? (cmyk ? { cmyk: paar[0] } : { hex: paar[1] }) : null);
}
const ZWART = [[0, 0, 0, 100], '#1a1a1a'];
const WIT = [[0, 0, 0, 0], '#ffffff'];
const GRIJS = [[0, 0, 0, 45], '#8c8c8c'];
const LICHTGRIJS = [[0, 0, 0, 12], '#e3e3e3'];

const DOBBEL_KLEUREN = {
  wit: { naam: 'Wit met zwarte ogen', vlak: WIT, oog: ZWART, rand: GRIJS },
  ivoor: { naam: 'Ivoor met rode één', vlak: [[0, 3, 12, 2], '#f8f1e2'], oog: [[0, 0, 0, 90], '#2b2b2b'], een: [[0, 95, 85, 5], '#d81f26'], rand: GRIJS },
  rood: { naam: 'Rood met witte ogen', vlak: [[0, 95, 85, 10], '#c8202a'], oog: WIT, rand: [[0, 95, 85, 40], '#8e1219'] },
  zwart: { naam: 'Zwart met witte ogen', vlak: [[60, 40, 40, 100], '#141414'], oog: WIT, rand: [[0, 0, 0, 80], '#333333'] },
  blauw: { naam: 'Blauw met witte ogen', vlak: [[90, 55, 0, 0], '#1f6fd6'], oog: WIT, rand: [[100, 70, 0, 30], '#174f9a'] },
};

// ---- dobbelsteen --------------------------------------------------------------------

// waar de ogen zitten, in een raster van 3 × 3 (0, 1, 2)
const OGEN = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

function vlakVormen(n, x, y, z, w, kleur, metRand) {
  const kl = DOBBEL_KLEUREN[w.kleur] || DOBBEL_KLEUREN.wit;
  const kinderen = [];
  kinderen.push({
    soort: 'pad', naam: 'Vlak', subpaden: [afgerond(x, y, z, z, metRand ? vexel.mm(w.hoek) : 0)],
    vulling: kleur(kl.vlak), lijn: metRand ? kleur(kl.rand) : null, lijndikte: 0.5,
  });
  const marge = z * 0.24;
  const stap = (z - 2 * marge) / 2;
  const ogen = [];
  if (w.ogen === 'cijfers') {
    kinderen.push({
      soort: 'tekst', naam: 'Cijfer', inhoud: String(n), x: r3(x + z / 2), y: r3(y + z * 0.5 + z * 0.19), grootte: r3(z * 0.52), gewicht: 700,
      uitlijning: 'midden', vulling: kleur(n === 1 && kl.een ? kl.een : kl.oog),
    });
  } else {
    const r = z * (n === 1 && w.ogen === 'rond' ? 0.13 : 0.092);
    for (const [i, j] of OGEN[n]) {
      const cx = x + marge + i * stap;
      const cy = y + marge + j * stap;
      if (w.ogen === 'vierkant') ogen.push(afgerond(cx - r, cy - r, 2 * r, 2 * r, r * 0.25));
      else ogen.push(cirkel(cx, cy, r));
    }
    kinderen.push({ soort: 'pad', naam: 'Ogen', subpaden: ogen, vulling: kleur(n === 1 && kl.een ? kl.een : kl.oog), lijn: null });
  }
  return { soort: 'groep', naam: `Vlak ${n}`, kinderen };
}

/** Een kubus als uitslag: kruisvorm met lijmranden; overstaande vlakken samen 7. */
function bouwplaat(x, y, z, w, kleur, lijnen) {
  // kolom 1: boven (2), voor (1), onder (5), achter (6); links (3) en rechts (4) naast voor
  const vlakken = [
    { n: 2, k: 1, r: 0 }, { n: 1, k: 1, r: 1 }, { n: 5, k: 1, r: 2 }, { n: 6, k: 1, r: 3 }, { n: 3, k: 0, r: 1 }, { n: 4, k: 2, r: 1 },
  ];
  const diep = z * 0.2;
  // lijmranden: [vlak-kolom, vlak-rij, zijde]
  const lijm = [[0, 1, 'boven'], [0, 1, 'onder'], [2, 1, 'boven'], [2, 1, 'onder'], [1, 3, 'links'], [1, 3, 'rechts'], [1, 3, 'onder']];
  const P = (k, r) => [x + diep + k * z, y + diep + r * z];
  const sleutel = (a, b) => `${r3(a[0])},${r3(a[1])}|${r3(b[0])},${r3(b[1])}`;
  const segmenten = new Map();
  const voeg = (a, b) => {
    const s1 = sleutel(a, b);
    const s2 = sleutel(b, a);
    if (segmenten.has(s2)) segmenten.get(s2).dubbel = true;
    else segmenten.set(s1, { a, b, dubbel: false });
  };
  const kinderen = [];
  const lijmVormen = [];
  for (const v of vlakken) {
    const [vx, vy] = P(v.k, v.r);
    voeg([vx, vy], [vx + z, vy]);
    voeg([vx + z, vy], [vx + z, vy + z]);
    voeg([vx + z, vy + z], [vx, vy + z]);
    voeg([vx, vy + z], [vx, vy]);
    kinderen.push(vlakVormen(v.n, vx, vy, z, w, kleur, false));
  }
  const vouw = [];
  for (const [k, r, zijde] of lijm) {
    const [vx, vy] = P(k, r);
    const inz = diep * 0.9;
    let a;
    let b;
    let n;
    if (zijde === 'boven') [a, b, n] = [[vx + z, vy], [vx, vy], [0, -1]];
    else if (zijde === 'onder') [a, b, n] = [[vx, vy + z], [vx + z, vy + z], [0, 1]];
    else if (zijde === 'links') [a, b, n] = [[vx, vy], [vx, vy + z], [-1, 0]];
    else [a, b, n] = [[vx + z, vy + z], [vx + z, vy], [1, 0]];
    const u = [(b[0] - a[0]) / z, (b[1] - a[1]) / z];
    const c = [a[0] + u[0] * inz + n[0] * diep, a[1] + u[1] * inz + n[1] * diep];
    const d = [b[0] - u[0] * inz + n[0] * diep, b[1] - u[1] * inz + n[1] * diep];
    lijmVormen.push({ gesloten: true, punten: [a, c, d, b].map(([px, py]) => ({ x: r3(px), y: r3(py) })) });
    // de basis van de lijmrand is een vouwlijn; de buitenkant snijden
    segmenten.get(sleutel(b, a)).lijm = true;
    // in dezelfde richting als de randen van de vlakken (met de klok mee): van b via d en c naar a
    segmenten.set(sleutel(b, d), { a: b, b: d });
    segmenten.set(sleutel(d, c), { a: d, b: c });
    segmenten.set(sleutel(c, a), { a: c, b: a });
  }
  kinderen.unshift({ soort: 'pad', naam: 'Lijmranden', subpaden: lijmVormen, vulling: kleur(LICHTGRIJS), lijn: null });
  // vouwlijnen: gedeelde randen en de basis van de lijmranden
  const rand = [];
  for (const s of segmenten.values()) {
    if (s.dubbel || s.lijm) vouw.push({ gesloten: false, punten: [{ x: r3(s.a[0]), y: r3(s.a[1]) }, { x: r3(s.b[0]), y: r3(s.b[1]) }] });
    else rand.push(s);
  }
  // de snijlijn als één gesloten pad: de buitenranden aan elkaar rijgen
  const opBegin = new Map(rand.map((s) => [`${r3(s.a[0])},${r3(s.a[1])}`, s]));
  const snij = [];
  let s = rand[0];
  for (let i = 0; i < rand.length && s; i++) {
    snij.push({ x: r3(s.a[0]), y: r3(s.a[1]) });
    s = opBegin.get(`${r3(s.b[0])},${r3(s.b[1])}`);
    if (s === rand[0]) break;
  }
  kinderen.push({ soort: 'pad', naam: 'Vouwlijnen', subpaden: vouw, vulling: null, ...lijnen.vouw });
  kinderen.push({ soort: 'pad', naam: 'Snijlijn', subpaden: [{ gesloten: true, punten: snij }], vulling: null, ...lijnen.snij });
  return { soort: 'groep', naam: 'Bouwplaat dobbelsteen', kinderen, breed: 3 * z + 2 * diep, hoog: 4 * z + 2 * diep };
}

function lijnStijlen(w, kleur) {
  if (w.steunkleur) {
    return {
      snij: { lijn: { steunkleur: { naam: 'Snijlijn', cmyk: [0, 100, 0, 0] } }, lijndikte: 0.5, overdrukLijn: true },
      vouw: { lijn: { steunkleur: { naam: 'Rillijn', cmyk: [100, 0, 0, 0] } }, lijndikte: 0.5, streep: [4, 2], overdrukLijn: true },
    };
  }
  return { snij: { lijn: kleur(ZWART), lijndikte: 0.5 }, vouw: { lijn: kleur(GRIJS), lijndikte: 0.5, streep: [3, 2] } };
}

function dobbelVormen(w, tg, kleur) {
  const z = vexel.mm(w.zijde);
  const gat = vexel.mm(6);
  const stukken = [];
  if (w.vorm === 'bouwplaat') {
    const lijnen = lijnStijlen(w, kleur);
    const proef = bouwplaat(0, 0, z, w, kleur, lijnen);
    const kol = Math.max(1, Math.floor((tg.b - vexel.mm(16) + gat) / (proef.breed + gat)));
    const rij = Math.max(1, Math.floor((tg.h - vexel.mm(16) + gat) / (proef.hoog + gat)));
    const n = Math.min(w.aantal, kol * rij);
    const k = Math.min(n, kol);
    const rr = Math.ceil(n / kol);
    const x0 = (tg.b - (k * proef.breed + (k - 1) * gat)) / 2;
    const y0 = (tg.h - (rr * proef.hoog + (rr - 1) * gat)) / 2;
    for (let i = 0; i < n; i++) {
      const b = bouwplaat(x0 + (i % kol) * (proef.breed + gat), y0 + Math.floor(i / kol) * (proef.hoog + gat), z, w, kleur, lijnen);
      delete b.breed;
      delete b.hoog;
      if (n > 1) b.naam += ` ${i + 1}`;
      stukken.push(b);
    }
    return { vormen: stukken, past: kol * rij, maat: [proef.breed, proef.hoog] };
  }
  // losse vlakken: per dobbelsteen een rij van 6 (of 3 × 2 als dat beter past)
  const perRij = 6 * z + 5 * vexel.mm(3) <= tg.b - vexel.mm(16) ? 6 : 3;
  const setB = perRij * z + (perRij - 1) * vexel.mm(3);
  const setH = (6 / perRij) * z + (6 / perRij - 1) * vexel.mm(3);
  const kol = Math.max(1, Math.floor((tg.b - vexel.mm(16) + gat) / (setB + gat)));
  const rij = Math.max(1, Math.floor((tg.h - vexel.mm(16) + gat) / (setH + gat)));
  const n = Math.min(w.aantal, kol * rij);
  const k = Math.min(n, kol);
  const rr = Math.ceil(n / kol);
  const x0 = (tg.b - (k * setB + (k - 1) * gat)) / 2;
  const y0 = (tg.h - (rr * setH + (rr - 1) * gat)) / 2;
  for (let d = 0; d < n; d++) {
    const sx = x0 + (d % kol) * (setB + gat);
    const sy = y0 + Math.floor(d / kol) * (setH + gat);
    const kinderen = [];
    for (let i = 0; i < 6; i++) {
      kinderen.push(vlakVormen(i + 1, sx + (i % perRij) * (z + vexel.mm(3)), sy + Math.floor(i / perRij) * (z + vexel.mm(3)), z, w, kleur, true));
    }
    stukken.push({ soort: 'groep', naam: n > 1 ? `Dobbelsteen ${d + 1}` : 'Dobbelsteen', kinderen });
  }
  return { vormen: stukken, past: kol * rij, maat: [setB, setH] };
}

// ---- speelkaarten -------------------------------------------------------------------

const KAARTMATEN = {
  poker: { naam: 'Poker 63 × 88 mm', b: 63, h: 88 },
  bridge: { naam: 'Bridge 57 × 89 mm', b: 57, h: 89 },
  mini: { naam: 'Mini 44 × 63 mm', b: 44, h: 63 },
  groot: { naam: 'Groot 70 × 120 mm', b: 70, h: 120 },
  eigen: { naam: 'Eigen maat' },
};
const KLEUREN = ['schoppen', 'harten', 'ruiten', 'klaveren'];
const KLEURNAAM = { schoppen: 'Schoppen', harten: 'Harten', ruiten: 'Ruiten', klaveren: 'Klaveren' };

function rangen(w) {
  const plaatjes = w.plaatjes === 'jqk' ? ['J', 'Q', 'K'] : ['B', 'V', 'H'];
  return ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', ...plaatjes];
}

// pipposities op een kaart, in fracties van het middenvak (x: 0..1, y: 0..1)
const PIPS = {
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
};

function kaartKleur(kl, w) {
  if (w.vierkleuren && kl === 'ruiten') return [[100, 45, 0, 0], '#0a6fd1'];
  if (w.vierkleuren && kl === 'klaveren') return [[85, 0, 95, 15], '#14883a'];
  return kl === 'harten' || kl === 'ruiten' ? [[0, 100, 85, 5], '#d4111d'] : ZWART;
}

function kaartVormen(x, y, w, kleur, kaart) {
  const B = vexel.mm(w.b);
  const H = vexel.mm(w.h);
  const kinderen = [{
    soort: 'pad', naam: 'Kaart', subpaden: [afgerond(x, y, B, H, vexel.mm(w.hoek))], vulling: kleur(WIT), lijn: kleur(GRIJS), lijndikte: 0.35,
  }];
  if (!kaart) {
    // alleen de indeling: hoekvakken en het middenvak als hulplijnen
    const veilig = vexel.mm(3);
    kinderen.push({
      soort: 'pad', naam: 'Veilige zone', subpaden: [afgerond(x + veilig, y + veilig, B - 2 * veilig, H - 2 * veilig, vexel.mm(Math.max(0, w.hoek - 2)))],
      vulling: null, lijn: kleur(GRIJS), lijndikte: 0.35, streep: [2, 2],
    });
    const iB = B * 0.16;
    kinderen.push({
      soort: 'pad', naam: 'Hoekvakken', vulling: null, lijn: kleur(GRIJS), lijndikte: 0.35, streep: [1, 1.5],
      subpaden: [afgerond(x + veilig, y + veilig, iB, H * 0.2, 1), afgerond(x + B - veilig - iB, y + H - veilig - H * 0.2, iB, H * 0.2, 1)],
    });
    return { soort: 'groep', naam: 'Lege kaart', kinderen };
  }
  const { rang, kl } = kaart;
  const kleurPaar = kaartKleur(kl, w);
  const inkt = kleur(kleurPaar);
  // hoekindex: rang met het symbool eronder, linksboven en (omgedraaid) rechtsonder
  const ig = Math.min(B * 0.15, vexel.mm(6.5));
  const ix = x + B * 0.1;
  const iy = y + H * 0.04 + ig * 0.92;
  const sym = ig * 0.72;
  const index = [];
  index.push({ soort: 'tekst', naam: 'Rang', inhoud: rang, x: r3(ix), y: r3(iy), grootte: r3(rang === '10' ? ig * 0.86 : ig), gewicht: 700, uitlijning: 'midden',
      letterafstand: rang === '10' ? -60 : 0, vulling: inkt });
  index.push({ soort: 'tekst', naam: 'Rang', inhoud: rang, x: r3(x + B - (ix - x)), y: r3(y + H - (iy - y)), grootte: r3(rang === '10' ? ig * 0.86 : ig), gewicht: 700,
      uitlijning: 'midden', letterafstand: rang === '10' ? -60 : 0, vulling: inkt, draai: 180 });
  const symY = iy + ig * 0.22 + sym / 2;
  const subpaden = [...symbool(kl, ix, symY, sym), ...symbool(kl, x + B - (ix - x), y + H - (symY - y), sym, true)];
  // het midden
  const mx0 = x + B * 0.27;
  const mx1 = x + B * 0.73;
  const my0 = y + H * 0.17;
  const my1 = y + H * 0.83;
  const n = Number(rang);
  if (rang === 'A') subpaden.push(...symbool(kl, x + B / 2, y + H / 2, B * 0.42));
  else if (n >= 2 && n <= 10) {
    const pip = Math.min(B * 0.2, (my1 - my0) / 4.4);
    for (const [px, py] of PIPS[n]) {
      const cx = mx0 + px * (mx1 - mx0);
      const cy = my0 + py * (my1 - my0);
      subpaden.push(...symbool(kl, cx, cy, pip, py > 0.5));
    }
  } else {
    // plaatje: een sierkader met de letter groot en het symbool, eigen eenvoudige opzet
    const fx = x + B * 0.22;
    const fy = y + H * 0.13;
    const fb = B * 0.56;
    const fh = H * 0.74;
    kinderen.push({ soort: 'pad', naam: 'Kader', subpaden: [afgerond(fx, fy, fb, fh, vexel.mm(1.5))], vulling: kleur(kleurPaar === ZWART ? [[0, 0, 0, 6], '#f0f0f0'] : [[0, 8, 6, 0],
        '#fdeeee']), lijn: inkt, lijndikte: 0.6 });
    kinderen.push({ soort: 'tekst', naam: 'Letter', inhoud: rang, x: r3(x + B / 2), y: r3(y + H / 2 - fh * 0.02), grootte: r3(fb * 0.62), gewicht: 800, uitlijning: 'midden', vulling: inkt });
    subpaden.push(...symbool(kl, x + B / 2, y + H / 2 + fh * 0.2, fb * 0.3));
    subpaden.push(...symbool(kl, x + B / 2, fy + fh * 0.12, fb * 0.13), ...symbool(kl, x + B / 2, fy + fh * 0.88, fb * 0.13, true));
  }
  kinderen.push({ soort: 'groep', naam: 'Hoekindex', kinderen: index });
  kinderen.push({ soort: 'pad', naam: 'Symbolen', subpaden, vulling: inkt, lijn: null });
  return { soort: 'groep', naam: `${KLEURNAAM[kl]} ${rang}`, kinderen };
}

function kaartenVormen(w, tg, kleur) {
  const kaarten = [];
  const lijst = rangen(w);
  if (w.inhoud === 'leeg') for (let i = 0; i < w.aantalLeeg; i++) kaarten.push(null);
  else if (w.inhoud === 'kleur') for (const rang of lijst) kaarten.push({ rang, kl: w.kleur });
  else for (const kl of KLEUREN) for (const rang of lijst) kaarten.push({ rang, kl });
  const B = vexel.mm(w.b);
  const H = vexel.mm(w.h);
  const gat = vexel.mm(w.snijruimte);
  const marge = vexel.mm(5);
  const kol = Math.floor((tg.b - 2 * marge + gat) / (B + gat));
  const rij = Math.floor((tg.h - 2 * marge + gat) / (H + gat));
  const perVel = kol * rij;
  if (!perVel) return { vormen: [], perVel: 0, n: kaarten.length, vellen: 0 };
  const vellen = Math.ceil(kaarten.length / perVel);
  const blokB = kol * B + (kol - 1) * gat;
  const rijenNodig = Math.min(rij, Math.ceil(Math.min(kaarten.length, perVel) / kol));
  const blokH = rijenNodig * H + (rijenNodig - 1) * gat;
  const x0 = (tg.b - blokB) / 2;
  const y0 = (tg.h - blokH) / 2;
  const vormen = [];
  for (let v = 0; v < vellen; v++) {
    const kinderen = [];
    for (let i = 0; i < perVel; i++) {
      const k = v * perVel + i;
      if (k >= kaarten.length) break;
      const dx = v * (tg.b + vexel.mm(20));
      kinderen.push(kaartVormen(x0 + dx + (i % kol) * (B + gat), y0 + Math.floor(i / kol) * (H + gat), w, kleur, kaarten[k]));
    }
    vormen.push({ soort: 'groep', naam: vellen > 1 ? `Speelkaarten, vel ${v + 1}` : 'Speelkaarten', kinderen });
  }
  return { vormen, perVel, n: kaarten.length, vellen, kol, rij };
}

// ---- speelbord ----------------------------------------------------------------------

const BORD_KLEUREN = [
  [[0, 55, 85, 0], '#f7934c'], [[60, 0, 40, 0], '#5cc4a8'], [[0, 15, 85, 0], '#fcd440'], [[55, 25, 0, 0], '#6fa8e6'], [[0, 55, 15, 0], '#f18bb0'],
];

/** De volgorde van de vakken: [kolom, rij] per vak. */
function bordVolgorde(n, indeling) {
  if (indeling === 'slinger') {
    const kol = Math.ceil(Math.sqrt(n * 1.15));
    const rij = Math.ceil(n / kol);
    const uit = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / kol);
      const k = i % kol;
      uit.push([r % 2 ? kol - 1 - k : k, rij - 1 - r]);
    }
    return { cellen: uit, kol, rij };
  }
  // spiraal van buiten naar binnen, linksonder beginnen
  const z = Math.ceil(Math.sqrt(n));
  const uit = [];
  let [x0, y0, x1, y1] = [0, 0, z - 1, z - 1];
  while (uit.length < z * z && x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) uit.push([x, y1]);
    for (let y = y1 - 1; y >= y0; y--) uit.push([x1, y]);
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) uit.push([x, y0]);
    if (x0 < x1) for (let y = y0 + 1; y <= y1 - 1; y++) uit.push([x0, y]);
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return { cellen: uit.slice(0, n), kol: z, rij: z };
}

function ster(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push({ x: r3(cx + rr * Math.cos(a)), y: r3(cy + rr * Math.sin(a)) });
  }
  return { gesloten: true, punten: pts };
}

function bordVormen(w, tg, kleur) {
  const { cellen, kol, rij } = bordVolgorde(w.vakken, w.indeling);
  const maat = Math.min(vexel.mm(w.maat), tg.b - vexel.mm(10));
  const rand = maat * 0.04;
  const c = (maat - 2 * rand) / Math.max(kol, rij);
  const bh = rij * c + 2 * rand;
  const bb = kol * c + 2 * rand;
  const x0 = (tg.b - bb) / 2;
  const y0 = Math.max(vexel.mm(10), (tg.h - bh) / 2);
  const gat = c * 0.07;
  const rnd = willekeur(w.zaad);
  // bonusvakken: willekeurig maar niet naast elkaar en niet op start of finish
  const bonus = new Set();
  let pogingen = 0;
  while (bonus.size < Math.min(w.bonus, Math.floor(w.vakken / 3)) && pogingen++ < 1000) {
    const i = 2 + Math.floor(rnd() * (w.vakken - 3));
    if (!bonus.has(i - 1) && !bonus.has(i + 1)) bonus.add(i);
  }
  const vakken = [];
  const nummers = [];
  const sterren = [];
  const tekstKleur = kleur([[85, 65, 25, 30], '#22324d']);
  cellen.forEach(([k, r], i) => {
    const x = x0 + rand + k * c + gat / 2;
    const y = y0 + rand + r * c + gat / 2;
    const z = c - gat;
    const eerste = i === 0;
    const laatste = i === cellen.length - 1;
    const kl = eerste || laatste ? [[0, 0, 0, 0], '#ffffff'] : BORD_KLEUREN[i % BORD_KLEUREN.length];
    vakken.push({ soort: 'pad', naam: `Vak ${i + 1}`, subpaden: [afgerond(x, y, z, z, z * 0.16)], vulling: kleur(kl), lijn: tekstKleur, lijndikte: eerste || laatste ? 1.2 : 0.6 });
    if (eerste || laatste) {
      const woord = eerste ? 'START' : 'FINISH';
      nummers.push({ soort: 'tekst', naam: woord, inhoud: woord, x: r3(x + z / 2), y: r3(y + z * 0.62), grootte: r3(Math.min(z * 0.22, (z * 0.86) / (woord.length * 0.68))),
          gewicht: 800, uitlijning: 'midden', vulling: tekstKleur });
    } else {
      nummers.push({ soort: 'tekst', naam: String(i + 1), inhoud: String(i + 1), x: r3(x + z * 0.12), y: r3(y + z * 0.3), grootte: r3(z * 0.24), gewicht: 700, vulling: tekstKleur });
      if (bonus.has(i)) sterren.push(ster(x + z * 0.58, y + z * 0.6, z * 0.26));
    }
  });
  const kinderen = [
    { soort: 'pad', naam: 'Bord', subpaden: [afgerond(x0, y0, bb, bh, rand * 0.8)], vulling: kleur([[3, 2, 12, 0], '#f6f3e2']), lijn: tekstKleur, lijndikte: 1.5 },
    { soort: 'groep', naam: 'Vakken', kinderen: vakken },
  ];
  if (sterren.length) kinderen.push({ soort: 'pad', naam: 'Bonusvakken', subpaden: sterren, vulling: kleur([[0, 0, 0, 0], '#ffffff']), lijn: tekstKleur, lijndikte: 0.6, lijnhoek: 'round' });
  kinderen.push({ soort: 'groep', naam: 'Nummers', kinderen: nummers });
  return { vormen: [{ soort: 'groep', naam: `Speelbord ${w.vakken} vakken`, kinderen }], maat: [bb, bh], bonus: sterren.length };
}

// ---- voorvertoning ------------------------------------------------------------------

function cssKleur(k) {
  if (!k) return null;
  if (k.hex) return k.hex;
  const c = k.cmyk || (k.steunkleur && k.steunkleur.cmyk);
  if (c) {
    const [a, m, y, z] = c.map((v) => v / 100);
    const f = (v) => Math.round(255 * (1 - v) * (1 - z));
    return `rgb(${f(a)},${f(m)},${f(y)})`;
  }
  return '#000';
}

function tekenVorm(g, v, s) {
  if (v.zichtbaar === false) return;
  if (v.soort === 'groep') {
    for (const k of v.kinderen) tekenVorm(g, k, s);
    return;
  }
  g.save();
  const vul = cssKleur(v.vulling);
  const lijn = cssKleur(v.lijn);
  if (v.soort === 'tekst') {
    g.font = `${v.gewicht || 400} ${v.grootte * s}px Inter, system-ui, sans-serif`;
    g.textAlign = v.uitlijning === 'midden' ? 'center' : v.uitlijning === 'rechts' ? 'right' : 'left';
    g.fillStyle = vul || '#000';
    g.translate(v.x * s, v.y * s);
    if (v.draai) g.rotate((v.draai * Math.PI) / 180);
    g.fillText(v.inhoud, 0, 0);
    g.restore();
    return;
  }
  g.beginPath();
  for (const sp of v.subpaden) {
    const pts = sp.punten;
    g.moveTo(pts[0].x * s, pts[0].y * s);
    const n = pts.length;
    for (let i = 1; i <= (sp.gesloten ? n : n - 1); i++) {
      const a = pts[i - 1];
      const b = pts[i % n];
      const c1 = a.uit || a;
      const c2 = b.in || b;
      g.bezierCurveTo(c1.x * s, c1.y * s, c2.x * s, c2.y * s, b.x * s, b.y * s);
    }
    if (sp.gesloten) g.closePath();
  }
  if (vul) {
    g.fillStyle = vul;
    g.fill('nonzero');
  }
  if (lijn) {
    g.strokeStyle = lijn;
    g.lineWidth = Math.max(0.5, (v.lijndikte || 1) * s);
    g.setLineDash((v.streep || []).map((d) => Math.max(1, d * s)));
    g.lineJoin = 'round';
    g.stroke();
  }
  g.restore();
}

/** Tekent vormen passend in het canvas; `kader` is het gebied in pt dat zichtbaar moet zijn. */
function voorvertoning(doek, vormen, kader) {
  const schaal = devicePixelRatio || 1;
  const vak = doek.getBoundingClientRect();
  doek.width = Math.round(vak.width * schaal);
  doek.height = Math.round(vak.height * schaal);
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, vak.width, vak.height);
  if (!kader || !vormen.length) return;
  const s = Math.min((vak.width - 16) / kader.b, (vak.height - 16) / kader.h);
  g.translate((vak.width - kader.b * s) / 2 - kader.x * s, (vak.height - kader.h * s) / 2 - kader.y * s);
  for (const v of vormen) tekenVorm(g, v, s);
}

function kaderVan(vormen) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const loop = (v) => {
    if (v.soort === 'groep') return v.kinderen.forEach(loop);
    if (v.soort !== 'pad') return undefined;
    for (const sp of v.subpaden) {
      for (const p of sp.punten) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
    }
    return undefined;
  };
  vormen.forEach(loop);
  return x0 === Infinity ? null : { x: x0 - 2, y: y0 - 2, b: x1 - x0 + 4, h: y1 - y0 + 4 };
}

function telVormen(vormen) {
  let n = 0;
  let p = 0;
  const loop = (v) => {
    n++;
    if (v.subpaden) for (const sp of v.subpaden) p += sp.punten.length;
    (v.kinderen || []).forEach(loop);
  };
  vormen.forEach(loop);
  return { n, p };
}

// ---- venster-hulpjes ----------------------------------------------------------------

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
const getalVeld = (waarde, min, max, stap) =>
  maak('input', { klasse: 'veld', type: 'number', min, max, step: stap, value: waarde, stijl: { width: '100%' } });
function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld', stijl: { width: '100%' } },
    ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => String(w) === String(waarde)) ? String(waarde) : String(opties[0][0]);
  return veld;
}
const metLabel = (tekst, veld, eenheid) =>
  maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0' } }),
    eenheid
      ? maak('span', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld,
        maak('span', { klasse: 'uitleg', tekst: eenheid, stijl: { flex: 'none' } }))
      : veld);
const kolommenRij = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '8px 10px', alignItems: 'end' } },
    ...kinderen);
function vinkje(tekst, aan) {
  const vak = maak('input', { type: 'checkbox' });
  vak.checked = Boolean(aan);
  return { vak, el: maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', height: '26px' } }, vak, tekst) };
}
const getal = (n, c = 0) => n.toLocaleString('nl-NL', { maximumFractionDigits: c });

/**
 * Het gemeenschappelijke venster: velden, voorvertoning, samenvatting en de knoppen.
 * `bouw(waarden)` geeft { vormen, samenvatting, fout } terug.
 */
async function venster({ sleutel, standaard, velden, waarden, bouw, knop, melding, variant }) {
  const doc = await vexel.document();
  const kleur = kleurMaker(doc.kleurruimte === 'cmyk');
  const w0 = { ...standaard, ...((await vexel.haal(sleutel)) || {}) };
  const v = velden(w0);
  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '250px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: knop });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const extra = variant ? maak('button', { klasse: 'knop', type: 'button', tekst: 'Andere variant' }) : null;
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px', padding: '12px 14px 14px' } },
    doek, ...v.rijen, samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, extra, extra ? maak('span', { stijl: { flex: '1' } }) : null, annuleer, maakKnop));
  document.head.append(maak('style', { tekst: '.veld:disabled{opacity:.45}.knop{white-space:nowrap}.verborgen{display:none!important}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  let laatste = null;
  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden(v);
    if (v.bijwerken) v.bijwerken(w);
    laatste = { w, ...bouw(w, doc.tekengebied, kleur) };
    const tel = telVormen(laatste.vormen);
    let fout = laatste.fout;
    if (!fout && tel.n > 5000) fout = `Dat worden ${tel.n} vormen; hooguit 5000 in één keer. Kies minder.`;
    if (!fout && tel.p > 50000) fout = `Dat worden ${tel.p} punten; hooguit 50 000 in één keer. Kies minder.`;
    if (doc.alleenLezen) fout = 'Dit document is alleen-lezen; je kunt hier niets aan toevoegen.';
    laatste.fout = fout;
    voorvertoning(doek, laatste.voorbeeld || laatste.vormen, laatste.kader || kaderVan(laatste.voorbeeld || laatste.vormen));
    samenvatting.textContent = fout || laatste.samenvatting;
    samenvatting.classList.toggle('fout', Boolean(fout));
    maakKnop.disabled = Boolean(fout);
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };
  if (extra) {
    extra.addEventListener('click', () => {
      v.zaad.value = String(1 + Math.floor(Math.random() * 99999));
      plan();
    });
  }
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    teken();
    if (laatste.fout) return;
    maakKnop.disabled = true;
    try {
      await vexel.maak(laatste.vormen);
      await vexel.bewaar(sleutel, laatste.w);
      vexel.melding(melding(laatste), 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Dat lukte niet.', 'fout');
    }
  });
  teken();
}

// ---- de drie commando's ----------------------------------------------------------------

vexel.opCommando('dobbelsteen', () => venster({
  sleutel: 'dobbelsteen',
  standaard: { vorm: 'bouwplaat', zijde: 30, ogen: 'rond', kleur: 'wit', hoek: 3, aantal: 1, steunkleur: false },
  knop: 'Dobbelsteen maken',
  velden: (w0) => {
    const v = {
      vorm: keuzeVeld([['bouwplaat', 'Bouwplaat (kubus om te vouwen)'], ['vlakken', 'Losse vlakken 1–6']], w0.vorm),
      zijde: getalVeld(w0.zijde, 8, 80, 1),
      ogen: keuzeVeld([['rond', 'Ronde ogen'], ['vierkant', 'Vierkante ogen'], ['cijfers', 'Cijfers']], w0.ogen),
      kleur: keuzeVeld(Object.entries(DOBBEL_KLEUREN).map(([k, x]) => [k, x.naam]), w0.kleur),
      hoek: getalVeld(w0.hoek, 0, 15, 0.5),
      aantal: getalVeld(w0.aantal, 1, 60, 1),
      steunkleur: vinkje('Snij- en rillijn als steunkleur', w0.steunkleur),
    };
    v.hoekVak = metLabel('Hoeken', v.hoek, 'mm');
    v.rijen = [
      kolommenRij('1.4fr 1fr', metLabel('Vorm', v.vorm), metLabel('Zijde', v.zijde, 'mm')),
      kolommenRij('1fr 1.4fr', metLabel('Ogen', v.ogen), metLabel('Kleur', v.kleur)),
      kolommenRij('1fr 1fr 1.4fr', metLabel('Aantal', v.aantal), v.hoekVak, v.steunkleur.el),
    ];
    v.bijwerken = (w) => {
      v.hoekVak.classList.toggle('verborgen', w.vorm !== 'vlakken');
      v.steunkleur.el.classList.toggle('verborgen', w.vorm !== 'bouwplaat');
    };
    return v;
  },
  waarden: (v) => ({
    vorm: v.vorm.value, zijde: begrens(leesGetal(v.zijde, 30), 8, 80), ogen: v.ogen.value, kleur: v.kleur.value,
    hoek: begrens(leesGetal(v.hoek, 3), 0, 15), aantal: Math.round(begrens(leesGetal(v.aantal, 1), 1, 60)), steunkleur: v.steunkleur.vak.checked,
  }),
  bouw: (w, tg, kleur) => {
    const r = dobbelVormen(w, tg, kleur);
    const [b, h] = r.maat.map((x) => vexel.naarMm(x));
    if (b > vexel.naarMm(tg.b) || h > vexel.naarMm(tg.h)) {
      return { vormen: [], fout: `Dat wordt ${getal(b)} × ${getal(h)} mm en past niet op het tekengebied. Kies een kleinere zijde.` };
    }
    const n = r.vormen.length;
    let tekst = w.vorm === 'bouwplaat'
      ? `${n} ${n === 1 ? 'bouwplaat' : 'bouwplaten'} van ${getal(b)} × ${getal(h)} mm: een kubus van ${getal(w.zijde)} mm met 7 lijmranden; overstaande vlakken samen 7.`
      : `${n} ${n === 1 ? 'set' : 'sets'} van zes vlakken van ${getal(w.zijde)} mm.`;
    if (w.aantal > r.past) tekst += r.past === 1 ? ' Er past er maar één op het tekengebied.' : ` Er passen er ${r.past} op het tekengebied.`;
    return { vormen: r.vormen, voorbeeld: r.vormen.slice(0, 1), samenvatting: tekst };
  },
  melding: (r) => (r.w.vorm === 'bouwplaat' ? 'Bouwplaat gemaakt: snijden over de doorgetrokken lijn, vouwen over de stippellijnen.' : 'Dobbelsteenvlakken gemaakt.'),
}));

vexel.opCommando('kaarten', () => venster({
  sleutel: 'kaarten',
  standaard: { formaat: 'poker', b: 63, h: 88, hoek: 3, inhoud: 'kleur', kleur: 'harten', plaatjes: 'bvh', vierkleuren: false, snijruimte: 4, aantalLeeg: 9 },
  knop: 'Kaarten maken',
  velden: (w0) => {
    const v = {
      formaat: keuzeVeld(Object.entries(KAARTMATEN).map(([k, x]) => [k, x.naam]), w0.formaat),
      b: getalVeld(w0.b, 30, 150, 1),
      h: getalVeld(w0.h, 40, 200, 1),
      hoek: getalVeld(w0.hoek, 0, 10, 0.5),
      inhoud: keuzeVeld([['kleur', 'Eén kleur (13 kaarten)'], ['alle', 'Alle vier kleuren (52)'], ['leeg', 'Lege indeling']], w0.inhoud),
      kleur: keuzeVeld(KLEUREN.map((k) => [k, KLEURNAAM[k]]), w0.kleur),
      plaatjes: keuzeVeld([['bvh', 'B, V, H'], ['jqk', 'J, Q, K']], w0.plaatjes),
      vierkleuren: vinkje('Vier kleuren', w0.vierkleuren),
      snijruimte: getalVeld(w0.snijruimte, 0, 20, 0.5),
      aantalLeeg: getalVeld(w0.aantalLeeg, 1, 200, 1),
    };
    v.vierkleuren.el.title = 'Ruiten blauw en klaveren groen, makkelijker te onderscheiden';
    v.kleurVak = metLabel('Kleur', v.kleur);
    v.leegVak = metLabel('Aantal', v.aantalLeeg);
    v.rijen = [
      kolommenRij('1.6fr 0.8fr 0.8fr 0.8fr', metLabel('Formaat', v.formaat), metLabel('Breedte', v.b, 'mm'), metLabel('Hoogte', v.h, 'mm'), metLabel('Hoeken', v.hoek, 'mm')),
      kolommenRij('1.5fr 1fr 1fr', metLabel('Kaarten', v.inhoud), v.kleurVak, v.leegVak),
      kolommenRij('1fr 1fr 1fr', v.plaatjesVak = metLabel('Plaatjes', v.plaatjes), metLabel('Snijruimte', v.snijruimte, 'mm'), v.vierkleuren.el),
    ];
    v.formaat.addEventListener('change', () => {
      const f = KAARTMATEN[v.formaat.value];
      if (f && f.b) {
        v.b.value = String(f.b);
        v.h.value = String(f.h);
      }
    });
    v.bijwerken = (w) => {
      v.b.disabled = w.formaat !== 'eigen';
      v.h.disabled = w.formaat !== 'eigen';
      v.kleurVak.classList.toggle('verborgen', w.inhoud !== 'kleur');
      v.leegVak.classList.toggle('verborgen', w.inhoud !== 'leeg');
      v.plaatjesVak.style.visibility = w.inhoud === 'leeg' ? 'hidden' : '';
      v.vierkleuren.el.style.visibility = w.inhoud === 'leeg' ? 'hidden' : '';
    };
    return v;
  },
  waarden: (v) => {
    const f = KAARTMATEN[v.formaat.value];
    const eigen = !f || !f.b;
    return {
      formaat: v.formaat.value,
      b: eigen ? begrens(leesGetal(v.b, 63), 30, 150) : f.b,
      h: eigen ? begrens(leesGetal(v.h, 88), 40, 200) : f.h,
      hoek: begrens(leesGetal(v.hoek, 3), 0, 10), inhoud: v.inhoud.value, kleur: v.kleur.value, plaatjes: v.plaatjes.value,
      vierkleuren: v.vierkleuren.vak.checked, snijruimte: begrens(leesGetal(v.snijruimte, 4), 0, 20),
      aantalLeeg: Math.round(begrens(leesGetal(v.aantalLeeg, 9), 1, 200)),
    };
  },
  bouw: (w, tg, kleur) => {
    const r = kaartenVormen(w, tg, kleur);
    if (!r.perVel) return { vormen: [], fout: `Een kaart van ${getal(w.b)} × ${getal(w.h)} mm past niet op het tekengebied.` };
    // voorbeeld: de eerste drie kaarten groot
    const B = vexel.mm(w.b);
    const H = vexel.mm(w.h);
    const proef = [];
    const lijst = w.inhoud === 'leeg' ? [null] : w.inhoud === 'kleur' ? ['A', '7', rangen(w)[11]].map((rang) => ({ rang, kl: w.kleur }))
      : [{ rang: 'A', kl: 'schoppen' }, { rang: '7', kl: 'harten' }, { rang: rangen(w)[12], kl: 'klaveren' }];
    lijst.forEach((k, i) => proef.push(kaartVormen(i * (B + vexel.mm(4)), 0, w, kleur, k)));
    let tekst = `${r.n} ${r.n === 1 ? 'kaart' : 'kaarten'} van ${getal(w.b)} × ${getal(w.h)} mm`;
    tekst += r.vellen > 1 ? ` op ${r.vellen} vellen (${r.perVel} per vel); de volgende vellen komen rechts naast het tekengebied.` : ` op één vel (${r.kol} × ${r.rij}).`;
    return { vormen: r.vormen, voorbeeld: proef, samenvatting: tekst };
  },
  melding: (r) => `Speelkaarten gemaakt${r.vormen.length > 1 ? ` op ${r.vormen.length} vellen` : ''}.`,
}));

vexel.opCommando('bord', () => venster({
  sleutel: 'bord',
  standaard: { vakken: 63, indeling: 'spiraal', maat: 180, bonus: 8, zaad: 1 },
  knop: 'Speelbord maken',
  variant: true,
  velden: (w0) => {
    const v = {
      vakken: getalVeld(w0.vakken, 10, 150, 1),
      indeling: keuzeVeld([['spiraal', 'Spiraal naar het midden'], ['slinger', 'Slinger (heen en weer)']], w0.indeling),
      maat: getalVeld(w0.maat, 80, 600, 5),
      bonus: getalVeld(w0.bonus, 0, 40, 1),
      zaad: getalVeld(w0.zaad, 1, 99999, 1),
    };
    v.rijen = [
      kolommenRij('1fr 1.6fr 1fr', metLabel('Vakken', v.vakken), metLabel('Indeling', v.indeling), metLabel('Breedte', v.maat, 'mm')),
      kolommenRij('1fr 1fr 1.6fr', metLabel('Sterrenvakken', v.bonus), metLabel('Variant', v.zaad), maak('span')),
    ];
    return v;
  },
  waarden: (v) => ({
    vakken: Math.round(begrens(leesGetal(v.vakken, 63), 10, 150)), indeling: v.indeling.value, maat: begrens(leesGetal(v.maat, 180), 80, 600),
    bonus: Math.round(begrens(leesGetal(v.bonus, 8), 0, 40)), zaad: Math.round(begrens(leesGetal(v.zaad, 1), 1, 99999)),
  }),
  bouw: (w, tg, kleur) => {
    const r = bordVormen(w, tg, kleur);
    const [b, h] = r.maat.map((x) => vexel.naarMm(x));
    let tekst = `Een bord van ${getal(b)} × ${getal(h)} mm met ${w.vakken} vakken, van START naar FINISH, ${r.bonus} sterrenvakken.`;
    if (vexel.mm(h) > tg.h) tekst += ' Let op: het is hoger dan het tekengebied.';
    if (w.maat > vexel.naarMm(tg.b)) tekst += ' Het is zo breed gemaakt als het tekengebied.';
    return { vormen: r.vormen, samenvatting: tekst };
  },
  melding: () => 'Speelbord gemaakt. Bedenk zelf de regels voor de sterrenvakken!',
}));
