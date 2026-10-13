// Maatlijnen: zet maatvoering (breedte en hoogte) bij de geselecteerde objecten.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  wat: 'beide', voor: 'apart', plaatsB: 'boven', plaatsH: 'links', eenheid: 'mm', decimalen: 1,
  afstand: 6, kleur: 'magenta', lijndikte: 0.35, grootte: 7, einden: 'pijl', metEenheid: true,
};

const KLEUREN = {
  magenta: { naam: 'Magenta', cmyk: [0, 100, 0, 0], hex: '#e5007d' },
  cyaan: { naam: 'Cyaan', cmyk: [100, 0, 0, 0], hex: '#009fe3' },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
  rood: { naam: 'Rood', cmyk: [0, 100, 100, 0], hex: '#e30613' },
  blauw: { naam: 'Blauw', cmyk: [100, 70, 0, 0], hex: '#1d4f9c' },
};

const EENHEDEN = {
  mm: { naam: 'Millimeter', achter: ' mm', pt: vexel.mm(1) },
  cm: { naam: 'Centimeter', achter: ' cm', pt: vexel.mm(10) },
  in: { naam: 'Inch', achter: ' inch', pt: 72 },
};

const PT = vexel.mm(1);
const MAX_OBJECTEN = 400;

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
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

/** Een maat in pt als tekst in de gekozen eenheid, met Nederlandse komma. */
function maatTekst(pt, w, metEenheid = w.metEenheid) {
  const e = EENHEDEN[w.eenheid] || EENHEDEN.mm;
  const getal = (pt / e.pt).toLocaleString('nl-NL', {
    minimumFractionDigits: w.decimalen, maximumFractionDigits: w.decimalen, useGrouping: false,
  });
  return getal + (metEenheid ? e.achter : '');
}

