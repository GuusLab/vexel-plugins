// Kalender: een maand- of jaarkalender voor een gekozen jaar, met weeknummers en Nederlandse feestdagen.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

// ---- datums (alles in UTC, zodat zomertijd nooit een dag overslaat) ----------- [datums]

const DAG = 86400000;

/** Weekdag met maandag = 0 … zondag = 6. */
const weekdag = (j, m, d) => (new Date(Date.UTC(j, m, d)).getUTCDay() + 6) % 7;
const dagenInMaand = (j, m) => new Date(Date.UTC(j, m + 1, 0)).getUTCDate();

/** ISO-weeknummer: week 1 is de week met de eerste donderdag van het jaar. */
function isoWeek(j, m, d) {
  const t = new Date(Date.UTC(j, m, d));
  t.setUTCDate(t.getUTCDate() - weekdag(j, m, d) + 3);
  const jaar = t.getUTCFullYear();
  const donderdagWeek1 = Date.UTC(jaar, 0, 4 - weekdag(jaar, 0, 4) + 3);
  return 1 + Math.round((t - donderdagWeek1) / (7 * DAG));
}

/** Eerste Paasdag (gregoriaans), als [maand (0-11), dag]. */
function pasen(j) {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const n = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * n + 114) / 31);
  const dag = ((h + l - 7 * n + 114) % 31) + 1;
  return [maand - 1, dag];
}

/** De Nederlandse feestdagen van een jaar: Map 'maand-dag' → naam. */
function feestdagen(j, taal) {
  const en = taal === 'en';
  const lijst = new Map();
  const zet = (t, nlNaam, enNaam) => {
    const d = new Date(t);
    lijst.set(`${d.getUTCMonth()}-${d.getUTCDate()}`, en ? enNaam : nlNaam);
  };
  const [pm, pd] = pasen(j);
  const rondPasen = (n) => Date.UTC(j, pm, pd + n);
  zet(Date.UTC(j, 0, 1), 'Nieuwjaarsdag', "New Year's Day");
  zet(rondPasen(-2), 'Goede Vrijdag', 'Good Friday');
  zet(rondPasen(0), 'Eerste Paasdag', 'Easter Sunday');
  zet(rondPasen(1), 'Tweede Paasdag', 'Easter Monday');
  if (j >= 2014) {
    // Koningsdag: 27 april, of de zaterdag ervoor als 27 april op zondag valt.
    zet(Date.UTC(j, 3, weekdag(j, 3, 27) === 6 ? 26 : 27), 'Koningsdag', "King's Day");
  } else if (j >= 1949) {
    // Koninginnedag: 30 april; op zondag een dag later (tot 1980) of eerder (vanaf 1980).
    const zondag = weekdag(j, 3, 30) === 6;
    zet(Date.UTC(j, 3, zondag ? (j >= 1980 ? 29 : 31) : 30), 'Koninginnedag', "Queen's Day");
  }
  if (j >= 1945) zet(Date.UTC(j, 4, 5), 'Bevrijdingsdag', 'Liberation Day');
  zet(rondPasen(39), 'Hemelvaartsdag', 'Ascension Day');
  zet(rondPasen(49), 'Eerste Pinksterdag', 'Whit Sunday');
  zet(rondPasen(50), 'Tweede Pinksterdag', 'Whit Monday');
  zet(Date.UTC(j, 11, 25), 'Eerste Kerstdag', 'Christmas Day');
  zet(Date.UTC(j, 11, 26), 'Tweede Kerstdag', 'Boxing Day');
  return lijst;
}
// ---- einde datums ----------------------------------------------------------- [/datums]

const TAAL = {
  nl: {
    maanden: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
    kort: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
    dagen: ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'],
    letters: ['M', 'D', 'W', 'D', 'V', 'Z', 'Z'],
    week: 'wk',
  },
  en: {
    maanden: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    kort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dagen: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    letters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    week: 'wk',
  },
};
const hoofdletter = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const ACCENTEN = {
  blauw: { naam: 'Blauw', cmyk: [100, 55, 0, 0], hex: '#1f5fa8' },
  rood: { naam: 'Rood', cmyk: [0, 90, 80, 0], hex: '#d9372b' },
  groen: { naam: 'Groen', cmyk: [75, 0, 80, 10], hex: '#2e8b4e' },
  oranje: { naam: 'Oranje', cmyk: [0, 60, 95, 0], hex: '#e8821e' },
  paars: { naam: 'Paars', cmyk: [60, 90, 0, 0], hex: '#6b3fa0' },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
};

