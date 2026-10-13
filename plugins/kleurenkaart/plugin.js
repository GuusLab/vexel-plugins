// Kleurenkaart: zet een drukproef-kleurenkaart met tintenladders en rijk zwart op het tekengebied.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { stap: 10, combi: [true, true, true, true], rijkZwart: true, labels: true, marge: 12 };
const STAPPEN = { 5: 'Stappen van 5%', 10: 'Stappen van 10%', 20: 'Stappen van 20%', 25: 'Stappen van 25%' };
const PT = vexel.mm(1);

// Inkten per kleurruimte: een ladder is een lijst kanalen die samen oplopen.
const CMYK_LADDERS = [
  { naam: 'Cyaan', kanalen: [0] },
  { naam: 'Magenta', kanalen: [1] },
  { naam: 'Geel', kanalen: [2] },
  { naam: 'Zwart', kanalen: [3] },
];
const CMYK_COMBI = [
  { naam: 'Cyaan + magenta', kort: 'C+M', kanalen: [0, 1] },
  { naam: 'Cyaan + geel', kort: 'C+Y', kanalen: [0, 2] },
  { naam: 'Magenta + geel', kort: 'M+Y', kanalen: [1, 2] },
  { naam: 'Cyaan + magenta + geel', kort: 'C+M+Y', kanalen: [0, 1, 2] },
];
const RGB_LADDERS = [
  { naam: 'Rood', kanalen: [0] },
  { naam: 'Groen', kanalen: [1] },
  { naam: 'Blauw', kanalen: [2] },
  { naam: 'Grijs', kanalen: [0, 1, 2], grijs: true },
];
const RGB_COMBI = [
  { naam: 'Rood + groen (geel)', kort: 'R+G', kanalen: [0, 1] },
  { naam: 'Rood + blauw (magenta)', kort: 'R+B', kanalen: [0, 2] },
  { naam: 'Groen + blauw (cyaan)', kort: 'G+B', kanalen: [1, 2] },
];
const RIJK_ZWART = [
  [0, 0, 0, 100], [40, 0, 0, 100], [30, 30, 30, 100], [60, 40, 40, 100],
  [50, 50, 50, 100], [70, 50, 40, 100], [100, 100, 100, 100],
];
const LETTERS = ['C', 'M', 'Y', 'K'];

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

function veldMetLabel(tekst, veld, eenheid) {
  veld.style.width = '100%';
  veld.style.minWidth = '0';
  const kop = maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0', whiteSpace: 'nowrap' } });
  if (eenheid) kop.append(maak('span', { tekst: ` (${eenheid})`, stijl: { opacity: '0.7' } }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, kop, veld);
}

function vinkje(id, tekst, aan) {
  const vak = maak('input', { type: 'checkbox', id, stijl: { margin: '0' } });
  vak.checked = aan;
  const label = maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center', minWidth: '0' } },
    vak, maak('span', { tekst }));
  return { vak, label };
}

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const mmTekst = (n) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

// ---- kleur -------------------------------------------------------------------
// Een eenvoudige omrekening zonder kleurprofiel: alleen voor de voorvertoning
// en om te kiezen of een label zwart of wit wordt.

function cmykNaarRgb([c, m, y, k]) {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z];
}
const hexVan = (rgb) => '#' + rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
const helderheid = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const cmykTekst = (cmyk) => cmyk.map((n, i) => (n ? LETTERS[i] + n : '')).filter(Boolean).join(' ') || 'Papier';
const tac = (cmyk) => cmyk.reduce((a, b) => a + b, 0);

/** Eén vlakje: de kleur, het rgb voor de voorvertoning en de labelregels. */
function vlakCmyk(cmyk, regels) {
  const rgb = cmykNaarRgb(cmyk);
  return { cmyk, rgb, regels, donker: helderheid(rgb) < 0.5 };
}
function vlakRgb(rgb, regels) {
  return { rgb, regels, donker: helderheid(rgb) < 0.5 };
}

