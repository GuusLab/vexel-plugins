// Sudoku: maakt geldige sudoku's met precies één oplossing, netjes op een vel.
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
// ---- de puzzels ---------------------------------------------------------------

const SOORTEN = {
  9: { n: 9, bh: 3, bb: 3, naam: '9 × 9' },
  6: { n: 6, bh: 2, bb: 3, naam: '6 × 6' },
};

// tier: welke stappen een puzzel mag vragen (1 = alleen 'waar kan deze 5 nog?',
// 2 = ook 'welk cijfer past hier nog?', 3 = ook paren en vergrendelde kandidaten,
// 9 = alles, zolang er één oplossing is). nietTier: de puzzel mag NIET al met die
// stappen op te lossen zijn (anders is hij te makkelijk voor dit niveau). Bij 6 × 6
// lukt bijna alles met de eerste stap; daar telt alleen het aantal gegeven cijfers.
const NIVEAUS = {
  makkelijk: { naam: 'Makkelijk', tier: 1, nietTier: 0, min: { 9: 36, 6: 20 } },
  gemiddeld: { naam: 'Gemiddeld', tier: 2, nietTier: 1, min: { 9: 28, 6: 16 } },
  moeilijk: { naam: 'Moeilijk', tier: 3, nietTier: 2, min: { 9: 25, 6: 13 } },
  heelmoeilijk: { naam: 'Heel moeilijk', tier: 9, nietTier: 3, min: { 9: 17, 6: 8 } },
};

const bitAantal = (m) => { let t = 0; while (m) { m &= m - 1; t++; } return t; };
const laagsteBit = (m) => 31 - Math.clz32(m & -m);

const structuren = new Map();
/** Rijen, kolommen en blokken van een soort, en per cel zijn buren. */
function structuur(s) {
  if (structuren.has(s.n)) return structuren.get(s.n);
  const { n, bh, bb } = s;
  const eenheden = [];
  for (let r = 0; r < n; r++) eenheden.push([...Array(n).keys()].map((c) => r * n + c));
  for (let c = 0; c < n; c++) eenheden.push([...Array(n).keys()].map((r) => r * n + c));
  for (let br = 0; br < n; br += bh) {
    for (let bc = 0; bc < n; bc += bb) {
      const blok = [];
      for (let r = br; r < br + bh; r++) for (let c = bc; c < bc + bb; c++) blok.push(r * n + c);
      eenheden.push(blok);
    }
  }
  const blokVan = (i) => Math.floor(Math.floor(i / n) / bh) * (n / bb) + Math.floor((i % n) / bb);
  const buren = [];
  for (let i = 0; i < n * n; i++) {
    const set = new Set();
    for (const e of eenheden) if (e.includes(i)) e.forEach((j) => { if (j !== i) set.add(j); });
    buren.push([...set]);
  }
  const st = { eenheden, buren, blokVan, vol: (1 << n) - 1 };
  structuren.set(n, st);
  return st;
}

