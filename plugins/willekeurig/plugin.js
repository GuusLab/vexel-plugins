// Willekeurig: geef elk geselecteerd object een eigen, kleine afwijking in plek,
// draaiing, grootte, dekking of kleur. Met een zaadje, dus elke variant is terug te halen.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  zaadje: 1,
  positie: true, positieMm: 3,
  draai: true, draaiGraden: 15,
  schaal: false, schaalProcent: 15,
  dekking: false, dekkingVan: 60, dekkingTot: 100,
  kleur: false, palet: 'selectie', basis: 0, eigenKleur: '#2f80ed',
};
const TINTEN = [1, 0.85, 0.7, 0.55, 0.4];

// ---- kleine hulpjes voor het venster ------------------------------------

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

function getalVeld(waarde, min, max, stap) {
  return maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
}

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const RAD = Math.PI / 180;

// ---- toeval met een zaadje ------------------------------------------------

/** Een vaste hash van een tekst (FNV-1a), als begin voor de generator. */
function hash(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Een getal tussen 0 en 1, steeds hetzelfde voor hetzelfde zaadje, object en
    eigenschap. Zo verandert de plek niet als je ook de kleur aanzet. */
function toeval(zaadje, nr, wat, extra = 0) {
  let t = (hash(`${zaadje}|${nr}|${wat}|${extra}`) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const tussen = (r, a, b) => a + (b - a) * r;

// ---- kleur ---------------------------------------------------------------

function hexNaarRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbNaarHex = (rgb) => '#' + rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/** Benadering zonder profiel, alleen voor een eigen kleur in een CMYK-document. */
function rgbNaarCmyk([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 0.999) return [0, 0, 0, 100];
  return [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k].map((n) => Math.round(n * 1000) / 10);
}

/** Een tint (lichtere versie) van een kleur uit de selectie: CMYK naar rato, RGB naar wit toe. */
function tint(kleur, f, cmykDoc) {
  if (cmykDoc) {
    const cmyk = kleur.cmyk.map((v) => Math.round(v * f * 10) / 10);
    return { cmyk, hex: tintHex(kleur.hex, f) };
  }
  const hex = tintHex(kleur.hex, f);
  return { hex };
}
const tintHex = (hex, f) => rgbNaarHex(hexNaarRgb(hex).map((v) => 255 - (255 - v) * f));

const kleurSleutel = (k) => (k.cmyk ? k.cmyk.join(',') : '') + '|' + k.hex;

/** De kleur zoals hij naar Vexel gaat: CMYK in een CMYK-document, anders hex. */
const naarVexel = (k, cmykDoc) => (cmykDoc && k.cmyk ? { cmyk: k.cmyk } : { hex: k.hex });

// ---- selectie ------------------------------------------------------------

async function leesSelectie() {
  const items = await vexel.selectie();
  return items.filter((o) => o && o.kader && Number.isFinite(o.kader.x) && Number.isFinite(o.kader.b));
}

const midden = (k) => ({ x: k.x + k.b / 2, y: k.y + k.h / 2 });

/** Een kleur uit de selectie, altijd met hex (en cmyk als die er is), of null. */
function kleurVan(k) {
  if (!k) return null;
  const cmyk = Array.isArray(k.cmyk) && k.cmyk.length === 4 ? k.cmyk.map(Number) : null;
  let hex = hexNaarRgb(k.hex) ? k.hex.toLowerCase() : null;
  if (!hex && cmyk) {
    const z = 1 - cmyk[3] / 100;
    hex = rgbNaarHex(cmyk.slice(0, 3).map((v) => 255 * (1 - v / 100) * z));
  }
  return hex ? (cmyk ? { cmyk, hex } : { hex }) : null;
}
const kleurOk = (k) => Boolean(kleurVan(k));
/** Een groep krijgt geen kleur: dan zou alles erin dezelfde kleur worden. */
const magKleur = (o) => o.soort !== 'groep' && kleurOk(o.vulling);

/** Een vingerafdruk van hoe de selectie er nu bij staat, om te zien of er
    intussen iets veranderd is (bijvoorbeeld ongedaan gemaakt). */
function afdruk(items) {
  const r = (n) => Math.round(n * 100) / 100;
  return items.map((o) => [o.id, r(o.kader.x), r(o.kader.y), r(o.kader.b), r(o.kader.h),
    o.vulling ? kleurSleutel(kleurVan(o.vulling) || { hex: '-' }) : '-', r(o.dekking == null ? 1 : o.dekking)].join(':')).sort().join(';');
}

// ---- de varianten ----------------------------------------------------------

/** De afwijking per object voor dit zaadje (ten opzichte van het begin). */
function variant(basis, w, palet) {
  const pt = vexel.mm(1);
  return basis.map((b) => {
    const nr = b.id;
    const v = { dx: 0, dy: 0, draai: 0, schaal: 1, dekking: null, kleur: null };
    if (w.positie) {
      v.dx = tussen(toeval(w.zaadje, nr, 'x'), -1, 1) * w.positieMm * pt;
      v.dy = tussen(toeval(w.zaadje, nr, 'y'), -1, 1) * w.positieMm * pt;
    }
    if (w.draai) v.draai = tussen(toeval(w.zaadje, nr, 'draai'), -1, 1) * w.draaiGraden;
    if (w.schaal) v.schaal = Math.max(0.05, 1 + tussen(toeval(w.zaadje, nr, 'schaal'), -1, 1) * (w.schaalProcent / 100));
    if (w.dekking) v.dekking = tussen(toeval(w.zaadje, nr, 'dekking'), w.dekkingVan, w.dekkingTot) / 100;
    if (w.kleur && palet.length && magKleur(b)) {
      v.kleur = palet[Math.min(palet.length - 1, Math.floor(toeval(w.zaadje, nr, 'kleur') * palet.length))];
    }
    return v;
  });
}

// ---- voorvertoning --------------------------------------------------------

function tekenVoorbeeld(canvas, basis, varianten) {
  const schaal = devicePixelRatio || 1;
  const vak = canvas.getBoundingClientRect();
  canvas.width = Math.round(vak.width * schaal);
  canvas.height = Math.round(vak.height * schaal);
  const g = canvas.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, vak.width, vak.height);
  if (!basis.length) return;

  const punten = [];
  basis.forEach((b, i) => {
    const v = varianten ? varianten[i] : { dx: 0, dy: 0, schaal: 1 };
    const d = (Math.hypot(b.b, b.h) / 2) * Math.max(1, v.schaal);
    punten.push([b.c.x - d, b.c.y - d], [b.c.x + d, b.c.y + d]);
    punten.push([b.c.x + v.dx - d, b.c.y + v.dy - d], [b.c.x + v.dx + d, b.c.y + v.dy + d]);
  });
  const x0 = Math.min(...punten.map((p) => p[0]));
  const y0 = Math.min(...punten.map((p) => p[1]));
  const x1 = Math.max(...punten.map((p) => p[0]));
  const y1 = Math.max(...punten.map((p) => p[1]));
  const s = Math.min((vak.width - 16) / Math.max(1, x1 - x0), (vak.height - 16) / Math.max(1, y1 - y0));
  const ox = (vak.width - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (vak.height - (y1 - y0) * s) / 2 - y0 * s;

  const accent = vexel.thema.accent || css('--accent', '#5aa2ff');
  const lijn = vexel.thema.lijn || css('--lijn', '#444');
  const zacht = vexel.thema.tekstZacht || css('--tekst-zacht', '#999');

  g.setLineDash([3, 3]);
  g.strokeStyle = lijn;
  for (const b of basis) g.strokeRect(ox + (b.c.x - b.b / 2) * s + 0.5, oy + (b.c.y - b.h / 2) * s + 0.5, b.b * s, b.h * s);
  g.setLineDash([]);

  basis.forEach((b, i) => {
    const v = varianten ? varianten[i] : { dx: 0, dy: 0, draai: 0, schaal: 1, dekking: null, kleur: null };
    const kleur = v.kleur ? v.kleur.hex : (b.vulling && b.vulling.hex) || zacht;
    const bb = b.b * v.schaal * s;
    const hh = b.h * v.schaal * s;
    g.save();
    g.translate(ox + (b.c.x + v.dx) * s, oy + (b.c.y + v.dy) * s);
    g.rotate(v.draai * RAD);
    g.globalAlpha = v.dekking == null ? b.dekking : v.dekking;
    g.fillStyle = kleur;
    g.fillRect(-bb / 2, -hh / 2, Math.max(1, bb), Math.max(1, hh));
    g.globalAlpha = 1;
    g.strokeStyle = accent;
    g.lineWidth = 1;
    g.strokeRect(-bb / 2, -hh / 2, Math.max(1, bb), Math.max(1, hh));
    g.restore();
  });
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmykDoc = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  let leesFout = null;

  // Het begin: hoe alles stond toen het venster openging (of na een wijziging van buitenaf).
  let basis = [];
  // Wat er nu is toegepast, per object: anker (waar het oude midden nu is), schaal, draaiing.
  let toegepast = null;
  let laatsteAfdruk = null;
  let laatsteZaadje = null;
  // eerdere toestanden: gaat iemand in Vexel een stap terug, dan herkennen we die
  let eerder = [];

  function zetBasis(items) {
    basis = items.map((o) => ({
      id: o.id, soort: o.soort, c: midden(o.kader), b: o.kader.b, h: o.kader.h,
      vulling: kleurVan(o.vulling), dekking: o.dekking == null ? 1 : o.dekking,
    }));
    toegepast = basis.map((b) => ({ anker: { ...b.c }, schaal: 1, draai: 0, kleur: false, dekking: false }));
    laatsteAfdruk = afdruk(items);
    laatsteZaadje = null;
    eerder = [{ afdruk: laatsteAfdruk, toegepast, zaadje: null }];
  }
  try {
    zetBasis(await leesSelectie());
  } catch (fout) {
    leesFout = fout;
  }

  // de kleuren in de selectie (zonder dubbele)
  const selectieKleuren = () => {
    const gezien = new Map();
    for (const b of basis) if (b.vulling && !gezien.has(kleurSleutel(b.vulling))) gezien.set(kleurSleutel(b.vulling), b.vulling);
    return [...gezien.values()];
  };

  const velden = {
    zaadje: getalVeld(w0.zaadje, 1, 999999, 1),
    positieMm: getalVeld(w0.positieMm, 0, 1000, 0.5),
    draaiGraden: getalVeld(w0.draaiGraden, 0, 180, 1),
    schaalProcent: getalVeld(w0.schaalProcent, 0, 95, 1),
    dekkingVan: getalVeld(w0.dekkingVan, 0, 100, 5),
    dekkingTot: getalVeld(w0.dekkingTot, 0, 100, 5),
  };
  const vakje = (aan) => {
    const v = maak('input', { type: 'checkbox', stijl: { margin: '0' } });
    v.checked = Boolean(aan);
    return v;
  };
  const aan = { positie: vakje(w0.positie), draai: vakje(w0.draai), schaal: vakje(w0.schaal), dekking: vakje(w0.dekking), kleur: vakje(w0.kleur) };
  const palet = maak('select', { klasse: 'veld' },
    maak('option', { value: 'selectie', tekst: 'Kleuren uit de selectie' }),
    maak('option', { value: 'tinten', tekst: 'Tinten van één kleur' }));
  palet.value = w0.palet === 'tinten' ? 'tinten' : 'selectie';
  const basisKeuze = maak('select', { klasse: 'veld' });
  const eigenKleur = maak('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(w0.eigenKleur) ? w0.eigenKleur : '#2f80ed',
    title: 'Eigen kleur', stijl: { width: '34px', height: '26px', padding: '0', border: '1px solid var(--lijn)', borderRadius: '5px', background: 'none' } });
  const stalen = maak('div', { stijl: { display: 'flex', gap: '4px', flexWrap: 'wrap', minHeight: '16px' } });

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '130px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const toepassen = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Toepassen' });
  const opnieuw = maak('button', { klasse: 'knop', type: 'button', tekst: 'Opnieuw', title: 'Probeer meteen een nieuwe variant (één stap ongedaan maken per keer)' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const eenheid = (t) => maak('span', { klasse: 'uitleg', tekst: t, stijl: { minWidth: '14px' } });
  const regel = (vak, naam, ...rest) => maak('div', {
    stijl: { display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: '8px', alignItems: 'center' },
  }, maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center' } }, vak, maak('span', { tekst: naam })),
  maak('div', { stijl: { display: 'flex', gap: '6px', alignItems: 'center', minWidth: '0' } }, ...rest));
  for (const v of Object.values(velden)) { v.style.flex = '1'; v.style.minWidth = '0'; }
  palet.style.flex = '1';
  basisKeuze.style.flex = '1';
  basisKeuze.style.minWidth = '0';

  const tintRegel = maak('div', { stijl: { display: 'flex', gap: '6px', alignItems: 'center', paddingLeft: '104px', minWidth: '0' } }, basisKeuze, eigenKleur);
  const formulier = maak('form', { stijl: { display: 'grid', gap: '9px', padding: '14px' } },
    regel(aan.positie, 'Positie', eenheid('±'), velden.positieMm, eenheid('mm')),
    regel(aan.draai, 'Draaiing', eenheid('±'), velden.draaiGraden, eenheid('°')),
    regel(aan.schaal, 'Grootte', eenheid('±'), velden.schaalProcent, eenheid('%')),
    regel(aan.dekking, 'Dekking', velden.dekkingVan, eenheid('tot'), velden.dekkingTot, eenheid('%')),
    regel(aan.kleur, 'Kleur', palet),
    tintRegel,
    maak('div', { stijl: { paddingLeft: '104px' } }, stalen),
    regel(maak('span'), 'Zaadje', velden.zaadje),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, opnieuw, toepassen),
  );
  document.body.append(formulier);

  function vulBasisKeuze() {
    const kleuren = selectieKleuren();
    const oud = basisKeuze.value || String(w0.basis);
    basisKeuze.replaceChildren(
      ...kleuren.map((k, i) => maak('option', { value: String(i), tekst: `Kleur ${i + 1} (${k.hex})`, title: k.hex })),
      maak('option', { value: 'eigen', tekst: 'Eigen kleur' }));
    basisKeuze.value = [...basisKeuze.options].some((o) => o.value === oud) ? oud : (kleuren.length ? '0' : 'eigen');
  }
  vulBasisKeuze();

  const waarden = () => ({
    zaadje: Math.round(begrens(leesGetal(velden.zaadje, 1), 1, 999999)),
    positie: aan.positie.checked, positieMm: begrens(leesGetal(velden.positieMm, 3), 0, 1000),
    draai: aan.draai.checked, draaiGraden: begrens(leesGetal(velden.draaiGraden, 15), 0, 180),
    schaal: aan.schaal.checked, schaalProcent: begrens(leesGetal(velden.schaalProcent, 15), 0, 95),
    dekking: aan.dekking.checked,
    dekkingVan: begrens(Math.min(leesGetal(velden.dekkingVan, 60), leesGetal(velden.dekkingTot, 100)), 0, 100),
    dekkingTot: begrens(Math.max(leesGetal(velden.dekkingVan, 60), leesGetal(velden.dekkingTot, 100)), 0, 100),
    kleur: aan.kleur.checked, palet: palet.value, basis: basisKeuze.value, eigenKleur: eigenKleur.value,
  });

  function maakPalet(w) {
    if (w.palet === 'selectie') return selectieKleuren();
    let grond;
    if (w.basis === 'eigen') {
      const rgb = hexNaarRgb(w.eigenKleur) || [47, 128, 237];
      grond = { hex: rgbNaarHex(rgb), cmyk: rgbNaarCmyk(rgb) };
    } else grond = selectieKleuren()[Number(w.basis)] || null;
    if (!grond) return [];
    if (cmykDoc && !grond.cmyk) grond = { ...grond, cmyk: rgbNaarCmyk(hexNaarRgb(grond.hex)) };
    return TINTEN.map((f) => tint(grond, f, cmykDoc));
  }

  function probleem(w) {
    if (leesFout) return 'De selectie kon niet worden gelezen: ' + leesFout.message;
    if (doc.alleenLezen) return 'Dit document is alleen-lezen.';
    if (!basis.length) return 'Selecteer eerst de objecten die je wilt variëren en open dit venster opnieuw.';
        if (!(w.positie || w.draai || w.schaal || w.dekking || w.kleur)) return 'Zet minstens één ding aan om te variëren.';
    if (w.kleur) {
      const p = maakPalet(w);
      if (!basis.some(magKleur)) return 'Geen van de objecten heeft een vulkleur die je kunt variëren (groepen slaat de plugin over).';
      if (w.palet === 'selectie' && p.length < 2) return 'De selectie heeft maar één vulkleur. Kies "Tinten van één kleur" of selecteer objecten in meer kleuren.';
    }
    return null;
  }

  function werkBij() {
    const w = waarden();
    tintRegel.style.display = w.kleur && w.palet === 'tinten' ? 'flex' : 'none';
    eigenKleur.style.display = w.basis === 'eigen' ? '' : 'none';
    const p = maakPalet(w);
    stalen.replaceChildren(...(w.kleur ? p : []).slice(0, 24).map((k) => maak('span', {
      title: k.cmyk && cmykDoc ? `C${k.cmyk[0]} M${k.cmyk[1]} Y${k.cmyk[2]} K${k.cmyk[3]}` : k.hex,
      stijl: { width: '16px', height: '16px', borderRadius: '3px', background: k.hex, border: '1px solid var(--lijn)' },
    })));
    stalen.parentElement.style.display = w.kleur ? '' : 'none';
    const fout = probleem(w);
    toepassen.disabled = Boolean(fout);
    opnieuw.disabled = Boolean(fout);
    if (fout) {
      samenvatting.textContent = fout;
      samenvatting.classList.add('fout');
      tekenVoorbeeld(voorbeeld, basis, null);
      return;
    }
    samenvatting.classList.remove('fout');
    const delen = [];
    if (w.positie) delen.push(`± ${w.positieMm} mm`);
    if (w.draai) delen.push(`± ${w.draaiGraden}°`);
    if (w.schaal) delen.push(`± ${w.schaalProcent}% groot`);
    if (w.dekking) delen.push(`dekking ${w.dekkingVan}–${w.dekkingTot}%`);
    if (w.kleur) delen.push(`${p.length} kleuren`);
    let tekst = `${basis.length} ${basis.length === 1 ? 'object' : 'objecten'}, variant ${w.zaadje}: ${delen.join(', ')}.`;
    const zonder = basis.filter((b) => !magKleur(b)).length;
    if (w.kleur && zonder) tekst += ` ${zonder} zonder vulkleur of als groep ${zonder === 1 ? 'houdt' : 'houden'} de eigen kleur.`;
    if (laatsteZaadje !== null) tekst += ` Variant ${laatsteZaadje} staat nu in je werk.`;
    if (basis.length >= 5000) tekst += ' Let op: Vexel geeft hooguit 5000 objecten door; de rest blijft staan.';
    samenvatting.textContent = tekst;
    tekenVoorbeeld(voorbeeld, basis, variant(basis, w, p));
  }

  /** Zet variant w neer, uitgaande van het begin, in één stap. */
  async function pasToe(w) {
    const nu = await leesSelectie();
    const ids = new Set(basis.map((b) => b.id));
    const zelfde = nu.length === basis.length && nu.every((o) => ids.has(o.id));
    const terug = zelfde ? eerder.filter((e) => e.afdruk === afdruk(nu)).pop() : null;
    if (terug && terug.afdruk !== laatsteAfdruk) {
      // in Vexel ongedaan gemaakt (of opnieuw gedaan): ga verder vanaf die variant
      toegepast = terug.toegepast;
      laatsteZaadje = terug.zaadje;
      laatsteAfdruk = terug.afdruk;
    } else if (!terug) {
      // de selectie of het werk is veranderd: begin opnieuw vanaf hoe het nu is
      const wasToegepast = laatsteZaadje !== null;
      zetBasis(nu);
      vulBasisKeuze();
      if (!basis.length) throw new Error('Er is niets meer geselecteerd.');
      if (!zelfde || wasToegepast) {
        vexel.melding('De selectie is intussen veranderd; de variant gaat uit van hoe alles nu staat.', 'info');
      }
    }
    const p = maakPalet(w);
    const varianten = variant(basis, w, p);
    const perId = new Map(nu.map((o) => [o.id, o]));
    const lijst = [];
    const nieuwToegepast = [];
    basis.forEach((b, i) => {
      const v = varianten[i];
      const t = toegepast[i];
      const huidig = perId.get(b.id);
      const c = midden(huidig.kader);
      const wijziging = { id: b.id };
      // schaal en draaiing ten opzichte van wat er nu staat
      const sigma = begrens(v.schaal / t.schaal, 0.001, 1000);
      const rho = v.draai - t.draai;
      if (Math.abs(sigma - 1) > 1e-9) wijziging.schaal = sigma;
      if (Math.abs(rho) > 1e-9) wijziging.draai = rho;
      // waar het anker na schalen en draaien om het huidige midden komt, en wat er nog moet schuiven
      const ax = t.anker.x - c.x;
      const ay = t.anker.y - c.y;
      const cos = Math.cos(rho * RAD);
      const sin = Math.sin(rho * RAD);
      const na = { x: c.x + sigma * (cos * ax - sin * ay), y: c.y + sigma * (sin * ax + cos * ay) };
      const doel = { x: b.c.x + v.dx, y: b.c.y + v.dy };
      const dx = doel.x - na.x;
      const dy = doel.y - na.y;
      if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) wijziging.verplaats = { dx, dy };
      // kleur en dekking altijd vanaf het begin
      if (v.kleur) wijziging.vulling = naarVexel(v.kleur, cmykDoc);
      else if (t.kleur && b.vulling) wijziging.vulling = naarVexel(b.vulling, cmykDoc);
      if (v.dekking != null) wijziging.dekking = Math.round(v.dekking * 1000) / 1000;
      else if (t.dekking) wijziging.dekking = b.dekking;
      nieuwToegepast.push({ anker: doel, schaal: v.schaal, draai: v.draai, kleur: Boolean(v.kleur), dekking: v.dekking != null });
      if (Object.keys(wijziging).length > 1) lijst.push(wijziging);
    });
    if (lijst.length) await vexel.wijzig(lijst);
    toegepast = nieuwToegepast;
    laatsteZaadje = w.zaadje;
    laatsteAfdruk = afdruk(await leesSelectie());
    eerder.push({ afdruk: laatsteAfdruk, toegepast, zaadje: laatsteZaadje });
    if (eerder.length > 200) eerder.splice(1, 1);
    await vexel.bewaar('instellingen', w);
  }

  let bezig = false;
  let laatsteW = null;
  async function doe(volgende, sluitNa) {
    if (bezig) return;
    const w0nu = waarden();
    if (probleem(w0nu)) return;
    bezig = true;
    toepassen.disabled = true;
    opnieuw.disabled = true;
    try {
      if (volgende) velden.zaadje.value = String(w0nu.zaadje >= 999999 ? 1 : w0nu.zaadje + 1);
      const w = waarden();
      if (!(sluitNa && laatsteZaadje === w.zaadje && JSON.stringify(w) === JSON.stringify(laatsteW))) await pasToe(w);
      laatsteW = w;
      if (sluitNa) {
        vexel.melding(`Variant ${w.zaadje} toegepast op ${basis.length} ${basis.length === 1 ? 'object' : 'objecten'}.`, 'ok');
        vexel.sluit();
        return;
      }
      annuleer.textContent = 'Sluiten';
    } catch (fout) {
      vexel.melding(fout && fout.message ? fout.message : 'Variëren lukte niet.', 'fout');
    } finally {
      bezig = false;
      werkBij();
    }
  }

  opnieuw.addEventListener('click', () => doe(true, false));
  formulier.addEventListener('input', werkBij);
  formulier.addEventListener('change', werkBij);
  formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    doe(false, true);
  });

  werkBij();
  velden.positieMm.focus();
}

vexel.opCommando('varieren', toonVenster);
