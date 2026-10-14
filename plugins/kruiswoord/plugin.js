// Kruiswoordraster: maakt uit een lijst "woord: omschrijving" een compacte kruiswoordpuzzel
// met genummerde vakjes, de omschrijvingen Horizontaal en Verticaal eronder en de
// oplossing als verborgen groep (aan te zetten in het lagenpaneel).
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { celmaat: 8, ij: true, lengte: true, leeg: 'weg', zaad: 1, kolommen: 2 };
const VOORBEELD = [
  'tulp: Voorjaarsbloem uit een bol',
  'molen: Draait op de wind',
  'fiets: Tweewieler met trappers',
  'kaas: Gatenrijk zuivelproduct',
  'gracht: Water tussen de grachtenpanden',
  'dijk: Houdt het water tegen',
  'klompen: Houten schoeisel',
  'haring: Vis die je bij de staart pakt',
  'stroopwafel: Ronde lekkernij met siroop',
  'polder: Drooggemaakt land',
  'regen: Komt vaak uit de lucht vallen',
  'koe: Graast in de wei',
].join('\n');
const MAX_WOORDEN = 60;
const MAX_LENGTE = 30;

// ---- willekeur met zaadje -------------------------------------------------------

function willekeur(zaad) {
  let s = (Math.imul((zaad | 0) ^ 0x51ed27, 0x9e3779b1) >>> 0) || 1;
  const volgende = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 6; i++) volgende();
  return volgende;
}
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));

// ---- woorden --------------------------------------------------------------------

function vakjesVan(woord, ij) {
  const letters = [];
  for (const teken of woord.normalize('NFKD').toUpperCase()) {
    const code = teken.charCodeAt(0);
    if (code >= 65 && code <= 90) letters.push(teken);
  }
  if (!ij) return letters;
  const vakjes = [];
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === 'I' && letters[i + 1] === 'J') {
      vakjes.push('IJ');
      i++;
    } else vakjes.push(letters[i]);
  }
  return vakjes;
}

/** Leest "woord: omschrijving" per regel (ook met = , tab of " - " ertussen). */
function leesLijst(tekst, ij) {
  const woorden = [];
  const problemen = [];
  const gezien = new Set();
  for (const ruw of tekst.split('\n')) {
    const regel = ruw.trim();
    if (!regel) continue;
    const m = /^(.+?)\s*(?::|=|\t| - | – )\s*(.*)$/.exec(regel);
    const toon = (m ? m[1] : regel).trim();
    const omschrijving = (m ? m[2] : '').trim();
    const vakjes = vakjesVan(toon, ij);
    const sleutel = vakjes.join('');
    if (vakjes.length < 2) {
      problemen.push(`“${toon}” is te kort`);
      continue;
    }
    if (vakjes.length > MAX_LENGTE) {
      problemen.push(`“${toon}” is te lang`);
      continue;
    }
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    woorden.push({ toon, vakjes, omschrijving: omschrijving || '…' });
  }
  return { woorden, problemen };
}

// ---- het rooster ---------------------------------------------------------------

/** Een rooster als Map "r,c" -> letter, met plaatsing van woorden en controles. */
function nieuwRooster() {
  return { cellen: new Map(), r0: 0, r1: -1, c0: 0, c1: -1, geplaatst: [] };
}
const sleutelVan = (r, c) => r + ',' + c;

function past(rooster, woord, r, c, horiz) {
  const L = woord.vakjes.length;
  const dr = horiz ? 0 : 1;
  const dc = horiz ? 1 : 0;
  const cel = (rr, cc) => rooster.cellen.get(sleutelVan(rr, cc));
  // voor en na het woord moet leeg zijn
  if (cel(r - dr, c - dc) !== undefined || cel(r + dr * L, c + dc * L) !== undefined) return -1;
  let kruisingen = 0;
  for (let k = 0; k < L; k++) {
    const rr = r + dr * k;
    const cc = c + dc * k;
    const v = cel(rr, cc);
    if (v !== undefined) {
      if (v !== woord.vakjes[k]) return -1;
      // niet over een woord in dezelfde richting heen
      if (rooster.richting.get(sleutelVan(rr, cc)) & (horiz ? 1 : 2)) return -1;
      kruisingen++;
    } else {
      // een nieuw vakje mag geen buren hebben in de dwarsrichting (anders ontstaan losse woorden)
      if (cel(rr + dc, cc + dr) !== undefined || cel(rr - dc, cc - dr) !== undefined) return -1;
    }
  }
  return kruisingen;
}