/** Telt de oplossingen (stopt bij `limiet`); vult `uit` met de eerste oplossing. */
function telOplossingen(raster, s, limiet = 2, uit = null, r = null) {
  const { n } = s;
  const st = structuur(s);
  const g = raster.slice();
  const rij = new Array(n).fill(0);
  const kol = new Array(n).fill(0);
  const blok = new Array(n).fill(0);
  for (let i = 0; i < n * n; i++) {
    if (!g[i]) continue;
    const b = 1 << (g[i] - 1);
    const ri = Math.floor(i / n), ki = i % n, bi = st.blokVan(i);
    if ((rij[ri] | kol[ki] | blok[bi]) & b) return 0;
    rij[ri] |= b; kol[ki] |= b; blok[bi] |= b;
  }
  let teller = 0;
  const zoek = () => {
    let beste = -1, besteM = 0, besteAantal = 99;
    for (let i = 0; i < n * n; i++) {
      if (g[i]) continue;
      const m = st.vol & ~(rij[Math.floor(i / n)] | kol[i % n] | blok[st.blokVan(i)]);
      const a = bitAantal(m);
      if (a === 0) return;
      if (a < besteAantal) { beste = i; besteM = m; besteAantal = a; if (a === 1) break; }
    }
    if (beste < 0) {
      if (teller === 0 && uit) for (let i = 0; i < n * n; i++) uit[i] = g[i];
      teller++;
      return;
    }
    const kandidaten = [];
    for (let m = besteM; m; m &= m - 1) kandidaten.push(laagsteBit(m));
    if (r) schud(kandidaten, r);
    const ri = Math.floor(beste / n), ki = beste % n, bi = st.blokVan(beste);
    for (const d of kandidaten) {
      const b = 1 << d;
      g[beste] = d + 1; rij[ri] |= b; kol[ki] |= b; blok[bi] |= b;
      zoek();
      g[beste] = 0; rij[ri] &= ~b; kol[ki] &= ~b; blok[bi] &= ~b;
      if (teller >= limiet) return;
    }
  };
  zoek();
  return teller;
}

/** Lost een puzzel op zoals een mens dat doet, met alleen de stappen tot `tier`. */
function logischOplosbaar(raster, s, tier) {
  const { n } = s;
  const st = structuur(s);
  const g = raster.slice();
  const kand = new Array(n * n).fill(0);
  for (let i = 0; i < n * n; i++) {
    if (g[i]) continue;
    let m = st.vol;
    for (const j of st.buren[i]) if (g[j]) m &= ~(1 << (g[j] - 1));
    kand[i] = m;
  }
  let open = g.filter((v) => !v).length;
  const zet = (i, d) => {
    g[i] = d + 1; kand[i] = 0; open--;
    for (const j of st.buren[i]) kand[j] &= ~(1 << d);
  };
  for (;;) {
    if (!open) return true;
    let voortgang = false;
    // verborgen enkeling: in een rij, kolom of blok kan een cijfer nog maar op één plek
    for (const e of st.eenheden) {
      for (let d = 0; d < n; d++) {
        const b = 1 << d;
        let plek = -1, aantal = 0, staat = false;
        for (const i of e) {
          if (g[i] === d + 1) { staat = true; break; }
          if (kand[i] & b) { plek = i; aantal++; }
        }
        if (staat) continue;
        if (aantal === 0) return false;
        if (aantal === 1) { zet(plek, d); voortgang = true; }
      }
    }
    if (tier >= 2) {
      // naakte enkeling: in deze cel past nog maar één cijfer
      for (let i = 0; i < n * n; i++) {
        if (g[i]) continue;
        if (!kand[i]) return false;
        if (bitAantal(kand[i]) === 1) { zet(i, laagsteBit(kand[i])); voortgang = true; }
      }
    }
    if (!voortgang && tier >= 3) voortgang = vergrendeld(st, g, kand, n) || naaktePaar(st, g, kand);
    if (!voortgang) return false;
  }
}

/** Vergrendelde kandidaten: staat een cijfer in een blok alleen op één rij (of kolom), dan niet elders op die rij. */
function vergrendeld(st, g, kand, n) {
  let iets = false;
  const blokken = st.eenheden.slice(2 * n);
  const lijnen = st.eenheden.slice(0, 2 * n);
  for (const blok of blokken) {
    for (const lijn of lijnen) {
      const samen = blok.filter((i) => lijn.includes(i));
      if (samen.length < 2) continue;
      for (let d = 0; d < n; d++) {
        const b = 1 << d;
        const inSamen = samen.some((i) => kand[i] & b);
        if (!inSamen) continue;
        const restBlok = blok.some((i) => !samen.includes(i) && (kand[i] & b));
        const restLijn = lijn.some((i) => !samen.includes(i) && (kand[i] & b));
        if (!restBlok && restLijn) {
          lijn.forEach((i) => { if (!samen.includes(i) && (kand[i] & b)) { kand[i] &= ~b; iets = true; } });
        } else if (!restLijn && restBlok) {
          blok.forEach((i) => { if (!samen.includes(i) && (kand[i] & b)) { kand[i] &= ~b; iets = true; } });
        }
      }
    }
  }
  return iets;
}

