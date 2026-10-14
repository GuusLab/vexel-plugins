// Kleurenblindheid: laat zien hoe de geselecteerde vormen eruitzien voor mensen met
// protanopie, deuteranopie, tritanopie en achromatopsie, naast elkaar, en waarschuwt
// voor kleurparen die dan samenvallen. Desgewenst een gesimuleerde kopie ernaast.
// De simulatie gebruikt de gepubliceerde matrices van Machado, Oliveira en Fernandes (2009)
// in lineair RGB; het kleurverschil is CIEDE2000.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { sterkte: 'volledig', kopie: 'deuteranopie' };

const SOORTEN = [
  { id: 'normaal', naam: 'Normaal zicht', kort: 'normaal' },
  { id: 'protanopie', naam: 'Protanopie', anomalie: 'Protanomalie', kort: 'rood-blind', uitleg: 'geen rode kegeltjes' },
  { id: 'deuteranopie', naam: 'Deuteranopie', anomalie: 'Deuteranomalie', kort: 'groen-blind', uitleg: 'geen groene kegeltjes, het meest voorkomend' },
  { id: 'tritanopie', naam: 'Tritanopie', anomalie: 'Tritanomalie', kort: 'blauw-blind', uitleg: 'geen blauwe kegeltjes, zeldzaam' },
  { id: 'achromatopsie', naam: 'Achromatopsie', anomalie: 'Achromatopsie', kort: 'geen kleur', uitleg: 'alleen licht en donker' },
];

