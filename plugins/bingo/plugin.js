// Bingokaarten: unieke kaarten voor 75 of 90 ballen of met eigen woorden, plus een trekkingslijst.
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
// ---- kleuren ----------------------------------------------------------------------

const KLEUREN = {
  blauw: { naam: 'Blauw', cmyk: [100, 55, 0, 0], hex: '#1667c7' },
  rood: { naam: 'Rood', cmyk: [0, 90, 80, 0], hex: '#e33a2f' },
  groen: { naam: 'Groen', cmyk: [80, 0, 90, 5], hex: '#2f9a48' },
  paars: { naam: 'Paars', cmyk: [65, 90, 0, 0], hex: '#7a3aa0' },
  oranje: { naam: 'Oranje', cmyk: [0, 60, 100, 0], hex: '#f07c00' },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
};

/** Een lichte tint van een kleur (voor vrije vakjes en lege vakken). */
function tint(k, deel) {
  const hex = k.hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16));
  const licht = hex.map((v) => Math.round(255 - (255 - v) * deel).toString(16).padStart(2, '0')).join('');
  return { cmyk: k.cmyk.map((v) => rond(v * deel, 10)), hex: `#${licht}` };
}

// ---- de kaarten -------------------------------------------------------------------

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

/** 75 ballen: per kolom 5 getallen uit 15 (B 1–15, I 16–30, …), midden vrij. */
function kaart75(r) {
  const kolommen = [];
  for (let k = 0; k < 5; k++) {
    const bak = [...Array(15).keys()].map((i) => k * 15 + i + 1);
    kolommen.push(schud(bak, r).slice(0, 5));
  }
  const vakken = [];
  for (let rij = 0; rij < 5; rij++) for (let k = 0; k < 5; k++) vakken.push(rij === 2 && k === 2 ? null : kolommen[k][rij]);
  return { vakken, sleutel: vakken.join(',') };
}

/**
 * 90 ballen: een strook van 6 kaarten van 3 × 9 waarop alle getallen 1–90 precies één
 * keer staan. Elke kaart heeft 15 getallen, 5 per rij, en in elke kolom minstens één.
 */
function strook90(r) {
  const groottes = [9, 10, 10, 10, 10, 10, 10, 10, 11];
  for (let poging = 0; poging < 200; poging++) {
    // 1. hoeveel getallen per kaart per kolom (1 tot 3)
    const aantal = [...Array(6)].map(() => new Array(9).fill(1));
    let goed = true;
    const over = groottes.map((g) => g - 6);
    const plekVrij = [...Array(6)].map(() => 6);
    // kolommen met de meeste rest eerst
    for (const k of [8, 0, 1, 2, 3, 4, 5, 6, 7]) {
      for (let n = 0; n < over[k]; n++) {
        const kandidaten = [...Array(6).keys()].filter((t) => aantal[t][k] < 3 && plekVrij[t] > 0);
        if (!kandidaten.length) { goed = false; break; }
        // liefst de kaart met de meeste ruimte
        const max = Math.max(...kandidaten.map((t) => plekVrij[t]));
        const beste = kandidaten.filter((t) => plekVrij[t] >= max - 1);
        const t = beste[Math.floor(r() * beste.length)];
        aantal[t][k]++;
        plekVrij[t]--;
      }
      if (!goed) break;
    }
    if (!goed || plekVrij.some((v) => v !== 0)) continue;
    // 2. per kaart de getallen over de rijen verdelen: 5 per rij
    const indelingen = aantal.map((rijAantal) => verdeelRijen(rijAantal, r));
    if (indelingen.some((x) => !x)) continue;
    // 3. de getallen zelf: elke kolom geschud over de kaarten, per kaart oplopend
    const kaarten = indelingen.map(() => new Array(27).fill(null));
    for (let k = 0; k < 9; k++) {
      const van = k === 0 ? 1 : k * 10;
      const tot = k === 8 ? 90 : k * 10 + 9;
      const bak = schud([...Array(tot - van + 1).keys()].map((i) => van + i), r);
      let p = 0;
      indelingen.forEach((rijen, t) => {
        const hier = bak.slice(p, p + aantal[t][k]).sort((a, b) => a - b);
        p += aantal[t][k];
        let i = 0;
        for (let rij = 0; rij < 3; rij++) if (rijen[rij][k]) kaarten[t][rij * 9 + k] = hier[i++];
      });
    }
    return kaarten.map((vakken) => ({ vakken, sleutel: vakken.join(',') }));
  }
  return null;
}