/** Naakt paar: twee cellen in een eenheid met dezelfde twee kandidaten. */
function naaktePaar(st, g, kand) {
  let iets = false;
  for (const e of st.eenheden) {
    const twee = e.filter((i) => !g[i] && bitAantal(kand[i]) === 2);
    for (let a = 0; a < twee.length; a++) {
      for (let b = a + 1; b < twee.length; b++) {
        if (kand[twee[a]] !== kand[twee[b]]) continue;
        const m = kand[twee[a]];
        for (const i of e) {
          if (i !== twee[a] && i !== twee[b] && !g[i] && (kand[i] & m)) { kand[i] &= ~m; iets = true; }
        }
      }
    }
  }
  return iets;
}

/** Maakt één puzzel: { puzzel, oplossing, gegeven, gelukt }. Zelfde zaadje, zelfde puzzel. */
function maakPuzzel(s, niveauId, zaad) {
  const niv = NIVEAUS[niveauId];
  const totaal = s.n * s.n;
  const min = niv.min[s.n];
  const pogingen = 40;
  const nietTier = s.n === 9 ? niv.nietTier : 0;
  let reserve = null;
  for (let poging = 0; poging < pogingen; poging++) {
    const r = toeval(mengZaad(zaad, poging));
    const oplossing = new Array(totaal).fill(0);
    telOplossingen(new Array(totaal).fill(0), s, 1, oplossing, r);
    const p = oplossing.slice();
    let gegeven = totaal;
    for (const i of schud([...Array(totaal).keys()], r)) {
      if (gegeven <= min) break;
      if (!p[i]) continue;
      const j = totaal - 1 - i;
      const weg = j !== i && p[j] ? [i, j] : [i];
      if (gegeven - weg.length < min) continue;
      const oud = weg.map((k) => p[k]);
      weg.forEach((k) => { p[k] = 0; });
      const goed = niv.tier >= 9 ? telOplossingen(p, s, 2) === 1 : logischOplosbaar(p, s, niv.tier);
      if (goed) gegeven -= weg.length;
      else weg.forEach((k, x) => { p[k] = oud[x]; });
    }
    const uitkomst = { puzzel: p, oplossing, gegeven, gelukt: true };
    if (!nietTier || !logischOplosbaar(p, s, nietTier)) return uitkomst;
    if (!reserve || gegeven < reserve.gegeven) reserve = { ...uitkomst, gelukt: false };
  }
  return reserve;
}

// ---- de indeling op het vel (mm) ---------------------------------------------

const MAX_PUZZELS = 12;
const TUSSEN = 12;
const LABEL = 7;