const nu = new Date();
const STANDAARD = {
  soort: 'maand',
  // standaard de volgende maand (in december: januari van volgend jaar)
  jaar: nu.getMonth() === 11 ? nu.getFullYear() + 1 : nu.getFullYear(),
  maand: (nu.getMonth() + 1) % 12,
  taal: 'nl',
  accent: 'blauw',
  randen: 'raster',
  marge: 10,
  weeknummers: true,
  feestdagen: true,
  weekend: true,
  buurdagen: true,
  notities: false,
  notitieAfstand: 6,
  lijst: true,
};

// ---- hulpjes voor het venster ----------------------------------------------

function maak(tag, opties = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [sleutel, waarde] of Object.entries(opties)) {
    if (waarde === undefined || waarde === null || waarde === false) continue;
    if (sleutel === 'klasse') el.className = waarde;
    else if (sleutel === 'tekst') el.textContent = waarde;
    else if (sleutel === 'stijl') Object.assign(el.style, waarde);
    else if (sleutel.startsWith('bij')) el.addEventListener(sleutel.slice(3).toLowerCase(), waarde);
    else el.setAttribute(sleutel, waarde === true ? '' : String(waarde));
  }
  for (const kind of kinderen) if (kind) el.append(kind);
  return el;
}

function getalVeld(waarde, min, max, stap) {
  return maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
}

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' }, ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}

function vinkje(tekst, aan) {
  const invoer = maak('input', { type: 'checkbox' });
  invoer.checked = Boolean(aan);
  const blok = maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minWidth: '0' } },
    invoer, maak('span', { tekst }));
  return { blok, invoer };
}

/** Label boven een veld, met optioneel een eenheid erachter. */
function metLabel(labelTekst, veld, eenheid) {
  veld.style.flex = '1';
  veld.style.minWidth = '0';
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld);
  if (eenheid) regel.append(maak('span', { klasse: 'uitleg', tekst: eenheid }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst: labelTekst, stijl: { minWidth: '0' } }), regel);
}

/** Een raster van n gelijke kolommen. */
const kolommen = (n, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end' } }, ...kinderen);

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).trim().replace(',', '.'));
  return String(veld.value).trim() !== '' && Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const nl = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });
const naarMm = (pt) => pt / vexel.mm(1);

/** Canvas op de juiste pixeldichtheid; geeft { g, b, h } terug. */
function bereidDoek(doek) {
  const schaal = devicePixelRatio || 1;
  const kader = doek.getBoundingClientRect();
  doek.width = Math.max(1, Math.round(kader.width * schaal));
  doek.height = Math.max(1, Math.round(kader.height * schaal));
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, kader.width, kader.height);
  return { g, b: kader.width, h: kader.height };
}

// ---- kleuren ----------------------------------------------------------------

/** CMYK naar een hex-benadering, voor de voorvertoning. */
function cmykNaarHex([c, m, y, k]) {
  const f = (a) => Math.round(255 * (1 - a / 100) * (1 - k / 100)).toString(16).padStart(2, '0');
  return `#${f(c)}${f(m)}${f(y)}`;
}

// ---- tekst meten en afbreken (Inter, geschat) ---------------------------------

const SMAL = new Set([..."iIl.,:;'!|j()[]{}ft"]);
const HALF = new Set([...'rsJ1-"/']);
const BREED = new Set([...'mwMW@%']);
const RUIM = new Set([...'ABCDEGHKNOQRUVXY&#0234567890']);

/** Geschatte breedte van een tekst in em (Inter, normaal gewicht). */
function emBreedte(tekst) {
  let som = 0;
  for (const t of tekst) {
    if (t === ' ') som += 0.28;
    else if (SMAL.has(t)) som += 0.28;
    else if (HALF.has(t)) som += 0.4;
    else if (BREED.has(t)) som += 0.86;
    else if (RUIM.has(t)) som += 0.66;
    else if (t >= 'A' && t <= 'Z') som += 0.62;
    else som += 0.55;
  }
  return som;
}

/** Breedte in pt bij een lettergrootte en gewicht (vet is iets breder). */
const tekstBreedte = (tekst, grootte, gewicht = 400) => emBreedte(tekst) * grootte * (1 + Math.max(0, gewicht - 400) / 300 * 0.06);

