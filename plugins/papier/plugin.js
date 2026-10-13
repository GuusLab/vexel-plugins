// Papier: schrijf- en tekenpapier (lijntjes, ruitjes, stippen, millimeter, isometrisch, zeshoeken, notenbalken).
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

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' },
    ...Object.entries(opties).map(([sleutel, tekst]) => maak('option', { value: sleutel, tekst })));
  veld.value = sleutel(opties, waarde);
  return veld;
}
const sleutel = (opties, waarde) => (Object.prototype.hasOwnProperty.call(opties, waarde) ? waarde : Object.keys(opties)[0]);

/** Een rij met een label links en een of meer velden (met eenheid) rechts. */
function regel(label, ...velden) {
  const rij = maak('label', { klasse: 'rij', stijl: { margin: '0' } }, maak('span', { klasse: 'label', tekst: label }));
  for (const v of velden) {
    if (typeof v === 'string') rij.append(maak('span', { klasse: 'uitleg', tekst: v, stijl: { flex: 'none' } }));
    else rij.append(v);
  }
  return rij;
}

// ---- kleur ----------------------------------------------------------------
// Een eenvoudige omrekening zonder kleurprofiel, alleen voor het voorbeeld.

const rgbVanCmyk = ([c, m, y, k]) => {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z].map(Math.round);
};
const hexVanRgb = (rgb) => '#' + rgb.map((n) => begrens(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
const kleurCss = (kleur) => (!kleur ? 'transparent' : kleur.hex || hexVanRgb(rgbVanCmyk(kleur.cmyk)));

/**
 * Een kleurkeuze: een lijst met drukkleuren en "Eigen kleur…". In een CMYK-document
 * typ je dan vier getallen (C M Y K), in een RGB-document kies je een kleur.
 */
function kleurKiezer(kleuren, bewaard, cmyk) {
  const lijst = { ...Object.fromEntries(Object.entries(kleuren).map(([k, v]) => [k, v.naam])), eigen: 'Eigen kleur…' };
  const keuze = keuzeVeld(lijst, bewaard && bewaard.keuze);
  const staal = maak('span', { 'aria-hidden': 'true', stijl: {
    flex: 'none', width: '18px', height: '18px', borderRadius: '4px', border: '1px solid var(--lijn)' } });
  const eigenCmyk = maak('input', { klasse: 'veld', type: 'text', placeholder: 'C M Y K', 'aria-label': 'CMYK, vier getallen',
    value: (bewaard && bewaard.cmyk ? bewaard.cmyk : [0, 0, 0, 100]).join(' '), stijl: { maxWidth: '110px' } });
  const eigenRgb = maak('input', { type: 'color', 'aria-label': 'Eigen kleur', value: (bewaard && bewaard.hex) || '#1a1a1a',
    stijl: { flex: 'none', width: '34px', height: '26px', padding: '0', border: '1px solid var(--lijn)', background: 'none' } });
  const eigen = cmyk ? eigenCmyk : eigenRgb;
  const veld = maak('span', { stijl: { display: 'flex', gap: '6px', alignItems: 'center', flex: '1', minWidth: '0' } }, keuze, eigen, staal);

  function lees() {
    if (keuze.value !== 'eigen') {
      const k = kleuren[keuze.value];
      return cmyk ? { cmyk: k.cmyk.slice() } : { hex: hexVanRgb(rgbVanCmyk(k.cmyk)) };
    }
    if (!cmyk) return { hex: eigenRgb.value.toLowerCase() };
    const delen = eigenCmyk.value.replace(/[,;%]/g, ' ').trim().split(/ +/).map(Number);
    if (delen.length !== 4 || delen.some((n) => !Number.isFinite(n))) return null;
    return { cmyk: delen.map((n) => begrens(n, 0, 100)) };
  }
  function bij() {
    eigen.style.display = keuze.value === 'eigen' ? '' : 'none';
    const k = lees();
    staal.style.background = k ? kleurCss(k) : 'transparent';
  }
  veld.addEventListener('input', bij);
  veld.addEventListener('change', bij);
  bij();
  return {
    veld,
    lees,
    zet: (waarde) => {
      keuze.value = sleutel(lijst, waarde && waarde.keuze);
      if (waarde && waarde.cmyk) eigenCmyk.value = waarde.cmyk.join(' ');
      if (waarde && waarde.hex) eigenRgb.value = waarde.hex;
      bij();
    },
    bewaar: () => ({ keuze: keuze.value, cmyk: cmyk && lees() ? lees().cmyk : bewaard && bewaard.cmyk, hex: !cmyk ? eigenRgb.value : bewaard && bewaard.hex }),
  };
}

// ---- tellen en opdelen ----------------------------------------------------

function tel(vormen) {
  let vormenAantal = 0;
  let punten = 0;
  const loop = (v) => {
    vormenAantal++;
    if (v.kinderen) v.kinderen.forEach(loop);
    if (v.subpaden) for (const s of v.subpaden) punten += s.punten.length;
    if (v.soort === 'ellips' || v.soort === 'rechthoek') punten += 4;
  };
  vormen.forEach(loop);
  return { vormen: vormenAantal, punten };
}

const GRENS = { vormen: 5000, punten: 50000, subpaden: 1000 };

/** Een lange lijst subpaden als één of meer paden (hooguit 1000 subpaden per pad). */
function alsPaden(subpaden, naam, stijl) {
  const paden = [];
  for (let i = 0; i < subpaden.length; i += GRENS.subpaden) {
    paden.push({ soort: 'pad', naam, subpaden: subpaden.slice(i, i + GRENS.subpaden), ...stijl });
  }
  if (paden.length > 1) paden.forEach((p, i) => { p.naam = `${naam} ${i + 1}`; });
  return paden;
}

// ---- voorbeeld op een canvas ----------------------------------------------

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

/**
 * Tekent het tekengebied (wit vel) met de vormen erop, passend in het canvas.
 * `zicht` is het stuk dat in beeld moet (in pt), standaard het hele tekengebied.
 */
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
  const loop = (v, dekking) => {
    if (v.soort === 'groep') return v.kinderen.forEach((k) => loop(k, dekking));
    let p;
    if (v.soort === 'pad') p = padVanSubpaden(v.subpaden, sx, ox, oy);
    else if (v.soort === 'rechthoek') {
      p = new Path2D();
      p.rect(ox + v.x * sx, oy + v.y * sx, v.b * sx, v.h * sx);
    } else if (v.soort === 'ellips') {
      p = new Path2D();
      p.ellipse(ox + v.cx * sx, oy + v.cy * sx, v.rx * sx, v.ry * sx, 0, 0, Math.PI * 2);
    } else return;
    g.globalAlpha = dekking * (v.dekking === undefined ? 1 : v.dekking);
    if (v.vulling) {
      g.fillStyle = kleurCss(v.vulling);
      g.fill(p);
    }
    if (v.lijn && v.lijndikte > 0) {
      g.strokeStyle = kleurCss(v.lijn);
      // Heel dunne lijnen: een halve pixel breed, maar met minder dekking, zodat het vlak klopt.
      const breedte = v.lijndikte * sx;
      g.lineWidth = Math.max(0.5, breedte);
      if (breedte < 0.5) g.globalAlpha *= Math.max(0.15, breedte / 0.5);
      g.lineJoin = 'round';
      g.stroke(p);
    }
    g.globalAlpha = 1;
  };
  vormen.forEach((v) => loop(v, 1));
  // De rand van het tekengebied: wat erbuiten valt, is afloop.
  g.strokeStyle = vexel.thema.accent;
  g.globalAlpha = 0.9;
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.strokeRect(ox + 0.5, oy + 0.5, tg.b * sx - 1, tg.h * sx - 1);
  g.setLineDash([]);
  g.globalAlpha = 1;
}

// ---- de soorten papier ----------------------------------------------------

const SOORTEN = {
  lijntjes: { naam: 'Lijntjes', maatLabel: 'Regelafstand', maat: 8, dikte: 0.5, min: 3, max: 30, kleur: 'blauw' },
  ruitjes: { naam: 'Ruitjes', maatLabel: 'Ruitmaat', maat: 5, dikte: 0.4, min: 2, max: 30, kleur: 'blauw' },
  stippen: { naam: 'Stippen', maatLabel: 'Stipafstand', maat: 5, dikte: 0.55, min: 2, max: 30, kleur: 'middengrijs' },
  millimeter: { naam: 'Millimeterpapier', maatLabel: '', maat: 1, dikte: 0.25, min: 1, max: 1, kleur: 'oranje' },
  isometrisch: { naam: 'Isometrisch raster', maatLabel: 'Zijde', maat: 5, dikte: 0.35, min: 2, max: 30, kleur: 'grijs' },
  zeshoek: { naam: 'Zeshoeken', maatLabel: 'Zijde', maat: 5, dikte: 0.4, min: 2, max: 30, kleur: 'grijs' },
  notenbalk: { naam: 'Notenbalken', maatLabel: 'Lijnafstand', maat: 2, dikte: 0.6, min: 1, max: 5, kleur: 'middengrijs' },
};

const KLEUREN = {
  blauw: { naam: 'Lichtblauw (C)', cmyk: [40, 0, 0, 0] },
  grijs: { naam: 'Lichtgrijs (K)', cmyk: [0, 0, 0, 30] },
  middengrijs: { naam: 'Grijs (K)', cmyk: [0, 0, 0, 55] },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100] },
  roze: { naam: 'Roze (M)', cmyk: [0, 45, 0, 0] },
  oranje: { naam: 'Oranje', cmyk: [0, 45, 70, 0] },
  groen: { naam: 'Groen', cmyk: [45, 0, 60, 0] },
  rood: { naam: 'Rood', cmyk: [0, 80, 60, 0] },
};