function indeling(w, doc) {
  const tb = doc.tekengebied.b / PT;
  const th = doc.tekengebied.h / PT;
  const binnenB = tb - 2 * w.marge;
  let binnenH = th - 2 * w.marge;
  const titelH = w.titel ? 16 : 0;
  binnenH -= titelH;
  // strook met kleine oplossingen onderaan
  let strook = null;
  if (w.oplossing === 'onderaan') {
    const sk = begrens((binnenB - (w.aantal - 1) * 5) / w.aantal, 22, 34);
    const perRij = Math.max(1, Math.floor((binnenB + 5) / (sk + 5)));
    const rijen = Math.ceil(w.aantal / perRij);
    const hoogte = rijen * (sk + 6) + (rijen - 1) * 3 + 6;
    strook = { sk, perRij, rijen, hoogte };
    binnenH -= hoogte + 6;
  }
  const labelH = w.labels ? LABEL : 0;
  let beste = null;
  for (let k = 1; k <= w.aantal; k++) {
    const r = Math.ceil(w.aantal / k);
    const zijde = Math.min((binnenB - (k - 1) * TUSSEN) / k, (binnenH - (r - 1) * TUSSEN) / r - labelH, 170);
    if (!beste || zijde > beste.zijde + 0.01) beste = { k, r, zijde };
  }
  const { k, r, zijde } = beste;
  const totB = k * zijde + (k - 1) * TUSSEN;
  const totH = r * (zijde + labelH) + (r - 1) * TUSSEN;
  const x0 = w.marge + (binnenB - totB) / 2;
  // titel en raster(s) samen in het midden van wat er over is
  const y0 = w.marge + titelH + Math.max(0, (binnenH - totH) / 2);
  const titelY = y0 - titelH + 9;
  const plekken = [];
  for (let i = 0; i < w.aantal; i++) {
    const rij = Math.floor(i / k);
    // een onvolle laatste rij komt in het midden
    const inRij = rij === r - 1 ? w.aantal - rij * k : k;
    const dx = (k - inRij) * (zijde + TUSSEN) / 2;
    plekken.push({ x: x0 + dx + (i % k) * (zijde + TUSSEN), y: y0 + rij * (zijde + labelH + TUSSEN) + labelH });
  }
  let strookPlekken = [];
  if (strook) {
    const yS = th - w.marge - strook.hoogte;
    strook.y = yS;
    strookPlekken = [...Array(w.aantal).keys()].map((i) => {
      const rij = Math.floor(i / strook.perRij);
      const inRij = Math.min(strook.perRij, w.aantal - rij * strook.perRij);
      const breed = inRij * strook.sk + (inRij - 1) * 5;
      return { x: w.marge + (binnenB - breed) / 2 + (i % strook.perRij) * (strook.sk + 5), y: yS + 10 + rij * (strook.sk + 9) };
    });
  }
  const fout = zijde < (w.grootte === 9 ? 45 : 30)
    ? `Er is te weinig ruimte: elk raster wordt maar ${mmTekst(zijde)} mm. Kies minder puzzels of een kleinere marge.`
    : null;
  return { tb, th, zijde, plekken, strook, strookPlekken, titelH, titelY, fout, k, r };
}

// ---- de vormen ------------------------------------------------------------------

function rasterVormen(s, x, y, zijde, dik, dun, kleur, naam) {
  const { n, bh, bb } = s;
  const c = zijde / n;
  const dunne = [];
  const dikke = [];
  for (let i = 1; i < n; i++) {
    (i % bb === 0 ? dikke : dunne).push(lijnStuk(x + i * c, y, x + i * c, y + zijde));
    (i % bh === 0 ? dikke : dunne).push(lijnStuk(x, y + i * c, x + zijde, y + i * c));
  }
  return {
    soort: 'groep', naam,
    kinderen: [
      { soort: 'pad', naam: 'Dunne lijnen', subpaden: dunne, vulling: null, lijn: kleur, lijndikte: dun, lijneinde: 'butt' },
      { soort: 'pad', naam: 'Dikke lijnen', subpaden: dikke, vulling: null, lijn: kleur, lijndikte: dik, lijneinde: 'butt' },
      { soort: 'rechthoek', naam: 'Rand', x, y, b: zijde, h: zijde, vulling: null, lijn: kleur, lijndikte: dik * 1.3, lijnhoek: 'miter' },
    ],
  };
}

function cijferVormen(s, waarden, filter, x, y, zijde, kleur, gewicht) {
  const c = zijde / s.n;
  const grootte = rond(c * 0.6);
  const uit = [];
  waarden.forEach((v, i) => {
    if (!v || !filter(i)) return;
    const cx = x + (i % s.n + 0.5) * c;
    const cy = y + (Math.floor(i / s.n) + 0.5) * c;
    uit.push({ soort: 'tekst', naam: String(v), x: rond(cx), y: rond(cy + grootte * 0.36), inhoud: String(v), grootte, gewicht, uitlijning: 'midden', vulling: kleur });
  });
  return uit;
}