/** Breek een tekst af in regels die binnen `breedte` pt passen. */
function breekAf(tekst, breedte, grootte, gewicht = 400) {
  const regels = [];
  for (const alinea of String(tekst).split('\n')) {
    let regel = '';
    for (const woord of alinea.split(/\s+/).filter(Boolean)) {
      const proef = regel ? `${regel} ${woord}` : woord;
      if (!regel || tekstBreedte(proef, grootte, gewicht) <= breedte) regel = proef;
      else { regels.push(regel); regel = woord; }
    }
    regels.push(regel);
  }
  return regels;
}

// ---- het venster: vaste opbouw ------------------------------------------------------

/** Knoppenrij met Annuleren en de hoofdknop. Extra knoppen (gewone .knop) mogen ervoor. */
function knoppenRij(hoofdTekst, ...extra) {
  const hoofd = maak('button', { klasse: 'knop primair', type: 'submit', tekst: hoofdTekst });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const rij = maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, ...extra, annuleer, hoofd);
  return { rij, hoofd };
}

// ---- kleuren ------------------------------------------------------------------

/** Meng een hex-kleur met wit: f = 1 is de kleur zelf, f = 0 is wit. */
function mengWit(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const kanaal = (v) => Math.round(255 - (255 - v) * f).toString(16).padStart(2, '0');
  return `#${kanaal(n >> 16)}${kanaal((n >> 8) & 255)}${kanaal(n & 255)}`;
}

function palet(w, cmyk) {
  const a = ACCENTEN[w.accent] || ACCENTEN.blauw;
  const k = (c, h) => (cmyk ? { cmyk: c } : { hex: h });
  const tint = (f) => (cmyk ? { cmyk: a.cmyk.map((v) => Math.round(v * f)) } : { hex: mengWit(a.hex, f) });
  return {
    tekst: k([0, 0, 0, 100], '#1a1a1a'),
    zacht: k([0, 0, 0, 55], '#777777'),
    lijn: k([0, 0, 0, 25], '#c4c4c4'),
    notitie: k([0, 0, 0, 18], '#d4d4d4'),
    buur: k([0, 0, 0, 28], '#b8b8b8'),
    wit: k([0, 0, 0, 0], '#ffffff'),
    accent: k(a.cmyk, a.hex),
    weekendVlak: tint(0.07),
    feestVlak: tint(0.15),
  };
}

const tekst = (inhoud, x, y, grootte, vulling, extra = {}) => ({ soort: 'tekst', x, y, inhoud, grootte, vulling, lijn: null, ...extra });

// ---- maandkalender --------------------------------------------------------------

