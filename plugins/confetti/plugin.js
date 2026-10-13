// Confetti: strooi rondjes, strookjes, driehoekjes, kronkels en sterretjes over het
// tekengebied, zonder dat ze elkaar raken (Poisson-schijven met verschillende maten).
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const MAX_STUKJES = 4000;
const MAX_PUNTEN = 48000;

const VORMEN = {
  cirkel: 'Rondjes',
  strook: 'Strookjes',
  driehoek: 'Driehoekjes',
  kronkel: 'Kronkels',
  ster: 'Sterretjes',
};

const PALETTEN = {
  feest: { naam: 'Feest', kleuren: ['#f94144', '#f8961e', '#f9c74f', '#43aa8b', '#577590'] },
  pastel: { naam: 'Pastel', kleuren: ['#f4a7b9', '#ffcf99', '#f6e27f', '#9fd8c4', '#a9bdf0'] },
  goud: { naam: 'Zwart en goud', kleuren: ['#141414', '#a8811f', '#d9b65a', '#ecd9a6', '#6e6e6e'] },
  roze: { naam: 'Roze', kleuren: ['#e83f7d', '#ff7aa8', '#ffb3cf', '#b45ae8', '#ffd166'] },
  zee: { naam: 'Zee', kleuren: ['#0b6e70', '#1aa3c8', '#7fd1f0', '#f2c14e', '#ef6f6c'] },
  eigen: { naam: 'Eigen kleuren', kleuren: null },
};

const STANDAARD = {
  vormen: { cirkel: true, strook: true, driehoek: true, kronkel: true, ster: true },
  palet: 'feest', eigen: ['#f94144', '#f8961e', '#f9c74f', '#43aa8b', '#577590'], aantalKleuren: 5,
  van: 3, tot: 8, dichtheid: 55, draaiing: 180,
  plaatsing: 'overal', rand: 35, vrij: 60,
  gebied: 'afloop', afloop: 3, zaad: 1,
};

// ---- willekeur met zaadje -----------------------------------------------------

function willekeur(zaad) {
  let s = (Math.imul((zaad | 0) ^ 0x2545f491, 0x9e3779b1) >>> 0) || 1;
  const volgende = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 8; i++) volgende();
  return volgende;
}

// ---- kleur --------------------------------------------------------------------

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const hexNaarRgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbNaarHex = (rgb) => '#' + rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function rgbNaarCmyk([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 0.999) return [0, 0, 0, 100];
  return [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k].map((n) => Math.round(n * 100));
}
function cmykNaarRgb([c, m, y, k]) {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z];
}
/** Een API-kleur naar CSS voor de voorvertoning. */
const kleurCss = (k) => (k.hex ? k.hex : rgbNaarHex(cmykNaarRgb(k.cmyk)));
/** Een API-kleur passend bij het document. */
function kleurVoorDocument(k, cmyk) {
  if (cmyk) return k.cmyk ? { cmyk: k.cmyk.slice() } : { cmyk: rgbNaarCmyk(hexNaarRgb(k.hex)) };
  return k.hex ? { hex: k.hex } : { hex: rgbNaarHex(cmykNaarRgb(k.cmyk)) };
}
function kleurNaam(k) {
  if (!k.cmyk) return k.hex;
  const [c, m, y, z] = k.cmyk.map(Math.round);
  return `C${c} M${m} Y${y} K${z}`;
}

/** De kleuren uit de selectie (vulling en lijn), zonder dubbele. */
function kleurenUitSelectie(items) {
  const gezien = new Map();
  const voeg = (k) => {
    if (!k || (!k.cmyk && !k.hex)) return;
    const sleutel = k.cmyk ? 'c' + k.cmyk.map(Math.round).join(',') : 'h' + String(k.hex).toLowerCase();
    if (!gezien.has(sleutel)) gezien.set(sleutel, k.cmyk ? { cmyk: k.cmyk.map(Math.round) } : { hex: k.hex });
  };
  for (const v of items) {
    voeg(v.vulling);
    voeg(v.lijn);
  }
  return [...gezien.values()].slice(0, 12);
}

// ---- de stukjes ---------------------------------------------------------------