/** Kiest per kolom welke rijen een getal krijgen, zodat elke rij er 5 heeft. */
function verdeelRijen(perKolom, r) {
  const rijen = [new Array(9).fill(false), new Array(9).fill(false), new Array(9).fill(false)];
  const som = [0, 0, 0];
  const volgorde = schud([...Array(9).keys()], r).sort((a, b) => perKolom[b] - perKolom[a]);
  const zoek = (i) => {
    if (i === volgorde.length) return som.every((s) => s === 5);
    const k = volgorde[i];
    const n = perKolom[k];
    const keuzes = n === 3 ? [[0, 1, 2]] : n === 2 ? [[0, 1], [0, 2], [1, 2]] : [[0], [1], [2]];
    for (const keuze of schud(keuzes.slice(), r)) {
      if (keuze.some((rij) => som[rij] >= 5)) continue;
      keuze.forEach((rij) => { rijen[rij][k] = true; som[rij]++; });
      if (zoek(i + 1)) return true;
      keuze.forEach((rij) => { rijen[rij][k] = false; som[rij]--; });
    }
    return false;
  };
  return zoek(0) ? rijen : null;
}

/** Woordenkaart: een willekeurige keuze uit de lijst, eventueel met vrij midden. */
function kaartWoorden(r, woorden, n, vrij) {
  const nodig = n * n - (vrij ? 1 : 0);
  const keuze = schud(woorden.slice(), r).slice(0, nodig);
  const vakken = [];
  let i = 0;
  for (let c = 0; c < n * n; c++) vakken.push(vrij && c === (n * n - 1) / 2 ? null : keuze[i++]);
  return { vakken, sleutel: vakken.join('|') };
}

function leesWoorden(tekst) {
  const regels = tekst.includes('\n') ? tekst.split('\n') : tekst.split(/[;,]/);
  const gezien = new Set();
  const uit = [];
  for (const regel of regels) {
    const w = regel.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!w || gezien.has(w.toLowerCase())) continue;
    gezien.add(w.toLowerCase());
    uit.push(w);
  }
  return uit;
}

/** Alle kaarten, uniek. Kaart met nummer n hangt alleen af van zaadje en n. */
function maakKaarten(w) {
  const kaarten = [];
  const gezien = new Set();
  if (w.soort === '90') {
    const eerste = Math.floor((w.eerste - 1) / 6);
    const laatste = Math.floor((w.eerste - 1 + w.aantal - 1) / 6);
    for (let s = eerste; s <= laatste; s++) {
      let strook = null;
      for (let extra = 0; !strook && extra < 20; extra++) strook = strook90(toeval(mengZaad('bingo90', w.zaad, s, extra)));
      strook.forEach((kaart, i) => {
        const nr = s * 6 + i + 1;
        if (nr >= w.eerste && nr < w.eerste + w.aantal) kaarten.push({ ...kaart, nr, strook: s + 1 });
      });
    }
    return kaarten;
  }
  for (let i = 0; i < w.aantal; i++) {
    const nr = w.eerste + i;
    let kaart = null;
    for (let extra = 0; extra < 50; extra++) {
      const r = toeval(mengZaad('bingo', w.soort, w.zaad, nr, extra, w.n, w.vrij));
      kaart = w.soort === '75' ? kaart75(r) : kaartWoorden(r, w.woorden, w.n, w.vrij);
      if (!gezien.has(kaart.sleutel)) break;
    }
    gezien.add(kaart.sleutel);
    kaarten.push({ ...kaart, nr });
  }
  return kaarten;
}

/** Hoeveel verschillende woordkaarten er ongeveer kunnen (om te veel te voorkomen). */
function mogelijkeWoordkaarten(m, nodig) {
  let v = 1;
  for (let i = 0; i < nodig; i++) { v *= (m - i); if (v > 1e9) return Infinity; }
  return v;
}

// ---- de maten van een kaart (mm) -----------------------------------------------------

/** Kolommen en rijen van het raster, en de hoogtes van kop en voet per vakmaat. */
function vorm(w) {
  if (w.soort === '75') return { kol: 5, rij: 5, kop: 0.78, voet: 0.34 };
  if (w.soort === '90') return { kol: 9, rij: 3, kop: 0.95, voet: 0 };
  return { kol: w.n, rij: w.n, kop: 0.7, voet: 0 };
}

const GAT = 6;