function bouwVormen(w, puzzels, lay, cmyk) {
  const s = SOORTEN[w.grootte];
  const niv = NIVEAUS[w.niveau];
  const zwart = kleurIn([0, 0, 0, 100], '#1a1a1a', cmyk);
  const grijs = kleurIn([0, 0, 0, 55], '#7a7a7a', cmyk);
  const blauw = kleurIn([100, 45, 0, 10], '#0a6fc2', cmyk);
  const zijde = lay.zijde * PT;
  const dik = s.n === 9 ? 1.6 : 1.8;
  const groepen = [];
  const oplossingen = [];
  puzzels.forEach((pz, i) => {
    const x = lay.plekken[i].x * PT;
    const y = lay.plekken[i].y * PT;
    const kinderen = [];
    if (w.labels) {
      kinderen.push({ soort: 'tekst', naam: 'Kop', x, y: y - 2.2 * PT, inhoud: `Sudoku ${i + 1} · ${niv.naam.toLowerCase()}`, grootte: 9, gewicht: 600, vulling: zwart });
      kinderen.push({ soort: 'tekst', naam: 'Code', x: x + zijde, y: y - 2.2 * PT, inhoud: `#${w.zaad}-${i + 1}`, grootte: 7, uitlijning: 'rechts', vulling: grijs });
    }
    kinderen.push(rasterVormen(s, x, y, zijde, dik, 0.5, zwart, 'Raster'));
    kinderen.push({ soort: 'groep', naam: `Gegeven cijfers (${pz.gegeven})`, kinderen: cijferVormen(s, pz.puzzel, () => true, x, y, zijde, zwart, 500) });
    groepen.push({ soort: 'groep', naam: `Sudoku ${i + 1} · ${niv.naam.toLowerCase()}`, kinderen });
    if (w.oplossing === 'verborgen') {
      oplossingen.push({ soort: 'groep', naam: `Oplossing ${i + 1}`, kinderen: cijferVormen(s, pz.oplossing, (j) => !pz.puzzel[j], x, y, zijde, blauw, 400) });
    }
  });
  const uit = [];
  if (w.titel) {
    uit.push({ soort: 'tekst', naam: 'Titel', x: lay.tb * PT / 2, y: lay.titelY * PT, inhoud: w.titel, grootte: 22, gewicht: 700, uitlijning: 'midden', letterafstand: 20, vulling: zwart });
  }
  uit.push({ soort: 'groep', naam: `Sudoku's · ${s.naam} · ${niv.naam.toLowerCase()}`, kinderen: groepen });
  if (w.oplossing === 'verborgen') {
    uit.push({ soort: 'groep', naam: 'Oplossingen (verborgen)', zichtbaar: false, kinderen: oplossingen });
  } else if (w.oplossing === 'onderaan') {
    const sk = lay.strook.sk * PT;
    const kinderen = [{ soort: 'tekst', naam: 'Kop', x: w.marge * PT, y: (lay.strook.y + 4) * PT, inhoud: 'Oplossingen', grootte: 8, gewicht: 600, vulling: grijs }];
    const yl = (lay.strook.y - 2) * PT;
    const lijn = { soort: 'pad', naam: 'Scheidingslijn', subpaden: [lijnStuk(w.marge * PT, yl, (lay.tb - w.marge) * PT, yl)],
      vulling: null, lijn: grijs, lijndikte: 0.4, streep: [2, 2] };
    kinderen.push(lijn);
    puzzels.forEach((pz, i) => {
      const x = lay.strookPlekken[i].x * PT;
      const y = lay.strookPlekken[i].y * PT;
      kinderen.push({ soort: 'groep', naam: `Oplossing ${i + 1}`, kinderen: [
        { soort: 'tekst', naam: 'Nummer', x, y: y - 1.5 * PT, inhoud: String(i + 1), grootte: 6, gewicht: 600, vulling: grijs },
        rasterVormen(s, x, y, sk, 0.7, 0.25, grijs, 'Raster'),
        { soort: 'groep', naam: 'Cijfers', kinderen: cijferVormen(s, pz.oplossing, () => true, x, y, sk, zwart, 400) },
      ] });
    });
    uit.push({ soort: 'groep', naam: 'Oplossingen', kinderen });
  } else {
    // op een apart vlak, rechts naast het tekengebied, in dezelfde indeling
    const dx = (lay.tb + 20) * PT;
    const kinderen = [{ soort: 'rechthoek', naam: 'Vlak (hulplijn)', x: dx, y: 0, b: lay.tb * PT, h: lay.th * PT, vulling: null, lijn: grijs, lijndikte: 0.5, streep: [4, 3] }];
    if (w.titel) {
      kinderen.push({ soort: 'tekst', naam: 'Titel', x: dx + lay.tb * PT / 2, y: lay.titelY * PT, inhoud: `${w.titel}: oplossingen`,
        grootte: 22, gewicht: 700, uitlijning: 'midden', letterafstand: 20, vulling: zwart });
    }
    puzzels.forEach((pz, i) => {
      const x = dx + lay.plekken[i].x * PT;
      const y = lay.plekken[i].y * PT;
      const z = zijde;
      kinderen.push({ soort: 'groep', naam: `Oplossing ${i + 1}`, kinderen: [
        { soort: 'tekst', naam: 'Kop', x, y: y - 2.2 * PT, inhoud: `Oplossing ${i + 1}`, grootte: 9, gewicht: 600, vulling: zwart },
        rasterVormen(s, x, y, z, dik, 0.5, zwart, 'Raster'),
        { soort: 'groep', naam: 'Gegeven', kinderen: cijferVormen(s, pz.oplossing, (j) => Boolean(pz.puzzel[j]), x, y, z, zwart, 500) },
        { soort: 'groep', naam: 'Ingevuld', kinderen: cijferVormen(s, pz.oplossing, (j) => !pz.puzzel[j], x, y, z, blauw, 400) },
      ] });
    });
    uit.push({ soort: 'groep', naam: 'Oplossingen (apart vlak)', kinderen });
  }
  return uit;
}