const SQRT3 = Math.sqrt(3);

/** Straal van de omschreven cirkel per soort, bij maat s (pt). */
function straalVan(soort, s, verhouding) {
  switch (soort) {
    case 'cirkel': return s / 2;
    case 'strook': return Math.hypot(s, s * verhouding) / 2;
    case 'driehoek': return s / SQRT3;
    case 'ster': return s / 2;
    default: return s * 0.95 + s * 0.08; // kronkel: halve lengte plus de halve lijndikte
  }
}

const smooth = (a, b, x) => {
  const t = begrens((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Kans (0 tot 1) dat er op (x, y) een stukje mag liggen. */
function maakZone(w, T) {
  if (w.plaatsing === 'randen') {
    const B = Math.max(1, vexel.mm(w.rand));
    return (x, y) => {
      const d = Math.min(x - T.x, T.x + T.b - x, y - T.y, T.y + T.h - y);
      return 1 - smooth(B * 0.55, B * 1.25, d);
    };
  }
  if (w.plaatsing === 'midden') {
    const fw = (T.b * w.vrij) / 100 / 2;
    const fh = (T.h * w.vrij) / 100 / 2;
    const cx = T.x + T.b / 2;
    const cy = T.y + T.h / 2;
    return (x, y) => {
      const u = (x - cx) / fw;
      const v = (y - cy) / fh;
      return smooth(0.92, 1.22, Math.pow(u ** 4 + v ** 4, 0.25));
    };
  }
  return () => 1;
}

/**
 * Strooit stukjes in gebied A. Elk stukje krijgt een plek, een maat, een soort,
 * een draaiing en een kleur. Twee stukjes liggen minstens hun stralen plus een
 * tussenruimte uit elkaar, dus ze raken elkaar nooit.
 */
function strooi(w, A, T, aantalKleuren) {
  const soorten = Object.keys(VORMEN).filter((s) => w.vormen[s]);
  if (!soorten.length) return { fout: 'Kies minstens één soort stukje.' };
  if (!aantalKleuren) return { fout: 'Er zijn geen kleuren om mee te strooien.' };
  const van = vexel.mm(Math.min(w.van, w.tot));
  const tot = vexel.mm(Math.max(w.van, w.tot));
  const rnd = willekeur(w.zaad);
  const zone = maakZone(w, T);
  const rMax = Math.max(...soorten.map((s) => straalVan(s, tot, 0.6)));
  const rGem = soorten.reduce((n, s) => n + straalVan(s, (van + tot) / 2, 0.45), 0) / soorten.length;
  const tussen = rGem * (0.25 + ((100 - w.dichtheid) / 100) * 3.2);

  // schatting vooraf, zodat een te dichte instelling niet eerst alles uitrekent
  const schatting = (A.b * A.h) / (Math.PI * (rGem + tussen / 2) ** 2) * 0.75;
  if (schatting > MAX_STUKJES * 3) {
    return { fout: `Dat worden veel te veel stukjes (ruim ${Math.round(schatting / 1000) * 1000}). Maak ze groter of zet de dichtheid lager.` };
  }

  const cel = rMax + tussen / 2;
  const gb = Math.max(1, Math.ceil(A.b / cel));
  const gh = Math.max(1, Math.ceil(A.h / cel));
  const rooster = Array.from({ length: gb * gh }, () => []);
  const stukjes = [];
  const vak = (x, y) => [begrens(Math.floor((x - A.x) / cel), 0, gb - 1), begrens(Math.floor((y - A.y) / cel), 0, gh - 1)];
  const reik = Math.ceil((2 * rMax + tussen) / cel);
  const vrij = (x, y, r) => {
    const [gi, gj] = vak(x, y);
    for (let j = Math.max(0, gj - reik); j <= Math.min(gh - 1, gj + reik); j++) {
      for (let i = Math.max(0, gi - reik); i <= Math.min(gb - 1, gi + reik); i++) {
        for (const k of rooster[j * gb + i]) {
          const o = stukjes[k];
          const min = r + o.r + tussen;
          if ((o.x - x) ** 2 + (o.y - y) ** 2 < min * min) return false;
        }
      }
    }
    return true;
  };
  const nieuwStukje = () => {
    const soort = soorten[Math.floor(rnd() * soorten.length)];
    const s = van + (tot - van) * Math.pow(rnd(), 1.4);
    const verhouding = 0.32 + rnd() * 0.26;
    return { soort, s, verhouding, r: straalVan(soort, s, verhouding) };
  };
  const binnen = (x, y) => x >= A.x && x <= A.x + A.b && y >= A.y && y <= A.y + A.h;
  const zet = (st, x, y) => {
    Object.assign(st, {
      x, y,
      hoek: (rnd() * 2 - 1) * w.draaiing,
      kleur: Math.floor(rnd() * aantalKleuren),
      golf: rnd() < 0.5 ? 1 : -1,
    });
    const [i, j] = vak(x, y);
    rooster[j * gb + i].push(stukjes.length);
    stukjes.push(st);
  };

  // zaadjes: losse plekken verspreid over het gebied
  const actief = [];
  for (let poging = 0; poging < 400 && actief.length < 40; poging++) {
    const x = A.x + rnd() * A.b;
    const y = A.y + rnd() * A.h;
    const st = nieuwStukje();
    if (rnd() > zone(x, y) || !vrij(x, y, st.r)) continue;
    actief.push(stukjes.length);
    zet(st, x, y);
  }
  // en dan groeien: nieuwe stukjes net buiten een bestaand stukje
  while (actief.length) {
    if (stukjes.length > MAX_STUKJES) {
      return { fout: `Dat worden meer dan ${MAX_STUKJES.toLocaleString('nl-NL')} stukjes. Maak ze groter of zet de dichtheid lager.` };
    }
    const plek = Math.floor(rnd() * actief.length);
    const o = stukjes[actief[plek]];
    let gevonden = false;
    for (let poging = 0; poging < 20; poging++) {
      const st = nieuwStukje();
      const min = o.r + st.r + tussen;
      const hoek = rnd() * Math.PI * 2;
      const afstand = min * (1 + rnd() * 0.6);
      const x = o.x + Math.cos(hoek) * afstand;
      const y = o.y + Math.sin(hoek) * afstand;
      if (!binnen(x, y) || rnd() > zone(x, y) || !vrij(x, y, st.r)) continue;
      actief.push(stukjes.length);
      zet(st, x, y);
      gevonden = true;
      break;
    }
    if (!gevonden) {
      actief[plek] = actief[actief.length - 1];
      actief.pop();
    }
  }
  if (!stukjes.length) return { fout: 'Er past niets in dit gebied. Maak de stukjes kleiner of het vrije midden kleiner.' };
  return { stukjes };
}

// ---- stukjes als vormen -------------------------------------------------------

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Zet het stukje om naar een vorm voor vexel.maak (zonder kleur). */
function alsVorm(st) {
  const hoek = (st.hoek * Math.PI) / 180;
  const c = Math.cos(hoek);
  const s = Math.sin(hoek);
  const p = (x, y) => ({ x: r3(st.x + x * c - y * s), y: r3(st.y + x * s + y * c) });
  const veelhoek = (punten) => ({ soort: 'pad', subpaden: [{ gesloten: true, punten: punten.map(([x, y]) => p(x, y)) }] });

  switch (st.soort) {
    case 'cirkel':
      return { soort: 'ellips', cx: r3(st.x), cy: r3(st.y), rx: r3(st.s / 2), ry: r3(st.s / 2) };
    case 'strook': {
      const b = st.s / 2;
      const h = (st.s * st.verhouding) / 2;
      return veelhoek([[-b, -h], [b, -h], [b, h], [-b, h]]);
    }
    case 'driehoek': {
      const r = st.s / SQRT3;
      return veelhoek([0, 1, 2].map((i) => [r * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 3), r * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 3)]));
    }
    case 'ster': {
      const punten = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? st.s * 0.21 : st.s / 2;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        punten.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return veelhoek(punten);
    }
    default: {
      // een kronkel: anderhalve golf, vloeiend met handvatten (Catmull-Rom)
      const L = st.s * 1.9;
      const a = st.s * 0.24 * st.golf;
      const basis = [];
      for (let k = 0; k <= 6; k++) basis.push([-L / 2 + (k * L) / 6, a * Math.sin((k * Math.PI) / 2)]);
      const punten = basis.map((q, k) => {
        const vorige = basis[Math.max(0, k - 1)];
        const volgende = basis[Math.min(6, k + 1)];
        const tx = (volgende[0] - vorige[0]) / 6;
        const ty = (volgende[1] - vorige[1]) / 6;
        const punt = p(q[0], q[1]);
        if (k > 0) punt.in = p(q[0] - tx, q[1] - ty);
        if (k < 6) punt.uit = p(q[0] + tx, q[1] + ty);
        return punt;
      });
      return { soort: 'pad', subpaden: [{ gesloten: false, punten }], lijndikte: r3(st.s * 0.17), lijneinde: 'round', lijnhoek: 'round' };
    }
  }
}

const puntenVan = (v) => (v.subpaden ? v.subpaden.reduce((n, sp) => n + sp.punten.length, 0) : 0);

/** Tekent een vorm (zoals voor vexel.maak) op een canvas. */
function tekenVorm(g, v, schaal, ox, oy) {
  const X = (x) => ox + x * schaal;
  const Y = (y) => oy + y * schaal;
  g.beginPath();
  if (v.soort === 'ellips') g.ellipse(X(v.cx), Y(v.cy), v.rx * schaal, v.ry * schaal, 0, 0, Math.PI * 2);
  else {
    for (const sp of v.subpaden) {
      const pts = sp.punten;
      g.moveTo(X(pts[0].x), Y(pts[0].y));
      const n = sp.gesloten ? pts.length : pts.length - 1;
      for (let i = 1; i <= n; i++) {
        const a = pts[i - 1];
        const b = pts[i % pts.length];
        const c1 = a.uit || a;
        const c2 = b.in || b;
        g.bezierCurveTo(X(c1.x), Y(c1.y), X(c2.x), Y(c2.y), X(b.x), Y(b.y));
      }
      if (sp.gesloten) g.closePath();
    }
  }
}

// ---- venster-hulpjes ----------------------------------------------------------

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
  return Number.isFinite(n) ? n : terugval;
};
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const getal = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });

const getalVeld = (waarde, min, max, stap) =>
  maak('input', { klasse: 'veld', type: 'number', min, max, step: stap, value: waarde, stijl: { width: '100%' } });

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld', stijl: { width: '100%' } },
    ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}

function metLabel(tekst, veld, eenheid) {
  const label = maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0' } });
  const eenheidEl = eenheid ? maak('span', { klasse: 'uitleg', tekst: eenheid, stijl: { flex: 'none' } }) : null;
  const blok = maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } }, label,
    eenheidEl ? maak('span', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld, eenheidEl) : veld);
  return Object.assign(blok, { labelEl: label, eenheidEl });
}

const kolommen = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '10px', alignItems: 'end' } },
    ...kinderen);

const kleurVeld = (hex, label) =>
  maak('input', {
    type: 'color', value: hex, 'aria-label': label,
    stijl: { width: '30px', height: '26px', padding: '0 2px', border: '1px solid var(--lijn)', borderRadius: '5px', background: 'var(--bg-2)' },
  });

function omhullende(items) {
  const x0 = Math.min(...items.map((v) => v.kader.x));
  const y0 = Math.min(...items.map((v) => v.kader.y));
  const x1 = Math.max(...items.map((v) => v.kader.x + v.kader.b));
  const y1 = Math.max(...items.map((v) => v.kader.y + v.kader.h));
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

// ---- het venster --------------------------------------------------------------

/** De afloop in pt per kant: die van het document als Vexel hem geeft, anders de ingevulde maat. */
function afloopVan(doc, mm) {
  const a = doc.afloop;
  const kant = (n) => (Number.isFinite(n) && n >= 0 ? n : null);
  if (a && [a.boven, a.rechts, a.onder, a.links].every((n) => kant(n) !== null)) {
    return { boven: a.boven, rechts: a.rechts, onder: a.onder, links: a.links, vanDocument: true };
  }
  const p = vexel.mm(mm);
  return { boven: p, rechts: p, onder: p, links: p, vanDocument: false };
}

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const opgeslagen = await vexel.haal('instellingen');
  const w0 = { ...STANDAARD, ...(opgeslagen || {}) };
  w0.vormen = { ...STANDAARD.vormen, ...(w0.vormen || {}) };
  let selectie = [];
  try {
    selectie = (await vexel.selectie()).filter((v) => v.kader);
  } catch (fout) {
    selectie = [];
  }
  const selectieKleuren = kleurenUitSelectie(selectie);
  const metKader = selectie.filter((v) => v.kader.b > 0 && v.kader.h > 0);

  const vinkjes = Object.entries(VORMEN).map(([sleutel, naam]) => {
    const vak = maak('input', { type: 'checkbox', value: sleutel });
    vak.checked = Boolean(w0.vormen[sleutel]);
    return { sleutel, vak, el: maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' } }, vak, naam) };
  });
  const paletOpties = Object.entries(PALETTEN).map(([k, p]) => [k, p.naam]);
  if (selectieKleuren.length) paletOpties.push(['selectie', `Uit de selectie (${selectieKleuren.length})`]);
  const palet = keuzeVeld(paletOpties, w0.palet === 'selectie' && !selectieKleuren.length ? 'feest' : w0.palet);
  const eigenVelden = [0, 1, 2, 3, 4].map((i) => kleurVeld(w0.eigen[i] || '#888888', `Kleur ${i + 1}`));
  const selectieStaal = maak('div', { stijl: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
    ...selectieKleuren.map((k) => maak('span', {
      title: kleurNaam(k),
      stijl: { width: '18px', height: '18px', borderRadius: '4px', background: kleurCss(k), border: '1px solid var(--lijn)' },
    })));
  const eigenRij = maak('div', { stijl: { display: 'flex', gap: '4px' } }, ...eigenVelden);

  const van = getalVeld(w0.van, 0.5, 100, 0.5);
  const tot = getalVeld(w0.tot, 0.5, 100, 0.5);
  const dichtheid = getalVeld(w0.dichtheid, 5, 100, 5);
  const draaiing = getalVeld(w0.draaiing, 0, 180, 5);
  const plaatsing = keuzeVeld([['overal', 'Overal'], ['randen', 'Langs de rand'], ['midden', 'Midden vrij']], w0.plaatsing);
  const zoneMaat = getalVeld(w0.plaatsing === 'midden' ? w0.vrij : w0.rand, 1, 400, 1);
  const zoneBlok = metLabel('Randbreedte', zoneMaat, 'mm');
  const gebiedOpties = [['afloop', 'Met afloop'], ['tekengebied', 'Tekengebied']];
  if (metKader.length) gebiedOpties.push(['selectie', 'Selectiekader']);
  const gebied = keuzeVeld(gebiedOpties, w0.gebied);
  const docAfloop = afloopVan(doc, w0.afloop);
  const afloop = getalVeld(w0.afloop, 0, 20, 0.5);
  if (docAfloop.vanDocument) {
    afloop.value = String(Math.round((Math.max(docAfloop.boven, docAfloop.rechts, docAfloop.onder, docAfloop.links) / vexel.mm(1)) * 10) / 10);
    afloop.title = 'De afloop van het document';
  }
  const achteraan = maak('input', { type: 'checkbox' });
  achteraan.checked = w0.achteraan !== false;
  const zaad = getalVeld(w0.zaad, 1, 99999, 1);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '150px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const variant = maak('button', { klasse: 'knop', type: 'button', tekst: 'Andere variant' });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Strooien' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', padding: '12px 14px 14px' } },
    doek,
    maak('div', { stijl: { display: 'grid', gap: '4px' } },
      maak('span', { klasse: 'label', tekst: 'Stukjes', stijl: { minWidth: '0' } }),
      maak('div', { stijl: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px' } }, ...vinkjes.map((v) => v.el))),
    kolommen('1fr 1fr', metLabel('Kleuren', palet),
      maak('div', { stijl: { display: 'grid', gap: '3px', alignSelf: 'end', minHeight: '26px', alignItems: 'center' } }, eigenRij, selectieStaal)),
    kolommen('1fr 1fr 1fr', metLabel('Grootte van', van, 'mm'), metLabel('tot', tot, 'mm'), metLabel('Dichtheid', dichtheid, '%')),
    kolommen('0.9fr 1.2fr 1fr', metLabel('Draaiing tot', draaiing, '°'), metLabel('Plaatsing', plaatsing), zoneBlok),
    kolommen('1.2fr 1fr 0.8fr', metLabel('Strooien over', gebied), metLabel('Afloop', afloop, 'mm'), metLabel('Variant', zaad)),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0', alignItems: 'center' } }, variant,
      maak('label', { klasse: 'uitleg', stijl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' } }, achteraan, 'Achteraan'),
      maak('span', { stijl: { flex: '1' } }), annuleer, maakKnop),
  );
  document.head.append(maak('style', { tekst: '.veld:disabled{opacity:.45}.knop{white-space:nowrap}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  let zoneSoort = plaatsing.value;
  const waarden = () => {
    const w = {
      vormen: Object.fromEntries(vinkjes.map((v) => [v.sleutel, v.vak.checked])),
      palet: palet.value,
      eigen: eigenVelden.map((k) => k.value),
      van: begrens(leesGetal(van, 3), 0.5, 100),
      tot: begrens(leesGetal(tot, 8), 0.5, 100),
      dichtheid: begrens(leesGetal(dichtheid, 55), 5, 100),
      draaiing: begrens(leesGetal(draaiing, 180), 0, 180),
      plaatsing: plaatsing.value,
      rand: w0.rand,
      vrij: w0.vrij,
      gebied: gebied.value,
      afloop: begrens(leesGetal(afloop, 3), 0, 20),
      zaad: Math.round(begrens(leesGetal(zaad, 1), 1, 99999)),
      achteraan: achteraan.checked,
    };
    if (w.plaatsing === 'randen') w.rand = begrens(leesGetal(zoneMaat, 35), 1, 400);
    if (w.plaatsing === 'midden') w.vrij = begrens(leesGetal(zoneMaat, 60), 5, 95);
    return w;
  };
  const kleurenVan = (w) => {
    if (w.palet === 'selectie') return selectieKleuren;
    const hex = w.palet === 'eigen' ? w.eigen : PALETTEN[w.palet].kleuren;
    return hex.map((h) => ({ hex: h }));
  };
  const gebiedVan = (w) => {
    if (w.gebied === 'selectie' && metKader.length) {
      const k = omhullende(metKader);
      return { A: k, T: k };
    }
    const T = { x: 0, y: 0, b: doc.tekengebied.b, h: doc.tekengebied.h };
    const a = w.gebied === 'afloop' ? afloopVan(doc, w.afloop) : { boven: 0, rechts: 0, onder: 0, links: 0 };
    return { A: { x: -a.links, y: -a.boven, b: T.b + a.links + a.rechts, h: T.h + a.boven + a.onder }, T };
  };

  let gepland = false;
  function teken() {
    gepland = false;
    if (plaatsing.value !== zoneSoort) {
      // het veld hoort bij een andere plaatsing: zet de bewaarde waarde terug
      zoneSoort = plaatsing.value;
      zoneMaat.value = String(zoneSoort === 'midden' ? w0.vrij : w0.rand);
    }
    const w = waarden();
    zoneBlok.labelEl.textContent = w.plaatsing === 'midden' ? 'Vrij midden' : 'Randbreedte';
    zoneBlok.eenheidEl.textContent = w.plaatsing === 'midden' ? '%' : 'mm';
    zoneMaat.disabled = w.plaatsing === 'overal';
    afloop.disabled = w.gebied !== 'afloop' || docAfloop.vanDocument;
    eigenRij.style.display = w.palet === 'selectie' ? 'none' : 'flex';
    selectieStaal.style.display = w.palet === 'selectie' ? 'flex' : 'none';
    if (w.palet !== 'eigen' && w.palet !== 'selectie') PALETTEN[w.palet].kleuren.forEach((h, i) => { eigenVelden[i].value = h; });

    const kleuren = kleurenVan(w);
    const { A, T } = gebiedVan(w);
    const uitkomst = strooi(w, A, T, kleuren.length);

    const schaal = devicePixelRatio || 1;
    const kader = doek.getBoundingClientRect();
    doek.width = Math.round(kader.width * schaal);
    doek.height = Math.round(kader.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const s = Math.min((kader.width - 16) / A.b, (kader.height - 16) / A.h);
    const ox = (kader.width - A.b * s) / 2 - A.x * s;
    const oy = (kader.height - A.h * s) / 2 - A.y * s;
    g.fillStyle = '#ffffff';
    g.fillRect(ox + T.x * s, oy + T.y * s, T.b * s, T.h * s);
    if (uitkomst.stukjes) {
      g.save();
      g.beginPath();
      g.rect(ox + A.x * s, oy + A.y * s, A.b * s, A.h * s);
      g.clip();
      for (const st of uitkomst.stukjes) {
        const v = alsVorm(st);
        tekenVorm(g, v, s, ox, oy);
        const k = kleurCss(kleuren[st.kleur]);
        if (st.soort === 'kronkel') {
          g.strokeStyle = k;
          g.lineWidth = Math.max(0.6, v.lijndikte * s);
          g.lineCap = 'round';
          g.stroke();
        } else {
          g.fillStyle = k;
          g.fill();
        }
      }
      g.restore();
    }
    g.setLineDash([3, 3]);
    g.strokeStyle = css('--tekst-zacht', '#b4b7bf');
    g.lineWidth = 1;
    g.strokeRect(ox + T.x * s + 0.5, oy + T.y * s + 0.5, T.b * s - 1, T.h * s - 1);
    g.setLineDash([]);

    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen; je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      const n = uitkomst.stukjes.length;
      samenvatting.textContent = `${n.toLocaleString('nl-NL')} ${n === 1 ? 'stukje' : 'stukjes'} van ${getal(Math.min(w.van, w.tot))} tot `
        + `${getal(Math.max(w.van, w.tot))} mm in ${kleuren.length} ${kleuren.length === 1 ? 'kleur' : 'kleuren'}, zonder overlap.`;
    }
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout));
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  eigenVelden.forEach((k) => k.addEventListener('input', () => { palet.value = 'eigen'; }));
  variant.addEventListener('click', () => {
    zaad.value = String(1 + Math.floor(Math.random() * 99999));
    plan();
  });
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const kleuren = kleurenVan(w);
    const { A, T } = gebiedVan(w);
    const r = strooi(w, A, T, kleuren.length);
    if (r.fout) return vexel.melding(r.fout, 'let');

    // per kleur een groep, zodat je een kleur in één keer kunt kiezen of aanpassen
    const groepen = kleuren.map(() => []);
    let punten = 0;
    for (const st of r.stukjes) {
      const v = alsVorm(st);
      const kleur = kleurVoorDocument(kleuren[st.kleur], cmyk);
      if (st.soort === 'kronkel') Object.assign(v, { vulling: null, lijn: kleur });
      else Object.assign(v, { vulling: kleur, lijn: null });
      punten += puntenVan(v);
      groepen[st.kleur].push(v);
    }
    if (punten > MAX_PUNTEN) return vexel.melding('Dat zijn te veel punten in één keer. Zet de dichtheid lager of maak de stukjes groter.', 'let');
    const kinderen = groepen
      .map((lijst, i) => ({ soort: 'groep', naam: `Kleur ${i + 1} (${kleurNaam(kleurVoorDocument(kleuren[i], cmyk))})`, kinderen: lijst }))
      .filter((gr) => gr.kinderen.length);

    maakKnop.disabled = true;
    try {
      await vexel.maak([{ soort: 'groep', naam: `Confetti, ${r.stukjes.length} stukjes`, kinderen }], w.achteraan ? { achteraan: true } : undefined);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Confetti gestrooid: ${r.stukjes.length} stukjes.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De confetti kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  vinkjes[0].vak.focus();
}

vexel.opCommando('strooien', toonVenster);