// ---- de indeling (alles in pt) ------------------------------------------------

/** Rekent de blokken en vlakjes uit, of een foutmelding als het niet past. */
function indeling(doc, w) {
  const cmyk = doc.kleurruimte === 'cmyk';
  const marge = w.marge * PT;
  const breedte = doc.tekengebied.b - 2 * marge;
  const hoogte = doc.tekengebied.h - 2 * marge;
  const n = Math.round(100 / w.stap);
  const procenten = Array.from({ length: n }, (_, i) => (i + 1) * w.stap);
  const gat = (n > 12 ? 1 : 1.5) * PT;

  const ladders = cmyk ? CMYK_LADDERS : RGB_LADDERS;
  const combis = (cmyk ? CMYK_COMBI : RGB_COMBI).filter((_, i) => w.combi[i]);
  const rijen = [];
  for (const l of [...ladders, ...combis]) {
    const vlakken = procenten.map((p) => {
      if (cmyk) {
        const k = [0, 0, 0, 0];
        for (const c of l.kanalen) k[c] = p;
        return vlakCmyk(k, l.kanalen.length > 1 ? l.kanalen.map((c) => LETTERS[c] + p) : [`${LETTERS[l.kanalen[0]]} ${p}`]);
      }
      const r = [0, 1, 2].map((c) => Math.round(!l.grijs && l.kanalen.includes(c) ? 255 : 255 * (1 - p / 100)));
      return vlakRgb(r, [`${p}%`, hexVan(r)]);
    });
    rijen.push({ naam: l.naam, vlakken, kolommen: n });
  }
  if (cmyk && w.rijkZwart) {
    rijen.push({
      naam: 'Rijk zwart (K100 naast opgebouwd zwart)',
      groepNaam: 'Rijk zwart',
      kolommen: RIJK_ZWART.length,
      vlakken: RIJK_ZWART.map((k) => vlakCmyk(k, [cmykTekst(k), `TAC ${tac(k)}%${tac(k) > 330 ? ', te hoog' : ''}`])),
    });
  }

  const vlakB = (breedte - (n - 1) * gat) / n;
  if (vlakB < 4 * PT) {
    return { fout: 'De vlakjes worden te smal: kies grotere stappen, een kleinere marge of een breder tekengebied.' };
  }
  const titelH = 17 * PT;
  const kopH = 5.5 * PT;
  const blokGat = 3.5 * PT;
  let vlakH = begrens(vlakB * 0.85, 9 * PT, 16 * PT);
  const nodig = (h) => titelH + rijen.length * (kopH + h + blokGat) - blokGat;
  if (nodig(vlakH) > hoogte) vlakH = (hoogte - titelH - rijen.length * (kopH + blokGat) + blokGat) / rijen.length;
  if (vlakH < 6 * PT) {
    return { fout: 'Dat past niet op het tekengebied: zet combinaties uit, kies grotere stappen of maak de marge kleiner.' };
  }

  let y = marge + titelH;
  for (const rij of rijen) {
    const b = (breedte - (rij.kolommen - 1) * gat) / rij.kolommen;
    rij.kopY = y + kopH - 1.6 * PT;
    rij.vlakken.forEach((v, i) => Object.assign(v, { x: marge + i * (b + gat), y: y + kopH, b, h: vlakH }));
    y += kopH + vlakH + blokGat;
  }
  const aantal = rijen.reduce((a, r) => a + r.vlakken.length, 0);
  return { rijen, marge, breedte, vlakB, vlakH, aantal, cmyk, hoogteGebruikt: y - blokGat - marge };
}

// ---- de vormen voor Vexel -------------------------------------------------------