function indeling(w, doc) {
  const tb = doc.tekengebied.b / PT;
  const th = doc.tekengebied.h / PT;
  const binnenB = tb - 2 * w.marge;
  const binnenH = th - 2 * w.marge;
  const v = vorm(w);
  const verhouding = (v.rij + v.kop + v.voet) / v.kol;
  let beste = null;
  for (let k = 1; k <= w.perVel; k++) {
    const r = Math.ceil(w.perVel / k);
    const breed = Math.min((binnenB - (k - 1) * GAT) / k, ((binnenH - (r - 1) * GAT) / r) / verhouding);
    if (!beste || breed > beste.breed + 0.01) beste = { k, r, breed };
  }
  const breed = Math.min(beste.breed, w.soort === '90' ? 190 : 150);
  const hoog = breed * verhouding;
  const vellen = Math.ceil(w.aantal / w.perVel);
  const totB = beste.k * breed + (beste.k - 1) * GAT;
  const totH = beste.r * hoog + (beste.r - 1) * GAT;
  const x0 = (tb - totB) / 2;
  const y0 = (th - totH) / 2;
  const plek = (i) => {
    const vel = Math.floor(i / w.perVel);
    const j = i % w.perVel;
    return { vel, x: vel * (tb + 20) + x0 + (j % beste.k) * (breed + GAT), y: y0 + Math.floor(j / beste.k) * (hoog + GAT) };
  };
  let fout = null;
  if (breed < (w.soort === '90' ? 70 : 45)) fout = `De kaarten worden te klein (${mmTekst(breed)} mm breed). Kies minder kaarten per vel of een kleinere marge.`;
  return { tb, th, breed, hoog, cel: breed / v.kol, v, vellen, plek, k: beste.k, r: beste.r, fout };
}

// ---- de vormen ----------------------------------------------------------------------

/** Verdeelt een woord of zin over regels en kiest een lettergrootte die in het vak past. */
function pasTekst(tekst, cel, start = cel * 0.22) {
  const woorden = tekst.split(' ');
  for (let g = start; g >= cel * 0.09; g *= 0.96) {
    const maxB = cel * 0.86;
    const breedte = (s) => s.length * g * 0.56;
    const regels = [];
    let regel = '';
    for (const woord of woorden) {
      const proef = regel ? `${regel} ${woord}` : woord;
      if (breedte(proef) <= maxB || !regel) regel = proef;
      else { regels.push(regel); regel = woord; }
    }
    if (regel) regels.push(regel);
    if (regels.every((x) => breedte(x) <= maxB) && regels.length * g * 1.18 <= cel * 0.8) return { regels, grootte: g };
  }
  const g = cel * 0.09;
  return { regels: [tekst], grootte: g };
}

function sterPad(cx, cy, buiten, binnen) {
  const punten = [];
  for (let i = 0; i < 10; i++) {
    const hoek = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? binnen : buiten;
    punten.push({ x: rond(cx + Math.cos(hoek) * r), y: rond(cy + Math.sin(hoek) * r) });
  }
  return { gesloten: true, punten };
}

