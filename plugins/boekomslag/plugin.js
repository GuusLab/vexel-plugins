// Boekomslag: de complete indeling van een boekomslag, met de rugdikte uit papier en pagina's.
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
// ---- gegevens ---------------------------------------------------------------------

const FORMATEN = {
  a5: { naam: 'A5 · 148 × 210', b: 148, h: 210 },
  roman: { naam: 'Roman · 135 × 215', b: 135, h: 215 },
  pocket: { naam: 'Pocket · 125 × 190', b: 125, h: 190 },
  '155x235': { naam: '155 × 235', b: 155, h: 235 },
  '170x240': { naam: '170 × 240', b: 170, h: 240 },
  b5: { naam: 'B5 · 176 × 250', b: 176, h: 250 },
  a4: { naam: 'A4 · 210 × 297', b: 210, h: 297 },
  vierkant: { naam: 'Vierkant · 210 × 210', b: 210, h: 210 },
  eigen: { naam: 'Eigen maat', b: 0, h: 0 },
};

// Volume: dikte in µm per g/m². Een vel (2 pagina's) is gewicht × volume µm dik.
const PAPIER = {
  hv: { naam: 'Houtvrij offset (vol. 1,25)', volume: 1.25 },
  mat: { naam: 'Mat gestreken (vol. 1,0)', volume: 1.0 },
  silk: { naam: 'Silk (vol. 0,95)', volume: 0.95 },
  glans: { naam: 'Glans gestreken (vol. 0,85)', volume: 0.85 },
  roman15: { naam: 'Romandruk (vol. 1,5)', volume: 1.5 },
  roman18: { naam: 'Romandruk (vol. 1,8)', volume: 1.8 },
  roman20: { naam: 'Romandruk (vol. 2,0)', volume: 2.0 },
  eigen: { naam: 'Eigen dikte per vel', volume: 0 },
};
const GEWICHTEN = [80, 90, 100, 115, 135, 170];

const BINDWIJZEN = {
  garenloos: { naam: 'Garenloos gebrocheerd', correctie: 0.5, gebonden: false },
  genaaidB: { naam: 'Genaaid gebrocheerd', correctie: 1.0, gebonden: false },
  genaaid: { naam: 'Genaaid gebonden (harde kaft)', correctie: 1.0, gebonden: true },
  garenloosG: { naam: 'Garenloos gebonden (harde kaft)', correctie: 0.5, gebonden: true },
};

// Hulplijnen in eigen steunkleuren die overdrukken: de drukker zet ze in één keer uit.
const STEUN = {
  snij: { steunkleur: { naam: 'Snijlijn', cmyk: [0, 100, 0, 0] } },
  ril: { steunkleur: { naam: 'Rillijn', cmyk: [100, 0, 0, 0] } },
  hulp: { steunkleur: { naam: 'Hulplijnen', cmyk: [0, 50, 100, 0] } },
};

// ---- de rekensom (mm) ----------------------------------------------------------------