function leg(rooster, woord, r, c, horiz) {
  const L = woord.vakjes.length;
  for (let k = 0; k < L; k++) {
    const rr = horiz ? r : r + k;
    const cc = horiz ? c + k : c;
    const s = sleutelVan(rr, cc);
    rooster.cellen.set(s, woord.vakjes[k]);
    rooster.richting.set(s, (rooster.richting.get(s) || 0) | (horiz ? 1 : 2));
  }
  rooster.r0 = Math.min(rooster.r0, r);
  rooster.c0 = Math.min(rooster.c0, c);
  rooster.r1 = Math.max(rooster.r1, horiz ? r : r + L - 1);
  rooster.c1 = Math.max(rooster.c1, horiz ? c + L - 1 : c);
  rooster.geplaatst.push({ woord, r, c, horiz });
}

/** Eén poging: woorden in een (deels willekeurige) volgorde zo compact mogelijk laten kruisen. */
function poging(woorden, rnd) {
  const rooster = nieuwRooster();
  rooster.richting = new Map();
  const volgorde = woorden.slice().sort((a, b) => b.vakjes.length - a.vakjes.length + (rnd() - 0.5) * 3);
  const eerste = volgorde.shift();
  leg(rooster, eerste, 0, 0, true);
  let wachtrij = volgorde;
  for (let ronde = 0; ronde < 3 && wachtrij.length; ronde++) {
    const overgebleven = [];
    for (const woord of wachtrij) {
      let beste = null;
      // kandidaten: elke letter van het woord op elk gelijk vakje in het rooster
      for (const [s, letter] of rooster.cellen) {
        const [r, c] = s.split(',').map(Number);
        for (let k = 0; k < woord.vakjes.length; k++) {
          if (woord.vakjes[k] !== letter) continue;
          for (const horiz of [true, false]) {
            const r0 = horiz ? r : r - k;
            const c0 = horiz ? c - k : c;
            const kr = past(rooster, woord, r0, c0, horiz);
            if (kr < 1) continue;
            const L = woord.vakjes.length;
            const nr0 = Math.min(rooster.r0, r0);
            const nc0 = Math.min(rooster.c0, c0);
            const nr1 = Math.max(rooster.r1, horiz ? r0 : r0 + L - 1);
            const nc1 = Math.max(rooster.c1, horiz ? c0 + L - 1 : c0);
            const h = nr1 - nr0 + 1;
            const b = nc1 - nc0 + 1;
            const score = kr * 12 - h * b * 0.35 - Math.abs(b - h * 1.25) * 1.5 + rnd() * 4;
            if (!beste || score > beste.score) beste = { score, r0, c0, horiz };
          }
        }
      }
      if (beste) leg(rooster, woord, beste.r0, beste.c0, beste.horiz);
      else overgebleven.push(woord);
    }
    wachtrij = overgebleven;
  }
  rooster.mislukt = wachtrij;
  return rooster;
}

/** Vele pogingen, de beste blijft: zoveel mogelijk woorden, dan klein en met veel kruisingen. */
function maakPuzzel(woorden, zaad) {
  if (!woorden.length) return { fout: 'Typ minstens één woord met een omschrijving, bijvoorbeeld: tulp: Voorjaarsbloem.' };
  if (woorden.length > MAX_WOORDEN) return { fout: `Dat zijn ${woorden.length} woorden; hooguit ${MAX_WOORDEN}.` };
  let beste = null;
  let besteScore = -Infinity;
  const pogingen = woorden.length > 30 ? 40 : 90;
  for (let i = 0; i < pogingen; i++) {
    const rnd = willekeur(zaad * 977 + i * 31);
    const r = poging(woorden, rnd);
    const h = r.r1 - r.r0 + 1;
    const b = r.c1 - r.c0 + 1;
    let kruis = 0;
    for (const v of r.richting.values()) if (v === 3) kruis++;
    const score = -r.mislukt.length * 1000 - h * b - Math.abs(b - h * 1.3) * 3 + kruis * 6;
    if (score > besteScore) {
      besteScore = score;
      beste = r;
    }
  }
  return nummeren(beste);
}