// ---- het venster ----------------------------------------------------------------

const STANDAARD = { grootte: 9, niveau: 'gemiddeld', aantal: 4, zaad: 2026, oplossing: 'verborgen', titel: 'Sudoku', labels: true, marge: 15 };

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const v = {
    grootte: keuze({ 9: '9 × 9 (klassiek)', 6: '6 × 6 (voor kinderen)' }, String(w0.grootte)),
    niveau: keuze(Object.fromEntries(Object.entries(NIVEAUS).map(([k, n]) => [k, n.naam])), w0.niveau),
    aantal: getalVeld(w0.aantal, 1, MAX_PUZZELS, 1),
    zaad: getalVeld(w0.zaad, 1, 999999, 1),
    oplossing: keuze({
      verborgen: 'Verborgen in het raster (laag aanzetten)',
      onderaan: 'Klein onderaan het vel',
      naast: 'Op een apart vlak naast het vel',
    }, w0.oplossing),
    titel: tekstVeld(w0.titel, 'Geen titel', 60),
    marge: getalVeld(w0.marge, 0, 60, 1),
  };
  const labels = vinkje('Nummer en niveau boven elk raster', w0.labels);
  const nieuw = el('button', { klasse: 'knop', type: 'button', tekst: 'Andere', title: 'Kies een nieuw zaadje: andere puzzels' });
  nieuw.style.padding = '0 10px';

  const voorbeeld = el('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '260px' } });
  const samenvatting = el('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '34px' } });
  const maakKnop = el('button', { klasse: 'knop primair', type: 'submit', tekst: 'Sudoku’s maken' });
  const annuleer = el('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  v.zaad.style.minWidth = '0';
  v.zaad.style.flex = '1';
  const zaadVak = vak('Zaadje', el('div', { stijl: { display: 'flex', gap: '6px' } }, v.zaad, nieuw));

  const formulier = el('form', { stijl: { display: 'grid', gap: '9px' } },
    kolom(2, vak('Raster', v.grootte), vak('Moeilijkheid', v.niveau)),
    kolom('0.8fr 1.5fr 0.8fr', vak('Aantal puzzels', v.aantal), zaadVak, vak('Marge', v.marge, 'mm')),
    kolom('1fr 1.6fr', vak('Titel', v.titel), vak('Oplossing', v.oplossing)),
    labels.label,
    el('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    el('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    grootte: Number(v.grootte.value),
    niveau: v.niveau.value,
    aantal: Math.round(begrens(leesGetal(v.aantal, 1), 1, MAX_PUZZELS)),
    zaad: Math.round(begrens(leesGetal(v.zaad, 1), 1, 999999)),
    oplossing: v.oplossing.value,
    titel: v.titel.value.trim().slice(0, 60),
    labels: labels.invoer.checked,
    marge: begrens(leesGetal(v.marge, 15), 0, 60),
  });

  // puzzels worden op de achtergrond gemaakt, één per beurt, en bewaard
  const voorraad = new Map();
  const sleutel = (w, i) => `${w.grootte}|${w.niveau}|${w.zaad}|${i}`;
  const puzzelVan = (w, i) => {
    const k = sleutel(w, i);
    if (!voorraad.has(k)) voorraad.set(k, maakPuzzel(SOORTEN[w.grootte], w.niveau, mengZaad('sudoku', w.grootte, w.niveau, w.zaad, i)));
    return voorraad.get(k);
  };
  let beurt = 0;

  function tekenVoorbeeld(w, lay, puzzels) {
    const { g, b, h } = canvasKlaar(voorbeeld);
    const naast = w.oplossing === 'naast';
    const breed = naast ? lay.tb * 2 + 20 : lay.tb;
    const s = Math.min((b - 12) / breed, (h - 12) / lay.th);
    const ox = (b - breed * s) / 2;
    const oy = (h - lay.th * s) / 2;
    const vlak = (dx) => {
      g.fillStyle = '#ffffff';
      g.fillRect(ox + dx * s, oy, lay.tb * s, lay.th * s);
    };
    vlak(0);
    if (naast) vlak(lay.tb + 20);
    const sn = SOORTEN[w.grootte];
    const raster = (x, y, z, waarden, filter, kleur) => {
      const c = z / sn.n;
      g.strokeStyle = '#222';
      for (let i = 0; i <= sn.n; i++) {
        g.lineWidth = i % sn.bb === 0 ? 1.1 : 0.4;
        g.beginPath(); g.moveTo(x + i * c, y); g.lineTo(x + i * c, y + z); g.stroke();
        g.lineWidth = i % sn.bh === 0 ? 1.1 : 0.4;
        g.beginPath(); g.moveTo(x, y + i * c); g.lineTo(x + z, y + i * c); g.stroke();
      }
      if (!waarden || c < 5) return;
      g.font = `${Math.max(4, c * 0.62)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      waarden.forEach((d, i) => {
        if (!d || !filter(i)) return;
        g.fillStyle = typeof kleur === 'function' ? kleur(i) : kleur;
        g.fillText(String(d), x + (i % sn.n + 0.5) * c, y + (Math.floor(i / sn.n) + 0.55) * c);
      });
    };
    if (w.titel) {
      g.fillStyle = '#222';
      g.font = `600 ${Math.max(6, 8 * s * 1.2)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(w.titel, ox + lay.tb * s / 2, oy + lay.titelY * s);
      if (naast) g.fillText(`${w.titel}: oplossingen`, ox + (lay.tb * 1.5 + 20) * s, oy + lay.titelY * s);
    }
    lay.plekken.forEach((p, i) => {
      const pz = puzzels[i];
      raster(ox + p.x * s, oy + p.y * s, lay.zijde * s, pz && pz.puzzel, () => true, '#222');
      if (naast) raster(ox + (p.x + lay.tb + 20) * s, oy + p.y * s, lay.zijde * s, pz && pz.oplossing, () => true, (j) => (pz.puzzel[j] ? '#222' : '#0a6fc2'));
      if (!pz) {
        g.fillStyle = 'rgba(90, 162, 255, 0.18)';
        g.fillRect(ox + p.x * s, oy + p.y * s, lay.zijde * s, lay.zijde * s);
      }
    });
    if (lay.strook) {
      lay.strookPlekken.forEach((p, i) => raster(ox + p.x * s, oy + p.y * s, lay.strook.sk * s, puzzels[i] && puzzels[i].oplossing, () => true, '#555'));
    }
  }

  function vernieuw() {
    const w = waarden();
    const lay = indeling(w, doc);
    const mijnBeurt = ++beurt;
    const puzzels = [];
    let tekst;
    const klaar = () => {
      const niv = NIVEAUS[w.niveau];
      const gegeven = puzzels.map((p) => p.gegeven);
      const vanTot = Math.min(...gegeven) === Math.max(...gegeven) ? `${gegeven[0]}` : `${Math.min(...gegeven)}–${Math.max(...gegeven)}`;
      tekst = `${w.aantal} ${w.aantal === 1 ? 'puzzel' : 'puzzels'} van ${mmTekst(lay.zijde)} × ${mmTekst(lay.zijde)} mm · ${SOORTEN[w.grootte].naam} · `
        + `${niv.naam.toLowerCase()} · ${vanTot} cijfers gegeven. Elke puzzel heeft precies één oplossing.`;
      if (puzzels.some((p) => !p.gelukt)) tekst += ' Niet elke puzzel haalt dit niveau helemaal; probeer een ander zaadje.';
      if (w.oplossing === 'naast') tekst += ' De oplossingen komen rechts naast het tekengebied.';
      toon(tekst, false);
      maakKnop.disabled = doc.alleenLezen;
    };
    const toon = (t, fout) => {
      if (doc.alleenLezen) { t = 'Dit document is alleen-lezen; je kunt hier geen sudoku’s maken.'; fout = true; }
      samenvatting.textContent = t;
      samenvatting.classList.toggle('fout', fout);
    };
    if (lay.fout) {
      tekenVoorbeeld(w, lay, []);
      toon(lay.fout, true);
      maakKnop.disabled = true;
      return;
    }
    toon(`Bezig met ${w.aantal === 1 ? 'de puzzel' : `${w.aantal} puzzels`}…`, false);
    maakKnop.disabled = true;
    const stap = () => {
      if (mijnBeurt !== beurt) return;
      puzzels.push(puzzelVan(w, puzzels.length));
      tekenVoorbeeld(w, lay, puzzels);
      if (puzzels.length < w.aantal) setTimeout(stap, 0);
      else klaar();
    };
    setTimeout(stap, 0);
  }

  let wacht = 0;
  formulier.addEventListener('input', () => { clearTimeout(wacht); wacht = setTimeout(vernieuw, 150); });
  nieuw.addEventListener('click', () => {
    v.zaad.value = String(1 + Math.floor(Math.random() * 999998));
    vernieuw();
  });
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const w = waarden();
    const lay = indeling(w, doc);
    if (lay.fout) return vexel.melding(lay.fout, 'let');
    maakKnop.disabled = true;
    try {
      const puzzels = [...Array(w.aantal).keys()].map((i) => puzzelVan(w, i));
      await vexel.maak(bouwVormen(w, puzzels, lay, cmyk));
      await vexel.bewaar('instellingen', w);
      const wat = `${w.aantal} ${w.aantal === 1 ? 'sudoku' : 'sudoku’s'} gemaakt`;
      const waar = { verborgen: 'de oplossingen staan verborgen in het lagenpaneel', onderaan: 'de oplossingen staan onderaan', naast: 'de oplossingen staan naast het tekengebied' }[w.oplossing];
      vexel.melding(`${wat}; ${waar}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De sudoku’s konden niet worden gemaakt.', 'fout');
    }
  });

  vernieuw();
  v.niveau.focus();
}

vexel.opCommando('maken', toonVenster);