/** Rekent rug, panelen en totale maat uit. Alle maten in mm. */
function bereken(w) {
  const binding = BINDWIJZEN[w.binding];
  const paginas = w.paginas + (w.paginas % 2);
  const vellen = paginas / 2;
  const diktePerVel = w.papier === 'eigen' ? w.eigenDikte : w.gewicht * PAPIER[w.papier].volume; // µm
  const blok = vellen * diktePerVel / 1000;
  const blokGecorrigeerd = blok + w.correctie;
  const r = {
    paginas, vellen, diktePerVel, blok, gebonden: binding.gebonden, binding,
    meldingen: [],
  };
  if (w.paginas % 2) r.meldingen.push(`Een boek heeft een even aantal pagina's; er is gerekend met ${paginas}.`);
  if (w.binding.startsWith('genaaid') && paginas % 16) {
    const op = Math.ceil(paginas / 16) * 16;
    r.meldingen.push(`Genaaid gaat in katernen, meestal van 16 pagina's: ${op} is een veilig aantal (vraag je drukker).`);
  }
  if (!binding.gebonden) {
    r.rug = w.rugZelf ? w.rugMaat : blokGecorrigeerd;
    if (r.rug < 3) r.meldingen.push('Met een rug onder 3 mm is garenloos of genaaid gebrocheerd lastig; overweeg nieten.');
    r.flap = w.flappen ? w.flapBreedte : 0;
    // van links naar rechts: flap, achterkant, rug, voorkant, flap
    r.panelen = [];
    if (r.flap) r.panelen.push({ id: 'flapA', naam: 'Flap achter', b: r.flap });
    r.panelen.push({ id: 'achter', naam: 'Achterkant', b: w.breedte });
    r.panelen.push({ id: 'rug', naam: 'Rug', b: r.rug });
    r.panelen.push({ id: 'voor', naam: 'Voorkant', b: w.breedte });
    if (r.flap) r.panelen.push({ id: 'flapV', naam: 'Flap voor', b: r.flap });
    r.b = r.panelen.reduce((s, p) => s + p.b, 0);
    r.h = w.hoogte;
    r.afloop = w.afloop;
  } else {
    // harde kaft: het overtrek met inslag, twee borden, twee groeven en het rugbord
    r.rugbord = w.rugZelf ? w.rugMaat : blokGecorrigeerd + 2 * w.bordikte;
    r.bordB = w.breedte + w.uitsteek - (w.groef - w.bordikte);
    r.bordH = w.hoogte + 2 * w.uitsteek;
    r.rug = r.rugbord;
    r.panelen = [
      { id: 'inslagA', naam: 'Inslag', b: w.inslag },
      { id: 'achter', naam: 'Achterkant', b: r.bordB },
      { id: 'groefA', naam: 'Groef', b: w.groef },
      { id: 'rug', naam: 'Rug', b: r.rugbord },
      { id: 'groefV', naam: 'Groef', b: w.groef },
      { id: 'voor', naam: 'Voorkant', b: r.bordB },
      { id: 'inslagV', naam: 'Inslag', b: w.inslag },
    ];
    r.b = r.panelen.reduce((s, p) => s + p.b, 0);
    r.h = r.bordH + 2 * w.inslag;
    r.afloop = 0;
    if (r.bordB < 20) r.meldingen.push('De borden worden erg smal; kijk de groef en de uitsteek na.');
  }
  let x = 0;
  for (const p of r.panelen) { p.x = x; x += p.b; }
  r.rugBlok = blokGecorrigeerd;
  return r;
}

/** Waar de omslag op het tekengebied komt (mm): linksboven als het tekengebied precies past, anders in het midden. */
function plaats(r, doc) {
  const tb = doc.tekengebied.b / PT;
  const th = doc.tekengebied.h / PT;
  const past = Math.abs(tb - r.b) < 0.6 && Math.abs(th - r.h) < 0.6;
  return { tb, th, past, x: past ? 0 : (tb - r.b) / 2, y: past ? 0 : (th - r.h) / 2 };
}

// ---- de vormen (pt) ---------------------------------------------------------------------