// Machado, Oliveira & Fernandes (2009), ernst 1,0, voor lineair RGB.
const MATRIX = {
  protanopie: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopie: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopie: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

// ---- kleur ----------------------------------------------------------------------

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const naarLineair = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const naarGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexNaarRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbNaarHex = (rgb) => '#' + rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/** Een kleur uit selectie() als RGB 0–255 (CMYK eenvoudig omgerekend, zoals op het scherm). */
function rgbVan(k) {
  if (!k) return null;
  if (k.registratie) return [0, 0, 0];
  if (typeof k.hex === 'string') {
    const r = hexNaarRgb(k.hex);
    if (r) return r;
  }
  if (Array.isArray(k.cmyk) && k.cmyk.length === 4) {
    const [c, m, y, z] = k.cmyk.map((v) => begrens(v, 0, 100) / 100);
    return [255 * (1 - c) * (1 - z), 255 * (1 - m) * (1 - z), 255 * (1 - y) * (1 - z)];
  }
  return null;
}

/** De kleur zoals iemand met deze vorm van kleurenblindheid hem ziet. */
function simuleer(rgb, soort, sterkte) {
  if (!rgb || soort === 'normaal') return rgb;
  const lin = rgb.map((v) => naarLineair(begrens(v, 0, 255) / 255));
  let uit;
  if (soort === 'achromatopsie') {
    const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    uit = [y, y, y];
  } else {
    const m = MATRIX[soort];
    uit = m.map((r) => r[0] * lin[0] + r[1] * lin[1] + r[2] * lin[2]);
  }
  // gedeeltelijk: tussen normaal en volledig in
  const s = sterkte === 'gedeeltelijk' && soort !== 'achromatopsie' ? 0.6 : 1;
  return uit.map((v, i) => Math.round(naarGamma(begrens(lin[i] + (v - lin[i]) * s, 0, 1)) * 255));
}

function rgbNaarLab(rgb) {
  const [r, g, b] = rgb.map((v) => naarLineair(v / 255));
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000-kleurverschil tussen twee Lab-kleuren. */
function deltaE(l1, l2) {
  const [L1, a1, b1] = l1;
  const [L2, a2, b2] = l2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (a, b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const h1p = h(a1p, b1);
  const h2p = h(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hpm += h1p + h2p < 360 ? 360 : -360;
    hpm /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad)
    + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/** Een eenvoudige Nederlandse naam voor een kleur, voor de waarschuwingen. */
function kleurNaam(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 0.08) return l < 0.15 ? 'zwart' : l > 0.92 ? 'wit' : l < 0.45 ? 'donkergrijs' : 'grijs';
  let hue;
  if (max === r) hue = ((g - b) / d + 6) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  const sat = d / (1 - Math.abs(2 * l - 1));
  let naam;
  if (hue < 15 || hue >= 340) naam = 'rood';
  else if (hue < 40) naam = l < 0.4 ? 'bruin' : 'oranje';
  else if (hue < 50 && l < 0.4) naam = 'bruin';
  else if (hue < 68) naam = l < 0.35 ? 'olijf' : 'geel';
  else if (hue < 160) naam = 'groen';
  else if (hue < 195) naam = 'turquoise';
  else if (hue < 255) naam = 'blauw';
  else if (hue < 290) naam = 'paars';
  else naam = 'roze';
  if (naam === 'rood' && l > 0.7) naam = 'roze';
  if (sat < 0.25) naam = 'grijs' + naam;
  else if (l < 0.3 && naam !== 'bruin' && naam !== 'olijf') naam = 'donker' + naam;
  else if (l > 0.75) naam = 'licht' + naam;
  return naam;
}

// ---- vormen tekenen -------------------------------------------------------------

function tekenbaar(o) {
  if (Array.isArray(o.subpaden) && o.subpaden.length) return 'pad';
  if (o.soort === 'tekst' && o.inhoud && o.kader) return 'tekst';
  return null;
}

function padOpCanvas(g, o, s, ox, oy) {
  g.beginPath();
  for (const sp of o.subpaden) {
    const pts = sp.punten || [];
    if (!pts.length) continue;
    g.moveTo(ox + pts[0].x * s, oy + pts[0].y * s);
    const n = pts.length;
    const tot = sp.gesloten ? n : n - 1;
    for (let i = 0; i < tot; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const c1 = a.uit || a;
      const c2 = b.in || b;
      g.bezierCurveTo(ox + c1.x * s, oy + c1.y * s, ox + c2.x * s, oy + c2.y * s, ox + b.x * s, oy + b.y * s);
    }
    if (sp.gesloten) g.closePath();
  }
}

function tekenPaneel(g, x, y, b, h, items, kader, soort, sterkte) {
  g.save();
  g.beginPath();
  g.rect(x, y, b, h);
  g.clip();
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, b, h);
  const marge = 10;
  const s = Math.min((b - 2 * marge) / Math.max(1e-6, kader.b), (h - 2 * marge) / Math.max(1e-6, kader.h));
  const ox = x + (b - kader.b * s) / 2 - kader.x * s;
  const oy = y + (h - kader.h * s) / 2 - kader.y * s;
  for (const o of items) {
    const vul = simuleer(rgbVan(o.vulling), soort, sterkte);
    const lijn = simuleer(rgbVan(o.lijn), soort, sterkte);
    g.globalAlpha = typeof o.dekking === 'number' ? o.dekking : 1;
    if (tekenbaar(o) === 'tekst') {
      const k = o.kader;
      const grootte = Math.max(4, (o.grootte || 12) * s);
      g.font = `500 ${grootte}px Inter, system-ui, sans-serif`;
      g.fillStyle = vul ? rgbNaarHex(vul) : '#000000';
      g.textBaseline = 'alphabetic';
      const regels = String(o.inhoud).split('\n');
      regels.forEach((r, i) => g.fillText(r, ox + k.x * s, oy + k.y * s + grootte * (0.92 + i * 1.2), k.b * s + 40));
      continue;
    }
    padOpCanvas(g, o, s, ox, oy);
    if (vul) {
      g.fillStyle = rgbNaarHex(vul);
      g.fill(o.vulregel === 'evenodd' ? 'evenodd' : 'nonzero');
    }
    if (lijn && o.lijndikte > 0) {
      g.strokeStyle = rgbNaarHex(lijn);
      g.lineWidth = Math.max(0.5, o.lijndikte * s);
      g.lineJoin = 'round';
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

// ---- venster-hulpjes ------------------------------------------------------------

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
function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld', stijl: { width: '100%' } },
    ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}
const metLabel = (tekst, veld) =>
  maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } }, maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0' } }), veld);
const kolommenRij = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '10px', alignItems: 'end' } },
    ...kinderen);