function bouwMaand(w, kader, p) {
  const T = TAAL[w.taal];
  const j = w.jaar, m = w.maand;
  const fd = w.feestdagen ? feestdagen(j, w.taal) : new Map();
  const { x: x0, y: y0, b: B, h: H } = kader;

  const titelG = begrens(B * 0.065, 12, 64);
  const weekB = w.weeknummers ? begrens(B * 0.055, 12, 40) : 0;
  const celB = (B - weekB) / 7;
  const kopG = begrens(celB * 0.13, 5, 12);
  const kopBoven = y0 + titelG * 1.3;
  const kopH = kopG * 2.6;
  const wd0 = weekdag(j, m, 1);
  const weken = Math.ceil((wd0 + dagenInMaand(j, m)) / 7);
  const rasterBoven = kopBoven + kopH;
  const celH = (y0 + H - rasterBoven) / weken;
  if (!(celB >= 14) || !(celH >= 14)) {
    return { fout: 'Dit past niet op het tekengebied: maak de marge kleiner of zet de weeknummers uit.' };
  }
  const dagG = begrens(Math.min(celB, celH * 1.4) * 0.2, 6, 26);
  const pad = Math.max(2, dagG * 0.42);
  const feestG = begrens(dagG * 0.42, 4.5, 8.5);
  const lijndikte = 0.5;

  const titel = {
    soort: 'groep', naam: 'Titel', kinderen: [
      tekst(hoofdletter(T.maanden[m]), x0, y0 + titelG * 0.74, titelG, p.accent, { gewicht: 700, naam: 'Maand' }),
      tekst(String(j), x0 + B, y0 + titelG * 0.74, titelG, p.zacht, { gewicht: 300, uitlijning: 'rechts', naam: 'Jaar' }),
    ],
  };

  const kopBasis = kopBoven + kopH * 0.5 + kopG * 0.36;
  const weekdagen = T.dagen.map((d, k) => tekst(d.toUpperCase(), x0 + weekB + k * celB + pad, kopBasis, kopG,
    k >= 5 && w.weekend ? p.accent : p.zacht, { gewicht: 600, letterafstand: 60, naam: d }));
  if (w.weeknummers) {
    weekdagen.unshift(tekst(T.week.toUpperCase(), x0 + weekB / 2, kopBasis, kopG * 0.85, p.zacht,
      { gewicht: 500, uitlijning: 'midden', letterafstand: 60, naam: 'Week' }));
  }

  const dagen = [];
  let aantalFeest = 0;
  for (let i = 0; i < weken * 7; i++) {
    const d = new Date(Date.UTC(j, m, 1 - wd0 + i));
    const dm = d.getUTCMonth(), dd = d.getUTCDate();
    const binnen = dm === m && d.getUTCFullYear() === j;
    const rij = Math.floor(i / 7), kol = i % 7;
    const cx = x0 + weekB + kol * celB, cy = rasterBoven + rij * celH;
    const feest = binnen ? fd.get(`${dm}-${dd}`) : null;
    if (feest) aantalFeest++;
    const weekend = kol >= 5 && w.weekend;
    const vulling = feest ? p.feestVlak : (weekend && binnen ? p.weekendVlak : null);
    const lijn = w.randen === 'raster' ? p.lijn : null;
    const delen = [];
    if (vulling || lijn) {
      delen.push({ soort: 'rechthoek', x: cx, y: cy, b: celB, h: celH, vulling, lijn, lijndikte: lijn ? lijndikte : 0, naam: 'Vak' });
    }
    const basis = cy + pad + dagG * 0.73;
    if (binnen || w.buurdagen) {
      const kleur = !binnen ? p.buur : (feest || weekend ? p.accent : p.tekst);
      delen.push(tekst(String(dd), cx + pad, basis, dagG, kleur, { gewicht: feest ? 700 : (binnen ? 500 : 400), naam: 'Dag' }));
    }
    if (feest) {
      const regels = breekAf(feest, celB - 2 * pad, feestG, 500).slice(0, 2);
      delen.push(tekst(regels.join('\n'), cx + pad, basis + feestG * 1.7, feestG, p.accent,
        { gewicht: 500, regelafstand: feestG * 1.2, naam: 'Feestdag' }));
    }
    if (w.notities && binnen) {
      const afstand = vexel.mm(w.notitieAfstand);
      const subpaden = [];
      for (let y = basis + Math.max(dagG * 0.55, feestG * 3.6) + afstand * 0.6; y <= cy + celH - pad * 0.7; y += afstand) {
        subpaden.push({ gesloten: false, punten: [{ x: cx + pad, y }, { x: cx + celB - pad, y }] });
      }
      if (subpaden.length) delen.push({ soort: 'pad', subpaden, vulling: null, lijn: p.notitie, lijndikte: 0.35, naam: 'Notitieregels' });
    }
    if (!delen.length) continue;
    dagen.push(delen.length === 1 && !binnen ? delen[0]
      : { soort: 'groep', naam: `${dd} ${T.maanden[dm]}`, kinderen: delen });
  }

  const kinderen = [titel, { soort: 'groep', naam: 'Weekdagen', kinderen: weekdagen }];
  if (w.weeknummers) {
    const nummers = [];
    for (let r = 0; r < weken; r++) {
      const d = new Date(Date.UTC(j, m, 1 - wd0 + r * 7));
      const nr = isoWeek(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      nummers.push(tekst(String(nr), x0 + weekB / 2, rasterBoven + r * celH + pad + dagG * 0.73, begrens(dagG * 0.5, 5, 11), p.zacht,
        { gewicht: 500, uitlijning: 'midden', naam: `Week ${nr}` }));
    }
    kinderen.push({ soort: 'groep', naam: 'Weeknummers', kinderen: nummers });
  }
  if (w.randen === 'open') {
    const subpaden = [];
    for (let r = 0; r <= weken; r++) {
      const y = rasterBoven + r * celH;
      subpaden.push({ gesloten: false, punten: [{ x: x0 + weekB, y }, { x: x0 + B, y }] });
    }
    kinderen.push({ soort: 'pad', subpaden, vulling: null, lijn: p.lijn, lijndikte, naam: 'Lijnen' });
  }
  kinderen.push({ soort: 'groep', naam: 'Dagen', kinderen: dagen });
  return {
    vorm: { soort: 'groep', naam: `${hoofdletter(T.maanden[m])} ${j}`, kinderen },
    samenvatting: `${hoofdletter(T.maanden[m])} ${j}: ${weken} weken, ${aantalFeest} ${aantalFeest === 1 ? 'feestdag' : 'feestdagen'}`
      + ` · vakken van ${nl(naarMm(celB))} × ${nl(naarMm(celH))} mm`,
    melding: `Maandkalender ${TAAL.nl.maanden[m]} ${j} gemaakt.`,
  };
}

// ---- jaarkalender -----------------------------------------------------------------

function bouwJaar(w, kader, p) {
  const T = TAAL[w.taal];
  const j = w.jaar;
  const fd = w.feestdagen ? feestdagen(j, w.taal) : new Map();
  const { x: x0, y: y0, b: B, h: H } = kader;
  const eenheden = w.weeknummers ? 8 : 7;
  const titelG = begrens(Math.min(B, H) * 0.075, 14, 80);
  const rasterBoven = y0 + titelG * 1.35;

  const feestLijst = [...fd.entries()].map(([sleutel, naam]) => {
    const [m, d] = sleutel.split('-').map(Number);
    return { m, d, naam };
  }).sort((a, b) => a.m - b.m || a.d - b.d);
  const metLijst = w.lijst && feestLijst.length > 0;

  // Kies de indeling (kolommen × rijen) met de grootste dagvakjes.
  let beste = null;
  for (const [k, r] of [[3, 4], [4, 3], [2, 6], [6, 2]]) {
    const tussen = B * 0.035;
    const lijstH = metLijst ? 0.12 * (H - titelG * 1.35) : 0;
    const slotB = (B - (k - 1) * tussen) / k;
    const slotH = (y0 + H - rasterBoven - lijstH - (r - 1) * tussen) / r;
    // Liever staand raster op staand papier en liggend op liggend: dat oogt rustiger.
    const cel = Math.min(slotB / eenheden, slotH / 8.6) * ((H >= B) === (r >= k) ? 1.15 : 1);
    if (!beste || cel > beste.cel) beste = { k, r, cel, tussen };
  }
  const { k: kols, r: rijen, tussen } = beste;
  const slotB = (B - (kols - 1) * tussen) / kols;
  const celB = slotB / eenheden;

  // Feestdagenlijst onderaan: maat hangt af van de vakjes.
  const lijstG = begrens(celB * 0.38, 5, 9);
  const lijstKols = Math.max(2, Math.min(kols, 4));
  const lijstRijen = metLijst ? Math.ceil(feestLijst.length / lijstKols) : 0;
  const lijstH = metLijst ? lijstG * 1.55 * lijstRijen + lijstG * 2.2 : 0;

  const beschikbaar = y0 + H - rasterBoven - lijstH;
  const celH = Math.min((beschikbaar - (rijen - 1) * tussen) / rijen / 8.6, celB * 1.15);
  if (!(celB >= 6) || !(celH >= 5)) {
    return { fout: 'Dit past niet op het tekengebied: maak de marge kleiner of zet de feestdagenlijst uit.' };
  }
  const miniH = celH * 8.6;
  const tussenY = rijen > 1 ? Math.min((beschikbaar - rijen * miniH) / (rijen - 1), celH * 4) : 0;
  const blokH = rijen * miniH + (rijen - 1) * tussenY;
  const blokBoven = rasterBoven + Math.max(0, (beschikbaar - blokH) / 2);

  const dagG = begrens(Math.min(celB, celH) * 0.5, 3.5, 16);
  const naamG = begrens(celH * 0.95, 5, 22);
  const off = w.weeknummers ? celB : 0;

  const maanden = [];
  for (let m = 0; m < 12; m++) {
    const sx = x0 + (m % kols) * (slotB + tussen);
    const sy = blokBoven + Math.floor(m / kols) * (miniH + tussenY);
    const wd0 = weekdag(j, m, 1), nd = dagenInMaand(j, m);
    const weken = Math.ceil((wd0 + nd) / 7);
    const dagBoven = sy + celH * 2.6;
    const kinderen = [];
    if (w.weekend) {
      kinderen.push({ soort: 'rechthoek', x: sx + off + 5 * celB, y: dagBoven, b: 2 * celB, h: weken * celH,
        vulling: p.weekendVlak, lijn: null, lijndikte: 0, naam: 'Weekend' });
    }
    kinderen.push(tekst(hoofdletter(T.maanden[m]), sx + off + celB * 0.5 - dagG * 0.35, sy + naamG * 0.8, naamG, p.accent,
      { gewicht: 700, naam: 'Maandnaam' }));
    const kopBasis = sy + celH * 1.6 + celH * 0.5 + dagG * 0.3;
    kinderen.push({
      soort: 'groep', naam: 'Weekdagen', kinderen: T.letters.map((l, k) =>
        tekst(l, sx + off + (k + 0.5) * celB, kopBasis, dagG * 0.82, k >= 5 && w.weekend ? p.accent : p.zacht,
          { gewicht: 600, uitlijning: 'midden', naam: T.dagen[k] })),
    });
    if (w.weeknummers) {
      const nummers = [];
      for (let r = 0; r < weken; r++) {
        const d = new Date(Date.UTC(j, m, 1 - wd0 + r * 7));
        const nr = isoWeek(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        nummers.push(tekst(String(nr), sx + celB * 0.5, dagBoven + (r + 0.5) * celH + dagG * 0.27, dagG * 0.7, p.zacht,
          { gewicht: 400, uitlijning: 'midden', naam: `Week ${nr}` }));
      }
      kinderen.push({ soort: 'groep', naam: 'Weeknummers', kinderen: nummers });
    }
    const dagen = [];
    for (let d = 1; d <= nd; d++) {
      const i = wd0 + d - 1;
      const kol = i % 7, rij = Math.floor(i / 7);
      const mx = sx + off + (kol + 0.5) * celB, my = dagBoven + (rij + 0.5) * celH;
      const feest = fd.get(`${m}-${d}`);
      const basis = my + dagG * 0.36;
      if (feest) {
        const r = Math.min(celB, celH) * 0.46;
        dagen.push({ soort: 'groep', naam: `${d} ${T.maanden[m]} · ${feest}`, kinderen: [
          { soort: 'ellips', cx: mx, cy: my, rx: r, ry: r, vulling: p.accent, lijn: null, lijndikte: 0, naam: 'Stip' },
          tekst(String(d), mx, basis, dagG, p.wit, { gewicht: 700, uitlijning: 'midden', naam: 'Dag' }),
        ] });
      } else {
        dagen.push(tekst(String(d), mx, basis, dagG, kol >= 5 && w.weekend ? p.accent : p.tekst,
          { gewicht: kol >= 5 && w.weekend ? 600 : 400, uitlijning: 'midden', naam: `${d} ${T.maanden[m]}` }));
      }
    }
    kinderen.push({ soort: 'groep', naam: 'Dagen', kinderen: dagen });
    maanden.push({ soort: 'groep', naam: hoofdletter(T.maanden[m]), kinderen });
  }

  const kinderen = [
    tekst(String(j), x0, y0 + titelG * 0.74, titelG, p.accent, { gewicht: 700, naam: 'Jaartal' }),
    { soort: 'groep', naam: 'Maanden', kinderen: maanden },
  ];
  if (metLijst) {
    const kolB = B / lijstKols;
    const datumB = tekstBreedte('30 sep', lijstG, 700) + lijstG * 0.8;
    const lijstBoven = y0 + H - lijstG * 1.55 * lijstRijen;
    const regels = [{ soort: 'pad', subpaden: [{ gesloten: false, punten: [{ x: x0, y: lijstBoven - lijstG * 1.6 }, { x: x0 + B, y: lijstBoven - lijstG * 1.6 }] }],
      vulling: null, lijn: p.lijn, lijndikte: 0.5, naam: 'Lijn' }];
    feestLijst.forEach((f, i) => {
      const lx = x0 + Math.floor(i / lijstRijen) * kolB;
      const ly = lijstBoven + (i % lijstRijen) * lijstG * 1.55 + lijstG * 0.8;
      regels.push({ soort: 'groep', naam: f.naam, kinderen: [
        tekst(`${f.d} ${T.kort[f.m]}`, lx, ly, lijstG, p.accent, { gewicht: 700, naam: 'Datum' }),
        tekst(f.naam, lx + datumB, ly, lijstG, p.tekst, { gewicht: 400, naam: 'Naam' }),
      ] });
    });
    kinderen.push({ soort: 'groep', naam: w.taal === 'en' ? 'Public holidays' : 'Feestdagen', kinderen: regels });
  }
  return {
    vorm: { soort: 'groep', naam: `Jaarkalender ${j}`, kinderen },
    samenvatting: `${j} in ${kols} × ${rijen} maanden · ${feestLijst.length} feestdagen · dagvakjes van ${nl(naarMm(celB))} × ${nl(naarMm(celH))} mm`,
    melding: `Jaarkalender ${j} gemaakt.`,
  };
}

/** Telt vormen en punten (de grenzen van vexel.maak). */
function tel(v, t = { vormen: 0, punten: 0 }) {
  t.vormen++;
  if (v.kinderen) v.kinderen.forEach((k) => tel(k, t));
  if (v.subpaden) v.subpaden.forEach((s) => { t.punten += s.punten.length; });
  return t;
}

function bouw(w, doc) {
  if (!(w.jaar >= 1900 && w.jaar <= 2200)) return { fout: 'Kies een jaar tussen 1900 en 2200.' };
  const marge = vexel.mm(w.marge);
  const kader = { x: marge, y: marge, b: doc.tekengebied.b - 2 * marge, h: doc.tekengebied.h - 2 * marge };
  if (!(kader.b > 40) || !(kader.h > 40)) return { fout: 'De marge is te groot voor dit tekengebied: maak hem kleiner.' };
  const p = palet(w, doc.kleurruimte === 'cmyk');
  const uitkomst = w.soort === 'jaar' ? bouwJaar(w, kader, p) : bouwMaand(w, kader, p);
  if (uitkomst.fout) return uitkomst;
  const t = tel(uitkomst.vorm);
  if (t.vormen > 5000 || t.punten > 50000) {
    return { fout: 'Dat worden te veel vormen in één keer: zet de notitieregels uit of maak de regelafstand groter.' };
  }
  return { ...uitkomst, telling: t };
}

// ---- voorvertoning --------------------------------------------------------------

const kleurCss = (k) => (!k ? null : k.hex || cmykNaarHex(k.cmyk));

function tekenVorm(g, v, s) {
  if (v.soort === 'groep') { v.kinderen.forEach((k) => tekenVorm(g, k, s)); return; }
  const vul = kleurCss(v.vulling), lijn = kleurCss(v.lijn);
  g.beginPath();
  if (v.soort === 'rechthoek') g.rect(v.x * s, v.y * s, v.b * s, v.h * s);
  else if (v.soort === 'ellips') g.ellipse(v.cx * s, v.cy * s, v.rx * s, v.ry * s, 0, 0, Math.PI * 2);
  else if (v.soort === 'pad') {
    for (const sp of v.subpaden) sp.punten.forEach((q, i) => (i ? g.lineTo(q.x * s, q.y * s) : g.moveTo(q.x * s, q.y * s)));
  } else if (v.soort === 'tekst') {
    if (v.grootte * s < 0.8) return;
    g.font = `${v.gewicht || 400} ${v.grootte * s}px Inter, system-ui, sans-serif`;
    g.textAlign = { midden: 'center', rechts: 'right' }[v.uitlijning] || 'left';
    g.fillStyle = vul || '#000000';
    v.inhoud.split('\n').forEach((r, i) => g.fillText(r, v.x * s, (v.y + i * (v.regelafstand || v.grootte * 1.2)) * s));
    return;
  }
  if (vul && v.soort !== 'pad') { g.fillStyle = vul; g.fill(); }
  if (lijn && v.lijndikte) { g.strokeStyle = lijn; g.lineWidth = Math.max(0.5, v.lijndikte * s); g.stroke(); }
}

// ---- het venster ------------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const soort = keuzeVeld([['maand', 'Maand'], ['jaar', 'Jaar (12 maanden)']], w0.soort);
  const jaar = getalVeld(w0.jaar, 1900, 2200, 1);
  const maand = keuzeVeld(TAAL.nl.maanden.map((n, i) => [String(i), hoofdletter(n)]), String(w0.maand));
  const taal = keuzeVeld([['nl', 'Nederlands'], ['en', 'Engels']], w0.taal);
  const accent = keuzeVeld(Object.entries(ACCENTEN).map(([s, a]) => [s, a.naam]), w0.accent);
  const randen = keuzeVeld([['raster', 'Vakken'], ['open', 'Alleen lijnen'], ['geen', 'Geen']], w0.randen);
  const marge = getalVeld(w0.marge, 0, 100, 1);
  const notitieAfstand = getalVeld(w0.notitieAfstand, 3, 30, 0.5);

  const weeknummers = vinkje('Weeknummers', w0.weeknummers);
  const feest = vinkje('Feestdagen', w0.feestdagen);
  const weekend = vinkje('Weekend in kleur', w0.weekend);
  const buurdagen = vinkje('Buurdagen in grijs', w0.buurdagen);
  const notities = vinkje('Notitieregels', w0.notities);
  const lijst = vinkje('Feestdagenlijst', w0.lijst);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '250px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const { rij: knoppen, hoofd } = knoppenRij('Kalender maken');

  const maandVeld = metLabel('Maand', maand);
  const randVeld = metLabel('Randen', randen);
  const afstandVeld = metLabel('Afstand notitieregels', notitieAfstand, 'mm');
  const vinkjes = maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px 10px' } },
    weeknummers.blok, feest.blok, weekend.blok, buurdagen.blok, notities.blok, lijst.blok);

  const formulier = maak('form', { stijl: { display: 'grid', gap: '11px' } },
    kolommen(3, metLabel('Kalender', soort), metLabel('Jaar', jaar), maandVeld),
    doek,
    kolommen(3, metLabel('Taal', taal), metLabel('Kleur', accent), randVeld),
    vinkjes,
    kolommen(2, metLabel('Marge', marge, 'mm'), afstandVeld),
    samenvatting,
    knoppen,
  );
  document.body.append(formulier);

  const waarden = () => ({
    soort: soort.value,
    jaar: Math.round(leesGetal(jaar, NaN)),
    maand: Number(maand.value),
    taal: taal.value,
    accent: accent.value,
    randen: randen.value,
    marge: begrens(leesGetal(marge, 10), 0, 100),
    notitieAfstand: begrens(leesGetal(notitieAfstand, 6), 3, 30),
    weeknummers: weeknummers.invoer.checked,
    feestdagen: feest.invoer.checked,
    weekend: weekend.invoer.checked,
    buurdagen: buurdagen.invoer.checked,
    notities: notities.invoer.checked,
    lijst: lijst.invoer.checked,
  });

  // Velden die alleen bij één soort horen, worden zachter en uitgeschakeld.
  const zetActief = (el, aan, ...velden) => {
    el.style.opacity = aan ? '1' : '0.4';
    velden.forEach((v) => { v.disabled = !aan; });
  };

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    const isMaand = w.soort === 'maand';
    zetActief(maandVeld, isMaand, maand);
    zetActief(randVeld, isMaand, randen);
    zetActief(buurdagen.blok, isMaand, buurdagen.invoer);
    zetActief(notities.blok, isMaand, notities.invoer);
    zetActief(afstandVeld, isMaand && w.notities, notitieAfstand);
    zetActief(lijst.blok, !isMaand && w.feestdagen, lijst.invoer);

    const uitkomst = bouw(w, doc);
    hoofd.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.className = uitkomst.fout || doc.alleenLezen ? 'uitleg fout' : 'uitleg';
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: open een document dat je kunt bewerken.';
    else samenvatting.textContent = uitkomst.fout || uitkomst.samenvatting;

    const { g, b, h } = bereidDoek(doek);
    const tb = doc.tekengebied;
    const s = Math.min((b - 16) / tb.b, (h - 16) / tb.h);
    const ox = (b - tb.b * s) / 2, oy = (h - tb.h * s) / 2;
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 8;
    g.fillRect(ox, oy, tb.b * s, tb.h * s);
    g.shadowBlur = 0;
    if (uitkomst.vorm) {
      g.save();
      g.translate(ox, oy);
      tekenVorm(g, uitkomst.vorm, s);
      g.restore();
    }
  }
  const plan = () => { if (!gepland) { gepland = true; requestAnimationFrame(teken); } };

  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const w = waarden();
    const uitkomst = bouw(w, doc);
    if (uitkomst.fout) return vexel.melding(uitkomst.fout, 'let');
    hoofd.disabled = true;
    try { await vexel.bewaar('instellingen', w); } catch (fout) { /* instellingen onthouden is bijzaak */ }
    try {
      await vexel.maak([uitkomst.vorm]);
      vexel.melding(uitkomst.melding, 'ok');
      vexel.sluit();
    } catch (fout) {
      hoofd.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De kalender kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  jaar.focus();
  jaar.select();
}

vexel.opCommando('maken', toonVenster);