function bouwVormen(w, r, pl, cmyk) {
  const x0 = pl.x * PT;
  const y0 = pl.y * PT;
  const B = r.b * PT;
  const H = r.h * PT;
  const a = r.afloop * PT;
  const hulp = { lijn: STEUN.hulp, lijndikte: 0.35, overdrukLijn: true, vulling: null };
  const ril = { lijn: STEUN.ril, lijndikte: 0.5, overdrukLijn: true, vulling: null, streep: [4, 2] };
  const snij = { lijn: STEUN.snij, lijndikte: 0.5, overdrukLijn: true, vulling: null };
  const hulpTekst = (naam, x, y, inhoud, grootte, uitlijning = 'midden', extra = {}) =>
    ({ soort: 'tekst', naam, x: rond(x), y: rond(y), inhoud, grootte, uitlijning, vulling: STEUN.hulp, overdrukVulling: true, ...extra });
  const paneel = (id) => r.panelen.find((p) => p.id === id);
  const px = (p) => x0 + p.x * PT;
  const uit = [];

  // snijlijn (de buitenrand van het eindproduct of het overtrek)
  const snijKinderen = [{ soort: 'rechthoek', naam: r.gebonden ? 'Rand overtrek' : 'Snijlijn', x: x0, y: y0, b: B, h: H, ...snij }];
  if (r.gebonden) {
    // hoeken van het overtrek schuin afsnijden, 1,5 × de bordikte van de bordhoek
    const i = w.inslag * PT;
    const k = 1.5 * w.bordikte * PT * Math.SQRT2;
    const hoeken = [];
    for (const [hx, sx] of [[x0, 1], [x0 + B, -1]]) {
      for (const [hy, sy] of [[y0, 1], [y0 + H, -1]]) {
        const d = 2 * i - k;
        hoeken.push(lijnStuk(rond(hx + sx * d), rond(hy), rond(hx), rond(hy + sy * d)));
      }
    }
    snijKinderen.push({ soort: 'pad', naam: 'Hoeken afsnijden', subpaden: hoeken, ...snij });
  }
  uit.push({ soort: 'groep', naam: 'Snijlijn', kinderen: snijKinderen });

  // rillijnen en vouwlijnen
  const rillen = [];
  const yR0 = y0 - a;
  const yR1 = y0 + H + a;
  if (!r.gebonden) {
    for (const p of r.panelen.slice(1)) rillen.push(lijnStuk(rond(px(p)), rond(yR0), rond(px(p)), rond(yR1)));
    if (w.scharnier > 0) {
      const rug = paneel('rug');
      for (const xs of [px(rug) - w.scharnier * PT, px(rug) + (rug.b + w.scharnier) * PT]) rillen.push(lijnStuk(rond(xs), rond(yR0), rond(xs), rond(yR1)));
    }
  } else {
    const i = w.inslag * PT;
    // waar de inslag om het bord vouwt
    rillen.push(lijnStuk(rond(x0 + i), rond(y0), rond(x0 + i), rond(y0 + H)), lijnStuk(rond(x0 + B - i), rond(y0), rond(x0 + B - i), rond(y0 + H)));
    rillen.push(lijnStuk(rond(x0), rond(y0 + i), rond(x0 + B), rond(y0 + i)), lijnStuk(rond(x0), rond(y0 + H - i), rond(x0 + B), rond(y0 + H - i)));
  }
  uit.push({ soort: 'pad', naam: r.gebonden ? 'Vouwlijnen inslag' : 'Rillijnen en vouwlijnen', subpaden: rillen, ...ril });

  // borden (harde kaft)
  if (r.gebonden) {
    const i = w.inslag * PT;
    const borden = ['achter', 'rug', 'voor'].map((id) => rechthoekPunten(rond(px(paneel(id))), rond(y0 + i), rond(paneel(id).b * PT), rond(r.bordH * PT)));
    uit.push({ soort: 'pad', naam: 'Borden en groeven', subpaden: borden, ...hulp, lijndikte: 0.5 });
  }

  // hulplijnen: afloop, veilige zone, rug
  const hulpKinderen = [];
  if (a > 0) hulpKinderen.push({ soort: 'rechthoek', naam: `Afloop ${mmTekst(r.afloop)} mm`, x: x0 - a, y: y0 - a, b: B + 2 * a, h: H + 2 * a, ...hulp, streep: [1.5, 1.5] });
  const m = w.marge * PT;
  const veilig = [];
  const binnenY = r.gebonden ? y0 + (w.inslag + w.uitsteek) * PT : y0;
  const binnenH = r.gebonden ? w.hoogte * PT : H;
  for (const p of r.panelen) {
    if (p.id.startsWith('inslag') || p.id.startsWith('groef')) continue;
    const zij = p.id === 'rug' ? Math.min(m, Math.max(0, (p.b * PT - 2) / 2), 1.5 * PT) : m;
    const vb = p.b * PT - 2 * zij;
    if (vb > 1 && binnenH - 2 * m > 1) veilig.push(rechthoekPunten(rond(px(p) + zij), rond(binnenY + m), rond(vb), rond(binnenH - 2 * m)));
  }
  if (veilig.length) hulpKinderen.push({ soort: 'pad', naam: `Veilige zone ${mmTekst(w.marge)} mm`, subpaden: veilig, ...hulp, streep: [3, 2] });
  const rug = paneel('rug');
  const rugMidden = px(rug) + rug.b * PT / 2;
  hulpKinderen.push({ soort: 'pad', naam: 'Rug: middenlijn', subpaden: [lijnStuk(rond(rugMidden), rond(y0 - a), rond(rugMidden), rond(y0 + H + a))], ...hulp, streep: [6, 2, 1, 2] });
  // labels per paneel
  const labelG = 7;
  for (const p of r.panelen) {
    if (p.id === 'rug' || p.id.startsWith('groef')) continue;
    const midX = px(p) + p.b * PT / 2;
    if (p.id.startsWith('inslag')) continue;
    const maat = r.gebonden ? `bord ${mmTekst(p.b)} × ${mmTekst(r.bordH)} mm` : `${mmTekst(p.b)} × ${mmTekst(r.h)} mm`;
    hulpKinderen.push(hulpTekst(`Label ${p.naam}`, midX, binnenY + binnenH / 2, `${p.naam.toUpperCase()}\n${maat}`, labelG, 'midden',
      { gewicht: 600, letterafstand: 60, regelafstand: labelG * 1.5 }));
  }
  uit.push({ soort: 'groep', naam: 'Hulplijnen', kinderen: hulpKinderen });

  // rugtekst: een voorbeeldtekst die je zelf vervangt
  if (w.rugtekst !== 'geen') {
    const g = rond(Math.min(14, rug.b * PT * 0.55));
    if (g >= 4) {
      const omlaag = w.rugtekst === 'omlaag';
      uit.push({ soort: 'tekst', naam: 'Rugtekst (vervang door je eigen tekst)', x: rond(rugMidden + (omlaag ? -1 : 1) * g * 0.36), y: rond(binnenY + binnenH / 2),
        inhoud: w.rugInhoud || 'Titel · Auteur', grootte: g, gewicht: 600, uitlijning: 'midden', draai: omlaag ? 90 : -90,
        vulling: kleurIn([0, 0, 0, 100], '#1a1a1a', cmyk) });
    }
  }

  // maatvoering boven en links, buiten de afloop
  if (w.maten) {
    const maat = [];
    const teksten = [];
    const yM = y0 - a - 7 * PT;
    const tick = 2 * PT;
    let vorige = null;
    for (const p of r.panelen) {
      const xa = px(p);
      const xb = xa + p.b * PT;
      maat.push(lijnStuk(rond(xa), rond(yM), rond(xb), rond(yM)));
      if (vorige !== xa) maat.push(lijnStuk(rond(xa), rond(yM - tick), rond(xa), rond(yM + tick)));
      maat.push(lijnStuk(rond(xb), rond(yM - tick), rond(xb), rond(yM + tick)));
      vorige = xb;
      const smal = p.b * PT < 30;
      teksten.push(hulpTekst(`Maat ${p.naam}`, (xa + xb) / 2, smal ? yM - 2.6 * PT - (p.id === 'rug' ? 0 : 7) : yM - 1.6 * PT, `${mmTekst(p.b, 2)}`, smal ? 6 : 7));
    }
    const yT = yM - 9 * PT;
    maat.push(lijnStuk(rond(x0), rond(yT), rond(x0 + B), rond(yT)));
    maat.push(lijnStuk(rond(x0), rond(yT - tick), rond(x0), rond(yT + tick)), lijnStuk(rond(x0 + B), rond(yT - tick), rond(x0 + B), rond(yT + tick)));
    teksten.push(hulpTekst('Maat totaal', x0 + B / 2, yT - 1.6 * PT, `${mmTekst(r.b, 2)} mm${r.afloop ? ` (met afloop ${mmTekst(r.b + 2 * r.afloop, 2)} mm)` : ''}`, 7, 'midden', { gewicht: 600 }));
    const xH = x0 - a - 7 * PT;
    maat.push(lijnStuk(rond(xH), rond(y0), rond(xH), rond(y0 + H)));
    maat.push(lijnStuk(rond(xH - tick), rond(y0), rond(xH + tick), rond(y0)), lijnStuk(rond(xH - tick), rond(y0 + H), rond(xH + tick), rond(y0 + H)));
    teksten.push(hulpTekst('Maat hoogte', xH - 1.6 * PT, y0 + H / 2, `${mmTekst(r.h, 2)} mm`, 7, 'midden', { draai: -90, gewicht: 600 }));
    // de berekening onder de omslag
    const regel = berekeningTekst(w, r);
    teksten.push(hulpTekst('Berekening', x0, y0 + H + a + 9 * PT, regel, 7, 'links'));
    uit.push({ soort: 'groep', naam: 'Maatvoering', kinderen: [{ soort: 'pad', naam: 'Maatlijnen', subpaden: maat, ...hulp, lijndikte: 0.3 }, ...teksten] });
  }

  const naam = `Boekomslag ${mmTekst(w.breedte)} × ${mmTekst(w.hoogte)} mm · rug ${mmTekst(r.rug, 2)} mm`;
  return [{ soort: 'groep', naam, kinderen: uit }];
}