/** Nummers zoals in een gewone kruiswoordpuzzel: rij voor rij, één nummer per beginvakje. */
function nummeren(r) {
  const R = r.r1 - r.r0 + 1;
  const C = r.c1 - r.c0 + 1;
  const starts = new Map();
  for (const g of r.geplaatst) {
    const s = sleutelVan(g.r - r.r0, g.c - r.c0);
    if (!starts.has(s)) starts.set(s, []);
    starts.get(s).push(g);
  }
  const nummers = new Map();
  let n = 0;
  for (let rr = 0; rr < R; rr++) {
    for (let cc = 0; cc < C; cc++) {
      const s = sleutelVan(rr, cc);
      if (!starts.has(s)) continue;
      nummers.set(s, ++n);
      for (const g of starts.get(s)) g.nummer = n;
    }
  }
  const raster = [];
  for (let rr = 0; rr < R; rr++) {
    const rij = [];
    for (let cc = 0; cc < C; cc++) rij.push(r.cellen.get(sleutelVan(rr + r.r0, cc + r.c0)) || null);
    raster.push(rij);
  }
  const horizontaal = r.geplaatst.filter((g) => g.horiz).sort((a, b) => a.nummer - b.nummer);
  const verticaal = r.geplaatst.filter((g) => !g.horiz).sort((a, b) => a.nummer - b.nummer);
  return { R, C, raster, nummers, horizontaal, verticaal, mislukt: r.mislukt, geplaatst: r.geplaatst.length };
}

// ---- vormen --------------------------------------------------------------------

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Breedte van tekst in Inter, ongeveer, in em. */
function breedteEm(tekst) {
  let n = 0;
  for (const t of tekst) {
    if ("iIjlft.,:;!|’'".includes(t)) n += 0.3;
    else if (t === ' ') n += 0.27;
    else if ('mwMW'.includes(t)) n += 0.86;
    else if (t >= 'A' && t <= 'Z') n += 0.66;
    else n += 0.55;
  }
  return n;
}

/** Breekt tekst af op woordgrenzen zodat hij in `breed` pt past. */
function afbreken(tekst, grootte, breed) {
  const regels = [];
  let regel = '';
  for (const woord of tekst.split(/\s+/)) {
    const proef = regel ? regel + ' ' + woord : woord;
    if (breedteEm(proef) * grootte > breed && regel) {
      regels.push(regel);
      regel = woord;
    } else regel = proef;
  }
  if (regel) regels.push(regel);
  return regels;
}

function omschrijvingVormen(lijst, kop, x, y, breed, opmaak, w) {
  const grootte = 9;
  const regelafstand = 12;
  const kinderen = [{ soort: 'tekst', naam: kop, inhoud: kop, x: r3(x), y: r3(y + 10), grootte: 10.5, gewicht: 700, vulling: opmaak.tekst }];
  let yy = y + 10 + 16;
  const inspring = 20;
  for (const g of lijst) {
    const tekst = g.woord.omschrijving + (w.lengte ? ` (${g.woord.vakjes.length})` : '');
    const regels = afbreken(tekst, grootte, breed - inspring);
    kinderen.push({
      soort: 'groep', naam: `${g.nummer} ${kop.toLowerCase()}`,
      kinderen: [
        { soort: 'tekst', naam: 'Nummer', inhoud: String(g.nummer), x: r3(x + inspring - 6), y: r3(yy), grootte, gewicht: 700, uitlijning: 'rechts', vulling: opmaak.tekst },
        { soort: 'tekst', naam: 'Omschrijving', inhoud: regels.join('\n'), x: r3(x + inspring), y: r3(yy), grootte, regelafstand, vulling: opmaak.tekst },
      ],
    });
    yy += regels.length * regelafstand + 3;
  }
  return { vorm: { soort: 'groep', naam: kop, kinderen }, hoogte: yy - y };
}