const getal = (n, cijfers = 1) => n.toLocaleString('nl-NL', { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });

// ---- analyse --------------------------------------------------------------------

/** Alle verschillende kleuren in de selectie, met waar ze voorkomen. */
function verzamelKleuren(items) {
  const kaart = new Map();
  for (const o of items) {
    for (const [k, wat] of [[o.vulling, 'vulling'], [o.lijn && o.lijndikte > 0 ? o.lijn : null, 'lijn']]) {
      const rgb = rgbVan(k);
      if (!rgb) continue;
      const hex = rgbNaarHex(rgb);
      if (!kaart.has(hex)) kaart.set(hex, { hex, rgb: hexNaarRgb(hex), aantal: 0, wat: new Set() });
      const e = kaart.get(hex);
      e.aantal++;
      e.wat.add(wat);
    }
  }
  return [...kaart.values()];
}

/** Kleurparen die normaal goed te onderscheiden zijn, maar bij een vorm van kleurenblindheid niet. */
function vindBotsingen(kleuren, sterkte) {
  const uit = [];
  for (let i = 0; i < kleuren.length; i++) {
    for (let j = i + 1; j < kleuren.length; j++) {
      const a = kleuren[i];
      const b = kleuren[j];
      const normaal = deltaE(rgbNaarLab(a.rgb), rgbNaarLab(b.rgb));
      if (normaal < 12) continue;
      let ergste = null;
      for (const soort of SOORTEN.slice(1, 4)) {
        const d = deltaE(rgbNaarLab(simuleer(a.rgb, soort.id, sterkte)), rgbNaarLab(simuleer(b.rgb, soort.id, sterkte)));
        if (d < 8 && (!ergste || d < ergste.d)) ergste = { soort, d };
      }
      if (ergste) uit.push({ a, b, normaal, ...ergste });
    }
  }
  // hetzelfde paar kleurnamen bij dezelfde soort maar één keer (het ergste)
  uit.sort((x, y) => x.d - y.d);
  const gezien = new Set();
  return uit.filter((z) => {
    const sleutel = [kleurNaam(z.a.rgb), kleurNaam(z.b.rgb)].sort().join('|') + '|' + z.soort.id;
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
}

// ---- het venster ----------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const alles = await vexel.selectie();
  const items = alles.filter((o) => tekenbaar(o));
  const overgeslagen = alles.length - items.length;
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  let kader = null;
  for (const o of items) {
    const k = o.kader;
    if (!k) continue;
    if (!kader) kader = { x: k.x, y: k.y, x1: k.x + k.b, y1: k.y + k.h };
    else {
      kader.x = Math.min(kader.x, k.x);
      kader.y = Math.min(kader.y, k.y);
      kader.x1 = Math.max(kader.x1, k.x + k.b);
      kader.y1 = Math.max(kader.y1, k.y + k.h);
    }
  }
  if (kader) {
    kader.b = kader.x1 - kader.x;
    kader.h = kader.y1 - kader.y;
  }

  const sterkte = keuzeVeld([['volledig', 'Volledig (-anopie)'], ['gedeeltelijk', 'Gedeeltelijk (-anomalie)']], w0.sterkte);
  const kopie = keuzeVeld([
    ['protanopie', 'Protanopie'], ['deuteranopie', 'Deuteranopie'], ['tritanopie', 'Tritanopie'], ['achromatopsie', 'Achromatopsie'], ['alle', 'Alle vier naast elkaar'],
  ], w0.kopie);

  const doek = maak('canvas', { role: 'img', 'aria-label': 'Voorvertoning per soort kleurenblindheid', stijl: { width: '100%', height: '300px', background: 'transparent' } });
  const waarschuwing = maak('div', { 'aria-live': 'polite', stijl: { border: '1px solid var(--lijn)', borderRadius: '5px', background: 'var(--bg-2)', overflow: 'auto', minHeight: '0' } });
  const samenvatting = maak('p', { klasse: 'uitleg', stijl: { margin: '0', minHeight: '1.5em' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Gesimuleerde kopie maken' });
  const sluit = maak('button', { klasse: 'knop', type: 'button', tekst: 'Sluiten', bijClick: () => vexel.sluit() });

  const formulier = maak('form', {
    stijl: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto auto auto', gap: '10px', padding: '12px 14px 14px', height: '100vh' },
  },
  doek,
  waarschuwing,
  kolommenRij('1fr 1fr', metLabel('Sterkte', sterkte), metLabel('Kopie ernaast', kopie)),
  samenvatting,
  maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, sluit, maakKnop),
  );
  document.head.append(maak('style', {
    tekst: '.knop{white-space:nowrap}.w{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:center;padding:6px 10px;'
      + 'border-bottom:1px solid var(--lijn)}.w:last-child{border-bottom:0}.paar{display:flex;gap:3px}'
      + '.staal{width:18px;height:18px;border-radius:3px;border:1px solid #0006}.pijl{color:var(--tekst-zacht);padding:0 3px;align-self:center}'
      + '.w b{font-weight:600}.w .zacht{color:var(--tekst-zacht)}.goed{padding:10px 12px;color:var(--tekst-zacht);line-height:1.5}'
      + '.goed b{color:#9be37a;font-weight:600}',
  }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({ sterkte: sterkte.value, kopie: kopie.value });

  function tekenAlles() {
    const w = waarden();
    const schaal = devicePixelRatio || 1;
    const vak = doek.getBoundingClientRect();
    doek.width = Math.round(vak.width * schaal);
    doek.height = Math.round(vak.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, vak.width, vak.height);
    const kol = 3;
    const rij = 2;
    const tussen = 8;
    const labelH = 16;
    const pb = (vak.width - tussen * (kol - 1)) / kol;
    const ph = (vak.height - tussen * (rij - 1)) / rij - labelH;
    const kleuren = verzamelKleuren(items);
    SOORTEN.forEach((soort, i) => {
      const x = (i % kol) * (pb + tussen);
      const y = Math.floor(i / kol) * (ph + labelH + tussen);
      if (kader) tekenPaneel(g, x, y, pb, ph, items, kader, soort.id, w.sterkte);
      else {
        g.fillStyle = vexel.thema.bg2 || '#24262c';
        g.fillRect(x, y, pb, ph);
      }
      g.fillStyle = i === 0 ? (vexel.thema.tekst || '#e8e9ec') : (vexel.thema.tekstZacht || '#b4b7bf');
      g.font = `${i === 0 ? 600 : 500} 11px Inter, system-ui, sans-serif`;
      g.textBaseline = 'top';
      const naam = w.sterkte === 'gedeeltelijk' && soort.anomalie ? soort.anomalie : soort.naam;
      g.fillText(naam, x + 1, y + ph + 3, pb);
    });
    // zesde vak: de kleuren uit de selectie, normaal en per soort
    const x = 2 * (pb + tussen);
    const y = ph + labelH + tussen;
    g.fillStyle = vexel.thema.bg2 || '#24262c';
    g.fillRect(x, y, pb, ph);
    const zichtbaar = kleuren.slice(0, 8);
    if (zichtbaar.length) {
      const rh = Math.min(16, (ph - 8) / zichtbaar.length);
      const sb = (pb - 16) / SOORTEN.length;
      zichtbaar.forEach((k, r) => {
        SOORTEN.forEach((soort, c) => {
          g.fillStyle = rgbNaarHex(simuleer(k.rgb, soort.id, w.sterkte));
          g.fillRect(x + 8 + c * sb, y + 4 + r * rh, sb - 2, rh - 2);
        });
      });
    }
    g.fillStyle = vexel.thema.tekstZacht || '#b4b7bf';
    g.font = '500 11px Inter, system-ui, sans-serif';
    g.fillText(`Kleuren (${kleuren.length})`, x + 1, y + ph + 3, pb);
  }

  function bijwerken() {
    const w = waarden();
    tekenAlles();
    waarschuwing.replaceChildren();
    const kleuren = verzamelKleuren(items);
    let tekst;
    let fout = false;
    if (!alles.length) {
      const t = 'Er is niets geselecteerd. Sluit dit venster, selecteer de vormen (geen groepen) en kies Kleurenblindheid opnieuw.';
      waarschuwing.append(maak('div', { klasse: 'goed', tekst: t }));
      tekst = 'Selecteer eerst een of meer vormen.';
      fout = true;
    } else if (!items.length) {
      waarschuwing.append(maak('div', { klasse: 'goed', tekst: 'Groepen en foto’s kan de plugin niet uitlezen. Open de groep (dubbelklik) en selecteer de vormen erin.' }));
      tekst = 'Niets in de selectie heeft een pad of tekst.';
      fout = true;
    } else {
      const botsingen = vindBotsingen(kleuren, w.sterkte);
      if (!botsingen.length) {
        const goed = maak('div', { klasse: 'goed' });
        goed.append(maak('b', { tekst: 'Geen botsende kleuren gevonden. ' }),
          kleuren.length < 2 ? 'Er is maar één kleur, dus niets om te vergelijken.'
            : `De ${kleuren.length} kleuren blijven bij alle drie de soorten van elkaar te onderscheiden. `
              + 'Kijk wel of licht en donker genoeg verschillen (achromatopsie).');
        waarschuwing.append(goed);
      }
      for (const z of botsingen.slice(0, 12)) {
        const staal = (rgb) => maak('span', { klasse: 'staal', stijl: { background: rgbNaarHex(rgb) } });
        const sa = simuleer(z.a.rgb, z.soort.id, w.sterkte);
        const sb = simuleer(z.b.rgb, z.soort.id, w.sterkte);
        const regel = maak('div', {});
        const naamA = kleurNaam(z.a.rgb);
        const naamB = kleurNaam(z.b.rgb);
        const soortNaam = (w.sterkte === 'gedeeltelijk' ? z.soort.anomalie : z.soort.naam).toLowerCase();
        regel.append(maak('b', { tekst: naamA === naamB ? `${naamA} (${z.a.hex}) en ${z.b.hex}` : `${naamA} en ${naamB}` }),
          ` vallen samen bij ${soortNaam}`, maak('span', { klasse: 'zacht', tekst: ` (verschil ${getal(z.d)} in plaats van ${getal(z.normaal)})` }));
        waarschuwing.append(maak('div', { klasse: 'w' },
          maak('span', { klasse: 'paar' }, staal(z.a.rgb), staal(z.b.rgb), maak('span', { klasse: 'pijl', tekst: '›' }), staal(sa), staal(sb)), regel));
      }
      tekst = botsingen.length
        ? `${botsingen.length} ${botsingen.length === 1 ? 'kleurpaar valt' : 'kleurparen vallen'} samen. Verschil ze ook in licht/donker, patroon of tekst.`
        : `${items.length} ${items.length === 1 ? 'vorm' : 'vormen'}, ${kleuren.length} ${kleuren.length === 1 ? 'kleur' : 'kleuren'} bekeken.`;
      if (overgeslagen) tekst += ` ${overgeslagen} overgeslagen (groep of foto).`;
      if (doc.alleenLezen) tekst += ' Alleen-lezen: een kopie maken kan niet.';
    }
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', fout);
    maakKnop.disabled = fout || doc.alleenLezen || !items.some((o) => tekenbaar(o) === 'pad');
  }

  function kopieVormen(w) {
    const cmyk = doc.kleurruimte === 'cmyk';
    const kleurUit = (rgb) => {
      if (!rgb) return null;
      if (!cmyk) return { hex: rgbNaarHex(rgb) };
      const [r, g, b] = rgb.map((v) => v / 255);
      const k = 1 - Math.max(r, g, b);
      if (k >= 0.999) return { cmyk: [0, 0, 0, 100] };
      const f = (v) => Math.round(((1 - v - k) / (1 - k)) * 1000) / 10;
      return { cmyk: [f(r), f(g), f(b), Math.round(k * 1000) / 10] };
    };
    const soorten = w.kopie === 'alle' ? SOORTEN.slice(1).map((s) => s.id) : [w.kopie];
    const stap = kader.b + vexel.mm(10);
    const zacht = cmyk ? { cmyk: [0, 0, 0, 60] } : { hex: '#666666' };
    return soorten.map((id, i) => {
      const soort = SOORTEN.find((s) => s.id === id);
      const dx = stap * (i + 1);
      const kinderen = [];
      for (const o of items) {
        if (tekenbaar(o) !== 'pad') continue;
        const verschuif = (p) => (p ? { x: p.x + dx, y: p.y } : undefined);
        const subpaden = o.subpaden.map((sp) => ({
          gesloten: Boolean(sp.gesloten),
          punten: sp.punten.map((p) => {
            const q = { x: p.x + dx, y: p.y };
            if (p.in) q.in = verschuif(p.in);
            if (p.uit) q.uit = verschuif(p.uit);
            return q;
          }),
        }));
        const vorm = {
          soort: 'pad', naam: (o.naam || 'Vorm').slice(0, 100), subpaden, vulregel: o.vulregel === 'evenodd' ? 'evenodd' : 'nonzero',
          vulling: kleurUit(simuleer(rgbVan(o.vulling), id, w.sterkte)),
          lijn: o.lijndikte > 0 ? kleurUit(simuleer(rgbVan(o.lijn), id, w.sterkte)) : null,
        };
        if (o.lijndikte > 0) vorm.lijndikte = o.lijndikte;
        if (typeof o.dekking === 'number' && o.dekking < 1) vorm.dekking = o.dekking;
        kinderen.push(vorm);
      }
      const naam = w.sterkte === 'gedeeltelijk' && soort.anomalie ? soort.anomalie : soort.naam;
      kinderen.push({
        soort: 'tekst', naam: 'Bijschrift', inhoud: `${naam} (gesimuleerd)`, x: kader.x + dx, y: kader.y + kader.h + vexel.mm(5),
        grootte: 8, gewicht: 500, vulling: zacht,
      });
      return { soort: 'groep', naam: `Kopie · ${naam.toLowerCase()}`, kinderen };
    });
  }

  formulier.addEventListener('change', bijwerken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (maakKnop.disabled) return;
    const w = waarden();
    maakKnop.disabled = true;
    const punten = items.reduce((n, o) => n + (o.subpaden || []).reduce((m, sp) => m + (sp.punten || []).length, 0), 0);
    const keer = w.kopie === 'alle' ? 4 : 1;
    if (punten * keer > 50000 || items.length * keer > 4900) {
      const melding = `Dat zijn te veel punten voor één keer (${punten * keer}). Kies één soort in plaats van alle vier, of selecteer minder.`;
      vexel.melding(melding, 'let');
      return;
    }
    try {
      const vormen = kopieVormen(w);
      await vexel.maak(vormen);
      await vexel.bewaar('instellingen', w);
      const tekstErbij = items.some((o) => tekenbaar(o) === 'tekst') ? ' Tekst is niet meegekopieerd.' : '';
      const wat = vormen.length === 1 ? 'Gesimuleerde kopie' : `${vormen.length} gesimuleerde kopieën`;
      vexel.melding(`${wat} gemaakt rechts naast de selectie.${tekstErbij}`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De kopie kon niet worden gemaakt.', 'fout');
    }
  });

  bijwerken();
  sterkte.addEventListener('change', () => vexel.bewaar('instellingen', waarden()));
}

vexel.opCommando('bekijken', toonVenster);