function papierTekst(w, r) {
  if (w.papier === 'eigen') return `${mmTekst(r.diktePerVel)} µm per vel`;
  return `${w.gewicht} g/m² ${PAPIER[w.papier].naam.replace(/ \(.*\)/, '').toLowerCase()} (volume ${mmTekst(PAPIER[w.papier].volume, 2)}: ${mmTekst(r.diktePerVel, 1)} µm per vel)`;
}

function berekeningTekst(w, r) {
  const blok = `blok ${r.vellen} vel × ${mmTekst(r.diktePerVel, 1)} µm = ${mmTekst(r.blok, 2)} mm`;
  const corr = `${w.correctie >= 0 ? '+' : '−'} ${mmTekst(Math.abs(w.correctie), 2)} mm ${r.binding.naam.toLowerCase().replace(/ \(.*\)/, '')}`;
  let rug;
  if (w.rugZelf) rug = `rug zelf ingevuld: ${mmTekst(r.rug, 2)} mm`;
  else if (r.gebonden) rug = `rug = ${mmTekst(r.blok, 2)} ${corr} + 2 × ${mmTekst(w.bordikte, 2)} mm bord = ${mmTekst(r.rug, 2)} mm`;
  else rug = `rug = ${mmTekst(r.blok, 2)} ${corr} = ${mmTekst(r.rug, 2)} mm`;
  return `${r.paginas} pagina's · ${papierTekst(w, r)} · ${blok} · ${rug}`;
}