function kaartVormen(w, kaart, x, y, lay, k) {
  const c = lay.cel * PT;
  const v = lay.v;
  const bb = v.kol * c;
  const kopH = v.kop * c;
  const rasterY = y + kopH;
  const rasterH = v.rij * c;
  const kinderen = [];
  const lijndik = Math.max(0.5, c * 0.012);
  // kop
  if (w.soort === '75') {
    kinderen.push({ soort: 'rechthoek', naam: 'Kopvlak', x, y, b: bb, h: kopH, vulling: k.accent, lijn: null });
    LETTERS.forEach((letter, i) => kinderen.push({ soort: 'tekst', naam: letter, x: rond(x + (i + 0.5) * c), y: rond(y + kopH * 0.5 + c * 0.2),
      inhoud: letter, grootte: rond(c * 0.56), gewicht: 800, uitlijning: 'midden', vulling: k.wit }));
  } else {
    kinderen.push({ soort: 'rechthoek', naam: 'Kopvlak', x, y, b: bb, h: kopH, vulling: k.accent, lijn: null });
    const grootte = rond(Math.min(kopH * 0.42, c * (w.soort === '90' ? 0.42 : 0.3)));
    kinderen.push({ soort: 'tekst', naam: 'Titel', x: rond(x + c * 0.25), y: rond(y + kopH * 0.5 + grootte * 0.36), inhoud: w.titel || 'Bingo',
      grootte, gewicht: 800, letterafstand: 30, vulling: k.wit });
    if (w.kaartnummer) {
      const tekst = w.soort === '90' ? `strook ${kaart.strook} · nr. ${String(kaart.nr).padStart(4, '0')}` : `nr. ${String(kaart.nr).padStart(4, '0')}`;
      kinderen.push({ soort: 'tekst', naam: 'Kaartnummer', x: rond(x + bb - c * 0.25), y: rond(y + kopH * 0.5 + grootte * 0.3), inhoud: tekst,
        grootte: rond(grootte * 0.62), gewicht: 500, uitlijning: 'rechts', vulling: k.wit });
    }
  }
  // lege vakken (90) en vrij vak
  const lege = [];
  kaart.vakken.forEach((waarde, i) => {
    if (waarde !== null) return;
    const cx = x + (i % v.kol) * c;
    const cy = rasterY + Math.floor(i / v.kol) * c;
    if (w.soort === '90') lege.push(rechthoekPunten(rond(cx), rond(cy), rond(c), rond(c)));
    else {
      kinderen.push({ soort: 'rechthoek', naam: 'Vrij vak', x: cx, y: cy, b: c, h: c, vulling: k.licht, lijn: null });
      kinderen.push({ soort: 'pad', naam: 'Ster', subpaden: [sterPad(cx + c / 2, cy + c * 0.44, c * 0.3, c * 0.13)], vulling: k.accent, lijn: null });
      kinderen.push({ soort: 'tekst', naam: 'Vrij', x: rond(cx + c / 2), y: rond(cy + c * 0.9), inhoud: 'VRIJ', grootte: rond(c * 0.13), gewicht: 700,
        uitlijning: 'midden', letterafstand: 80, vulling: k.accent });
    }
  });
  if (lege.length) kinderen.push({ soort: 'pad', naam: 'Lege vakken', subpaden: lege, vulling: k.licht, lijn: null });
  // raster
  const lijnen = [];
  for (let i = 1; i < v.kol; i++) lijnen.push(lijnStuk(rond(x + i * c), rond(rasterY), rond(x + i * c), rond(rasterY + rasterH)));
  for (let i = 1; i < v.rij; i++) lijnen.push(lijnStuk(rond(x), rond(rasterY + i * c), rond(x + bb), rond(rasterY + i * c)));
  kinderen.push({ soort: 'pad', naam: 'Raster', subpaden: lijnen, vulling: null, lijn: k.lijn, lijndikte: lijndik });
  // getallen of woorden
  const vakTeksten = [];
  kaart.vakken.forEach((waarde, i) => {
    if (waarde === null) return;
    const cx = x + (i % v.kol + 0.5) * c;
    const cy = rasterY + (Math.floor(i / v.kol) + 0.5) * c;
    if (w.soort === 'woorden') {
      const { regels, grootte } = pasTekst(String(waarde), c, k.woordGrootte);
      const ra = grootte * 1.18;
      const eersteY = cy - (regels.length - 1) * ra / 2 + grootte * 0.36;
      vakTeksten.push({ soort: 'tekst', naam: String(waarde).slice(0, 100), x: rond(cx), y: rond(eersteY), inhoud: regels.join('\n'), grootte: rond(grootte),
        regelafstand: rond(ra), gewicht: 600, uitlijning: 'midden', vulling: k.tekst });
    } else {
      const grootte = c * (w.soort === '90' ? 0.48 : 0.44);
      vakTeksten.push({ soort: 'tekst', naam: String(waarde), x: rond(cx), y: rond(cy + grootte * 0.36), inhoud: String(waarde), grootte: rond(grootte),
        gewicht: 700, uitlijning: 'midden', vulling: k.tekst });
    }
  });
  kinderen.push({ soort: 'groep', naam: w.soort === 'woorden' ? 'Woorden' : 'Getallen', kinderen: vakTeksten });
  // voet
  if (v.voet) {
    const voetY = rasterY + rasterH + v.voet * c * 0.66;
    const g = rond(Math.min(c * 0.16, 9));
    if (w.titel && w.soort === '75') kinderen.push({ soort: 'tekst', naam: 'Titel', x: rond(x + 1.5 * PT), y: rond(voetY), inhoud: w.titel, grootte: g, gewicht: 600, vulling: k.accent });
    if (w.kaartnummer) {
      kinderen.push({ soort: 'tekst', naam: 'Kaartnummer', x: rond(x + bb - 1.5 * PT), y: rond(voetY), inhoud: `nr. ${String(kaart.nr).padStart(4, '0')}`,
        grootte: g, gewicht: 500, uitlijning: 'rechts', vulling: k.zacht });
    }
  }
  // rand om kop en raster
  kinderen.push({ soort: 'rechthoek', naam: 'Rand', x, y, b: bb, h: kopH + rasterH, vulling: null, lijn: k.accent, lijndikte: rond(lijndik * 2.4), lijnhoek: 'miter' });
  return { soort: 'groep', naam: `Bingokaart ${String(kaart.nr).padStart(4, '0')}`, kinderen };
}