function bouwVormen(w, ind) {
  const kleur = (c, h) => (ind.cmyk ? { cmyk: c } : { hex: h });
  const zwart = kleur([0, 0, 0, 100], '#000000');
  const wit = kleur([0, 0, 0, 0], '#FFFFFF');
  const zacht = kleur([0, 0, 0, 70], '#4d4d4d');
  const m = ind.marge;
  const titel = ind.cmyk ? 'Kleurenkaart CMYK' : 'Kleurenkaart RGB';
  const kopGroep = {
    soort: 'groep', naam: 'Titel',
    kinderen: [
      { soort: 'tekst', naam: 'Titel', x: m, y: m + 5 * PT, inhoud: `${titel} · stappen van ${w.stap}%`, grootte: 13, gewicht: 700, vulling: zwart, lijn: null },
      {
        soort: 'tekst', naam: 'Uitleg', x: m, y: m + 10 * PT, grootte: 6.5, vulling: zacht, lijn: null,
        inhoud: ind.cmyk
          ? 'Tintladders per inkt in procent rasterdekking. TAC = totale inktdekking (som van C, M, Y en K).'
          : 'RGB-tintladders van wit naar volle kleur, met de hexwaarde per vlakje. Niet bedoeld als drukproef.',
      },
      { soort: 'rechthoek', naam: 'Lijn', x: m, y: m + 12.5 * PT, b: ind.breedte, h: 0.35, vulling: zwart, lijn: null },
    ],
  };
  const blokken = ind.rijen.map((rij) => {
    const kinderen = [{ soort: 'tekst', naam: 'Kop', x: m, y: rij.kopY, inhoud: rij.naam, grootte: 7.5, gewicht: 600, vulling: zwart, lijn: null }];
    for (const v of rij.vlakken) {
      const vulling = v.cmyk ? { cmyk: v.cmyk } : { hex: hexVan(v.rgb) };
      kinderen.push({ soort: 'rechthoek', naam: v.regels.join(' '), x: v.x, y: v.y, b: v.b, h: v.h, vulling, lijn: null });
    }
    if (w.labels) {
      for (const v of rij.vlakken) {
        const langste = Math.max(...v.regels.map((r) => r.length));
        const pad = Math.min(1.2 * PT, v.b * 0.08);
        const grootte = begrens(Math.min((v.b - 2 * pad) / (langste * 0.6), (v.h - 2 * pad) / (v.regels.length * 1.2)), 3.5, 6.5);
        const lh = grootte * 1.2;
        kinderen.push({
          soort: 'tekst', naam: `Label ${v.regels.join(' ')}`, inhoud: v.regels.join('\n'),
          x: v.x + pad, y: v.y + v.h - pad - (v.regels.length - 1) * lh - grootte * 0.1,
          grootte, regelafstand: lh, gewicht: 500, vulling: v.donker ? wit : zwart, lijn: null,
        });
      }
    }
    return { soort: 'groep', naam: rij.groepNaam || rij.naam, kinderen };
  });
  return [{ soort: 'groep', naam: `${titel} · ${w.stap}%`, kinderen: [kopGroep, ...blokken] }];
}

const telVormen = (vormen) => vormen.reduce((a, v) => a + 1 + (v.kinderen ? telVormen(v.kinderen) : 0), 0);