function puzzelVormen(p, w, opmaak, tg, titelTekst) {
  const c = vexel.mm(w.celmaat);
  const breed = p.C * c;
  const x0 = r3((tg.b - breed) / 2);
  const boven = vexel.mm(18) + (titelTekst ? 34 : 0);
  const kinderen = [];
  if (titelTekst) {
    kinderen.push({ soort: 'tekst', naam: 'Titel', inhoud: titelTekst, x: r3(tg.b / 2), y: r3(vexel.mm(18) + 18), grootte: 20, gewicht: 700, uitlijning: 'midden', vulling: opmaak.tekst });
  }
  const vakjes = [];
  const zwart = [];
  const nummers = [];
  const letters = [];
  const nGrootte = r3(Math.max(4, c * 0.27));
  const lGrootte = r3(c * (p.raster.some((rij) => rij.some((v) => v && v.length > 1)) ? 0.5 : 0.58));
  for (let r = 0; r < p.R; r++) {
    for (let k = 0; k < p.C; k++) {
      const v = p.raster[r][k];
      const x = x0 + k * c;
      const y = boven + r * c;
      if (!v) {
        if (w.leeg === 'zwart') zwart.push({ soort: 'rechthoek', x: r3(x), y: r3(y), b: r3(c), h: r3(c), vulling: opmaak.zwart, lijn: opmaak.lijn, lijndikte: 0.75 });
        continue;
      }
      vakjes.push({ soort: 'rechthoek', x: r3(x), y: r3(y), b: r3(c), h: r3(c), vulling: opmaak.wit, lijn: opmaak.lijn, lijndikte: 0.75 });
      const n = p.nummers.get(sleutelVan(r, k));
      if (n) nummers.push({ soort: 'tekst', inhoud: String(n), x: r3(x + c * 0.08), y: r3(y + nGrootte * 1.02), grootte: nGrootte, gewicht: 600, vulling: opmaak.tekst });
      letters.push({
        soort: 'tekst', inhoud: v, x: r3(x + c / 2), y: r3(y + c * 0.56 + lGrootte * 0.36), grootte: lGrootte, gewicht: 500, uitlijning: 'midden', vulling: opmaak.oplossing,
      });
    }
  }
  if (zwart.length) kinderen.push({ soort: 'groep', naam: 'Zwarte vakjes', kinderen: zwart });
  kinderen.push({ soort: 'groep', naam: 'Vakjes', kinderen: vakjes });
  kinderen.push({ soort: 'groep', naam: 'Nummers', kinderen: nummers });
  kinderen.push({ soort: 'groep', naam: 'Oplossing', zichtbaar: false, kinderen: letters });

  // omschrijvingen eronder, in één of twee kolommen
  const ruimte = vexel.mm(12);
  const marge = vexel.mm(18);
  const lijstBreed = tg.b - 2 * marge;
  const y = boven + p.R * c + vexel.mm(10);
  if (w.kolommen === 2) {
    const kb = (lijstBreed - ruimte) / 2;
    if (p.horizontaal.length) kinderen.push(omschrijvingVormen(p.horizontaal, 'Horizontaal', marge, y, kb, opmaak, w).vorm);
    if (p.verticaal.length) kinderen.push(omschrijvingVormen(p.verticaal, 'Verticaal', marge + kb + ruimte, y, kb, opmaak, w).vorm);
  } else {
    let yy = y;
    for (const [lijst, kop] of [[p.horizontaal, 'Horizontaal'], [p.verticaal, 'Verticaal']]) {
      if (!lijst.length) continue;
      const o = omschrijvingVormen(lijst, kop, marge, yy, lijstBreed, opmaak, w);
      kinderen.push(o.vorm);
      yy += o.hoogte + vexel.mm(4);
    }
  }
  return { soort: 'groep', naam: `Kruiswoordpuzzel ${p.C} × ${p.R}`, kinderen };
}

/** Hoe hoog de puzzel wordt (pt), om te kunnen waarschuwen als hij niet op het vel past. */
function hoogteVan(p, w, tg, titel) {
  const c = vexel.mm(w.celmaat);
  const lijstBreed = tg.b - vexel.mm(36);
  const kb = w.kolommen === 2 ? (lijstBreed - vexel.mm(12)) / 2 : lijstBreed;
  const h = (lijst) => 26 + lijst.reduce((n, g) => n + afbreken(g.woord.omschrijving + ' (00)', 9, kb - 20).length * 12 + 3, 0);
  const lijsten = w.kolommen === 2 ? Math.max(h(p.horizontaal), h(p.verticaal)) : h(p.horizontaal) + h(p.verticaal) + vexel.mm(4);
  return vexel.mm(18) + (titel ? 34 : 0) + p.R * c + vexel.mm(10) + lijsten;
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
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '10px', alignItems: 'end' } },
    ...kinderen);
function vinkje(tekst, aan) {
  const vak = maak('input', { type: 'checkbox' });
  vak.checked = Boolean(aan);
  return { vak, el: maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', height: '26px' } }, vak, tekst) };
}
const getal = (n, cijfers = 0) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });

// ---- het venster --------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const lijstVeld = maak('textarea', {
    klasse: 'veld', spellcheck: 'false', 'aria-label': 'Woorden met omschrijving, één per regel',
    placeholder: 'woord: omschrijving (één per regel)',
    stijl: { width: '100%', height: '100%', minHeight: '200px', padding: '6px 8px', resize: 'none', lineHeight: '1.45' },
  });
  lijstVeld.value = VOORBEELD;
  const titel = maak('input', { klasse: 'veld', type: 'text', maxlength: 80, placeholder: 'Bijvoorbeeld: Typisch Nederlands', stijl: { width: '100%' } });
  const celmaat = getalVeld(w0.celmaat, 4, 20, 0.5);
  const leeg = keuzeVeld([['weg', 'Weglaten'], ['zwart', 'Zwart vullen']], w0.leeg);
  const kolommen = keuzeVeld([[2, 'Twee kolommen'], [1, 'Onder elkaar']], w0.kolommen);
  const ij = vinkje('IJ in één vakje', w0.ij);
  const lengte = vinkje('Lengte erachter (5)', w0.lengte);
  const zaad = getalVeld(w0.zaad, 1, 99999, 1);
  const toonOplossing = vinkje('Oplossing tonen', false);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '100%', minHeight: '200px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const variant = maak('button', { klasse: 'knop', type: 'button', tekst: 'Andere indeling' });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Puzzel maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', padding: '12px 14px 14px' } },
    kolommenRij('1fr 1fr',
      maak('label', { stijl: { display: 'grid', gridTemplateRows: 'auto 1fr', gap: '3px', alignSelf: 'stretch' } },
        maak('span', { klasse: 'label', tekst: 'Woord: omschrijving', stijl: { minWidth: '0' } }), lijstVeld),
      maak('div', { stijl: { display: 'grid', gridTemplateRows: 'auto 1fr', gap: '3px', alignSelf: 'stretch' } },
        toonOplossing.el, doek)),
    kolommenRij('2fr 1fr', metLabel('Titel (mag leeg)', titel), metLabel('Celmaat', celmaat, 'mm')),
    kolommenRij('1fr 1fr 1fr', metLabel('Lege vakjes', leeg), metLabel('Omschrijvingen', kolommen), metLabel('Variant', zaad)),
    maak('div', { stijl: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px' } }, ij.el, lengte.el),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, variant, maak('span', { stijl: { flex: '1' } }), annuleer, maakKnop),
  );
  toonOplossing.el.style.height = '18px';
  document.head.append(maak('style', { tekst: '.knop{white-space:nowrap}textarea.veld{height:auto}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({
    celmaat: begrens(leesGetal(celmaat, 8), 4, 20),
    leeg: leeg.value,
    kolommen: Number(kolommen.value) === 1 ? 1 : 2,
    ij: ij.vak.checked,
    lengte: lengte.vak.checked,
    zaad: Math.round(begrens(leesGetal(zaad, 1), 1, 99999)),
  });

  let cache = { sleutel: '', puzzel: null, problemen: [] };
  const bereken = () => {
    const w = waarden();
    const sleutel = `${w.ij}|${w.zaad}|${lijstVeld.value}`;
    if (cache.sleutel !== sleutel) {
      const { woorden, problemen } = leesLijst(lijstVeld.value, w.ij);
      cache = { sleutel, puzzel: maakPuzzel(woorden, w.zaad), problemen };
    }
    return { w, puzzel: cache.puzzel, problemen: cache.problemen };
  };

  let gepland = false;
  function teken() {
    gepland = false;
    const { w, puzzel, problemen } = bereken();
    const schaal = devicePixelRatio || 1;
    const vak = doek.getBoundingClientRect();
    doek.width = Math.round(vak.width * schaal);
    doek.height = Math.round(vak.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, vak.width, vak.height);
    if (puzzel && !puzzel.fout) {
      const c = Math.min((vak.width - 12) / puzzel.C, (vak.height - 12) / puzzel.R, 26);
      const ox = (vak.width - puzzel.C * c) / 2;
      const oy = (vak.height - puzzel.R * c) / 2;
      for (let r = 0; r < puzzel.R; r++) {
        for (let k = 0; k < puzzel.C; k++) {
          const v = puzzel.raster[r][k];
          const x = ox + k * c;
          const y = oy + r * c;
          if (!v) {
            if (w.leeg === 'zwart') {
              g.fillStyle = '#16171b';
              g.fillRect(x, y, c, c);
            }
            continue;
          }
          g.fillStyle = '#ffffff';
          g.fillRect(x, y, c, c);
          g.strokeStyle = '#2a2a2a';
          g.lineWidth = 0.8;
          g.strokeRect(x + 0.4, y + 0.4, c - 0.8, c - 0.8);
          const n = puzzel.nummers.get(sleutelVan(r, k));
          if (n && c >= 9) {
            g.fillStyle = '#333';
            g.font = `600 ${Math.max(5, c * 0.3)}px Inter, system-ui, sans-serif`;
            g.textAlign = 'left';
            g.textBaseline = 'top';
            g.fillText(String(n), x + 1.5, y + 1);
          }
          if (toonOplossing.vak.checked) {
            g.fillStyle = '#c0392b';
            g.font = `500 ${c * 0.52}px Inter, system-ui, sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(v, x + c / 2, y + c * 0.58);
          }
        }
      }
    }
    let tekst;
    let fout = false;
    if (doc.alleenLezen) {
      tekst = 'Dit document is alleen-lezen; je kunt hier niets aan toevoegen.';
      fout = true;
    } else if (puzzel.fout) {
      tekst = puzzel.fout;
      fout = true;
    } else {
      const mm = (n) => getal(n * w.celmaat);
      tekst = `${puzzel.geplaatst} woorden in ${puzzel.C} × ${puzzel.R} vakjes (${mm(puzzel.C)} × ${mm(puzzel.R)} mm), `
        + `${puzzel.horizontaal.length} horizontaal en ${puzzel.verticaal.length} verticaal.`;
      if (puzzel.mislukt.length) {
        tekst += ` Past niet: ${puzzel.mislukt.map((x) => x.toon).join(', ')}. Probeer een andere indeling of woorden met meer gewone letters.`;
      }
      const h = hoogteVan(puzzel, w, doc.tekengebied, titel.value.trim());
      if (h > doc.tekengebied.h) tekst += ' Let op: hij is hoger dan het tekengebied; kies kleinere vakjes.';
      if (puzzel.C * vexel.mm(w.celmaat) > doc.tekengebied.b) tekst += ' Let op: hij is breder dan het tekengebied; kies kleinere vakjes.';
    }
    if (problemen.length) tekst += ` Overgeslagen: ${problemen.join(', ')}.`;
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', fout || Boolean(puzzel.mislukt && puzzel.mislukt.length));
    maakKnop.disabled = fout;
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  variant.addEventListener('click', () => {
    zaad.value = String(1 + Math.floor(Math.random() * 99999));
    plan();
  });
  let klok = 0;
  formulier.addEventListener('input', (e) => {
    // de woordenlijst pas na een korte pauze in het typen opnieuw rekenen
    if (e.target === lijstVeld) {
      clearTimeout(klok);
      klok = setTimeout(plan, 250);
    } else plan();
  });
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const { w, puzzel } = bereken();
    if (puzzel.fout) return vexel.melding(puzzel.fout, 'let');
    const opmaak = {
      tekst: cmyk ? { cmyk: [0, 0, 0, 100] } : { hex: '#1a1a1a' },
      lijn: cmyk ? { cmyk: [0, 0, 0, 100] } : { hex: '#1a1a1a' },
      wit: cmyk ? { cmyk: [0, 0, 0, 0] } : { hex: '#ffffff' },
      zwart: cmyk ? { cmyk: [0, 0, 0, 100] } : { hex: '#1a1a1a' },
      oplossing: cmyk ? { cmyk: [0, 90, 85, 0] } : { hex: '#d0352a' },
    };
    maakKnop.disabled = true;
    try {
      await vexel.maak([puzzelVormen(puzzel, w, opmaak, doc.tekengebied, titel.value.trim())]);
      await vexel.bewaar('instellingen', w);
      let melding = `Kruiswoordpuzzel gemaakt met ${puzzel.geplaatst} woorden. De oplossing staat verborgen in de groep Oplossing.`;
      if (puzzel.mislukt.length) melding += ` Niet geplaatst: ${puzzel.mislukt.map((m) => m.toon).join(', ')}.`;
      vexel.melding(melding, puzzel.mislukt.length ? 'let' : 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De puzzel kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  lijstVeld.focus();
}

vexel.opCommando('maken', toonVenster);
