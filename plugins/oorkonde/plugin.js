// Oorkonde: een certificaat of diploma met sierlijke rand, tekst, handtekeningen en zegel.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

// ---- kleine hulpjes (venster, getallen, kleuren, toeval) ---------------------

const PT = vexel.mm(1);

/** Maakt een element: el('div', { klasse, tekst, stijl, bijClick, ...attributen }, ...kinderen). */
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
  for (const kind of kinderen) if (kind) e.append(kind);
  return e;
}

const getalVeld = (waarde, min, max, stap = 1) =>
  el('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
const tekstVeld = (waarde, plaatshouder, max = 200) =>
  el('input', { klasse: 'veld', type: 'text', value: waarde, placeholder: plaatshouder, maxlength: max, spellcheck: 'false' });

function keuze(opties, waarde) {
  const e = el('select', { klasse: 'veld' }, ...Object.entries(opties).map(([w, t]) => el('option', { value: w, tekst: t })));
  e.value = Object.prototype.hasOwnProperty.call(opties, waarde) ? waarde : Object.keys(opties)[0];
  return e;
}

/** Een veld met het label erboven (en eventueel de eenheid). */
function vak(tekst, veld, eenheid) {
  veld.style.width = '100%';
  veld.style.minWidth = '0';
  const kop = el('span', { klasse: 'label', tekst, stijl: { minWidth: '0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } });
  if (eenheid) kop.append(el('span', { tekst: ` (${eenheid})`, stijl: { opacity: '0.7' } }));
  return el('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } }, kop, veld);
}

function vinkje(tekst, aan) {
  const invoer = el('input', { type: 'checkbox' });
  invoer.checked = Boolean(aan);
  const label = el('label', { stijl: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--tekst-zacht)', minWidth: '0' } }, invoer, el('span', { tekst }));
  return { label, invoer };
}

const kolom = (n, ...k) => el('div', { stijl: { display: 'grid', gridTemplateColumns: typeof n === 'number' ? `repeat(${n}, minmax(0, 1fr))` : n, gap: '8px', alignItems: 'end' } }, ...k);
const kop = (tekst) => el('div', { klasse: 'label', tekst, stijl: { fontWeight: '600', color: 'var(--tekst)', margin: '2px 0 -3px' } });

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return String(veld.value).trim() !== '' && Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const mmTekst = (n, dec = 1) => (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('nl-NL', { maximumFractionDigits: dec });
const getalTekst = (n) => n.toLocaleString('nl-NL');
const themaKleur = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

/** Een kleur voor het document: CMYK in een CMYK-document, anders hex. */
function kleurIn(cmyk, hex, isCmyk) {
  return isCmyk ? { cmyk } : { hex };
}
/** Benadering van een CMYK-kleur op het scherm (voor de voorvertoning). */
function cmykNaarCss(c) {
  const [a, m, y, k] = c.map((v) => v / 100);
  const f = (v) => Math.round(255 * (1 - v) * (1 - k));
  return `rgb(${f(a)}, ${f(m)}, ${f(y)})`;
}

/** Een voorspelbare toevalsgenerator (mulberry32): hetzelfde zaadje geeft hetzelfde resultaat. */
function toeval(zaad) {
  let a = zaad >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Mengt een paar getallen en teksten tot één zaadje. */
function mengZaad(...delen) {
  let h = 2166136261;
  for (const deel of delen) {
    const s = String(deel);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 124;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function schud(lijst, r) {
  for (let i = lijst.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [lijst[i], lijst[j]] = [lijst[j], lijst[i]];
  }
  return lijst;
}

/** Zet een canvas klaar op de juiste resolutie; geeft { g, b, h } in css-pixels. */
function canvasKlaar(canvas) {
  const schaal = devicePixelRatio || 1;
  const kader = canvas.getBoundingClientRect();
  const b = Math.max(10, kader.width);
  const h = Math.max(10, kader.height);
  canvas.width = Math.round(b * schaal);
  canvas.height = Math.round(h * schaal);
  const g = canvas.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, b, h);
  return { g, b, h };
}

/** Een rechthoek als pad met gesloten subpad (in pt). */
const rechthoekPunten = (x, y, b, h) => ({ gesloten: true, punten: [{ x, y }, { x: x + b, y }, { x: x + b, y: y + h }, { x, y: y + h }] });
const lijnStuk = (x1, y1, x2, y2) => ({ gesloten: false, punten: [{ x: x1, y: y1 }, { x: x2, y: y2 }] });
const rond = (n, d = 100) => Math.round(n * d) / d;

/** Telt vormen zoals Vexel dat doet: elke vorm en elke groep telt mee (hooguit 5000 per keer). */
function telVormen(lijst) {
  let n = 0;
  for (const o of lijst) n += 1 + (o.soort === 'groep' ? telVormen(o.kinderen) : 0);
  return n;
}
const MAX_PER_KEER = 5000;
// ---- formaten en kleuren -------------------------------------------------------------

const FORMATEN = {
  tekengebied: { naam: 'Tekengebied' },
  a4l: { naam: 'A4 liggend', b: 297, h: 210 },
  a4s: { naam: 'A4 staand', b: 210, h: 297 },
  a5l: { naam: 'A5 liggend', b: 210, h: 148 },
  a5s: { naam: 'A5 staand', b: 148, h: 210 },
};

const STIJLEN = { klassiek: 'Klassiek', modern: 'Modern', speels: 'Speels', sportief: 'Sportief' };

// hoofdkleur en bijkleur per kleurset
const KLEURSETS = {
  blauw: { naam: 'Marineblauw', hoofd: { cmyk: [100, 78, 20, 32], hex: '#1d3557' }, bij: { cmyk: [12, 32, 85, 8], hex: '#c49a3c' } },
  bordeaux: { naam: 'Bordeaux', hoofd: { cmyk: [20, 100, 70, 40], hex: '#7b1e2b' }, bij: { cmyk: [12, 32, 85, 8], hex: '#c49a3c' } },
  groen: { naam: 'Groen', hoofd: { cmyk: [85, 30, 80, 30], hex: '#1f5a3c' }, bij: { cmyk: [12, 32, 85, 8], hex: '#c49a3c' } },
  paars: { naam: 'Paars', hoofd: { cmyk: [75, 95, 10, 15], hex: '#4b2a7b' }, bij: { cmyk: [0, 45, 90, 0], hex: '#f39a2e' } },
  zwart: { naam: 'Zwart en zilver', hoofd: { cmyk: [0, 0, 0, 100], hex: '#1a1a1a' }, bij: { cmyk: [0, 0, 0, 38], hex: '#a3a3a3' } },
};
const SPEELS = [
  { cmyk: [0, 75, 60, 0], hex: '#f05a4f' }, { cmyk: [0, 22, 90, 0], hex: '#fdc52f' }, { cmyk: [50, 0, 95, 0], hex: '#8cc63f' },
  { cmyk: [85, 35, 0, 0], hex: '#1f8ad1' }, { cmyk: [60, 75, 0, 0], hex: '#7d55a5' },
];

// ---- meetkunde ---------------------------------------------------------------------------

/** Een afgeronde rechthoek als lijn met lengteparameter: punt en normaal (naar binnen) op afstand t. */
function omtrek(x, y, b, h, r) {
  const delen = [
    { soort: 'lijn', l: b - 2 * r, x0: x + r, y0: y, dx: 1, dy: 0 },
    { soort: 'boog', l: Math.PI * r / 2, cx: x + b - r, cy: y + r, a0: -Math.PI / 2 },
    { soort: 'lijn', l: h - 2 * r, x0: x + b, y0: y + r, dx: 0, dy: 1 },
    { soort: 'boog', l: Math.PI * r / 2, cx: x + b - r, cy: y + h - r, a0: 0 },
    { soort: 'lijn', l: b - 2 * r, x0: x + b - r, y0: y + h, dx: -1, dy: 0 },
    { soort: 'boog', l: Math.PI * r / 2, cx: x + r, cy: y + h - r, a0: Math.PI / 2 },
    { soort: 'lijn', l: h - 2 * r, x0: x, y0: y + h - r, dx: 0, dy: -1 },
    { soort: 'boog', l: Math.PI * r / 2, cx: x + r, cy: y + r, a0: Math.PI },
  ];
  const L = delen.reduce((s, d) => s + d.l, 0);
  const punt = (t) => {
    let rest = ((t % L) + L) % L;
    for (const d of delen) {
      if (rest <= d.l || d === delen[delen.length - 1]) {
        if (d.soort === 'lijn') return { x: d.x0 + d.dx * rest, y: d.y0 + d.dy * rest, nx: -d.dy, ny: d.dx };
        const a = d.a0 + (r > 0 ? rest / r : 0);
        return { x: d.cx + Math.cos(a) * r, y: d.cy + Math.sin(a) * r, nx: -Math.cos(a), ny: -Math.sin(a) };
      }
      rest -= d.l;
    }
    return null;
  };
  return { L, punt };
}

const pt2 = (x, y) => ({ x: rond(x), y: rond(y) });
function cirkel(cx, cy, r) {
  const k = r * 0.5522847498;
  return { gesloten: true, punten: [
    { x: rond(cx), y: rond(cy - r), in: pt2(cx - k, cy - r), uit: pt2(cx + k, cy - r) },
    { x: rond(cx + r), y: rond(cy), in: pt2(cx + r, cy - k), uit: pt2(cx + r, cy + k) },
    { x: rond(cx), y: rond(cy + r), in: pt2(cx + k, cy + r), uit: pt2(cx - k, cy + r) },
    { x: rond(cx - r), y: rond(cy), in: pt2(cx - r, cy + k), uit: pt2(cx - r, cy - k) },
  ] };
}
/** Een gesloten kromme uit een functie van de hoek. */
function polair(cx, cy, n, straal, draai = 0) {
  const punten = [];
  for (let i = 0; i < n; i++) {
    const a = draai + i / n * Math.PI * 2;
    const r = straal(a);
    punten.push(pt2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return { gesloten: true, punten };
}
/** Een blad (spits aan twee kanten) van a naar b, met breedte w. */
function blad(ax, ay, bx, by, w) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / l * w;
  const ny = (bx - ax) / l * w;
  return { gesloten: true, punten: [
    { x: rond(ax), y: rond(ay), uit: pt2(ax + (mx - ax) * 0.4 + nx, ay + (my - ay) * 0.4 + ny), in: pt2(ax + (mx - ax) * 0.4 - nx, ay + (my - ay) * 0.4 - ny) },
    { x: rond(bx), y: rond(by), in: pt2(bx - (bx - mx) * 0.4 + nx, by - (by - my) * 0.4 + ny), uit: pt2(bx - (bx - mx) * 0.4 - nx, by - (by - my) * 0.4 - ny) },
  ] };
}
/** Een rolkromme: een rolcirkel binnen een vaste cirkel (p en q bepalen het aantal lussen). */
function spiro(cx, cy, R, p, q, dFactor, n = 900) {
  const a = R * p / (p + q * (dFactor - 1));
  const b = a * q / p;
  const d = b * dFactor;
  const punten = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2 * q;
    punten.push(pt2(cx + (a - b) * Math.cos(t) + d * Math.cos((a - b) / b * t), cy + (a - b) * Math.sin(t) - d * Math.sin((a - b) / b * t)));
  }
  return { gesloten: true, punten };
}

/** Een ster met n punten. */
function ster(cx, cy, n, buiten, binnen, draai = -Math.PI / 2) {
  const punten = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = draai + i * Math.PI / n;
    const r = i % 2 ? binnen : buiten;
    punten.push(pt2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return { gesloten: true, punten };
}

/** Knipt tekst in regels die ongeveer in een breedte passen (gemiddelde letterbreedte). */
function breek(tekst, breedte, grootte) {
  const max = Math.max(8, Math.floor(breedte / (grootte * 0.5)));
  const uit = [];
  for (const alinea of tekst.split('\n')) {
    let regel = '';
    for (const woord of alinea.split(/\s+/).filter(Boolean)) {
      if (!regel) regel = woord;
      else if ((regel + ' ' + woord).length <= max) regel += ' ' + woord;
      else { uit.push(regel); regel = woord; }
    }
    uit.push(regel);
  }
  return uit;
}

// ---- randen per stijl --------------------------------------------------------------------

/** Klassiek: een guillochéband van verweven golflijnen, met kaderlijnen en hoekrozetten. */
function randKlassiek(B, H, k) {
  const m = Math.min(B, H) * 0.045;
  const bw = Math.min(B, H) * 0.04;
  const r = bw * 1.2;
  const mid = omtrek(m + bw / 2, m + bw / 2, B - 2 * m - bw, H - 2 * m - bw, r);
  const golven = Math.round(mid.L / (bw * 1.6));
  const draden = [];
  const n = 7;
  const stap = 1.6;
  const aantal = Math.ceil(mid.L / stap);
  for (let j = 0; j < n; j++) {
    const fase = j * 2 * Math.PI / n;
    const punten = [];
    for (let i = 0; i < aantal; i++) {
      const t = i / aantal * mid.L;
      const p = mid.punt(t);
      const u = t / mid.L * 2 * Math.PI;
      const o = bw * 0.46 * Math.sin(golven * u + fase) * (0.78 + 0.22 * Math.cos(2 * golven * u - fase));
      punten.push(pt2(p.x + p.nx * o, p.y + p.ny * o));
    }
    draden.push({ gesloten: true, punten });
  }
  const kaders = [
    { soort: 'rechthoek', naam: 'Buitenlijn', x: m - 1.5, y: m - 1.5, b: B - 2 * m + 3, h: H - 2 * m + 3, vulling: null, lijn: k.hoofd, lijndikte: 1.6 },
    { soort: 'rechthoek', naam: 'Binnenlijn', x: m + bw + 1.5, y: m + bw + 1.5, b: B - 2 * (m + bw) - 3, h: H - 2 * (m + bw) - 3, vulling: null, lijn: k.hoofd, lijndikte: 0.8 },
    { soort: 'rechthoek', naam: 'Fijne lijn', x: m + bw + 6, y: m + bw + 6, b: B - 2 * (m + bw) - 12, h: H - 2 * (m + bw) - 12, vulling: null, lijn: k.bij, lijndikte: 0.5 },
  ];
  // rozetjes in de hoeken van de fijne lijn
  const rz = bw * 0.75;
  const hoeken = [[m + bw + 6, m + bw + 6], [B - m - bw - 6, m + bw + 6], [m + bw + 6, H - m - bw - 6], [B - m - bw - 6, H - m - bw - 6]];
  const schijven = hoeken.map(([cx, cy]) => cirkel(cx, cy, rz * 1.02));
  const rozetten = hoeken.map(([cx, cy]) => spiro(cx, cy, rz, 8, 3, 0.9, 600));
  const harten = hoeken.map(([cx, cy]) => cirkel(cx, cy, rz * 0.16));
  return { soort: 'groep', naam: 'Rand', kinderen: [
    { soort: 'pad', naam: 'Guillochéband', subpaden: draden, vulling: null, lijn: k.bij, lijndikte: 0.45 },
    ...kaders,
    { soort: 'pad', naam: 'Hoekschijven', subpaden: schijven, vulling: k.papier, lijn: k.hoofd, lijndikte: 0.8 },
    { soort: 'pad', naam: 'Hoekrozetten', subpaden: rozetten, vulling: null, lijn: k.hoofd, lijndikte: 0.4 },
    { soort: 'pad', naam: 'Hoekharten', subpaden: harten, vulling: k.bij, lijn: null },
  ], binnen: m + bw + 14 };
}

/** Modern: een dunne lijst en een brede kleurbalk links. */
function randModern(B, H, k) {
  const m = Math.min(B, H) * 0.05;
  const balk = B * 0.075;
  return { soort: 'groep', naam: 'Rand', kinderen: [
    { soort: 'rechthoek', naam: 'Kleurbalk', x: 0, y: 0, b: balk, h: H, vulling: k.hoofd, lijn: null },
    { soort: 'rechthoek', naam: 'Accentlijn', x: balk + 3, y: 0, b: 2.5, h: H, vulling: k.bij, lijn: null },
    { soort: 'rechthoek', naam: 'Lijst', x: balk + m, y: m, b: B - balk - 2 * m, h: H - 2 * m, vulling: null, lijn: k.hoofd, lijndikte: 0.6 },
  ], binnen: m + 16, links: balk + m + 16 };
}

/** Speels: een rand van gekleurde rondjes en confetti in de marge. */
function randSpeels(B, H, k, zaad) {
  const m = Math.min(B, H) * 0.06;
  const r = Math.min(B, H) * 0.022;
  const lijn = omtrek(m, m, B - 2 * m, H - 2 * m, r * 2);
  const n = Math.round(lijn.L / (r * 2.25));
  const perKleur = SPEELS.map(() => []);
  for (let i = 0; i < n; i++) {
    const p = lijn.punt(i / n * lijn.L);
    perKleur[i % SPEELS.length].push(cirkel(p.x, p.y, r * (i % 2 ? 0.78 : 1)));
  }
  const rnd = toeval(mengZaad('oorkonde', zaad));
  const confetti = SPEELS.map(() => []);
  for (let i = 0; i < 70; i++) {
    // alleen in de marge buiten de bolletjes, of net erbinnen in de hoeken
    let x;
    let y;
    const kant = Math.floor(rnd() * 4);
    const vrij = 4 * PT;
    const diep = vrij + rnd() * Math.max(1, m - r * 1.6 - vrij);
    const langs = (l) => vrij + rnd() * (l - 2 * vrij);
    if (kant === 0) { x = langs(B); y = diep; } else if (kant === 1) { x = B - diep; y = langs(H); } else if (kant === 2) { x = langs(B); y = H - diep; } else { x = diep; y = langs(H); }
    const g = r * (0.25 + rnd() * 0.35);
    const soort = Math.floor(rnd() * 3);
    const c = Math.floor(rnd() * SPEELS.length);
    if (soort === 0) confetti[c].push(cirkel(x, y, g));
    else if (soort === 1) confetti[c].push(ster(x, y, 5, g * 1.4, g * 0.6, rnd() * 6));
    else {
      const a = rnd() * Math.PI;
      const dx = Math.cos(a) * g * 1.4;
      const dy = Math.sin(a) * g * 1.4;
      const ex = -Math.sin(a) * g * 0.45;
      const ey = Math.cos(a) * g * 0.45;
      confetti[c].push({ gesloten: true, punten: [pt2(x - dx - ex, y - dy - ey), pt2(x + dx - ex, y + dy - ey), pt2(x + dx + ex, y + dy + ey), pt2(x - dx + ex, y - dy + ey)] });
    }
  }
  const kinderen = [];
  perKleur.forEach((lijst, i) => kinderen.push({ soort: 'pad', naam: `Bolletjes ${i + 1}`, subpaden: lijst, vulling: k.speels[i], lijn: null }));
  confetti.forEach((lijst, i) => { if (lijst.length) kinderen.push({ soort: 'pad', naam: `Confetti ${i + 1}`, subpaden: lijst, vulling: k.speels[i], lijn: null }); });
  kinderen.push({ soort: 'rechthoek', naam: 'Binnenlijn', x: m + r * 2.2, y: m + r * 2.2, b: B - 2 * (m + r * 2.2), h: H - 2 * (m + r * 2.2),
    vulling: null, lijn: k.hoofd, lijndikte: 1.2, streep: [0.1, 4], lijneinde: 'round' });
  return { soort: 'groep', naam: 'Rand', kinderen, binnen: m + r * 2.2 + 12 };
}

/** Sportief: een stevige lijst met schuine strepen in twee hoeken. */
function randSportief(B, H, k) {
  const m = Math.min(B, H) * 0.04;
  const s = Math.min(B, H) * 0.3;
  const strepen = [[], []];
  const breed = s / 9;
  for (let i = 0; i < 9; i++) {
    const c1 = i * breed;
    const c2 = (i + 1) * breed;
    const doel = strepen[i % 2];
    doel.push({ gesloten: true, punten: [pt2(c1, 0), pt2(c2, 0), pt2(0, c2), pt2(0, c1)] });
    doel.push({ gesloten: true, punten: [pt2(B - c1, H), pt2(B - c2, H), pt2(B, H - c2), pt2(B, H - c1)] });
  }
  return { soort: 'groep', naam: 'Rand', kinderen: [
    { soort: 'pad', naam: 'Strepen', subpaden: strepen[0], vulling: k.hoofd, lijn: null },
    { soort: 'pad', naam: 'Strepen licht', subpaden: strepen[1], vulling: k.bij, lijn: null },
    { soort: 'rechthoek', naam: 'Lijst', x: m, y: m, b: B - 2 * m, h: H - 2 * m, vulling: null, lijn: k.hoofd, lijndikte: 5 },
    { soort: 'rechthoek', naam: 'Binnenlijn', x: m + 7, y: m + 7, b: B - 2 * m - 14, h: H - 2 * m - 14, vulling: null, lijn: k.bij, lijndikte: 1.2 },
  ], binnen: m + 22 };
}

// ---- zegels ----------------------------------------------------------------------------

function zegel(stijl, cx, cy, R, tekst, k) {
  const kinderen = [];
  const tekstVorm = (kleur, g = R * 0.3, gewicht = 800) => ({ soort: 'tekst', naam: 'Zegeltekst', x: rond(cx), y: rond(cy + g * 0.36), inhoud: tekst || '★',
    grootte: rond(Math.min(g, R * 1.15 / Math.max(2, (tekst || '★').length) * 1.6)), gewicht, uitlijning: 'midden', letterafstand: 40, vulling: kleur });
  if (stijl === 'klassiek') {
    // linten
    const lint = (zijde) => ({ gesloten: true, punten: [pt2(cx + zijde * R * 0.25, cy + R * 0.3), pt2(cx + zijde * R * 0.8, cy + R * 1.55),
      pt2(cx + zijde * R * 0.5, cy + R * 1.38), pt2(cx + zijde * R * 0.36, cy + R * 1.7), pt2(cx - zijde * R * 0.12, cy + R * 0.5)] });
    kinderen.push({ soort: 'pad', naam: 'Linten', subpaden: [lint(-1), lint(1)], vulling: k.hoofd, lijn: null });
    kinderen.push({ soort: 'pad', naam: 'Kartelrand', subpaden: [polair(cx, cy, 480, (a) => R * (1 + 0.05 * Math.sin(40 * a)))], vulling: k.bij, lijn: null });
    kinderen.push({ soort: 'pad', naam: 'Ring', subpaden: [cirkel(cx, cy, R * 0.84)], vulling: null, lijn: k.hoofd, lijndikte: 0.8 });
    kinderen.push({ soort: 'pad', naam: 'Guilloché', subpaden: [spiro(cx, cy, R * 0.8, 17, 7, 0.85, 1600)], vulling: null, lijn: k.hoofd, lijndikte: 0.3 });
    kinderen.push({ soort: 'pad', naam: 'Hart', subpaden: [cirkel(cx, cy, R * 0.36)], vulling: k.hoofd, lijn: k.bij, lijndikte: 0.8 });
    kinderen.push(tekstVorm(k.papier, R * 0.24));
  } else if (stijl === 'modern') {
    kinderen.push({ soort: 'pad', naam: 'Buitenring', subpaden: [cirkel(cx, cy, R)], vulling: null, lijn: k.hoofd, lijndikte: 1.4 });
    const stippen = [];
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      stippen.push(cirkel(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, R * 0.028));
    }
    kinderen.push({ soort: 'pad', naam: 'Stippen', subpaden: stippen, vulling: k.bij, lijn: null });
    kinderen.push({ soort: 'pad', naam: 'Schijf', subpaden: [cirkel(cx, cy, R * 0.7)], vulling: k.hoofd, lijn: null });
    kinderen.push(tekstVorm(k.papier, R * 0.3, 700));
  } else if (stijl === 'speels') {
    kinderen.push({ soort: 'pad', naam: 'Ster', subpaden: [ster(cx, cy, 16, R, R * 0.8)], vulling: k.speels[1], lijn: null });
    kinderen.push({ soort: 'pad', naam: 'Schijf', subpaden: [cirkel(cx, cy, R * 0.66)], vulling: k.papier, lijn: k.speels[0], lijndikte: 2, streep: [0.1, 3.2], lijneinde: 'round' });
    kinderen.push(tekstVorm(k.hoofd, R * 0.32));
  } else {
    // medaille met lint en twee lauriertakken
    const lint = (zijde) => ({ gesloten: true, punten: [pt2(cx + zijde * R * 0.05, cy - R * 0.9), pt2(cx + zijde * R * 0.65, cy - R * 2.1),
      pt2(cx + zijde * R * 1.05, cy - R * 2.1), pt2(cx + zijde * R * 0.5, cy - R * 0.75)] });
    kinderen.push({ soort: 'pad', naam: 'Lint', subpaden: [lint(-1), lint(1)], vulling: k.hoofd, lijn: null });
    const bladeren = [];
    const stelen = [];
    const rs = R * 1.18;
    for (const zijde of [-1, 1]) {
      const steel = [];
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI / 2 + zijde * (0.28 + i / n * 2.25);
        steel.push({ x: cx + Math.cos(a) * rs, y: cy + Math.sin(a) * rs, a });
      }
      stelen.push({ gesloten: false, punten: steel.map((q) => pt2(q.x, q.y)) });
      steel.slice(1).forEach((q, i) => {
        // raaklijn langs de steel, omhoog
        const tx = -Math.sin(q.a) * zijde;
        const ty = Math.cos(q.a) * zijde;
        const l = R * (0.42 - i * 0.012);
        for (const kant of [-1, 1]) {
          const hoek = 0.75 * kant;
          const dx = tx * Math.cos(hoek) - ty * Math.sin(hoek);
          const dy = tx * Math.sin(hoek) + ty * Math.cos(hoek);
          bladeren.push(blad(q.x, q.y, q.x + dx * l, q.y + dy * l, l * 0.2));
        }
      });
    }
    kinderen.push({ soort: 'pad', naam: 'Takken', subpaden: stelen, vulling: null, lijn: k.hoofd, lijndikte: 1.1, lijneinde: 'round' });
    kinderen.push({ soort: 'pad', naam: 'Laurier', subpaden: bladeren, vulling: k.hoofd, lijn: null });
    kinderen.push({ soort: 'pad', naam: 'Medaille', subpaden: [cirkel(cx, cy, R * 0.92)], vulling: k.bij, lijn: k.hoofd, lijndikte: 1.2 });
    kinderen.push({ soort: 'pad', naam: 'Ster', subpaden: [ster(cx, cy, 5, R * 0.62, R * 0.26)], vulling: null, lijn: k.papier, lijndikte: 1 });
    kinderen.push(tekstVorm(k.hoofd, R * 0.28));
  }
  return { soort: 'groep', naam: 'Zegel', kinderen };
}

// ---- de oorkonde ---------------------------------------------------------------------------

function maat(w, doc) {
  const tb = doc.tekengebied.b / PT;
  const th = doc.tekengebied.h / PT;
  const f = FORMATEN[w.formaat];
  const b = f && f.b ? f.b : tb;
  const h = f && f.h ? f.h : th;
  const past = Math.abs(b - tb) < 0.6 && Math.abs(h - th) < 0.6;
  return { b, h, tb, th, past, x: past ? 0 : (tb - b) / 2, y: past ? 0 : (th - h) / 2, tePast: b > tb + 0.5 || h > th + 0.5 };
}

/** Schuift een vorm (of groep) op zijn plek. */
function verschuif(o, dx, dy) {
  if (o.soort === 'groep') { o.kinderen.forEach((kind) => verschuif(kind, dx, dy)); return; }
  if (o.soort === 'rechthoek' || o.soort === 'tekst') { o.x = rond(o.x + dx); o.y = rond(o.y + dy); return; }
  if (o.soort === 'pad') {
    for (const sp of o.subpaden) {
      for (const p of sp.punten) {
        p.x = rond(p.x + dx); p.y = rond(p.y + dy);
        if (p.in) p.in = pt2(p.in.x + dx, p.in.y + dy);
        if (p.uit) p.uit = pt2(p.uit.x + dx, p.uit.y + dy);
      }
    }
  }
}

function bouwVormen(w, m, cmyk) {
  const set = KLEURSETS[w.kleur] || KLEURSETS.blauw;
  const k = {
    hoofd: kleurIn(set.hoofd.cmyk, set.hoofd.hex, cmyk), bij: kleurIn(set.bij.cmyk, set.bij.hex, cmyk),
    tekst: kleurIn([0, 0, 0, 88], '#2b2b2b', cmyk), zacht: kleurIn([0, 0, 0, 60], '#666666', cmyk), papier: kleurIn([0, 0, 0, 0], '#ffffff', cmyk),
    speels: SPEELS.map((c) => kleurIn(c.cmyk, c.hex, cmyk)),
  };
  const B = m.b * PT;
  const H = m.h * PT;
  const rand = w.stijl === 'klassiek' ? randKlassiek(B, H, k) : w.stijl === 'modern' ? randModern(B, H, k)
    : w.stijl === 'speels' ? randSpeels(B, H, k, w.zaad) : randSportief(B, H, k);
  const binnen = rand.binnen;
  delete rand.binnen;
  const links = rand.links || binnen;
  delete rand.links;
  const modern = w.stijl === 'modern';
  const kort = Math.min(B, H);
  const xL = modern ? links : binnen;
  const xR = B - binnen;
  const breed = xR - xL;
  const xM = modern ? xL : (xL + xR) / 2;
  const uitl = modern ? 'links' : 'midden';
  const bovenrand = binnen;
  const hoog = H - 2 * binnen;
  const liggend = B > H;

  // het tekstblok (titel tot datum), met y vanaf 0; f maakt alles kleiner als het niet past
  const maakBlok = (f) => {
    const teksten = [];
    const t = (naam, y, inhoud, grootte, extra = {}) => teksten.push({ soort: 'tekst', naam, x: rond(extra.x === undefined ? xM : extra.x), y: rond(y), inhoud, grootte: rond(grootte),
      uitlijning: extra.uitlijning || uitl, vulling: extra.vulling || k.tekst, gewicht: extra.gewicht, letterafstand: extra.letterafstand, regelafstand: extra.regelafstand });

    // titel, aanhef, naam
    const titelG = f * Math.min(kort * 0.085, breed / Math.max(4, w.titel.length) * 1.35);
    const titel = w.stijl === 'klassiek' || w.stijl === 'sportief' ? w.titel.toUpperCase() : w.titel;
    // eerst alles ten opzichte van de bovenkant van het tekstblok (0); straks in het midden gezet
    let y = titelG * 0.75;
    if (w.titel) t('Titel', y, titel, titelG, { gewicht: w.stijl === 'speels' ? 800 : 700, vulling: k.hoofd, letterafstand: w.stijl === 'klassiek' ? 160 : w.stijl === 'sportief' ? 80 : 0 });
    const aanhefG = f * kort * 0.026;
    y += titelG * 0.55 + aanhefG * 2.6;
    if (w.aanhef) t('Aanhef', y, w.aanhef.toUpperCase(), aanhefG, { gewicht: 600, letterafstand: 260, vulling: w.stijl === 'speels' ? k.zacht : k.bij });
    const naamG = f * Math.min(kort * 0.075, breed / Math.max(6, w.naam.length) * 1.75);
    y += aanhefG + naamG * 1.5;
    if (w.naam) t('Naam', y, w.naam, naamG, { gewicht: w.stijl === 'klassiek' ? 500 : 700, vulling: w.stijl === 'speels' ? k.hoofd : k.tekst });
    const versiering = [];
    y += naamG * 0.45;
    // lijn onder de naam, met een ruitje in het midden
    const lijnB = modern ? Math.min(breed * 0.55, naamG * w.naam.length * 0.55 + 20) : Math.min(breed * 0.62, kort * 0.75);
    const lx0 = modern ? xL : xM - lijnB / 2;
    versiering.push({ soort: 'pad', naam: 'Lijn onder de naam', subpaden: [lijnStuk(rond(lx0), rond(y), rond(lx0 + lijnB), rond(y))], vulling: null, lijn: k.bij, lijndikte: 0.9 });
    if (w.stijl === 'klassiek') {
      const r = 3.6;
      versiering.push({ soort: 'pad', naam: 'Ruitje', subpaden: [{ gesloten: true, punten: [pt2(xM, y - r), pt2(xM + r, y), pt2(xM, y + r), pt2(xM - r, y)] }],
        vulling: k.bij, lijn: k.papier, lijndikte: 1 });
    }
    // de tekst
    const tekstG = f * Math.max(8, kort * 0.031);
    const regels = breek(w.tekst, modern ? breed * 0.7 : breed * 0.78, tekstG);
    y += tekstG * 2.4;
    if (w.tekst) t('Tekst', y, regels.join('\n'), tekstG, { regelafstand: rond(tekstG * 1.45) });
    y += (regels.length - 1) * tekstG * 1.45;
    const datumG = tekstG * 0.92;
    y += datumG * 2.2;
    if (w.datum) t('Plaats en datum', y, w.datum, datumG, { vulling: k.zacht });
    const blokEind = y + datumG * 0.4;
    return { teksten, versiering, blokEind };
  };
  const tekstG = Math.max(8, kort * 0.031);

  // handtekeningen en zegel onderaan
  const onder = H - binnen - tekstG * 3.3;
  const R = kort * (liggend ? 0.085 : 0.075);
  const lijnLang = Math.min(breed * 0.3, kort * 0.36);
  let posities = [];
  let zegelX = modern ? xR - R : (xL + xR) / 2;
  if (modern) posities = w.handtekeningen === 2 ? [xL, xL + lijnLang + 30] : w.handtekeningen === 1 ? [xL] : [];
  else if (w.handtekeningen === 2) posities = [xL + breed * 0.2, xR - breed * 0.2];
  else if (w.handtekeningen === 1) { posities = [xR - breed * 0.22]; zegelX = xL + breed * 0.22; }
  const handGroep = [];
  posities.forEach((px, i) => {
    const naam = i === 0 ? w.naam1 : w.naam2;
    const functie = i === 0 ? w.functie1 : w.functie2;
    const x0 = modern ? px : px - lijnLang / 2;
    const kinderen = [{ soort: 'pad', naam: 'Lijn', subpaden: [lijnStuk(rond(x0), rond(onder), rond(x0 + lijnLang), rond(onder))], vulling: null, lijn: k.tekst, lijndikte: 0.6 }];
    const ax = modern ? x0 : px;
    if (naam) kinderen.push({ soort: 'tekst', naam: 'Naam', x: rond(ax), y: rond(onder + tekstG * 1.5), inhoud: naam, grootte: rond(tekstG * 0.9), gewicht: 600, uitlijning: uitl, vulling: k.tekst });
    if (functie) kinderen.push({ soort: 'tekst', naam: 'Functie', x: rond(ax), y: rond(onder + tekstG * 2.75), inhoud: functie, grootte: rond(tekstG * 0.78), uitlijning: uitl, vulling: k.zacht });
    handGroep.push({ soort: 'groep', naam: `Handtekening ${i + 1}`, kinderen });
  });

  // het tekstblok verticaal in het midden van de ruimte boven handtekeningen en zegel
  const zegelOnder = w.zegel && !modern;
  const ondergrens = zegelOnder ? onder - R * (w.stijl === 'sportief' ? 2.2 : 1.55) : onder - tekstG * (posities.length ? 2.5 : 0);
  const bovengrens = modern && w.zegel ? bovenrand + R * 2.4 : bovenrand + hoog * 0.04;
  const ruimte = ondergrens - bovengrens;
  let blok = maakBlok(1);
  if (blok.blokEind > ruimte) blok = maakBlok(Math.max(0.6, ruimte / blok.blokEind));
  const tekstGroep = { soort: 'groep', naam: 'Tekst', kinderen: [...blok.teksten, ...blok.versiering] };
  verschuif(tekstGroep, 0, bovengrens + Math.max(0, (ruimte - blok.blokEind) * 0.45));
  const uit = [rand];
  uit.push(tekstGroep);
  if (handGroep.length) uit.push({ soort: 'groep', naam: 'Handtekeningen', kinderen: handGroep });
  if (w.zegel) {
    const zy = modern ? bovenrand + R * 0.2 + R : onder - R * 0.35;
    uit.push(zegel(w.stijl, zegelX, w.stijl === 'sportief' ? onder - R * 0.6 : zy, R, w.zegelTekst, k));
  }
  // alles verschuiven naar de plek op het tekengebied
  if (m.x || m.y) uit.forEach((o) => verschuif(o, m.x * PT, m.y * PT));
  return [{ soort: 'groep', naam: `Oorkonde · ${STIJLEN[w.stijl].toLowerCase()} · ${w.naam || 'zonder naam'}`.slice(0, 100), kinderen: uit }];
}

// ---- voorvertoning: tekent dezelfde vormen op het canvas ------------------------------------

function kleurCss(k) {
  if (!k) return null;
  return k.hex || cmykNaarCss(k.cmyk);
}
function tekenVormen(g, vormen) {
  for (const o of vormen) {
    if (o.soort === 'groep') { tekenVormen(g, o.kinderen); continue; }
    const vul = kleurCss(o.vulling);
    const lijn = kleurCss(o.lijn);
    if (o.soort === 'tekst') {
      g.save();
      g.font = `${o.gewicht || 400} ${o.grootte}px system-ui, sans-serif`;
      g.fillStyle = vul || '#000';
      g.textAlign = { midden: 'center', rechts: 'right' }[o.uitlijning] || 'left';
      g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g && o.letterafstand) g.letterSpacing = `${o.letterafstand / 1000 * o.grootte}px`;
      o.inhoud.split('\n').forEach((r, i) => g.fillText(r, o.x, o.y + i * (o.regelafstand || o.grootte * 1.2)));
      g.restore();
      continue;
    }
    g.beginPath();
    if (o.soort === 'rechthoek') g.rect(o.x, o.y, o.b, o.h);
    else if (o.soort === 'pad') {
      for (const sp of o.subpaden) {
        const p = sp.punten;
        g.moveTo(p[0].x, p[0].y);
        const n = p.length;
        for (let i = 1; i <= (sp.gesloten ? n : n - 1); i++) {
          const a = p[i - 1];
          const b = p[i % n];
          if (a.uit || b.in) {
            const c1 = a.uit || a;
            const c2 = b.in || b;
            g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
          } else g.lineTo(b.x, b.y);
        }
        if (sp.gesloten) g.closePath();
      }
    }
    if (vul) { g.fillStyle = vul; g.fill(o.vulregel === 'evenodd' ? 'evenodd' : 'nonzero'); }
    if (lijn && o.lijndikte) {
      g.strokeStyle = lijn;
      g.lineWidth = o.lijndikte;
      g.lineCap = o.lijneinde || 'butt';
      g.setLineDash(o.streep || []);
      g.stroke();
      g.setLineDash([]);
    }
  }
}

// ---- het venster -----------------------------------------------------------------------------

const vandaag = () => new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
const STANDAARD = {
  stijl: 'klassiek', formaat: 'tekengebied', kleur: 'blauw', titel: 'Oorkonde', aanhef: 'uitgereikt aan', naam: 'Sanne de Vries',
  tekst: 'voor het met veel inzet en succes afronden van de cursus Typografie in de praktijk.', datum: '',
  handtekeningen: 2, naam1: 'J. Jansen', functie1: 'Docent', naam2: 'M. Bakker', functie2: 'Directeur', zegel: true, zegelTekst: '', zaad: 7,
};

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const opgeslagen = (await vexel.haal('instellingen')) || {};
  const w0 = { ...STANDAARD, datum: `Utrecht, ${vandaag()}`, zegelTekst: String(new Date().getFullYear()), ...opgeslagen };

  const v = {
    stijl: keuze(STIJLEN, w0.stijl),
    formaat: keuze(Object.fromEntries(Object.entries(FORMATEN).map(([s, f]) => [s, s === 'tekengebied'
      ? 'Tekengebied' : f.naam])), w0.formaat),
    kleur: keuze(Object.fromEntries(Object.entries(KLEURSETS).map(([s, x]) => [s, x.naam])), w0.kleur),
    titel: tekstVeld(w0.titel, 'Oorkonde', 40),
    aanhef: tekstVeld(w0.aanhef, 'uitgereikt aan', 60),
    naam: tekstVeld(w0.naam, 'Naam', 60),
    tekst: el('textarea', { klasse: 'veld', rows: 3, maxlength: 400, stijl: { height: '56px', padding: '5px 8px', resize: 'none', lineHeight: '1.35' } }),
    datum: tekstVeld(w0.datum, 'Plaats, datum', 60),
    handtekeningen: keuze({ 0: 'Geen', 1: 'Eén', 2: 'Twee' }, String(w0.handtekeningen)),
    naam1: tekstVeld(w0.naam1, 'Naam', 40),
    functie1: tekstVeld(w0.functie1, 'Functie', 40),
    naam2: tekstVeld(w0.naam2, 'Naam', 40),
    functie2: tekstVeld(w0.functie2, 'Functie', 40),
    zegelTekst: tekstVeld(w0.zegelTekst, 'Jaartal of letters', 8),
    zaad: getalVeld(w0.zaad, 1, 99999, 1),
  };
  v.tekst.value = w0.tekst;
  const zegelAan = vinkje('Zegel', w0.zegel);
  const rij1 = kolom(2, vak('Naam 1', v.naam1), vak('Functie 1', v.functie1));
  const rij2 = kolom(2, vak('Naam 2', v.naam2), vak('Functie 2', v.functie2));
  const zaadVak = vak('Confetti (zaadje)', v.zaad);

  const voorbeeld = el('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '200px' } });
  const samenvatting = el('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '18px' } });
  const maakKnop = el('button', { klasse: 'knop primair', type: 'submit', tekst: 'Oorkonde maken' });
  const annuleer = el('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = el('form', { stijl: { display: 'grid', gap: '8px' } },
    kolom(3, vak('Stijl', v.stijl), vak('Formaat', v.formaat), vak('Kleur', v.kleur)),
    kolom('1fr 1fr', vak('Titel', v.titel), vak('Aanhef', v.aanhef)),
    kolom('1.3fr 1fr', vak('Naam', v.naam), vak('Plaats en datum', v.datum)),
    vak('Tekst', v.tekst),
    kolom('0.9fr 0.8fr 1fr 1fr', vak('Handtekeningen', v.handtekeningen), el('div', { stijl: { paddingBottom: '5px' } }, zegelAan.label), vak('Zegeltekst', v.zegelTekst), zaadVak),
    rij1,
    rij2,
    el('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    el('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    stijl: v.stijl.value,
    formaat: v.formaat.value,
    kleur: v.kleur.value,
    titel: v.titel.value.trim().slice(0, 40),
    aanhef: v.aanhef.value.trim().slice(0, 60),
    naam: v.naam.value.trim().slice(0, 60),
    tekst: v.tekst.value.trim().slice(0, 400),
    datum: v.datum.value.trim().slice(0, 60),
    handtekeningen: Number(v.handtekeningen.value) || 0,
    naam1: v.naam1.value.trim(), functie1: v.functie1.value.trim(), naam2: v.naam2.value.trim(), functie2: v.functie2.value.trim(),
    zegel: zegelAan.invoer.checked,
    zegelTekst: v.zegelTekst.value.trim().slice(0, 8),
    zaad: Math.round(begrens(leesGetal(v.zaad, 7), 1, 99999)),
  });

  function teken() {
    const w = waarden();
    const m = maat(w, doc);
    rij1.style.opacity = w.handtekeningen >= 1 ? '1' : '0.4';
    rij2.style.opacity = w.handtekeningen >= 2 ? '1' : '0.4';
    v.zegelTekst.disabled = !w.zegel;
    zaadVak.style.visibility = w.stijl === 'speels' ? 'visible' : 'hidden';
    let tekst = `${STIJLEN[w.stijl]}, ${mmTekst(m.b, 0)} × ${mmTekst(m.h, 0)} mm.`;
    if (m.past) tekst += ' Vult het tekengebied precies.';
    else if (m.tePast) tekst += ` Groter dan het tekengebied: zet dat op ${mmTekst(m.b, 0)} × ${mmTekst(m.h, 0)} mm.`;
    else tekst += ' Komt in het midden van het tekengebied.';
    if (!w.naam && !w.titel) tekst = 'Vul minstens een titel of een naam in.';
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier geen oorkonde maken.';
    const fout = doc.alleenLezen || (!w.naam && !w.titel);
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', fout || m.tePast);
    maakKnop.disabled = fout;
    // voorvertoning met de echte vormen
    const { g, b, h } = canvasKlaar(voorbeeld);
    const s = Math.min((b - 12) / (m.b * PT), (h - 12) / (m.h * PT));
    g.save();
    g.translate((b - m.b * PT * s) / 2, (h - m.h * PT * s) / 2);
    g.scale(s, s);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, m.b * PT, m.h * PT);
    tekenVormen(g, bouwVormen(w, { ...m, x: 0, y: 0 }, cmyk));
    g.restore();
  }

  let wacht = 0;
  formulier.addEventListener('input', () => { clearTimeout(wacht); wacht = setTimeout(teken, 60); });
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const w = waarden();
    if (!w.naam && !w.titel) return vexel.melding('Vul minstens een titel of een naam in.', 'let');
    const m = maat(w, doc);
    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(w, m, cmyk));
      // de naam zelf bewaren we niet (persoonsgegeven); de rest wel
      const { naam, naam1, naam2, ...bewaar } = w;
      await vexel.bewaar('instellingen', bewaar);
      vexel.melding(m.tePast ? 'Oorkonde gemaakt; hij is groter dan het tekengebied.' : 'Oorkonde gemaakt.', m.tePast ? 'let' : 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De oorkonde kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  v.naam.focus();
  v.naam.select();
}

vexel.opCommando('maken', toonVenster);