// ---- het venster -----------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  if (!Array.isArray(w0.combi) || w0.combi.length !== 4) w0.combi = STANDAARD.combi;

  const stap = maak('select', { klasse: 'veld', id: 'stap' },
    ...Object.entries(STAPPEN).map(([s, t]) => maak('option', { value: s, tekst: t })));
  stap.value = STAPPEN[w0.stap] ? String(w0.stap) : '10';
  const marge = maak('input', { klasse: 'veld', id: 'marge', type: 'number', min: 0, max: 50, step: 1, value: w0.marge, inputmode: 'decimal' });
  const combis = (cmyk ? CMYK_COMBI : RGB_COMBI).map((c, i) => vinkje(`combi${i}`, c.kort, w0.combi[i] !== false));
  const rijk = vinkje('rijkZwart', 'Rijk zwart vergelijken', w0.rijkZwart !== false);
  const labels = vinkje('labels', 'Labels in de vlakjes', w0.labels !== false);

  const ruimteUitleg = maak('p', {
    klasse: 'uitleg', stijl: { margin: '0' },
    tekst: cmyk
      ? 'CMYK-document: ladders per inkt in procent rasterdekking.'
      : 'Dit document is RGB, dus je krijgt een RGB- en grijswaardenkaart met hexwaarden. '
        + 'Voor een drukproef-kaart in CMYK: zet het document eerst op CMYK.',
  });
  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '230px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '17px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Kaart maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, ...k);
  const kop = (tekst) => maak('div', { klasse: 'label', tekst, stijl: { fontWeight: '600', color: 'var(--tekst)', margin: '2px 0 -4px' } });
  if (!cmyk) rijk.label.style.display = 'none';

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    ruimteUitleg,
    twee(veldMetLabel('Tintstappen', stap), veldMetLabel('Marge', marge, 'mm')),
    kop('Combinaties'),
    maak('div', { stijl: { display: 'flex', gap: '14px', flexWrap: 'wrap' } }, ...combis.map((c) => c.label)),
    maak('div', { stijl: { display: 'flex', gap: '14px', flexWrap: 'wrap' } }, rijk.label, labels.label),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    stap: Number(stap.value) || 10,
    marge: begrens(leesGetal(marge, 12), 0, 50),
    combi: [0, 1, 2, 3].map((i) => (combis[i] ? combis[i].vak.checked : w0.combi[i] !== false)),
    rijkZwart: rijk.vak.checked,
    labels: labels.vak.checked,
  });

  function teken() {
    const w = waarden();
    const ind = indeling(doc, w);
    let tekst;
    if (ind.fout) tekst = ind.fout;
    else {
      tekst = `${ind.rijen.length} rijen, ${ind.aantal} vlakjes van ${mmTekst(ind.vlakB / PT)} × ${mmTekst(ind.vlakH / PT)} mm.`;
    }
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier geen kaart maken.';
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', Boolean(ind.fout));
    maakKnop.disabled = doc.alleenLezen || Boolean(ind.fout);

    const schaal = devicePixelRatio || 1;
    const kader = voorbeeld.getBoundingClientRect();
    voorbeeld.width = Math.round(kader.width * schaal);
    voorbeeld.height = Math.round(kader.height * schaal);
    const g = voorbeeld.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const tb = doc.tekengebied.b;
    const th = doc.tekengebied.h;
    const s = Math.min((kader.width - 8) / tb, (kader.height - 8) / th);
    const ox = (kader.width - tb * s) / 2;
    const oy = (kader.height - th * s) / 2;
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, tb * s, th * s);
    g.strokeStyle = css('--lijn', vexel.thema.lijn);
    g.strokeRect(ox - 0.5, oy - 0.5, tb * s + 1, th * s + 1);
    if (ind.fout) return;
    g.fillStyle = '#222222';
    g.fillRect(ox + ind.marge * s, oy + (ind.marge + 3 * PT) * s, Math.min(ind.breedte, 60 * PT) * s, 3 * PT * s);
    for (const rij of ind.rijen) {
      g.fillStyle = '#888888';
      g.fillRect(ox + ind.marge * s, oy + (rij.kopY - 2 * PT) * s, 18 * PT * s, 1.5 * PT * s);
      for (const v of rij.vlakken) {
        g.fillStyle = `rgb(${v.rgb.map(Math.round).join(', ')})`;
        g.fillRect(ox + v.x * s, oy + v.y * s, Math.max(0.5, v.b * s), v.h * s);
      }
    }
  }

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const w = waarden();
    const ind = indeling(doc, w);
    if (ind.fout) return vexel.melding(ind.fout, 'let');
    const vormen = bouwVormen(w, ind);
    if (telVormen(vormen) > 5000) return vexel.melding('Dat worden te veel vormen; kies grotere stappen.', 'let');

    maakKnop.disabled = true;
    try {
      await vexel.maak(vormen);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Kleurenkaart gemaakt: ${ind.aantal} vlakjes in ${ind.rijen.length} rijen.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De kleurenkaart kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  stap.focus();
}

vexel.opCommando('maken', toonVenster);