const STANDAARD = {
  soort: 'ruitjes', maat: 5, dikte: 0.4, kleur: { keuze: 'blauw' }, boven: 12, onder: 12, links: 12, rechts: 12,
  kantlijn: true, kantlijnPlek: 25, kantlijnKleur: { keuze: 'rood' }, balkruimte: 12, perSoort: {},
};

// ---- meetkunde ------------------------------------------------------------

const lijn = (x0, y0, x1, y1) => ({ gesloten: false, punten: [{ x: x0, y: y0 }, { x: x1, y: y1 }] });

/** Knipt een oneindige lijn (door punt p, richting d) af op de rechthoek; null als hij er niet door gaat. */
function lijnInVak(p, d, vak) {
  let t0 = -Infinity;
  let t1 = Infinity;
  const grenzen = [[d.x, p.x, vak.x, vak.x + vak.b], [d.y, p.y, vak.y, vak.y + vak.h]];
  for (const [r, q, lo, hi] of grenzen) {
    if (Math.abs(r) < 1e-12) {
      if (q < lo - 1e-9 || q > hi + 1e-9) return null;
    } else {
      const a = (lo - q) / r;
      const b = (hi - q) / r;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
  }
  if (!(t1 - t0 > 0.01)) return null;
  return lijn(p.x + d.x * t0, p.y + d.y * t0, p.x + d.x * t1, p.y + d.y * t1);
}

/** Een familie evenwijdige lijnen onder `hoek` graden, `afstand` uit elkaar, door punt `o`. */
function lijnfamilie(vak, hoek, afstand, o) {
  const a = (hoek * Math.PI) / 180;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  const n = { x: -d.y, y: d.x };
  const hoeken = [[vak.x, vak.y], [vak.x + vak.b, vak.y], [vak.x, vak.y + vak.h], [vak.x + vak.b, vak.y + vak.h]];
  const proj = hoeken.map(([x, y]) => (x - o.x) * n.x + (y - o.y) * n.y);
  const uit = [];
  for (let k = Math.ceil(Math.min(...proj) / afstand); k <= Math.floor(Math.max(...proj) / afstand); k++) {
    const s = lijnInVak({ x: o.x + n.x * k * afstand, y: o.y + n.y * k * afstand }, d, vak);
    if (s) uit.push(s);
  }
  return uit;
}

/** Losse lijnstukken aan elkaar rijgen tot zo lang mogelijke lijnen. */
function rijg(stukken) {
  const sleutelVan = (p) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`;
  const bij = new Map();
  stukken.forEach((s, i) => {
    for (const p of [s[0], s[1]]) {
      const k = sleutelVan(p);
      if (!bij.has(k)) bij.set(k, []);
      bij.get(k).push(i);
    }
  });
  const gebruikt = new Set();
  const volgende = (p) => (bij.get(sleutelVan(p)) || []).find((i) => !gebruikt.has(i));
  const ketens = [];
  // Begin bij losse uiteinden, zodat de lijnen zo lang mogelijk worden.
  const graad = stukken.map((s) => Math.min(bij.get(sleutelVan(s[0])).length, bij.get(sleutelVan(s[1])).length));
  const volgorde = [...stukken.keys()].sort((i, j) => graad[i] - graad[j]);
  for (const start of volgorde) {
    if (gebruikt.has(start)) continue;
    gebruikt.add(start);
    let [a, b] = stukken[start];
    // Begin bij het losse uiteinde, als er een is.
    if (bij.get(sleutelVan(a)).length !== 1 && bij.get(sleutelVan(b)).length === 1) [a, b] = [b, a];
    const punten = [a, b];
    for (;;) {
      const i = volgende(punten[punten.length - 1]);
      if (i === undefined) break;
      gebruikt.add(i);
      const [p, q] = stukken[i];
      punten.push(sleutelVan(p) === sleutelVan(punten[punten.length - 1]) ? q : p);
    }
    const gesloten = punten.length > 3 && sleutelVan(punten[0]) === sleutelVan(punten[punten.length - 1]);
    if (gesloten) punten.pop();
    ketens.push({ gesloten, punten: punten.map((p) => ({ x: p.x, y: p.y })) });
  }
  return ketens;
}

/** Het vak binnen de marges, in pt. */
function binnenVak(doc, w) {
  const m = (n) => vexel.mm(n);
  const vak = { x: m(w.links), y: m(w.boven), b: doc.tekengebied.b - m(w.links) - m(w.rechts), h: doc.tekengebied.h - m(w.boven) - m(w.onder) };
  return vak.b > vexel.mm(5) && vak.h > vexel.mm(5) ? vak : null;
}

/** Maakt het vak een veelvoud van `stap` breed en hoog, horizontaal gecentreerd. */
function heleVakjes(vak, stapX, stapY) {
  const nx = Math.floor(vak.b / stapX + 1e-6);
  const ny = Math.floor(vak.h / stapY + 1e-6);
  return { x: vak.x + (vak.b - nx * stapX) / 2, y: vak.y, b: nx * stapX, h: ny * stapY, nx, ny };
}

/** Geeft { lagen: [{ naam, subpaden, dikte, kleur? }], omschrijving } of { fout }. */
function bouwPapier(doc, w) {
  const vak = binnenVak(doc, w);
  if (!vak) return { fout: 'De marges zijn te groot voor dit tekengebied. Maak ze kleiner.' };
  const s = vexel.mm(w.maat);
  // Snelle schatting vooraf: bij heel kleine maten wordt het te veel voor één keer.
  if (w.soort !== 'millimeter' && (vak.b * vak.h) / (s * s) > 20000) {
    return { fout: 'Die maat is te klein voor dit vel: dat worden te veel lijnen of stippen. Kies een grotere maat of grotere marges.' };
  }
  const lagen = [];
  let omschrijving = '';

  if (w.soort === 'lijntjes') {
    const regels = [];
    for (let y = vak.y + s; y <= vak.y + vak.h + 0.01; y += s) regels.push(lijn(vak.x, y, vak.x + vak.b, y));
    lagen.push({ naam: 'Regels', subpaden: regels, dikte: w.dikte });
    omschrijving = `${regels.length} regels, ${getal(w.maat)} mm uit elkaar`;
  } else if (w.soort === 'ruitjes') {
    const g = heleVakjes(vak, s, s);
    const lijnen = [];
    for (let i = 0; i <= g.nx; i++) lijnen.push(lijn(g.x + i * s, g.y, g.x + i * s, g.y + g.h));
    for (let j = 0; j <= g.ny; j++) lijnen.push(lijn(g.x, g.y + j * s, g.x + g.b, g.y + j * s));
    lagen.push({ naam: 'Ruitjes', subpaden: lijnen, dikte: w.dikte });
    omschrijving = `${g.nx} × ${g.ny} ruitjes van ${getal(w.maat)} mm`;
  } else if (w.soort === 'stippen') {
    const g = heleVakjes(vak, s, s);
    const r = vexel.mm(w.dikte) / 2;
    const k = r * 0.5522847498;
    const stippen = [];
    for (let j = 0; j <= g.ny; j++) {
      for (let i = 0; i <= g.nx; i++) {
        const cx = g.x + i * s;
        const cy = g.y + j * s;
        stippen.push({ gesloten: true, punten: [
          { x: cx, y: cy - r, in: { x: cx - k, y: cy - r }, uit: { x: cx + k, y: cy - r } },
          { x: cx + r, y: cy, in: { x: cx + r, y: cy - k }, uit: { x: cx + r, y: cy + k } },
          { x: cx, y: cy + r, in: { x: cx + k, y: cy + r }, uit: { x: cx - k, y: cy + r } },
          { x: cx - r, y: cy, in: { x: cx - r, y: cy + k }, uit: { x: cx - r, y: cy - k } },
        ] });
      }
    }
    lagen.push({ naam: 'Stippen', subpaden: stippen, gevuld: true });
    omschrijving = `${getal(stippen.length, 0)} stippen, ${getal(w.maat)} mm uit elkaar`;
  } else if (w.soort === 'millimeter') {
    const mm = vexel.mm(1);
    const g = heleVakjes(vak, 10 * mm, 10 * mm);
    const fijn = [];
    const half = [];
    const heel = [];
    const soortVan = (i) => (i % 10 === 0 ? heel : i % 5 === 0 ? half : fijn);
    for (let i = 0; i <= g.nx * 10; i++) soortVan(i).push(lijn(g.x + i * mm, g.y, g.x + i * mm, g.y + g.h));
    for (let j = 0; j <= g.ny * 10; j++) soortVan(j).push(lijn(g.x, g.y + j * mm, g.x + g.b, g.y + j * mm));
    lagen.push({ naam: 'Millimeters', subpaden: fijn, dikte: w.dikte });
    lagen.push({ naam: 'Halve centimeters', subpaden: half, dikte: w.dikte * 1.8 });
    lagen.push({ naam: 'Centimeters', subpaden: heel, dikte: w.dikte * 3 });
    omschrijving = `${g.nx} × ${g.ny} cm`;
  } else if (w.soort === 'isometrisch') {
    const hgt = (s * Math.sqrt(3)) / 2;
    const o = { x: vak.x + vak.b / 2, y: vak.y };
    const lijnen = [...lijnfamilie(vak, 90, hgt, o), ...lijnfamilie(vak, 30, hgt, o), ...lijnfamilie(vak, 150, hgt, o)];
    lagen.push({ naam: 'Isometrisch raster', subpaden: lijnen, dikte: w.dikte });
    omschrijving = `driehoeken met een zijde van ${getal(w.maat)} mm`;
  } else if (w.soort === 'zeshoek') {
    // Zeshoeken met een punt naar boven; alleen hele zeshoeken binnen het vak.
    const bz = Math.sqrt(3) * s;
    const dy = 1.5 * s;
    const kolommen = Math.floor((vak.b - bz / 2) / bz + 1e-6);
    const rijen = Math.floor((vak.h - s / 2) / dy + 1e-6);
    if (kolommen < 1 || rijen < 1) return { fout: 'De zeshoeken zijn te groot voor het vak binnen de marges.' };
    const x0 = vak.x + (vak.b - (kolommen + 0.5) * bz) / 2 + bz / 2;
    const y0 = vak.y + s;
    const stukken = [];
    const gezien = new Set();
    let aantal = 0;
    for (let r = 0; r < rijen; r++) {
      for (let c = 0; c < kolommen; c++) {
        const cx = x0 + c * bz + (r % 2 ? bz / 2 : 0);
        const cy = y0 + r * dy;
        aantal++;
        const hoek = (i) => {
          const a = ((-90 + 60 * i) * Math.PI) / 180;
          return { x: cx + s * Math.cos(a), y: cy + s * Math.sin(a) };
        };
        for (let i = 0; i < 6; i++) {
          const a = hoek(i);
          const b = hoek(i + 1);
          const k = `${Math.round((a.x + b.x) * 50)},${Math.round((a.y + b.y) * 50)}`;
          if (gezien.has(k)) continue;
          gezien.add(k);
          stukken.push([a, b]);
        }
      }
    }
    lagen.push({ naam: 'Zeshoeken', subpaden: rijg(stukken), dikte: w.dikte });
    omschrijving = `${getal(aantal, 0)} zeshoeken met een zijde van ${getal(w.maat)} mm`;
  } else if (w.soort === 'notenbalk') {
    const balk = 4 * s;
    const tussen = vexel.mm(w.balkruimte);
    const aantal = Math.floor((vak.h + tussen + 0.01) / (balk + tussen));
    if (aantal < 1) return { fout: 'Er past geen notenbalk tussen de marges. Maak de marges of de lijnafstand kleiner.' };
    const y0 = vak.y + (vak.h - (aantal * balk + (aantal - 1) * tussen)) / 2;
    const lijnen = [];
    for (let b = 0; b < aantal; b++) {
      for (let i = 0; i < 5; i++) {
        const y = y0 + b * (balk + tussen) + i * s;
        lijnen.push(lijn(vak.x, y, vak.x + vak.b, y));
      }
    }
    lagen.push({ naam: 'Notenbalken', subpaden: lijnen, dikte: w.dikte });
    omschrijving = `${aantal} notenbalken`;
  }

  if (w.kantlijn && (w.soort === 'lijntjes' || w.soort === 'ruitjes')) {
    const x = vexel.mm(w.kantlijnPlek);
    if (x > 0 && x < doc.tekengebied.b) {
      lagen.push({ naam: 'Kantlijn', subpaden: [lijn(x, vak.y, x, vak.y + vak.h)], dikte: Math.max(0.5, w.dikte * 1.6), kantlijn: true });
    }
  }
  return { lagen, omschrijving };
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  const perSoort = { ...w0.perSoort };

  const velden = {
    soort: keuzeVeld(Object.fromEntries(Object.entries(SOORTEN).map(([k, v]) => [k, v.naam])), w0.soort),
    maat: getalVeld(w0.maat, 1, 30, 0.5),
    dikte: getalVeld(w0.dikte, 0.1, 5, 0.05),
    boven: getalVeld(w0.boven, 0, 100, 1),
    onder: getalVeld(w0.onder, 0, 100, 1, 'Marge onder'),
    links: getalVeld(w0.links, 0, 100, 1),
    rechts: getalVeld(w0.rechts, 0, 100, 1, 'Marge rechts'),
    kantlijn: maak('input', { type: 'checkbox', stijl: { margin: '0', flex: 'none' } }),
    kantlijnPlek: getalVeld(w0.kantlijnPlek, 1, 200, 1, 'Plaats van de kantlijn in mm van links'),
    balkruimte: getalVeld(w0.balkruimte, 2, 60, 1),
  };
  velden.kantlijn.checked = Boolean(w0.kantlijn);
  const kleur = kleurKiezer(KLEUREN, w0.kleur, cmyk);
  const kantlijnKleur = kleurKiezer(KLEUREN, w0.kantlijnKleur, cmyk);

  const doekVel = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '190px' } });
  const doekDetail = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '190px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Papier maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const maatRij = regel('Maat', velden.maat, 'mm');
  const dikteEenheid = maak('span', { klasse: 'uitleg', tekst: 'pt', stijl: { flex: 'none' } });
  const dikteRij = regel('Lijndikte', velden.dikte, dikteEenheid);
  const kantlijnRij = regel('Kantlijn', velden.kantlijn, velden.kantlijnPlek, 'mm van links');
  const kantlijnKleurRij = regel('Kleur kantlijn', kantlijnKleur.veld);
  const balkRij = regel('Tussen balken', velden.balkruimte, 'mm');

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, doekVel, doekDetail),
    regel('Soort', velden.soort),
    maatRij,
    balkRij,
    dikteRij,
    regel('Kleur', kleur.veld),
    regel('Marge boven', velden.boven, 'onder', velden.onder, 'mm'),
    regel('Marge links', velden.links, 'rechts', velden.rechts, 'mm'),
    kantlijnRij,
    kantlijnKleurRij,
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => {
    const soort = velden.soort.value;
    const def = SOORTEN[soort];
    return {
      soort,
      maat: begrens(leesGetal(velden.maat, def.maat), def.min, def.max),
      dikte: begrens(leesGetal(velden.dikte, def.dikte), soort === 'stippen' ? 0.2 : 0.1, soort === 'stippen' ? 3 : 5),
      boven: begrens(leesGetal(velden.boven, 0), 0, 100),
      onder: begrens(leesGetal(velden.onder, 0), 0, 100),
      links: begrens(leesGetal(velden.links, 0), 0, 100),
      rechts: begrens(leesGetal(velden.rechts, 0), 0, 100),
      kantlijn: velden.kantlijn.checked,
      kantlijnPlek: begrens(leesGetal(velden.kantlijnPlek, 25), 1, 200),
      balkruimte: begrens(leesGetal(velden.balkruimte, 12), 2, 60),
      kleur: kleur.bewaar(),
      kantlijnKleur: kantlijnKleur.bewaar(),
    };
  };

  // Elke soort onthoudt zijn eigen maat en lijndikte.
  let vorigeSoort = velden.soort.value;
  velden.soort.addEventListener('change', () => {
    perSoort[vorigeSoort] = {
      maat: leesGetal(velden.maat, SOORTEN[vorigeSoort].maat), dikte: leesGetal(velden.dikte, SOORTEN[vorigeSoort].dikte), kleur: kleur.bewaar(),
    };
    vorigeSoort = velden.soort.value;
    const def = SOORTEN[vorigeSoort];
    const eerder = perSoort[vorigeSoort] || {};
    velden.maat.value = eerder.maat || def.maat;
    velden.dikte.value = eerder.dikte || def.dikte;
    kleur.zet(eerder.kleur || { keuze: def.kleur });
    velden.maat.min = def.min;
    velden.maat.max = def.max;
  });

  /** De vormen voor Vexel, of { fout }. */
  function vormenVan(w) {
    const lijnKleur = kleur.lees();
    const kantKleur = kantlijnKleur.lees();
    if (!lijnKleur || !kantKleur) return { fout: 'Een eigen kleur is niet goed: typ vier getallen van 0 tot 100, zoals 40 0 0 0.' };
    const uitkomst = bouwPapier(doc, w);
    if (uitkomst.fout) return uitkomst;
    const kinderen = [];
    for (const laag of uitkomst.lagen) {
      if (!laag.subpaden.length) continue;
      const k = laag.kantlijn ? kantKleur : lijnKleur;
      const stijl = laag.gevuld
        ? { vulling: k, lijn: null, lijndikte: 0 }
        : { vulling: null, lijn: k, lijndikte: laag.dikte, lijneinde: 'butt', lijnhoek: 'miter' };
      kinderen.push(...alsPaden(laag.subpaden, laag.naam, stijl));
    }
    const soortNaam = SOORTEN[w.soort].naam;
    const naam = w.soort === 'millimeter' ? soortNaam : `${soortNaam} ${getal(w.maat)} mm`;
    const vormen = [{ soort: 'groep', naam: `Papier: ${naam}`, kinderen }];
    const t = tel(vormen);
    if (t.punten > GRENS.punten) {
      return { fout: `Dat zijn te veel punten (${getal(t.punten, 0)}, hooguit ${getal(GRENS.punten, 0)}). Kies een grotere maat of grotere marges.` };
    }
    return { vormen, omschrijving: uitkomst.omschrijving, telling: t };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    const def = SOORTEN[w.soort];
    maatRij.style.display = def.maatLabel ? '' : 'none';
    maatRij.querySelector('.label').textContent = def.maatLabel || 'Maat';
    dikteRij.querySelector('.label').textContent = w.soort === 'stippen' ? 'Stipgrootte' : w.soort === 'millimeter' ? 'Fijnste lijn' : 'Lijndikte';
    dikteEenheid.textContent = w.soort === 'stippen' ? 'mm' : 'pt';
    const metKantlijn = w.soort === 'lijntjes' || w.soort === 'ruitjes';
    kantlijnRij.style.display = metKantlijn ? '' : 'none';
    kantlijnKleurRij.style.display = metKantlijn && w.kantlijn ? '' : 'none';
    velden.kantlijnPlek.disabled = !w.kantlijn;
    balkRij.style.display = w.soort === 'notenbalk' ? '' : 'none';

    const uitkomst = vormenVan(w);
    const vormen = uitkomst.vormen || [];
    tekenVoorbeeld(doekVel, doc, vormen);
    const d = vexel.mm(w.soort === 'millimeter' ? 24 : 42);
    tekenVoorbeeld(doekDetail, doc, vormen, { x: vexel.mm(Math.max(0, w.links - 4)), y: vexel.mm(Math.max(0, w.boven - 4)), b: d, h: d });
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout));
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else samenvatting.textContent = `${uitkomst.omschrijving[0].toUpperCase()}${uitkomst.omschrijving.slice(1)}. Rechts: de hoek linksboven, vergroot.`;
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const uitkomst = vormenVan(w);
    if (uitkomst.fout) return vexel.melding(uitkomst.fout, 'let');
    maakKnop.disabled = true;
    try {
      await vexel.maak(uitkomst.vormen);
      perSoort[w.soort] = { maat: w.maat, dikte: w.dikte, kleur: w.kleur };
      await vexel.bewaar('instellingen', { ...w, perSoort });
      vexel.melding(`Papier gemaakt: ${uitkomst.omschrijving}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het papier kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  velden.soort.focus();
}

vexel.opCommando('maken', toonVenster);