function omhullende(kaders) {
  const x0 = Math.min(...kaders.map((k) => k.x));
  const y0 = Math.min(...kaders.map((k) => k.y));
  const x1 = Math.max(...kaders.map((k) => k.x + k.b));
  const y1 = Math.max(...kaders.map((k) => k.y + k.h));
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

// ---- de maatvoering (alles in pt) -----------------------------------------------

/**
 * Rekent één maat uit langs een as. u loopt langs de maat, v staat er haaks op.
 * Geeft lijnen, pijlpunten en een label terug in gewone x/y-coördinaten.
 *   a0, a1: begin en eind langs u; rand: de rand van het object op v;
 *   richting: -1 (boven/links) of 1 (onder/rechts); horizontaal: true voor breedte.
 */
function eenMaat(a0, a1, rand, richting, horizontaal, tekst, w) {
  const P = horizontaal ? (u, v) => ({ x: u, y: v }) : (u, v) => ({ x: v, y: u });
  const gaatje = vexel.mm(1);
  const over = vexel.mm(1.5);
  const L = rand + richting * vexel.mm(w.afstand);
  const g = w.grootte;
  const pijl = Math.max(vexel.mm(1.8), w.lijndikte * 6);
  const breedPijl = pijl * 0.32;
  const tekstB = tekst.length * g * 0.6;
  const marge = vexel.mm(0.8);
  const lengte = a1 - a0;
  const mid = (a0 + a1) / 2;

  const hulp = [a0, a1].map((a) => [P(a, rand + richting * gaatje), P(a, L + richting * over)]);
  const lijnen = [];
  const pijlen = [];
  const streepjes = [];

  // Hoeveel ruimte het label op de maatlijn inneemt.
  const gat = (horizontaal ? tekstB : g * 1.15) + 2 * marge;
  const nodig = w.einden === 'pijl' ? 2 * pijl + gat + vexel.mm(1) : gat + vexel.mm(2);
  // Een horizontaal label op een staande maatlijn mag niet tot op het object komen.
  const ruimHorizontaal = horizontaal || tekstB / 2 + vexel.mm(1.5) < vexel.mm(w.afstand);
  const binnen = lengte >= nodig && ruimHorizontaal;

  const uitloop = w.einden === 'pijl' ? 0 : over;
  let b0 = a0 - uitloop;
  let b1 = a1 + uitloop;
  if (w.einden === 'pijl' && !binnen && lengte < nodig) {
    b0 = a0 - pijl - vexel.mm(2.5);
    b1 = a1 + pijl + vexel.mm(2.5);
  }
  if (binnen) {
    lijnen.push([P(b0, L), P(mid - gat / 2, L)], [P(mid + gat / 2, L), P(b1, L)]);
  } else {
    lijnen.push([P(b0, L), P(b1, L)]);
  }

  if (w.einden === 'pijl') {
    for (const [a, naar] of [[a0, -1], [a1, 1]]) {
      // binnen: de punt wijst naar buiten (naar de hulplijn); buiten: naar binnen.
      const s = lengte >= nodig ? -naar : naar;
      pijlen.push([P(a, L), P(a + s * pijl, L - breedPijl), P(a + s * pijl, L + breedPijl)]);
    }
  } else {
    const d = vexel.mm(1.1);
    for (const a of [a0, a1]) {
      const m = P(a, L);
      streepjes.push([{ x: m.x - d, y: m.y + d }, { x: m.x + d, y: m.y - d }]);
    }
  }

  let label;
  if (binnen) {
    const c = P(mid, L);
    label = { x: c.x, y: c.y + g * 0.35, uitlijning: 'midden' };
  } else if (horizontaal) {
    const y = richting < 0 ? L - vexel.mm(1.8) : L + vexel.mm(1.8) + g * 0.72;
    label = { x: mid, y, uitlijning: 'midden' };
  } else {
    label = richting < 0
      ? { x: L - vexel.mm(1.5), y: mid + g * 0.35, uitlijning: 'rechts' }
      : { x: L + vexel.mm(1.5), y: mid + g * 0.35, uitlijning: 'links' };
  }
  label.inhoud = tekst;
  return { hulp, lijnen, pijlen, streepjes, label };
}

/** Alle maten bij één kader. */
function maatvoering(k, w) {
  const maten = [];
  if (w.wat !== 'hoogte') {
    const onder = w.plaatsB === 'onder';
    maten.push({
      soort: 'breedte',
      ...eenMaat(k.x, k.x + k.b, onder ? k.y + k.h : k.y, onder ? 1 : -1, true, maatTekst(k.b, w), w),
    });
  }
  if (w.wat !== 'breedte') {
    const rechts = w.plaatsH === 'rechts';
    maten.push({
      soort: 'hoogte',
      ...eenMaat(k.y, k.y + k.h, rechts ? k.x + k.b : k.x, rechts ? 1 : -1, false, maatTekst(k.h, w), w),
    });
  }
  return maten;
}

function bouwVormen(kaders, w, cmyk) {
  const k = KLEUREN[w.kleur] || KLEUREN.magenta;
  const kleur = cmyk ? { cmyk: k.cmyk } : { hex: k.hex };
  const open = (l) => ({ gesloten: false, punten: l });
  const lijn = { vulling: null, lijn: kleur, lijndikte: w.lijndikte, lijneinde: 'butt', lijnhoek: 'miter' };

  const groepen = kaders.map((kader) => {
    const kinderen = maatvoering(kader, w).map((m) => {
      const delen = [
        { soort: 'pad', naam: 'Hulplijnen', subpaden: m.hulp.map(open), ...lijn },
        { soort: 'pad', naam: 'Maatlijn', subpaden: m.lijnen.map(open), ...lijn },
      ];
      if (m.pijlen.length) {
        delen.push({
          soort: 'pad', naam: 'Pijlpunten', vulling: kleur, lijn: null,
          subpaden: m.pijlen.map((p) => ({ gesloten: true, punten: p })),
        });
      }
      if (m.streepjes.length) {
        delen.push({ soort: 'pad', naam: 'Streepjes', subpaden: m.streepjes.map(open), ...lijn, lijndikte: w.lijndikte * 2 });
      }
      delen.push({ soort: 'tekst', naam: 'Label', ...m.label, grootte: w.grootte, vulling: kleur, lijn: null });
      return { soort: 'groep', naam: `Maatlijn ${m.soort}`, kinderen: delen };
    });
    const naam = `Maat ${maatTekst(kader.b, w, false)} × ${maatTekst(kader.h, w, false)}${(EENHEDEN[w.eenheid] || EENHEDEN.mm).achter}`;
    return { soort: 'groep', naam: w.voor === 'geheel' ? naam.replace('Maat', 'Maat geheel') : naam, kinderen };
  });
  return [{ soort: 'groep', naam: 'Maatlijnen', kinderen: groepen }];
}

// ---- het venster -----------------------------------------------------------------

async function leesSelectie() {
  try {
    const items = await vexel.selectie();
    return { kaders: items.filter((o) => o.kader && o.kader.b >= 0 && o.kader.h >= 0).map((o) => o.kader) };
  } catch (fout) {
    return { kaders: [], fout: fout && fout.message ? fout.message : 'De selectie kon niet worden gelezen.' };
  }
}

async function toonVenster() {
  const doc = await vexel.document();
  const bewaard = (await vexel.haal('instellingen')) || {};
  const w0 = { ...STANDAARD, ...bewaard };
  if (!bewaard.eenheid && EENHEDEN[doc.eenheid]) w0.eenheid = doc.eenheid;
  let selectie = await leesSelectie();

  const wat = keuzeLijst('wat', { beide: 'Breedte en hoogte', breedte: 'Alleen breedte', hoogte: 'Alleen hoogte' }, w0.wat);
  const voor = keuzeLijst('voor', { apart: 'Elk object apart', geheel: 'De hele selectie' }, w0.voor);
  const plaatsB = keuzeLijst('plaatsB', { boven: 'Boven', onder: 'Onder' }, w0.plaatsB);
  const plaatsH = keuzeLijst('plaatsH', { links: 'Links', rechts: 'Rechts' }, w0.plaatsH);
  const eenheid = keuzeLijst('eenheid', Object.fromEntries(Object.entries(EENHEDEN).map(([s, e]) => [s, e.naam])), w0.eenheid);
  const kleur = keuzeLijst('kleur', Object.fromEntries(Object.entries(KLEUREN).map(([s, k]) => [s, k.naam])), w0.kleur);
  const einden = keuzeLijst('einden', { pijl: 'Pijlpunten', streep: 'Schuine streepjes' }, w0.einden);
  const v = {
    decimalen: getalVeld('decimalen', w0.decimalen, 0, 3, 1),
    afstand: getalVeld('afstand', w0.afstand, 0, 200, 0.5),
    lijndikte: getalVeld('lijndikte', w0.lijndikte, 0.1, 5, 0.05),
    grootte: getalVeld('grootte', w0.grootte, 3, 72, 0.5),
  };
  const metEenheid = maak('input', { type: 'checkbox', id: 'metEenheid', stijl: { margin: '0' } });
  metEenheid.checked = w0.metEenheid !== false;

  const selectieRegel = maak('p', { klasse: 'uitleg', stijl: { margin: '0', flex: '1' } });
  const vernieuw = maak('button', { klasse: 'knop', type: 'button', tekst: 'Opnieuw lezen', title: 'Lees de selectie opnieuw' });
  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '150px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '17px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Maatlijnen maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, ...k);
  const drie = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } }, ...k);
  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    maak('div', { stijl: { display: 'flex', gap: '8px', alignItems: 'center' } }, selectieRegel, vernieuw),
    twee(veldMetLabel('Maatvoeren', wat), veldMetLabel('Voor', voor)),
    twee(veldMetLabel('Breedtemaat', plaatsB), veldMetLabel('Hoogtemaat', plaatsH)),
    drie(veldMetLabel('Eenheid', eenheid), veldMetLabel('Decimalen', v.decimalen), veldMetLabel('Afstand', v.afstand, 'mm')),
    drie(veldMetLabel('Kleur', kleur), veldMetLabel('Lijndikte', v.lijndikte, 'pt'), veldMetLabel('Letter', v.grootte, 'pt')),
    twee(veldMetLabel('Einden', einden),
      maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center', alignSelf: 'end', height: '26px' } },
        metEenheid, maak('span', { tekst: 'Eenheid in het label' }))),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    wat: wat.value, voor: voor.value, plaatsB: plaatsB.value, plaatsH: plaatsH.value,
    eenheid: eenheid.value, kleur: kleur.value, einden: einden.value, metEenheid: metEenheid.checked,
    decimalen: Math.round(begrens(leesGetal(v.decimalen, 1), 0, 3)),
    afstand: begrens(leesGetal(v.afstand, 6), 0, 200),
    lijndikte: begrens(leesGetal(v.lijndikte, 0.35), 0.1, 5),
    grootte: begrens(leesGetal(v.grootte, 7), 3, 72),
  });

  const teMaten = (w) => {
    if (!selectie.kaders.length) return [];
    return w.voor === 'geheel' ? [omhullende(selectie.kaders)] : selectie.kaders;
  };

  function teken() {
    const w = waarden();
    const kaders = teMaten(w);
    const n = selectie.kaders.length;
    selectieRegel.textContent = n
      ? `${n} ${n === 1 ? 'object' : 'objecten'} geselecteerd.`
      : 'Niets geselecteerd.';

    let tekst;
    let fout = false;
    if (selectie.fout) { tekst = selectie.fout; fout = true; }
    else if (!n) { tekst = 'Selecteer eerst een of meer objecten en klik dan op Opnieuw lezen.'; fout = true; }
    else if (kaders.length > MAX_OBJECTEN) {
      tekst = `Dat zijn te veel objecten (${kaders.length}); kies "De hele selectie" of selecteer er hooguit ${MAX_OBJECTEN}.`;
      fout = true;
    } else if (doc.alleenLezen) { tekst = 'Dit document is alleen-lezen; je kunt hier geen maatlijnen maken.'; fout = true; }
    else if (kaders.length === 1) {
      const k = kaders[0];
      tekst = `Maat ${maatTekst(k.b, w, false)} × ${maatTekst(k.h, w)}${w.voor === 'geheel' && n > 1 ? ' (de hele selectie)' : ''}.`;
    } else tekst = `${kaders.length} objecten krijgen elk een eigen maatvoering.`;
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', fout && Boolean(n || selectie.fout));
    maakKnop.disabled = fout;

    // Voorvertoning: het eerste kader (of de omhullende), passend geschaald; lijnen en tekst op ware grootte.
    const schaal = devicePixelRatio || 1;
    const vak = voorbeeld.getBoundingClientRect();
    voorbeeld.width = Math.round(vak.width * schaal);
    voorbeeld.height = Math.round(vak.height * schaal);
    const g = voorbeeld.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, vak.width, vak.height);
    const echt = kaders[0] || { x: 0, y: 0, b: vexel.mm(60), h: vexel.mm(40) };
    // Hoeveel de maatvoering buiten het object uitsteekt (dat hangt niet van de objectmaat af).
    const proef = { x: 0, y: 0, b: 1000, h: 1000 };
    const rand = { l: 0, r: 0, b: 0, o: 0 };
    for (const m of maatvoering(proef, w)) {
      const tb = m.label.inhoud.length * w.grootte * 0.6;
      const lx = m.label.uitlijning === 'midden' ? m.label.x - tb / 2 : m.label.uitlijning === 'rechts' ? m.label.x - tb : m.label.x;
      const pts = [...m.hulp.flat(), ...m.lijnen.flat(), ...m.pijlen.flat(), { x: lx, y: m.label.y - w.grootte },
        { x: lx + tb, y: m.label.y + 2 }];
      for (const p of pts) {
        rand.l = Math.max(rand.l, -p.x);
        rand.r = Math.max(rand.r, p.x - 1000);
        rand.b = Math.max(rand.b, -p.y);
        rand.o = Math.max(rand.o, p.y - 1000);
      }
    }
    const s = Math.min((vak.width - rand.l - rand.r - 16) / Math.max(echt.b, 1),
      (vak.height - rand.b - rand.o - 12) / Math.max(echt.h, 1));
    const k = { b: Math.max(echt.b * s, 4), h: Math.max(echt.h * s, 4) };
    k.x = (vak.width - rand.l - rand.r - k.b) / 2 + rand.l;
    k.y = (vak.height - rand.b - rand.o - k.h) / 2 + rand.b;
    // De maatlabels tonen de echte maat, de tekening is geschaald.
    const maten = maatvoering(k, w).map((m, i) => {
      const echtM = maatvoering(echt, w)[i];
      return { ...m, label: { ...m.label, inhoud: echtM.label.inhoud } };
    });
    g.fillStyle = 'rgba(90, 162, 255, 0.22)';
    g.strokeStyle = 'rgba(156, 200, 255, 0.8)';
    g.lineWidth = 1;
    g.fillRect(k.x, k.y, k.b, k.h);
    g.strokeRect(k.x + 0.5, k.y + 0.5, k.b - 1, k.h - 1);
    const kl = (KLEUREN[w.kleur] || KLEUREN.magenta).hex;
    const toon = kl === '#e5007d' ? '#ff4fb4' : kl === '#1a1a1a' ? css('--tekst', vexel.thema.tekst) : kl === '#1d4f9c' ? '#6f9cff' : kl;
    g.strokeStyle = toon;
    g.fillStyle = toon;
    for (const m of maten) {
      g.lineWidth = Math.max(w.lijndikte, 0.6);
      g.beginPath();
      for (const [a, b] of [...m.hulp, ...m.lijnen]) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      g.stroke();
      g.lineWidth = Math.max(w.lijndikte * 2, 1);
      g.beginPath();
      for (const [a, b] of m.streepjes) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      g.stroke();
      for (const p of m.pijlen) {
        g.beginPath();
        g.moveTo(p[0].x, p[0].y);
        g.lineTo(p[1].x, p[1].y);
        g.lineTo(p[2].x, p[2].y);
        g.closePath();
        g.fill();
      }
      g.font = `${w.grootte}px Inter, system-ui, sans-serif`;
      g.textAlign = { midden: 'center', rechts: 'right', links: 'left' }[m.label.uitlijning];
      g.fillText(m.label.inhoud, m.label.x, m.label.y);
    }
  }

  vernieuw.addEventListener('click', async () => {
    selectie = await leesSelectie();
    teken();
  });
  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const kaders = teMaten(w);
    if (!kaders.length) return vexel.melding('Selecteer eerst een of meer objecten.', 'let');
    if (kaders.length > MAX_OBJECTEN) return vexel.melding(`Te veel objecten; selecteer er hooguit ${MAX_OBJECTEN}.`, 'let');
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');

    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(kaders, w, doc.kleurruimte === 'cmyk'));
      await vexel.bewaar('instellingen', w);
      vexel.melding(kaders.length === 1
        ? `Maatlijnen gemaakt: ${maatTekst(kaders[0].b, w, false)} × ${maatTekst(kaders[0].h, w)}.`
        : `Maatlijnen gemaakt bij ${kaders.length} objecten.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De maatlijnen konden niet worden gemaakt.', 'fout');
    }
  });

  teken();
  (selectie.kaders.length ? wat : vernieuw).focus();
}

vexel.opCommando('maken', toonVenster);