// ---- het venster ----------------------------------------------------------------------------

const STANDAARD = {
  formaat: 'a5', breedte: 148, hoogte: 210, paginas: 200, binding: 'garenloos', correctie: 0.5, papier: 'hv', gewicht: 90, eigenDikte: 110,
  rugZelf: false, rugMaat: 12, flappen: false, flapBreedte: 90, afloop: 3, marge: 5, scharnier: 0, bordikte: 2, uitsteek: 3, groef: 7, inslag: 15,
  rugtekst: 'omlaag', rugInhoud: 'Titel · Auteur', maten: true,
};

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const docAfloop = doc.afloop ? rond(Math.max(doc.afloop.boven, doc.afloop.links) / PT, 10) : 3;
  const w0 = { ...STANDAARD, afloop: docAfloop || STANDAARD.afloop, ...((await vexel.haal('instellingen')) || {}) };

  const v = {
    formaat: keuze(Object.fromEntries(Object.entries(FORMATEN).map(([k, f]) => [k, f.naam])), w0.formaat),
    breedte: getalVeld(w0.breedte, 30, 1000, 0.5),
    hoogte: getalVeld(w0.hoogte, 30, 1000, 0.5),
    paginas: getalVeld(w0.paginas, 4, 2000, 2),
    binding: keuze(Object.fromEntries(Object.entries(BINDWIJZEN).map(([k, b]) => [k, b.naam])), w0.binding),
    correctie: getalVeld(w0.correctie, -5, 10, 0.1),
    papier: keuze(Object.fromEntries(Object.entries(PAPIER).map(([k, p]) => [k, p.naam])), w0.papier),
    gewicht: keuze(Object.fromEntries(GEWICHTEN.map((g) => [g, `${g} g/m²`])), String(w0.gewicht)),
    eigenDikte: getalVeld(w0.eigenDikte, 20, 1000, 1),
    rugMaat: getalVeld(w0.rugMaat, 0.5, 200, 0.1),
    flapBreedte: getalVeld(w0.flapBreedte, 20, 400, 1),
    afloop: getalVeld(w0.afloop, 0, 20, 0.5),
    marge: getalVeld(w0.marge, 0, 40, 0.5),
    scharnier: getalVeld(w0.scharnier, 0, 20, 0.5),
    bordikte: getalVeld(w0.bordikte, 0.5, 6, 0.1),
    uitsteek: getalVeld(w0.uitsteek, 0, 10, 0.5),
    groef: getalVeld(w0.groef, 2, 20, 0.5),
    inslag: getalVeld(w0.inslag, 5, 40, 0.5),
    rugtekst: keuze({ omlaag: 'Van boven naar beneden', omhoog: 'Van onder naar boven', geen: 'Geen rugtekst' }, w0.rugtekst),
    rugInhoud: tekstVeld(w0.rugInhoud, 'Titel · Auteur', 80),
  };
  const vink = { rugZelf: vinkje('Rugdikte zelf invullen', w0.rugZelf), flappen: vinkje('Flappen', w0.flappen), maten: vinkje('Maatvoering en berekening', w0.maten) };
  const vakken = {
    eigenDikte: vak('Dikte per vel', v.eigenDikte, 'µm'), gewicht: vak('Gewicht', v.gewicht),
    rugMaat: vak('Rug', v.rugMaat, 'mm'), flapBreedte: vak('Flapbreedte', v.flapBreedte, 'mm'),
  };
  const zacht = kolom('1fr 1fr 1fr 1fr', vak('Afloop', v.afloop, 'mm'), vak('Veilige marge', v.marge, 'mm'), vak('Scharnierril', v.scharnier, 'mm'),
    el('div', { stijl: { paddingBottom: '5px' } }, vink.flappen.label));
  const flapRij = kolom('1fr 3fr', vakken.flapBreedte, el('span', { klasse: 'uitleg', tekst: 'De flap vouwt precies op de rand van voor- en achterkant.', stijl: { paddingBottom: '5px' } }));
  const hard = kolom(4, vak('Bordikte', v.bordikte, 'mm'), vak('Uitsteek', v.uitsteek, 'mm'), vak('Groef', v.groef, 'mm'), vak('Inslag', v.inslag, 'mm'));

  const voorbeeld = el('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '140px' } });
  const rugRegel = el('div', { stijl: { fontSize: '13px', fontWeight: '600', color: 'var(--tekst)' } });
  const samenvatting = el('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = el('button', { klasse: 'knop primair', type: 'submit', tekst: 'Omslag maken' });
  const annuleer = el('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = el('form', { stijl: { display: 'grid', gap: '8px' } },
    kop('Boek'),
    kolom('1.5fr 1fr 1fr', vak('Formaat', v.formaat), vak('Breedte', v.breedte, 'mm'), vak('Hoogte', v.hoogte, 'mm')),
    kolom('0.8fr 1.8fr 0.8fr', vak("Pagina's", v.paginas), vak('Bindwijze', v.binding), vak('Correctie', v.correctie, 'mm')),
    kop('Papier binnenwerk'),
    kolom('1.8fr 1fr', vak('Soort', v.papier), el('div', {}, vakken.gewicht, vakken.eigenDikte)),
    kolom('1fr 1fr', el('div', { stijl: { paddingBottom: '5px' } }, vink.rugZelf.label), vakken.rugMaat),
    kop('Omslag'),
    zacht,
    flapRij,
    hard,
    kolom('1fr 1fr', vak('Rugtekst', v.rugtekst), vak('Tekst op de rug', v.rugInhoud)),
    vink.maten.label,
    el('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    rugRegel,
    samenvatting,
    el('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    formaat: v.formaat.value,
    breedte: begrens(leesGetal(v.breedte, 148), 30, 1000),
    hoogte: begrens(leesGetal(v.hoogte, 210), 30, 1000),
    paginas: Math.round(begrens(leesGetal(v.paginas, 200), 4, 2000)),
    binding: v.binding.value,
    correctie: begrens(leesGetal(v.correctie, 0.5), -5, 10),
    papier: v.papier.value,
    gewicht: Number(v.gewicht.value) || 90,
    eigenDikte: begrens(leesGetal(v.eigenDikte, 110), 20, 1000),
    rugZelf: vink.rugZelf.invoer.checked,
    rugMaat: begrens(leesGetal(v.rugMaat, 12), 0.5, 200),
    flappen: vink.flappen.invoer.checked,
    flapBreedte: begrens(leesGetal(v.flapBreedte, 90), 20, 400),
    afloop: begrens(leesGetal(v.afloop, 3), 0, 20),
    marge: begrens(leesGetal(v.marge, 5), 0, 40),
    scharnier: begrens(leesGetal(v.scharnier, 0), 0, 20),
    bordikte: begrens(leesGetal(v.bordikte, 2), 0.5, 6),
    uitsteek: begrens(leesGetal(v.uitsteek, 3), 0, 10),
    groef: begrens(leesGetal(v.groef, 7), 2, 20),
    inslag: begrens(leesGetal(v.inslag, 15), 5, 40),
    rugtekst: v.rugtekst.value,
    rugInhoud: v.rugInhoud.value.trim().slice(0, 80),
    maten: vink.maten.invoer.checked,
  });

  const weergave = new Map();
  const toon = (vakje, aan) => {
    if (!weergave.has(vakje)) weergave.set(vakje, vakje.style.display);
    vakje.style.display = aan ? weergave.get(vakje) : 'none';
  };
  const dim = (vakje, aan) => {
    vakje.style.opacity = aan ? '1' : '0.45';
    vakje.querySelectorAll('input, select').forEach((x) => { x.disabled = !aan; });
  };

  function teken() {
    const w = waarden();
    const r = bereken(w);
    const pl = plaats(r, doc);
    toon(vakken.gewicht, w.papier !== 'eigen');
    toon(vakken.eigenDikte, w.papier === 'eigen');
    dim(vakken.rugMaat, w.rugZelf);
    toon(zacht, !r.gebonden);
    toon(flapRij, !r.gebonden && w.flappen);
    toon(hard, r.gebonden);
    dim(v.rugInhoud.parentElement, w.rugtekst !== 'geen');
    if (!w.rugZelf) v.rugMaat.value = rond(r.rug, 100);

    rugRegel.textContent = `Rug ${mmTekst(r.rug, 2)} mm · omslag ${mmTekst(r.b, 2)} × ${mmTekst(r.h, 2)} mm`
      + (r.afloop ? ` + ${mmTekst(r.afloop)} mm afloop` : ' (overtrek)');
    let tekst = berekeningTekst(w, r) + '.';
    if (r.gebonden) tekst += ` Borden ${mmTekst(r.bordB, 2)} × ${mmTekst(r.bordH, 2)} mm.`;
    tekst += pl.past ? ' Past precies op het tekengebied.'
      : ` Tip: zet het tekengebied op ${mmTekst(r.b, 2)} × ${mmTekst(r.h, 2)} mm${r.afloop ? ` met ${mmTekst(r.afloop)} mm afloop` : ''}; nu komt de omslag in het midden.`;
    if (r.meldingen.length) tekst += ` ${r.meldingen.join(' ')}`;
    let fout = null;
    if (doc.alleenLezen) fout = 'Dit document is alleen-lezen; je kunt hier geen omslag maken.';
    samenvatting.textContent = fout || tekst;
    samenvatting.classList.toggle('fout', Boolean(fout));
    maakKnop.disabled = Boolean(fout);
    tekenVoorbeeld(w, r);
  }

  function tekenVoorbeeld(w, r) {
    const { g, b, h } = canvasKlaar(voorbeeld);
    const a = r.afloop;
    const s = Math.min((b - 16) / (r.b + 2 * a), (h - 16) / (r.h + 2 * a));
    const ox = (b - r.b * s) / 2;
    const oy = (h - r.h * s) / 2;
    if (a) {
      g.fillStyle = '#f3d9c2';
      g.fillRect(ox - a * s, oy - a * s, (r.b + 2 * a) * s, (r.h + 2 * a) * s);
    }
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, r.b * s, r.h * s);
    const kleuren = { achter: '#e9f1fb', voor: '#e9f1fb', rug: '#cfe0f6', flapA: '#f4f6f8', flapV: '#f4f6f8', inslagA: '#f6efe6', inslagV: '#f6efe6', groefA: '#fff', groefV: '#fff' };
    const binnenY = r.gebonden ? oy + w.inslag * s : oy;
    const binnenH = r.gebonden ? r.bordH * s : r.h * s;
    for (const p of r.panelen) {
      g.fillStyle = kleuren[p.id];
      g.fillRect(ox + p.x * s, binnenY, p.b * s, binnenH);
    }
    g.strokeStyle = '#2b9be6';
    g.setLineDash([4, 2]);
    g.lineWidth = 1;
    for (const p of r.panelen.slice(1)) {
      g.beginPath();
      g.moveTo(ox + p.x * s + 0.5, oy - a * s);
      g.lineTo(ox + p.x * s + 0.5, oy + (r.h + a) * s);
      g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = '#e0198c';
    g.strokeRect(ox + 0.5, oy + 0.5, r.b * s - 1, r.h * s - 1);
    g.fillStyle = '#4a5568';
    g.font = '600 9px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of r.panelen) {
      if (p.b * s < 30 || p.id.startsWith('inslag')) continue;
      g.fillText(p.naam, ox + (p.x + p.b / 2) * s, binnenY + binnenH / 2 - 6);
      g.font = '9px system-ui, sans-serif';
      g.fillText(`${mmTekst(p.b, 1)} mm`, ox + (p.x + p.b / 2) * s, binnenY + binnenH / 2 + 7);
      g.font = '600 9px system-ui, sans-serif';
    }
    const rug = r.panelen.find((p) => p.id === 'rug');
    if (w.rugtekst !== 'geen' && rug.b * s > 6) {
      g.save();
      g.translate(ox + (rug.x + rug.b / 2) * s, binnenY + binnenH / 2);
      g.rotate(w.rugtekst === 'omlaag' ? Math.PI / 2 : -Math.PI / 2);
      g.fillStyle = '#1a1a1a';
      g.font = `600 ${Math.min(9, rug.b * s * 0.6)}px system-ui, sans-serif`;
      g.fillText(w.rugInhoud || 'Titel · Auteur', 0, 0);
      g.restore();
    }
  }

  formulier.addEventListener('input', (e) => {
    if (e.target === v.formaat) {
      const f = FORMATEN[v.formaat.value];
      if (f && f.b) { v.breedte.value = f.b; v.hoogte.value = f.h; }
    } else if (e.target === v.breedte || e.target === v.hoogte) {
      v.formaat.value = 'eigen';
    } else if (e.target === v.binding) {
      v.correctie.value = BINDWIJZEN[v.binding.value].correctie;
    }
    teken();
  });
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const w = waarden();
    const r = bereken(w);
    const pl = plaats(r, doc);
    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(w, r, pl, cmyk));
      await vexel.bewaar('instellingen', w);
      let melding = `Boekomslag gemaakt: rug ${mmTekst(r.rug, 2)} mm, omslag ${mmTekst(r.b, 2)} × ${mmTekst(r.h, 2)} mm.`;
      if (!pl.past) melding += ` Zet het tekengebied op ${mmTekst(r.b, 2)} × ${mmTekst(r.h, 2)} mm en schuif de groep naar linksboven.`;
      vexel.melding(melding, pl.past ? 'ok' : 'info');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De omslag kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  v.paginas.focus();
}

vexel.opCommando('maken', toonVenster);
