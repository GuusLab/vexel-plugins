// Envelop-ontwerp: stansvorm voor een papieren envelop met sluitklep, zijkleppen en onderklep.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

// Afgewerkte envelopmaten (korte × lange zijde, mm).
const FORMATEN = {
  c6: { naam: 'C6 · 114 × 162 mm', kort: 114, lang: 162 },
  c5: { naam: 'C5 · 162 × 229 mm', kort: 162, lang: 229 },
  c4: { naam: 'C4 · 229 × 324 mm', kort: 229, lang: 324 },
  dl: { naam: 'DL · 110 × 220 mm', kort: 110, lang: 220 },
  vierkant: { naam: 'Vierkant · 160 × 160 mm', kort: 160, lang: 160 },
  eigen: { naam: 'Eigen maat' },
};

const STANDAARD = {
  formaat: 'c6', breedte: 162, hoogte: 114, klepzijde: 'lang', klepvorm: 'recht',
  automatisch: true, sluitklep: 48, zijklep: 19.5, onderklep: 75, afronding: 3, panelen: true,
};

const PT = vexel.mm(1);

// ---- kleine hulpjes --------------------------------------------------------

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

const getalVeld = (id, waarde, min, max, stap) =>
  maak('input', { klasse: 'veld', id, type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });

function veldMetLabel(tekst, veld, eenheid) {
  veld.style.width = '100%';
  veld.style.minWidth = '0';
  const kop = maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0', whiteSpace: 'nowrap' } });
  if (eenheid) kop.append(maak('span', { tekst: ` (${eenheid})`, stijl: { opacity: '0.7' } }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, kop, veld);
}

const keuzeLijst = (id, opties, waarde) => {
  const el = maak('select', { klasse: 'veld', id },
    ...Object.entries(opties).map(([w, t]) => maak('option', { value: w, tekst: t })));
  el.value = opties[waarde] ? waarde : Object.keys(opties)[0];
  return el;
};

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const mmTekst = (n) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

// ---- afgeronde hoeken --------------------------------------------------------

/**
 * Zet een lijst hoekpunten { x, y, r } om in padpunten met bezierhandvatten.
 * Een hoek met r > 0 wordt een cirkelboog; r wordt zo nodig kleiner gemaakt
 * zodat twee bogen op één zijde elkaar nooit overlappen.
 */
function rondHoeken(punten, gesloten = true) {
  const n = punten.length;
  const uit = [];
  for (let i = 0; i < n; i++) {
    const p = punten[i];
    const r = p.r || 0;
    const rand = !gesloten && (i === 0 || i === n - 1);
    if (!(r > 0) || rand) {
      uit.push({ x: p.x, y: p.y });
      continue;
    }
    const a = punten[(i - 1 + n) % n];
    const b = punten[(i + 1) % n];
    const l1 = Math.hypot(a.x - p.x, a.y - p.y);
    const l2 = Math.hypot(b.x - p.x, b.y - p.y);
    if (l1 < 1e-6 || l2 < 1e-6) {
      uit.push({ x: p.x, y: p.y });
      continue;
    }
    const v1 = { x: (a.x - p.x) / l1, y: (a.y - p.y) / l1 };
    const v2 = { x: (b.x - p.x) / l2, y: (b.y - p.y) / l2 };
    const hoek = Math.acos(begrens(v1.x * v2.x + v1.y * v2.y, -1, 1));
    if (hoek < 1e-3 || Math.PI - hoek < 1e-3) {
      uit.push({ x: p.x, y: p.y });
      continue;
    }
    const t = Math.tan(hoek / 2);
    const d = Math.min(r / t, l1 / 2, l2 / 2);
    const straal = d * t;
    const h = (4 / 3) * Math.tan((Math.PI - hoek) / 4) * straal;
    const p1 = { x: p.x + v1.x * d, y: p.y + v1.y * d };
    const p2 = { x: p.x + v2.x * d, y: p.y + v2.y * d };
    uit.push({ x: p1.x, y: p1.y, uit: { x: p1.x - v1.x * h, y: p1.y - v1.y * h } });
    uit.push({ x: p2.x, y: p2.y, in: { x: p2.x - v2.x * h, y: p2.y - v2.y * h } });
  }
  return uit;
}


// ---- de uitslag (alles in mm, y omlaag) ---------------------------------------

const halve = (n) => Math.round(n * 2) / 2;

/** De maat van het middenpaneel: w is de zijde waar de sluitklep aan zit. */
function paneelMaat(w) {
  const f = FORMATEN[w.formaat] || FORMATEN.c6;
  const lang = f.lang || Math.max(w.lang, w.kort);
  const kort = f.kort || Math.min(w.lang, w.kort);
  return w.klepzijde === 'kort' ? { b: kort, h: lang } : { b: lang, h: kort };
}

/** Voorgestelde klepmaten voor een middenpaneel van b × h mm. */
function automatischeKleppen(b, h, klepvorm) {
  const puntig = klepvorm === 'puntig';
  const sluitklep = halve(Math.min(h * (puntig ? 0.5 : 0.42), b * (puntig ? 0.45 : 0.35)));
  return {
    sluitklep,
    // De onderklep reikt tot 12 mm onder de rand van de sluitklep: genoeg plakrand.
    onderklep: halve(Math.min(h - 2, Math.max(h * 0.3, h - sluitklep + 12))),
    zijklep: halve(Math.max(8, Math.min(b * 0.12, h * 0.25, 25))),
  };
}

/**
 * Rekent de uitslag uit. Het middenpaneel (de voorkant) is precies de
 * envelopmaat, van rillijn tot rillijn. Bovenaan zit de sluitklep, links en
 * rechts de zijkleppen en onderaan de onderklep, die over de zijkleppen valt.
 */
function ontwerp(w) {
  const { b, h } = paneelMaat(w);
  const k = w.automatisch ? automatischeKleppen(b, h, w.klepvorm) : w;
  const d = k.sluitklep;
  const u = k.onderklep;
  const z = k.zijklep;
  const r = w.afronding;

  const fouten = [];
  if (d >= h) fouten.push(`De sluitklep is te diep: maak hem minder dan ${mmTekst(h)} mm (de hoogte van de envelop).`);
  if (u >= h) fouten.push(`De onderklep is te hoog: maak hem minder dan ${mmTekst(h)} mm.`);
  if (2 * z >= b - 4) fouten.push(`De zijkleppen zijn te breed: samen moeten ze smaller zijn dan ${mmTekst(b - 4)} mm.`);
  const overlap = d + u - h;

  // Buitencontour, met de klok mee vanaf de linkerbovenhoek van het middenpaneel.
  const sluit = [];
  if (w.klepvorm === 'puntig') {
    const schouder = Math.min(b * 0.08, d * 0.3);
    const rPunt = Math.min(Math.max(r * 3, 6), b * 0.1, d * 0.4);
    sluit.push({ x: 0, y: 0 }, { x: schouder, y: -d * 0.22, r }, { x: b / 2, y: -d, r: rPunt }, { x: b - schouder, y: -d * 0.22, r });
  } else {
    const inzet = Math.min(d * 0.3, b * 0.15);
    sluit.push({ x: 0, y: 0 }, { x: inzet, y: -d, r }, { x: b - inzet, y: -d, r });
  }
  const a = Math.min(z, h * 0.3);
  const c = Math.min(z * 0.7, h * 0.25);
  const zijRechts = [{ x: b, y: 0 }, { x: b + z, y: a, r }, { x: b + z, y: h - c, r }];
  const s = Math.min(u * 0.5, b * 0.22);
  const onder = [{ x: b, y: h }, { x: b - s, y: h + u, r }, { x: s, y: h + u, r }];
  const zijLinks = [{ x: 0, y: h }, { x: -z, y: h - c, r }, { x: -z, y: a, r }];
  const omtrek = [...sluit, ...zijRechts, ...onder, ...zijLinks];

  // Rillijnen: de vier zijden van het middenpaneel.
  const rillen = [
    [{ x: 0, y: 0 }, { x: b, y: 0 }],
    [{ x: b, y: 0 }, { x: b, y: h }],
    [{ x: b, y: h }, { x: 0, y: h }],
    [{ x: 0, y: h }, { x: 0, y: 0 }],
  ];

  const vlakken = [
    { naam: 'Voorkant', label: `Voorkant\n${mmTekst(b)} × ${mmTekst(h)} mm`, punten: [{ x: 0, y: 0 }, { x: b, y: 0 }, { x: b, y: h }, { x: 0, y: h }] },
    { naam: 'Sluitklep', klep: true, label: `Sluitklep\n${mmTekst(d)} mm`, punten: [...sluit, { x: b, y: 0 }] },
    { naam: 'Zijklep', klep: true, label: 'Zijklep', punten: [...zijRechts, { x: b, y: h }] },
    { naam: 'Onderklep', klep: true, label: `Onderklep\n${mmTekst(u)} mm`, punten: [...onder, { x: 0, y: h }] },
    { naam: 'Zijklep', klep: true, label: 'Zijklep', punten: [...zijLinks, { x: 0, y: 0 }] },
  ];

  const xs = omtrek.map((p) => p.x);
  const ys = omtrek.map((p) => p.y);
  const kader = { x: Math.min(...xs), y: Math.min(...ys), b: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return { omtrek, rillen, vlakken, kader, fouten, overlap, maat: { b, h }, kleppen: { sluitklep: d, onderklep: u, zijklep: z } };
}

/** Plaatst de uitslag midden op het tekengebied; draait hem een kwartslag als hij alleen zo past. */
function plaats(uitslag, tekengebied) {
  const tb = tekengebied.b / PT;
  const th = tekengebied.h / PT;
  const k = uitslag.kader;
  const pastRecht = k.b <= tb && k.h <= th;
  const pastGedraaid = k.h <= tb && k.b <= th;
  const draai = !pastRecht && pastGedraaid;
  const bb = draai ? k.h : k.b;
  const bh = draai ? k.b : k.h;
  const ox = (tb - bb) / 2;
  const oy = (th - bh) / 2;
  const f = draai
    ? (p) => ({ x: (ox + (k.y + k.h - p.y)) * PT, y: (oy + (p.x - k.x)) * PT })
    : (p) => ({ x: (ox + p.x - k.x) * PT, y: (oy + p.y - k.y) * PT });
  return { f, draai, past: pastRecht || pastGedraaid, b: bb, h: bh };
}

const zetOm = (punten, f) => punten.map((p) => ({ ...f(p), r: p.r ? p.r * PT : 0 }));


// ---- de vormen voor Vexel -------------------------------------------------------

function bouwVormen(w, uitslag, plek, cmyk) {
  const kleur = (c, h) => (cmyk ? { cmyk: c } : { hex: h });
  const snij = kleur([0, 100, 0, 0], '#e5007d');
  const ril = kleur([100, 0, 0, 0], '#009fe3');
  const lijn = { vulling: null, lijndikte: 0.25, lijnhoek: 'round', lijneinde: 'butt' };

  const kinderen = [];
  if (w.panelen) {
    const vlakVormen = [];
    for (const v of uitslag.vlakken) {
      vlakVormen.push({
        soort: 'pad', naam: v.naam, subpaden: [{ gesloten: true, punten: rondHoeken(zetOm(v.punten, plek.f)) }],
        vulling: v.klep ? kleur([0, 0, 0, 7], '#ededed') : kleur([0, 2, 10, 0], '#fdf8e6'), lijn: null,
      });
    }
    for (const v of uitslag.vlakken) {
      const pt = zetOm(v.punten, plek.f);
      const xs = pt.map((p) => p.x);
      const ys = pt.map((p) => p.y);
      const b = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      const regels = v.label.split('\n');
      const langste = Math.max(...regels.map((t) => t.length));
      const grootte = begrens(Math.min(b / (langste * 0.62), h / (regels.length * 1.8)), 3.5, 10);
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      vlakVormen.push({
        soort: 'tekst', naam: `Label ${v.naam.toLowerCase()}`, inhoud: v.label, grootte, uitlijning: 'midden',
        gewicht: v.klep ? 400 : 600, regelafstand: grootte * 1.25,
        x: cx, y: cy - ((regels.length - 1) * grootte * 1.25) / 2 + grootte * 0.35,
        vulling: kleur([0, 0, 0, 65], '#595959'), lijn: null,
      });
    }
    kinderen.push({ soort: 'groep', naam: 'Panelen', kinderen: vlakVormen });
  }
  kinderen.push({
    soort: 'groep', naam: 'Rillijn',
    kinderen: [{
      soort: 'pad', naam: 'Rillijnen', ...lijn, lijn: ril, streep: [vexel.mm(2), vexel.mm(1)],
      subpaden: uitslag.rillen.map((l) => ({ gesloten: false, punten: l.map(plek.f) })),
    }],
  });
  kinderen.push({
    soort: 'groep', naam: 'Snijlijn',
    kinderen: [{
      soort: 'pad', naam: 'Snijlijn buitenkant', ...lijn, lijn: snij,
      subpaden: [{ gesloten: true, punten: rondHoeken(zetOm(uitslag.omtrek, plek.f)) }],
    }],
  });
  const f = FORMATEN[w.formaat];
  const maat = `${mmTekst(uitslag.maat.b)} × ${mmTekst(uitslag.maat.h)} mm`;
  const naam = w.formaat === 'eigen' || w.formaat === 'vierkant' ? `Envelop ${maat}` : `Envelop ${f.naam.split(' ')[0]} ${maat}`;
  return [{ soort: 'groep', naam: `${naam}, ${w.klepvorm === 'puntig' ? 'puntige' : 'rechte'} klep`, kinderen }];
}

// ---- voorvertoning --------------------------------------------------------------

function padOpCanvas(g, punten, gesloten, f) {
  if (!punten.length) return;
  const q = (p) => f(p);
  const eerste = q(punten[0]);
  g.moveTo(eerste.x, eerste.y);
  const n = punten.length;
  for (let i = 1; i <= (gesloten ? n : n - 1); i++) {
    const a = punten[i - 1];
    const b = punten[i % n];
    const c1 = q(a.uit || a);
    const c2 = q(b.in || b);
    const e = q(b);
    g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
  }
  if (gesloten) g.closePath();
}


// ---- het venster -----------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const v = {
    lang: getalVeld('lang', w0.lang || 162, 20, 1000, 0.5),
    kort: getalVeld('kort', w0.kort || 114, 20, 1000, 0.5),
    sluitklep: getalVeld('sluitklep', w0.sluitklep, 5, 1000, 0.5),
    zijklep: getalVeld('zijklep', w0.zijklep, 3, 500, 0.5),
    onderklep: getalVeld('onderklep', w0.onderklep, 5, 1000, 0.5),
    afronding: getalVeld('afronding', w0.afronding, 0, 20, 0.5),
  };
  const formaat = keuzeLijst('formaat', Object.fromEntries(Object.entries(FORMATEN).map(([k, f]) => [k, f.naam])), w0.formaat);
  const klepzijde = keuzeLijst('klepzijde', { lang: 'Lange zijde', kort: 'Korte zijde' }, w0.klepzijde);
  const klepvorm = keuzeLijst('klepvorm', { recht: 'Recht', puntig: 'Puntig' }, w0.klepvorm);
  const vinkje = (id, aan) => {
    const el = maak('input', { type: 'checkbox', id, stijl: { margin: '0' } });
    el.checked = aan !== false;
    return el;
  };
  const automatisch = vinkje('automatisch', w0.automatisch);
  const panelen = vinkje('panelen', w0.panelen);

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '150px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Stansvorm maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const drie = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } }, ...k);
  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, ...k);
  const kop = (tekst) => maak('div', { klasse: 'label', tekst, stijl: { fontWeight: '600', color: 'var(--tekst)', margin: '2px 0 -4px' } });
  const vinkRegel = (el, tekst) => maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center' } }, el, maak('span', { tekst }));
  const maatVakken = [veldMetLabel('Lange zijde', v.lang, 'mm'), veldMetLabel('Korte zijde', v.kort, 'mm')];
  const klepVakken = [veldMetLabel('Sluitklep', v.sluitklep, 'mm'), veldMetLabel('Zijklep', v.zijklep, 'mm'),
    veldMetLabel('Onderklep', v.onderklep, 'mm')];
  const regel = 'De voorkant is precies de envelopmaat, van rillijn tot rillijn. Kies een maat die rondom 2 tot 5 mm ruimer is dan de inhoud.';

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    kop('Envelop'),
    twee(veldMetLabel('Formaat', formaat), veldMetLabel('Sluitklep aan de', klepzijde)),
    twee(...maatVakken),
    maak('p', { klasse: 'uitleg', tekst: regel, stijl: { margin: '-4px 0 0' } }),
    kop('Kleppen'),
    twee(veldMetLabel('Vorm sluitklep', klepvorm), veldMetLabel('Hoekafronding', v.afronding, 'mm')),
    vinkRegel(automatisch, 'Klepmaten automatisch'),
    drie(...klepVakken),
    vinkRegel(panelen, 'Panelen met namen (hulpvlakken, niet om te drukken)'),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    formaat: formaat.value,
    lang: begrens(leesGetal(v.lang, 162), 20, 1000),
    kort: begrens(leesGetal(v.kort, 114), 20, 1000),
    klepzijde: klepzijde.value,
    klepvorm: klepvorm.value,
    automatisch: automatisch.checked,
    sluitklep: begrens(leesGetal(v.sluitklep, 48), 5, 1000),
    zijklep: begrens(leesGetal(v.zijklep, 19.5), 3, 500),
    onderklep: begrens(leesGetal(v.onderklep, 75), 5, 1000),
    afronding: begrens(leesGetal(v.afronding, 3), 0, 20),
    panelen: panelen.checked,
  });

  function bereken() {
    const w = waarden();
    const uitslag = ontwerp(w);
    const plek = plaats(uitslag, doc.tekengebied);
    return { w, uitslag, plek };
  }

  function zetVelden(w, uitslag) {
    const f = FORMATEN[w.formaat];
    const eigen = w.formaat === 'eigen';
    if (!eigen) {
      v.lang.value = f.lang;
      v.kort.value = f.kort;
    }
    v.lang.disabled = !eigen;
    v.kort.disabled = !eigen;
    for (const vak of maatVakken) vak.style.opacity = eigen ? '1' : '0.55';
    for (const [sleutel, vak] of [['sluitklep', klepVakken[0]], ['zijklep', klepVakken[1]], ['onderklep', klepVakken[2]]]) {
      if (w.automatisch) v[sleutel].value = uitslag.kleppen[sleutel];
      v[sleutel].disabled = w.automatisch;
      vak.style.opacity = w.automatisch ? '0.55' : '1';
    }
  }

  function teken() {
    const { w, uitslag, plek } = bereken();
    zetVelden(w, uitslag);

    let tekst = `Uitslag ${mmTekst(plek.b)} × ${mmTekst(plek.h)} mm`;
    tekst += plek.draai ? ', een kwartslag gedraaid zodat hij past.' : '.';
    if (uitslag.overlap < 8) {
      tekst += uitslag.overlap > 0
        ? ` De sluitklep valt maar ${mmTekst(uitslag.overlap)} mm over de onderklep; maak een van beide dieper.`
        : ' De sluitklep komt niet tot de onderklep; maak een van beide dieper.';
    } else {
      tekst += ` De sluitklep valt ${mmTekst(uitslag.overlap)} mm over de onderklep.`;
    }
    if (!plek.past) {
      tekst += ` Past niet op het tekengebied (${mmTekst(doc.tekengebied.b / PT)} × ${mmTekst(doc.tekengebied.h / PT)} mm): `
        + 'maak het tekengebied groter of kies een kleiner formaat.';
    }
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier geen stansvorm maken.';
    if (uitslag.fouten.length) tekst = uitslag.fouten[0];
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', Boolean(uitslag.fouten.length) || !plek.past || uitslag.overlap < 8);
    maakKnop.disabled = doc.alleenLezen || Boolean(uitslag.fouten.length);

    const schaal = devicePixelRatio || 1;
    const kader = voorbeeld.getBoundingClientRect();
    voorbeeld.width = Math.round(kader.width * schaal);
    voorbeeld.height = Math.round(kader.height * schaal);
    const g = voorbeeld.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const tb = doc.tekengebied.b;
    const th = doc.tekengebied.h;
    const bx = Math.min(-plek.b * PT / 2 + tb / 2, 0);
    const by = Math.min(-plek.h * PT / 2 + th / 2, 0);
    const bb = Math.max(tb, plek.b * PT);
    const bh = Math.max(th, plek.h * PT);
    const s = Math.min((kader.width - 8) / bb, (kader.height - 8) / bh);
    const ox = (kader.width - bb * s) / 2 - bx * s;
    const oy = (kader.height - bh * s) / 2 - by * s;
    const f = (p) => ({ x: ox + p.x * s, y: oy + p.y * s });

    g.fillStyle = css('--bg', vexel.thema.bg);
    g.fillRect(ox, oy, tb * s, th * s);
    g.strokeStyle = plek.past ? css('--lijn', vexel.thema.lijn) : '#ff5c5c';
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, tb * s - 1, th * s - 1);

    if (w.panelen) {
      for (const vl of uitslag.vlakken) {
        g.beginPath();
        padOpCanvas(g, rondHoeken(zetOm(vl.punten, plek.f)), true, f);
        g.fillStyle = vl.klep ? 'rgba(160, 170, 185, 0.16)' : 'rgba(90, 162, 255, 0.18)';
        g.fill();
      }
    }
    g.lineWidth = 1;
    g.setLineDash([4, 2.5]);
    g.strokeStyle = '#38b6f0';
    g.beginPath();
    for (const l of uitslag.rillen) padOpCanvas(g, l.map(plek.f), false, f);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = '#ff4fb4';
    g.lineWidth = 1.2;
    g.beginPath();
    padOpCanvas(g, rondHoeken(zetOm(uitslag.omtrek, plek.f)), true, f);
    g.stroke();
  }

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const { w, uitslag, plek } = bereken();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    if (uitslag.fouten.length) return vexel.melding(uitslag.fouten[0], 'let');

    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(w, uitslag, plek, doc.kleurruimte === 'cmyk'));
      await vexel.bewaar('instellingen', w);
      if (plek.past) {
        vexel.melding(`Stansvorm gemaakt: uitslag ${mmTekst(plek.b)} × ${mmTekst(plek.h)} mm${plek.draai ? ' (gedraaid)' : ''}.`, 'ok');
      } else {
        vexel.melding(`Stansvorm gemaakt, maar de uitslag (${mmTekst(plek.b)} × ${mmTekst(plek.h)} mm) is groter dan het tekengebied.`, 'let');
      }
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De stansvorm kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  formaat.focus();
}

vexel.opCommando('maken', toonVenster);