/** De trekkingslijst: alle getallen (of woorden) om af te strepen. */
function lijstVormen(w, x0, lay, k) {
  const marge = w.marge * PT;
  const b = lay.tb * PT - 2 * marge;
  const kinderen = [];
  const titel = w.soort === 'woorden' ? (w.titel || 'Bingo') : `Bingo · ${w.soort} ballen`;
  kinderen.push({ soort: 'tekst', naam: 'Titel', x: x0 + marge, y: marge + 18, inhoud: `Trekkingslijst · ${titel}`, grootte: 18, gewicht: 700, vulling: k.accent });
  kinderen.push({ soort: 'tekst', naam: 'Uitleg', x: x0 + marge, y: marge + 34, inhoud: 'Streep elk getrokken nummer af. Bij een bingo kun je de kaart hier nakijken.',
    grootte: 9, vulling: k.zacht });
  const y0 = marge + 50;
  if (w.soort === 'woorden') {
    const kol = w.woorden.length > 40 ? 3 : 2;
    const perKol = Math.ceil(w.woorden.length / kol);
    const rijH = Math.min(22, (lay.th * PT - y0 - marge) / perKol);
    const g = rond(Math.min(11, rijH * 0.55));
    const vakjes = [];
    const teksten = [];
    w.woorden.forEach((woord, i) => {
      const x = x0 + marge + Math.floor(i / perKol) * (b / kol);
      const y = y0 + (i % perKol) * rijH;
      vakjes.push(rechthoekPunten(rond(x), rond(y + rijH * 0.5 - g * 0.45), rond(g * 0.9), rond(g * 0.9)));
      teksten.push({ soort: 'tekst', naam: woord, x: rond(x + g * 1.5), y: rond(y + rijH * 0.5 + g * 0.36), inhoud: woord, grootte: g, vulling: k.tekst });
    });
    kinderen.push({ soort: 'pad', naam: 'Afstreepvakjes', subpaden: vakjes, vulling: null, lijn: k.accent, lijndikte: 0.75 });
    kinderen.push({ soort: 'groep', naam: 'Woorden', kinderen: teksten });
    return { soort: 'groep', naam: 'Trekkingslijst', kinderen };
  }
  // 75: kolommen B I N G O met de getallen eronder; 90: tien per rij
  const kolommen = w.soort === '75' ? 5 : 10;
  const rijen = w.soort === '75' ? 15 : 9;
  const kopRij = w.soort === '75' ? 1 : 0;
  const ruimteH = lay.th * PT - y0 - marge;
  const cw = Math.min(b / kolommen, 70);
  const ch = Math.min(ruimteH / (rijen + kopRij), cw);
  const gl = rond(Math.min(ch * 0.5, cw * 0.4));
  const xL = x0 + marge + (b - kolommen * cw) / 2;
  const lijnen = [];
  const teksten = [];
  for (let kol = 0; kol < kolommen; kol++) {
    if (kopRij) {
      kinderen.push({ soort: 'rechthoek', naam: `Letter ${LETTERS[kol]}`, x: rond(xL + kol * cw), y: y0, b: rond(cw), h: rond(ch), vulling: k.accent, lijn: null });
      teksten.push({ soort: 'tekst', naam: LETTERS[kol], x: rond(xL + (kol + 0.5) * cw), y: rond(y0 + ch * 0.5 + gl * 0.42), inhoud: LETTERS[kol],
        grootte: rond(gl * 1.15), gewicht: 800, uitlijning: 'midden', vulling: k.wit });
    }
    for (let rij = 0; rij < rijen; rij++) {
      const getal = w.soort === '75' ? kol * 15 + rij + 1 : rij * 10 + kol + 1;
      teksten.push({ soort: 'tekst', naam: String(getal), x: rond(xL + (kol + 0.5) * cw), y: rond(y0 + (rij + kopRij + 0.5) * ch + gl * 0.36),
        inhoud: String(getal), grootte: gl, gewicht: 600, uitlijning: 'midden', vulling: k.tekst });
    }
  }
  const yOnder = y0 + (rijen + kopRij) * ch;
  for (let i = 0; i <= kolommen; i++) lijnen.push(lijnStuk(rond(xL + i * cw), rond(y0), rond(xL + i * cw), rond(yOnder)));
  for (let i = 0; i <= rijen + kopRij; i++) lijnen.push(lijnStuk(rond(xL), rond(y0 + i * ch), rond(xL + kolommen * cw), rond(y0 + i * ch)));
  kinderen.push({ soort: 'pad', naam: 'Raster', subpaden: lijnen, vulling: null, lijn: k.lijn, lijndikte: 0.75 });
  kinderen.push({ soort: 'groep', naam: 'Getallen', kinderen: teksten });
  return { soort: 'groep', naam: 'Trekkingslijst', kinderen };
}

