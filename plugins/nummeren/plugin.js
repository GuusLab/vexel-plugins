// Nummeren: genummerde tickets, bonnen en loten, met afscheurstrook, verdeeld over vellen.
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
// ---- kleuren ---------------------------------------------------------------------

const NUMMERKLEUREN = {
  rood: { naam: 'Rood', cmyk: [0, 100, 100, 0], hex: '#e30d1b' },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
  blauw: { naam: 'Blauw', cmyk: [100, 60, 0, 0], hex: '#0f5fb5' },
};
// Hulplijnen voor de drukker: eigen steunkleuren, overdrukkend, zodat ze er makkelijk uit kunnen.
const SNIJLIJN = { steunkleur: { naam: 'Snijlijn', cmyk: [0, 100, 0, 0] } };
const PERFORATIE = { steunkleur: { naam: 'Perforatie', cmyk: [100, 0, 0, 0] } };

// ---- nummers -----------------------------------------------------------------------

/** Maakt de tekst van een nummer, volgens het sjabloon of de eigen opmaak. */
function nummerTekst(w, n) {
  if (w.sjabloon) {
    const runs = [...w.sjabloon.inhoud.matchAll(/#+/g)];
    if (runs.length) {
      const langste = runs.reduce((a, b) => (b[0].length > a[0].length ? b : a));
      return w.sjabloon.inhoud.slice(0, langste.index) + String(n).padStart(langste[0].length, '0') + w.sjabloon.inhoud.slice(langste.index + langste[0].length);
    }
    return `${w.sjabloon.inhoud}${String(n).padStart(w.cijfers, '0')}`;
  }
  return `${w.voor}${String(n).padStart(w.cijfers, '0')}${w.achter}`;
}

/** Welk nummer (volgnummer i, vanaf 0) op plek p van vel v komt, of -1. */
function volgnummer(w, lay, v, p) {
  if (w.volgorde === 'stapel') return p * lay.vellen + v;
  const i = v * lay.perVel + p;
  return i < w.aantal ? i : -1;
}

// ---- de indeling (mm) -----------------------------------------------------------------

const PER_RIJ_VELLEN = 10;

function indeling(w, doc) {
  const tb = doc.tekengebied.b / PT;
  const th = doc.tekengebied.h / PT;
  const kol = Math.floor((tb - 2 * w.marge + w.tussen) / (w.breedte + w.tussen));
  const rij = Math.floor((th - 2 * w.marge + w.tussen) / (w.hoogte + w.tussen));
  const uit = { tb, th, kol, rij, perVel: Math.max(0, kol * rij) };
  if (uit.perVel < 1) {
    uit.fout = `Een vak van ${mmTekst(w.breedte)} × ${mmTekst(w.hoogte)} mm past niet op het tekengebied (${mmTekst(tb)} × ${mmTekst(th)} mm) `
      + 'met deze marge. Kies een kleiner vak of een kleinere marge.';
    return uit;
  }
  if (w.strook !== 'geen') {
    const lang = w.strook === 'links' || w.strook === 'rechts' ? w.breedte : w.hoogte;
    if (w.strookMaat > lang - 10) {
      uit.fout = `De strook (${mmTekst(w.strookMaat)} mm) is te groot voor een vak van ${mmTekst(w.breedte)} × ${mmTekst(w.hoogte)} mm.`;
      return uit;
    }
  }
  uit.vellen = Math.ceil(w.aantal / uit.perVel);
  uit.totaal = w.volgorde === 'stapel' ? uit.vellen * uit.perVel : w.aantal;
  const blokB = kol * w.breedte + (kol - 1) * w.tussen;
  const blokH = rij * w.hoogte + (rij - 1) * w.tussen;
  uit.x0 = (tb - blokB) / 2;
  uit.y0 = (th - blokH) / 2;
  uit.vel = (v) => ({ x: (v % PER_RIJ_VELLEN) * (tb + 20), y: Math.floor(v / PER_RIJ_VELLEN) * (th + 20) });
  uit.plek = (p) => ({ x: uit.x0 + (p % kol) * (w.breedte + w.tussen), y: uit.y0 + Math.floor(p / kol) * (w.hoogte + w.tussen) });
  return uit;
}

/** De twee delen van een vak: het hoofddeel en de strook (mm, ten opzichte van het vak). */
function delen(w) {
  const s = w.strook === 'geen' ? 0 : w.strookMaat;
  const B = w.breedte;
  const H = w.hoogte;
  switch (w.strook) {
    case 'links': return { hoofd: { x: s, y: 0, b: B - s, h: H }, strook: { x: 0, y: 0, b: s, h: H }, perf: [s, 0, s, H] };
    case 'rechts': return { hoofd: { x: 0, y: 0, b: B - s, h: H }, strook: { x: B - s, y: 0, b: s, h: H }, perf: [B - s, 0, B - s, H] };
    case 'boven': return { hoofd: { x: 0, y: s, b: B, h: H - s }, strook: { x: 0, y: 0, b: B, h: s }, perf: [0, s, B, s] };
    case 'onder': return { hoofd: { x: 0, y: 0, b: B, h: H - s }, strook: { x: 0, y: H - s, b: B, h: s }, perf: [0, H - s, B, H - s] };
    default: return { hoofd: { x: 0, y: 0, b: B, h: H }, strook: null, perf: null };
  }
}

/** Een lettergrootte (pt) die past in een breedte (pt), uitgaande van gemiddelde letters. */
const pasGrootte = (tekst, breedte, max, gewicht = 400) => Math.max(5, Math.min(max, breedte / (Math.max(1, tekst.length) * (gewicht >= 600 ? 0.6 : 0.55))));

// ---- de vormen ----------------------------------------------------------------------

function vakVormen(w, n, x, y, k) {
  const d = delen(w);
  const nr = nummerTekst(w, n);
  const kinderen = [];
  const pad = Math.min(4, w.hoogte * 0.1) * PT;
  const h = { x: x + d.hoofd.x * PT, y: y + d.hoofd.y * PT, b: d.hoofd.b * PT, h: d.hoofd.h * PT };
  if (w.snijlijn) {
    kinderen.push({ soort: 'rechthoek', naam: 'Snijlijn', x, y, b: w.breedte * PT, h: w.hoogte * PT, vulling: null, lijn: SNIJLIJN, lijndikte: 0.25, overdrukLijn: true });
  }
  let ty = h.y + pad;
  if (!w.alleenNummers) {
    if (w.titel) {
      const ruimte = (h.b - 2 * pad) * (w.plek === 'rechtsboven' ? 0.6 : 1);
      const g = rond(pasGrootte(w.titel, ruimte, Math.min(22, h.h * 0.24), 700));
      ty += g * 0.95;
      kinderen.push({ soort: 'tekst', naam: 'Titel', x: rond(h.x + pad), y: rond(ty), inhoud: w.titel, grootte: g, gewicht: 700, vulling: k.tekst });
    }
    if (w.omschrijving) {
      const g = rond(pasGrootte(w.omschrijving, h.b - 2 * pad, Math.min(10, h.h * 0.12)));
      ty += g * 1.7;
      kinderen.push({ soort: 'tekst', naam: 'Omschrijving', x: rond(h.x + pad), y: rond(ty), inhoud: w.omschrijving, grootte: g, vulling: k.zacht });
    }
  }
  // het nummer in het hoofddeel
  const st = w.sjabloon;
  const ng = rond(st ? st.grootte : pasGrootte(nr, h.b * 0.6, Math.min(18, h.h * 0.2), 700));
  // 'midden' is het midden van de ruimte onder de titel en omschrijving
  const tekstOnder = w.alleenNummers ? h.y : Math.max(h.y, ty);
  const plek = {
    rechtsonder: { x: h.x + h.b - pad, y: h.y + h.h - pad, u: 'rechts' },
    rechtsboven: { x: h.x + h.b - pad, y: h.y + pad + ng * 0.75, u: 'rechts' },
    linksonder: { x: h.x + pad, y: h.y + h.h - pad, u: 'links' },
    midden: { x: h.x + h.b / 2, y: (tekstOnder + h.y + h.h) / 2 + ng * 0.36, u: 'midden' },
  }[w.plek];
  kinderen.push({ soort: 'tekst', naam: 'Nummer', x: rond(plek.x), y: rond(plek.y), inhoud: nr, grootte: ng, gewicht: st ? undefined : 700,
    uitlijning: plek.u, letterafstand: st ? undefined : 40, vulling: st && st.vulling ? st.vulling : k.nummer });
  // de afscheurstrook
  if (d.strook) {
    const s = { x: x + d.strook.x * PT, y: y + d.strook.y * PT, b: d.strook.b * PT, h: d.strook.h * PT };
    const sp = Math.min(3, w.strookMaat * 0.12) * PT;
    const sg = rond(Math.min(ng, pasGrootte(nr, s.b - 2 * sp, 14, 700)));
    const strook = [{ soort: 'tekst', naam: 'Nummer', x: rond(s.x + s.b / 2), y: rond(s.y + sp + sg * 0.8), inhoud: nr, grootte: sg, gewicht: st ? undefined : 700,
      uitlijning: 'midden', vulling: st && st.vulling ? st.vulling : k.nummer }];
    if (w.invulregels) {
      const labels = ['Naam', 'Telefoon'];
      const beschikbaar = s.y + s.h - sp - (s.y + sp + sg * 1.4);
      const regelH = Math.min(9 * PT, beschikbaar / 2);
      const lg = rond(Math.max(4.5, Math.min(6.5, regelH * 0.32)));
      if (regelH > 4 * PT) {
        const lijnen = [];
        labels.forEach((label, i) => {
          const ly = s.y + s.h - sp - (labels.length - 1 - i) * regelH;
          lijnen.push(lijnStuk(rond(s.x + sp), rond(ly), rond(s.x + s.b - sp), rond(ly)));
          strook.push({ soort: 'tekst', naam: label, x: rond(s.x + sp), y: rond(ly - regelH + lg * 1.3), inhoud: label, grootte: lg, vulling: k.zacht });
        });
        strook.push({ soort: 'pad', naam: 'Invulregels', subpaden: lijnen, vulling: null, lijn: k.regel, lijndikte: 0.4 });
      }
    }
    kinderen.push({ soort: 'groep', naam: 'Strook', kinderen: strook });
    const [a, b, c, e] = d.perf.map((v, i) => rond((i % 2 ? y : x) + v * PT));
    kinderen.push({ soort: 'pad', naam: 'Perforatie (steunkleur)', subpaden: [lijnStuk(a, b, c, e)], vulling: null, lijn: PERFORATIE, lijndikte: 0.5,
      streep: [3, 2], overdrukLijn: true });
    if (w.stippel) {
      kinderen.push({ soort: 'pad', naam: 'Stippellijn', subpaden: [lijnStuk(a, b, c, e)], vulling: null, lijn: k.regel, lijndikte: 0.5,
        streep: [0.1, 2.2], lijneinde: 'round' });
    }
  }
  return { soort: 'groep', naam: nr.slice(0, 100), kinderen };
}

function bouwVormen(w, lay, cmyk) {
  const kn = NUMMERKLEUREN[w.kleur] || NUMMERKLEUREN.rood;
  const k = {
    nummer: kleurIn(kn.cmyk, kn.hex, cmyk),
    tekst: kleurIn([0, 0, 0, 100], '#1a1a1a', cmyk),
    zacht: kleurIn([0, 0, 0, 65], '#595959', cmyk),
    regel: kleurIn([0, 0, 0, 45], '#8c8c8c', cmyk),
  };
  const vellen = [];
  for (let v = 0; v < lay.vellen; v++) {
    const o = lay.vel(v);
    const vakken = [];
    for (let p = 0; p < lay.perVel; p++) {
      const i = volgnummer(w, lay, v, p);
      if (i < 0) continue;
      const pl = lay.plek(p);
      vakken.push(vakVormen(w, w.begin + i * w.stap, (o.x + pl.x) * PT, (o.y + pl.y) * PT, k));
    }
    if (vakken.length) vellen.push({ soort: 'groep', naam: `Vel ${v + 1}`, kinderen: vakken });
  }
  const eerste = nummerTekst(w, w.begin);
  const laatste = nummerTekst(w, w.begin + (lay.totaal - 1) * w.stap);
  const uit = [{ soort: 'groep', naam: `Nummeren ${eerste} – ${laatste}`.slice(0, 100), kinderen: vellen }];
  if (lay.vellen > 1) {
    const kaders = [];
    for (let v = 1; v < lay.vellen; v++) {
      const o = lay.vel(v);
      kaders.push(rechthoekPunten(rond(o.x * PT), rond(o.y * PT), rond(lay.tb * PT), rond(lay.th * PT)));
    }
    uit.push({ soort: 'pad', naam: 'Vlakken naast het tekengebied (hulplijn)', subpaden: kaders, vulling: null,
      lijn: kleurIn([0, 0, 0, 30], '#b3b3b3', cmyk), lijndikte: 0.5, streep: [4, 3] });
  }
  return uit;
}

// ---- het venster ------------------------------------------------------------------------

const STANDAARD = {
  breedte: 95, hoogte: 50, strook: 'links', strookMaat: 30, voor: 'Nr. ', cijfers: 4, achter: '', begin: 1, stap: 1, aantal: 100,
  volgorde: 'stapel', plek: 'rechtsonder', kleur: 'rood', titel: 'Loterij', omschrijving: 'Trekking zaterdag 21 juni · € 2,50 per lot',
  alleenNummers: false, snijlijn: true, stippel: true, invulregels: true, marge: 10, tussen: 0, gebruikSjabloon: true,
};

/** Zet een kleur uit selectie() om naar een kleur voor maak(): een steunkleur op naam, anders CMYK of hex. */
function kleurUitSelectie(k) {
  if (!k) return null;
  if (typeof k.steunkleur === 'string' && k.steunkleur) {
    return Array.isArray(k.cmyk) ? { steunkleur: { naam: k.steunkleur.slice(0, 60), cmyk: k.cmyk } } : { steunkleur: { naam: k.steunkleur.slice(0, 60) } };
  }
  if (k.registratie) return { registratie: true };
  if (Array.isArray(k.cmyk) && k.cmyk.length === 4) return { cmyk: k.cmyk };
  if (typeof k.hex === 'string') return { hex: k.hex };
  return null;
}

/** Zoekt in de selectie een tekst (sjabloon) en een rechthoek (maat). */
function leesSelectie(sel) {
  const tekst = sel.find((o) => o.soort === 'tekst' && typeof o.inhoud === 'string' && o.inhoud.trim());
  const recht = sel.find((o) => o.soort === 'pad' && o.subpaden && o.subpaden.length === 1 && o.subpaden[0].punten.length === 4
    && o.kader.b > 5 && o.kader.h > 5);
  return {
    sjabloon: tekst ? { inhoud: tekst.inhoud.split('\n')[0].slice(0, 80), grootte: begrens(tekst.grootte || 12, 4, 200), vulling: kleurUitSelectie(tekst.vulling) } : null,
    maat: recht ? { b: rond(recht.kader.b / PT, 10), h: rond(recht.kader.h / PT, 10) } : null,
  };
}

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  let uitSelectie = { sjabloon: null, maat: null };
  try { uitSelectie = leesSelectie(await vexel.selectie()); } catch (fout) { /* zonder selectie gaat het ook */ }

  const v = {
    breedte: getalVeld(w0.breedte, 10, 1000, 0.5),
    hoogte: getalVeld(w0.hoogte, 10, 1000, 0.5),
    strook: keuze({ geen: 'Geen', links: 'Links', rechts: 'Rechts', boven: 'Boven', onder: 'Onder' }, w0.strook),
    strookMaat: getalVeld(w0.strookMaat, 5, 500, 0.5),
    voor: tekstVeld(w0.voor, 'bijv. Nr. ', 20),
    cijfers: getalVeld(w0.cijfers, 1, 8, 1),
    achter: tekstVeld(w0.achter, '', 20),
    begin: getalVeld(w0.begin, 0, 99999999, 1),
    stap: getalVeld(w0.stap, 1, 1000, 1),
    aantal: getalVeld(w0.aantal, 1, 9999, 1),
    volgorde: keuze({ stapel: 'Op snijstapel', vel: 'Per vel' }, w0.volgorde),
    plek: keuze({ rechtsonder: 'Rechtsonder', rechtsboven: 'Rechtsboven', linksonder: 'Linksonder', midden: 'Midden' }, w0.plek),
    kleur: keuze(Object.fromEntries(Object.entries(NUMMERKLEUREN).map(([s, x]) => [s, x.naam])), w0.kleur),
    titel: tekstVeld(w0.titel, 'Geen titel', 60),
    omschrijving: tekstVeld(w0.omschrijving, 'Geen omschrijving', 100),
    marge: getalVeld(w0.marge, 0, 100, 1),
    tussen: getalVeld(w0.tussen, 0, 50, 0.5),
  };
  const vink = {
    alleenNummers: vinkje('Alleen nummers', w0.alleenNummers),
    snijlijn: vinkje('Snijlijnen', w0.snijlijn),
    stippel: vinkje('Stippellijn drukken', w0.stippel),
    invulregels: vinkje('Naam en telefoon op strook', w0.invulregels),
    sjabloon: vinkje('', w0.gebruikSjabloon),
  };
  const sjabloonRij = el('div', { stijl: { display: 'none', alignItems: 'center', gap: '8px', background: 'var(--bg-2)', border: '1px solid var(--lijn)',
    borderRadius: '6px', padding: '6px 8px' } });
  if (uitSelectie.sjabloon || uitSelectie.maat) {
    sjabloonRij.style.display = 'flex';
    if (uitSelectie.sjabloon) {
      vink.sjabloon.label.lastChild.textContent = `Geselecteerde tekst als sjabloon: «${uitSelectie.sjabloon.inhoud}»`;
      vink.sjabloon.label.style.flex = '1';
      vink.sjabloon.label.style.overflow = 'hidden';
      sjabloonRij.append(vink.sjabloon.label);
    }
    if (uitSelectie.maat) {
      const neem = el('button', { klasse: 'knop', type: 'button', tekst: `Maat ${mmTekst(uitSelectie.maat.b)} × ${mmTekst(uitSelectie.maat.h)} mm`,
        title: 'Neem de maat van de geselecteerde rechthoek over', stijl: { marginLeft: 'auto', whiteSpace: 'nowrap' } });
      neem.addEventListener('click', () => { v.breedte.value = uitSelectie.maat.b; v.hoogte.value = uitSelectie.maat.h; teken(); });
      sjabloonRij.append(neem);
    }
  }

  const voorbeeld = el('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '170px' } });
  const samenvatting = el('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '34px' } });
  const maakKnop = el('button', { klasse: 'knop primair', type: 'submit', tekst: 'Nummeren' });
  const annuleer = el('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const opmaakVelden = kolom('1fr 1.6fr', vak('Titel', v.titel), vak('Omschrijving', v.omschrijving));
  const nummerOpmaak = kolom('1.2fr 0.7fr 1fr', vak('Voorvoegsel', v.voor), vak('Cijfers', v.cijfers), vak('Achtervoegsel', v.achter));

  const formulier = el('form', { stijl: { display: 'grid', gap: '8px' } },
    sjabloonRij,
    kop('Vak'),
    kolom(4, vak('Breedte', v.breedte, 'mm'), vak('Hoogte', v.hoogte, 'mm'), vak('Strook', v.strook), vak('Strook', v.strookMaat, 'mm')),
    kop('Nummer'),
    nummerOpmaak,
    kolom(3, vak('Beginnummer', v.begin), vak('Stap', v.stap), vak('Aantal', v.aantal)),
    kolom(3, vak('Volgorde', v.volgorde), vak('Plek', v.plek), vak('Kleur', v.kleur)),
    kop('Opmaak en vel'),
    opmaakVelden,
    kolom('1fr 1fr 1fr 1fr', vak('Marge', v.marge, 'mm'), vak('Snijruimte', v.tussen, 'mm'), el('div', { stijl: { gridColumn: 'span 2', display: 'grid', gap: '4px' } },
      vink.alleenNummers.label, vink.snijlijn.label)),
    el('div', { stijl: { display: 'flex', gap: '14px' } }, vink.stippel.label, vink.invulregels.label),
    el('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    el('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    breedte: begrens(leesGetal(v.breedte, 95), 10, 1000),
    hoogte: begrens(leesGetal(v.hoogte, 50), 10, 1000),
    strook: v.strook.value,
    strookMaat: begrens(leesGetal(v.strookMaat, 30), 5, 500),
    voor: v.voor.value.slice(0, 20),
    cijfers: Math.round(begrens(leesGetal(v.cijfers, 4), 1, 8)),
    achter: v.achter.value.slice(0, 20),
    begin: Math.round(begrens(leesGetal(v.begin, 1), 0, 99999999)),
    stap: Math.round(begrens(leesGetal(v.stap, 1), 1, 1000)),
    aantal: Math.round(begrens(leesGetal(v.aantal, 1), 1, 9999)),
    volgorde: v.volgorde.value,
    plek: v.plek.value,
    kleur: v.kleur.value,
    titel: v.titel.value.trim().slice(0, 60),
    omschrijving: v.omschrijving.value.trim().slice(0, 100),
    alleenNummers: vink.alleenNummers.invoer.checked,
    snijlijn: vink.snijlijn.invoer.checked,
    stippel: vink.stippel.invoer.checked,
    invulregels: vink.invulregels.invoer.checked,
    marge: begrens(leesGetal(v.marge, 10), 0, 100),
    tussen: begrens(leesGetal(v.tussen, 0), 0, 50),
    gebruikSjabloon: vink.sjabloon.invoer.checked,
    sjabloon: uitSelectie.sjabloon && vink.sjabloon.invoer.checked ? uitSelectie.sjabloon : null,
  });

  /** Telt de echte vormen tegen de grens van Vexel; geeft een melding of null. */
  function teVeel(w, lay) {
    const vormen = bouwVormen(w, lay, cmyk);
    const totaal = telVormen(vormen);
    if (totaal <= MAX_PER_KEER) return null;
    // zoek het grootste aantal dat nog past
    const past = (n) => { const wn = { ...w, aantal: n }; const ln = indeling(wn, doc); return !ln.fout && telVormen(bouwVormen(wn, ln, cmyk)) <= MAX_PER_KEER; };
    let laag = 1;
    let hoog = w.aantal - 1;
    while (laag < hoog) { const mid = Math.ceil((laag + hoog) / 2); if (past(mid)) laag = mid; else hoog = mid - 1; }
    const kan = laag;
    return `Zoveel nummers kunnen niet in één keer (hooguit ${getalTekst(kan)} met deze opmaak). Maak ze in delen: `
      + `begin het volgende deel bij nummer ${getalTekst(w.begin + kan * w.stap)}.`;
  }

  function teken() {
    const w = waarden();
    const lay = indeling(w, doc);
    const strookAan = w.strook !== 'geen';
    v.strookMaat.disabled = !strookAan;
    vink.stippel.invoer.disabled = !strookAan;
    vink.invulregels.invoer.disabled = !strookAan;
    vink.stippel.label.style.opacity = strookAan ? '1' : '0.45';
    vink.invulregels.label.style.opacity = strookAan ? '1' : '0.45';
    opmaakVelden.style.opacity = w.alleenNummers ? '0.45' : '1';
    nummerOpmaak.style.opacity = w.sjabloon ? '0.45' : '1';
    let fout = lay.fout || teVeel(w, lay);
    if (doc.alleenLezen) fout = 'Dit document is alleen-lezen; je kunt hier niet nummeren.';
    if (!fout) {
      const laatste = w.begin + (lay.totaal - 1) * w.stap;
      let tekst = `${getalTekst(lay.totaal)} nummers: ${nummerTekst(w, w.begin)} tot en met ${nummerTekst(w, laatste)} · `
        + `${lay.perVel} per vel (${lay.kol} × ${lay.rij}) · ${lay.vellen} ${lay.vellen === 1 ? 'vel' : 'vellen'}.`;
      if (w.volgorde === 'stapel' && lay.totaal !== w.aantal) tekst += ` Afgerond op hele vellen (${getalTekst(w.aantal)} gevraagd).`;
      if (w.volgorde === 'stapel' && lay.vellen > 1) tekst += ' Na het snijden ligt elke stapel op volgorde.';
      if (lay.vellen > 1) tekst += ' De andere vellen komen naast het tekengebied.';
      if (String(laatste).length > w.cijfers && !w.sjabloon) tekst += ` Let op: ${getalTekst(laatste)} heeft meer dan ${w.cijfers} cijfers.`;
      samenvatting.textContent = tekst;
    } else samenvatting.textContent = fout;
    samenvatting.classList.toggle('fout', Boolean(fout));
    maakKnop.disabled = Boolean(fout);
    tekenVoorbeeld(w, lay);
  }

  function tekenVoorbeeld(w, lay) {
    const { g, b, h } = canvasKlaar(voorbeeld);
    const s = Math.min((b - 12) / lay.tb, (h - 12) / lay.th);
    const ox = (b - lay.tb * s) / 2;
    const oy = (h - lay.th * s) / 2;
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, lay.tb * s, lay.th * s);
    if (lay.fout || !lay.perVel) return;
    const kleur = NUMMERKLEUREN[w.kleur].hex;
    const d = delen(w);
    for (let p = 0; p < lay.perVel; p++) {
      const i = volgnummer(w, lay, 0, p);
      if (i < 0) continue;
      const pl = lay.plek(p);
      const x = ox + pl.x * s;
      const y = oy + pl.y * s;
      g.strokeStyle = w.snijlijn ? '#e0198c' : '#c8c8c8';
      g.lineWidth = 0.7;
      g.setLineDash([]);
      g.strokeRect(x, y, w.breedte * s, w.hoogte * s);
      if (!w.alleenNummers && w.titel) {
        g.fillStyle = '#d9d9d9';
        g.fillRect(x + (d.hoofd.x + 3) * s, y + (d.hoofd.y + 3) * s, Math.min(d.hoofd.b * 0.55, w.titel.length * 2.6) * s, Math.max(1.5, 3.5 * s));
      }
      const nr = nummerTekst(w, w.begin + i * w.stap);
      const fs = Math.max(5, Math.min(11, 4.2 * s * 2));
      g.font = `700 ${fs}px system-ui, sans-serif`;
      g.fillStyle = kleur;
      g.textBaseline = 'alphabetic';
      const hx = x + d.hoofd.x * s;
      const hy = y + d.hoofd.y * s;
      const hb = d.hoofd.b * s;
      const hh = d.hoofd.h * s;
      const pos = { rechtsonder: [hx + hb - 3, hy + hh - 3, 'right'], rechtsboven: [hx + hb - 3, hy + fs + 2, 'right'],
        linksonder: [hx + 3, hy + hh - 3, 'left'], midden: [hx + hb / 2, hy + hh / 2 + fs * 0.35, 'center'] }[w.plek];
      g.textAlign = pos[2];
      g.fillText(nr, pos[0], pos[1]);
      if (d.strook) {
        g.textAlign = 'center';
        g.font = `700 ${Math.max(4, fs * 0.8)}px system-ui, sans-serif`;
        g.fillText(nr, x + (d.strook.x + d.strook.b / 2) * s, y + d.strook.y * s + fs);
        g.strokeStyle = '#2b9be6';
        g.setLineDash([3, 2]);
        g.beginPath();
        g.moveTo(x + d.perf[0] * s, y + d.perf[1] * s);
        g.lineTo(x + d.perf[2] * s, y + d.perf[3] * s);
        g.stroke();
        g.setLineDash([]);
      }
    }
  }

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const lay = indeling(w, doc);
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const fout = lay.fout || teVeel(w, lay);
    if (fout) return vexel.melding(fout, 'let');
    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(w, lay, cmyk));
      const { sjabloon, ...bewaar } = w;
      await vexel.bewaar('instellingen', bewaar);
      const laatste = nummerTekst(w, w.begin + (lay.totaal - 1) * w.stap);
      let melding = `${getalTekst(lay.totaal)} nummers gemaakt (${nummerTekst(w, w.begin)} – ${laatste}) op ${lay.vellen} ${lay.vellen === 1 ? 'vel' : 'vellen'}.`;
      if (lay.vellen > 1) melding += ' De andere vellen staan naast het tekengebied.';
      vexel.melding(melding, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het nummeren is niet gelukt.', 'fout');
    }
  });

  teken();
  v.titel.focus();
}

vexel.opCommando('maken', toonVenster);