function bouwVormen(w, kaarten, lay, cmyk) {
  const a = KLEUREN[w.kleur] || KLEUREN.blauw;
  const kies = (x) => kleurIn(x.cmyk, x.hex, cmyk);
  const k = {
    accent: kies(a), licht: kies(tint(a, 0.14)), wit: kleurIn([0, 0, 0, 0], '#ffffff', cmyk),
    tekst: kleurIn([0, 0, 0, 100], '#1a1a1a', cmyk), lijn: kleurIn([0, 0, 0, 60], '#6b6b6b', cmyk), zacht: kleurIn([0, 0, 0, 55], '#7a7a7a', cmyk),
  };
  if (w.soort === 'woorden') {
    // één lettergrootte voor (bijna) alle woorden, zo oogt de kaart rustig; een enkele
    // uitschieter (het langste tiende deel) mag kleiner worden
    const c = lay.cel * PT;
    const maten = w.woorden.map((x) => pasTekst(x, c).grootte).sort((a, b) => a - b);
    k.woordGrootte = Math.max(c * 0.13, maten[Math.floor(maten.length * 0.1)]);
  }
  const perVel = [];
  kaarten.forEach((kaart, i) => {
    const p = lay.plek(i);
    if (!perVel[p.vel]) perVel[p.vel] = [];
    perVel[p.vel].push(kaartVormen(w, kaart, p.x * PT, p.y * PT, lay, k));
  });
  const uit = perVel.map((lijst, i) => ({ soort: 'groep', naam: `Vel ${i + 1}`, kinderen: lijst }));
  const extraVellen = lay.vellen - 1 + (w.lijst ? 1 : 0);
  if (w.lijst) uit.push(lijstVormen(w, lay.vellen * (lay.tb + 20) * PT, lay, k));
  if (extraVellen > 0) {
    const kaders = [];
    for (let i = 1; i <= extraVellen; i++) kaders.push(rechthoekPunten(rond(i * (lay.tb + 20) * PT), 0, rond(lay.tb * PT), rond(lay.th * PT)));
    uit.push({ soort: 'pad', naam: 'Vlakken naast het tekengebied (hulplijn)', subpaden: kaders, vulling: null,
      lijn: kleurIn([0, 0, 0, 30], '#b3b3b3', cmyk), lijndikte: 0.5, streep: [4, 3] });
  }
  return uit;
}

// ---- het venster --------------------------------------------------------------------

const VOORBEELDWOORDEN = [
  'Dansen', 'Polonaise', 'Discobal', 'Karaoke', 'Taart', 'Slingers', 'Ballonnen', 'Toost', 'Confetti', 'Limonade',
  'Fotohokje', 'Fotolijst', 'Kampvuur', 'Gitaar', 'Zonnebril', 'Feesthoed', 'Toeter', 'Bitterbal', 'Kaarsjes', 'Cadeau',
  'Speech', 'Lampion', 'Glitter', 'DJ', 'Snoep', 'Vuurwerk', 'Schuimpjes', 'IJsje', 'Selfie', 'Kroon',
].join('\n');

const STANDAARD = {
  soort: '75', aantal: 12, perVel: 4, eerste: 1, zaad: 1975, kleur: 'blauw', titel: 'Feestavond', kaartnummer: true, lijst: true,
  marge: 10, n: 5, vrij: true, woordenTekst: VOORBEELDWOORDEN,
};

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const v = {
    soort: keuze({ 75: '75 ballen (5 × 5, BINGO)', 90: '90 ballen (3 × 9, stroken van 6)', woorden: 'Eigen woorden (muziek, feest)' }, w0.soort),
    aantal: getalVeld(w0.aantal, 1, 999, 1),
    perVel: keuze({ 1: '1', 2: '2', 3: '3', 4: '4', 6: '6', 8: '8', 9: '9', 12: '12' }, String(w0.perVel)),
    eerste: getalVeld(w0.eerste, 1, 99999, 1),
    zaad: getalVeld(w0.zaad, 1, 999999, 1),
    kleur: keuze(Object.fromEntries(Object.entries(KLEUREN).map(([s, x]) => [s, x.naam])), w0.kleur),
    titel: tekstVeld(w0.titel, 'Bingo', 40),
    marge: getalVeld(w0.marge, 0, 50, 1),
    n: keuze({ 3: '3 × 3', 4: '4 × 4', 5: '5 × 5' }, String(w0.n)),
    woorden: el('textarea', { klasse: 'veld', rows: 4, spellcheck: 'false', stijl: { height: '74px', padding: '5px 8px', resize: 'none', lineHeight: '1.35' } }),
  };
  v.woorden.value = w0.woordenTekst;
  const nummer = vinkje('Kaartnummer', w0.kaartnummer);
  const lijst = vinkje('Trekkingslijst', w0.lijst);
  const vrij = vinkje('Vrij midden', w0.vrij);
  const andere = el('button', { klasse: 'knop', type: 'button', tekst: 'Andere', title: 'Nieuw zaadje: andere kaarten', stijl: { padding: '0 10px' } });
  v.zaad.style.flex = '1';
  v.zaad.style.minWidth = '0';

  const woordVak = el('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 112px', gap: '8px', alignItems: 'start' } },
    vak('Woorden (één per regel)', v.woorden),
    el('div', { stijl: { display: 'grid', gap: '10px' } }, vak('Raster', v.n), vrij.label));
  const voorbeeld = el('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '190px' } });
  const samenvatting = el('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '34px' } });
  const maakKnop = el('button', { klasse: 'knop primair', type: 'submit', tekst: 'Kaarten maken' });
  const annuleer = el('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = el('form', { stijl: { display: 'grid', gap: '9px' } },
    kolom('1.5fr 1fr', vak('Soort', v.soort), vak('Titel', v.titel)),
    woordVak,
    kolom(3, vak('Aantal kaarten', v.aantal), vak('Per vel', v.perVel), vak('Eerste nummer', v.eerste)),
    kolom('1.4fr 1fr 0.8fr', vak('Zaadje', el('div', { stijl: { display: 'flex', gap: '6px' } }, v.zaad, andere)), vak('Kleur', v.kleur), vak('Marge', v.marge, 'mm')),
    el('div', { stijl: { display: 'flex', gap: '16px' } }, nummer.label, lijst.label),
    el('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    el('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => {
    const soort = v.soort.value;
    const n = Number(v.n.value);
    return {
      soort,
      aantal: Math.round(begrens(leesGetal(v.aantal, 1), 1, 999)),
      perVel: Number(v.perVel.value) || 4,
      eerste: Math.round(begrens(leesGetal(v.eerste, 1), 1, 99999)),
      zaad: Math.round(begrens(leesGetal(v.zaad, 1), 1, 999999)),
      kleur: v.kleur.value,
      titel: v.titel.value.trim().slice(0, 40),
      marge: begrens(leesGetal(v.marge, 10), 0, 50),
      n,
      vrij: n % 2 === 1 && vrij.invoer.checked,
      woordenTekst: v.woorden.value.slice(0, 20000),
      woorden: leesWoorden(v.woorden.value).slice(0, 300),
      kaartnummer: nummer.invoer.checked,
      lijst: lijst.invoer.checked,
    };
  };

  function controle(w, lay) {
    if (doc.alleenLezen) return 'Dit document is alleen-lezen; je kunt hier geen kaarten maken.';
    if (w.soort === 'woorden') {
      const nodig = w.n * w.n - (w.vrij ? 1 : 0);
      if (w.woorden.length < nodig) {
        return `Een kaart van ${w.n} × ${w.n} heeft ${nodig} woorden nodig; je hebt er ${w.woorden.length}. Vul de lijst aan of kies een kleiner raster.`;
      }
      if (mogelijkeWoordkaarten(w.woorden.length, nodig) < w.aantal * 4) {
        return `Met ${w.woorden.length} woorden zijn er te weinig verschillende kaarten mogelijk. Voeg woorden toe of maak minder kaarten.`;
      }
    }
    if (lay.fout) return lay.fout;
    // tel de echte vormen (groepen tellen mee) tegen de grens van Vexel
    const vormen = bouwVormen(w, maakKaarten(w), lay, cmyk);
    const totaal = telVormen(vormen);
    if (totaal > MAX_PER_KEER) {
      // zoek het grootste aantal kaarten dat nog past
      const past = (n) => { const wn = { ...w, aantal: n }; return telVormen(bouwVormen(wn, maakKaarten(wn), indeling(wn, doc), cmyk)) <= MAX_PER_KEER; };
      let laag = 1;
      let hoog = w.aantal - 1;
      while (laag < hoog) { const mid = Math.ceil((laag + hoog) / 2); if (past(mid)) laag = mid; else hoog = mid - 1; }
      return `Zoveel kaarten kunnen niet in één keer (hooguit ${laag}). Maak ze in delen: zet daarna het eerste kaartnummer op ${w.eerste + laag}.`;
    }
    return null;
  }

  function teken() {
    const w = waarden();
    const lay = indeling(w, doc);
    woordVak.style.display = w.soort === 'woorden' ? 'grid' : 'none';
    vrij.label.style.opacity = w.n % 2 ? '1' : '0.45';
    vrij.invoer.disabled = w.n % 2 === 0;
    const fout = controle(w, lay);
    samenvatting.classList.toggle('fout', Boolean(fout));
    maakKnop.disabled = Boolean(fout);
    let kaarten = [];
    if (!fout) {
      kaarten = maakKaarten({ ...w, aantal: Math.min(w.aantal, w.perVel) });
      const vellen = lay.vellen;
      const soortTekst = w.soort === "woorden" ? `${w.n} × ${w.n}` : `${w.soort} ballen`;
      let tekst = `${w.aantal} ${w.aantal === 1 ? 'kaart' : 'kaarten'} (${soortTekst}) van ${mmTekst(lay.breed, 0)} × ${mmTekst(lay.hoog, 0)} mm, `
        + `${w.perVel} per vel: ${vellen} ${vellen === 1 ? 'vel' : 'vellen'}`;
      const extra = vellen - 1 + (w.lijst ? 1 : 0);
      if (extra > 0) tekst += `; ${extra === 1 ? 'het tweede vlak komt' : `${extra} vlakken komen`} rechts naast het tekengebied`;
      tekst += '.';
      if (w.soort === '90' && (w.eerste - 1) % 6 === 0 && w.aantal % 6 === 0) tekst += ' Elke strook van 6 heeft alle getallen 1–90 precies één keer.';
      samenvatting.textContent = tekst;
    } else samenvatting.textContent = fout;
    tekenVoorbeeld(w, lay, kaarten, Boolean(fout));
  }

  function tekenVoorbeeld(w, lay, kaarten, fout) {
    const { g, b, h } = canvasKlaar(voorbeeld);
    const s = Math.min((b - 12) / lay.tb, (h - 12) / lay.th);
    const ox = (b - lay.tb * s) / 2;
    const oy = (h - lay.th * s) / 2;
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, lay.tb * s, lay.th * s);
    const extra = lay.vellen - 1 + (w.lijst ? 1 : 0);
    if (extra > 0 && !fout) {
      // de vlakken naast het tekengebied als een stapeltje, met het aantal erop
      const vx = ox + lay.tb * s + 10;
      for (let i = Math.min(extra, 3) - 1; i >= 0; i--) {
        g.fillStyle = `rgba(255, 255, 255, ${0.16 + 0.1 * (2 - i)})`;
        g.fillRect(vx + i * 5, oy + i * 5, lay.tb * s * 0.55, lay.th * s * 0.55);
      }
      g.fillStyle = themaKleur('--tekst', vexel.thema.tekst);
      g.font = '600 12px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`+${extra}`, vx + lay.tb * s * 0.275, oy + lay.th * s * 0.275);
    }
    if (fout) return;
    const a = KLEUREN[w.kleur];
    const c = lay.cel * s;
    kaarten.forEach((kaart, i) => {
      const p = lay.plek(i);
      const x = ox + p.x * s;
      const y = oy + p.y * s;
      const kopH = lay.v.kop * c;
      g.fillStyle = a.hex;
      g.fillRect(x, y, lay.breed * s, kopH);
      g.strokeStyle = '#9a9a9a';
      g.lineWidth = 0.5;
      g.font = `600 ${Math.max(3, c * (w.soort === 'woorden' ? 0.16 : 0.42))}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      kaart.vakken.forEach((waarde, j) => {
        const cx = x + (j % lay.v.kol) * c;
        const cy = y + kopH + Math.floor(j / lay.v.kol) * c;
        if (waarde === null) { g.fillStyle = tint(a, 0.18).hex; g.fillRect(cx, cy, c, c); }
        g.strokeRect(cx, cy, c, c);
        if (waarde !== null && c > 7) {
          g.fillStyle = '#1a1a1a';
          const t = String(waarde);
          g.fillText(w.soort === 'woorden' && t.length > 7 ? `${t.slice(0, 6)}…` : t, cx + c / 2, cy + c / 2 + 0.5);
        }
      });
      if (w.soort === '75' && c > 7) {
        g.fillStyle = '#ffffff';
        g.font = `800 ${c * 0.5}px system-ui, sans-serif`;
        LETTERS.forEach((l, j) => g.fillText(l, x + (j + 0.5) * c, y + kopH / 2 + 0.5));
      }
      g.strokeStyle = a.hex;
      g.lineWidth = 1.2;
      g.strokeRect(x, y, lay.breed * s, kopH + lay.v.rij * c);
    });
  }

  formulier.addEventListener('input', teken);
  andere.addEventListener('click', () => { v.zaad.value = String(1 + Math.floor(Math.random() * 999998)); teken(); });
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const lay = indeling(w, doc);
    const fout = controle(w, lay);
    if (fout) return vexel.melding(fout, 'let');
    maakKnop.disabled = true;
    try {
      const kaarten = maakKaarten(w);
      await vexel.maak(bouwVormen(w, kaarten, lay, cmyk));
      const { woorden, ...bewaar } = w;
      await vexel.bewaar('instellingen', bewaar);
      const laatste = w.eerste + w.aantal - 1;
      let melding = `${w.aantal} ${w.aantal === 1 ? 'bingokaart' : 'bingokaarten'} gemaakt (nr. ${w.eerste}–${laatste}) op ${lay.vellen} ${lay.vellen === 1 ? 'vel' : 'vellen'}.`;
      if (lay.vellen > 1 || w.lijst) melding += ' Wat niet op het tekengebied past, staat rechts ernaast.';
      vexel.melding(melding, 'ok');
      vexel.sluit();
    } catch (fout2) {
      maakKnop.disabled = false;
      vexel.melding(fout2 && fout2.message ? fout2.message : 'De kaarten konden niet worden gemaakt.', 'fout');
    }
  });

  teken();
  v.soort.focus();
}

vexel.opCommando('maken', toonVenster);
