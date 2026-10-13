// Kleurharmonie: zet een rij vlakjes met kleuren die bij de gekozen kleur passen.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { harmonie: 'analoog', plaats: 'onder', grootte: 15, tussenruimte: 3, waarden: true };

const HARMONIEEN = {
  complementair: { naam: 'Complementair', uitleg: 'De kleur, de tegenkleur en van beide een 50%-tint.' },
  analoog: { naam: 'Analoog', uitleg: 'Vijf buren op de kleurcirkel, telkens 20° verder.' },
  triade: { naam: 'Triade', uitleg: 'Drie kleuren op gelijke afstand van elkaar (120°).' },
  tinten: { naam: 'Tinten', uitleg: 'De kleur in 100, 80, 60, 40 en 20 procent.' },
};

// ---- kleur ---------------------------------------------------------------
// Een eenvoudige omrekening zonder kleurprofiel: goed genoeg om te kiezen,
// niet bedoeld als drukproef.

const rond = (n) => Math.round(Math.min(100, Math.max(0, n)));

function cmykNaarRgb([c, m, y, k]) {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z];
}

function rgbNaarCmyk([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 0.999) return [0, 0, 0, 100];
  return [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k].map((n) => rond(n * 100));
}

function rgbNaarHsl([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [h * 60, s, l];
}

function hslNaarRgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function hexNaarRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Zet een Kleur uit de API om naar CMYK, of null als het geen kleur is. */
function naarCmyk(kleur) {
  if (!kleur) return null;
  if (Array.isArray(kleur.cmyk) && kleur.cmyk.length === 4) return kleur.cmyk.map(rond);
  const rgb = hexNaarRgb(kleur.hex);
  return rgb ? rgbNaarCmyk(rgb) : null;
}

const draai = (cmyk, graden) => {
  const [h, s, l] = rgbNaarHsl(cmykNaarRgb(cmyk));
  return rgbNaarCmyk(hslNaarRgb([(h + graden + 360) % 360, s, l]));
};
const tint = (cmyk, factor) => cmyk.map((n) => rond(n * factor));

function harmonie(soort, basis) {
  switch (soort) {
    case 'complementair': {
      const tegen = draai(basis, 180);
      return [basis, tint(basis, 0.5), tint(tegen, 0.5), tegen];
    }
    case 'triade':
      return [basis, draai(basis, 120), draai(basis, 240)];
    case 'tinten':
      return [1, 0.8, 0.6, 0.4, 0.2].map((f) => tint(basis, f));
    default:
      return [-40, -20, 0, 20, 40].map((g) => (g === 0 ? basis : draai(basis, g)));
  }
}

const cmykTekst = ([c, m, y, k]) => `C${c} M${m} Y${y} K${k}`;
const cssKleur = (cmyk) => `rgb(${cmykNaarRgb(cmyk).map(Math.round).join(', ')})`;
const hex = (cmyk) => '#' + cmykNaarRgb(cmyk).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');

// ---- venster-hulpjes -------------------------------------------------------

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

const labelMet = (tekst, veld) =>
  maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, maak('span', { klasse: 'label', tekst }), veld);

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};

// ---- selectie ------------------------------------------------------------

async function leesSelectie() {
  try {
    const items = await vexel.selectie();
    if (!items.length) return { items };
    const metVulling = items.find((v) => naarCmyk(v.vulling));
    return { items, kleur: metVulling ? naarCmyk(metVulling.vulling) : null };
  } catch (fout) {
    return { items: [], fout };
  }
}

function omhullende(items) {
  if (!items.length) return null;
  const x0 = Math.min(...items.map((v) => v.kader.x));
  const y0 = Math.min(...items.map((v) => v.kader.y));
  const x1 = Math.max(...items.map((v) => v.kader.x + v.kader.b));
  const y1 = Math.max(...items.map((v) => v.kader.y + v.kader.h));
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  let selectie = await leesSelectie();
  let basis = selectie.kleur || w0.laatsteKleur || [0, 60, 100, 0];

  const kanalen = ['C', 'M', 'Y', 'K'].map((letter, i) =>
    maak('input', {
      klasse: 'veld', type: 'number', min: 0, max: 100, step: 1, value: basis[i],
      'aria-label': `${letter} (procent)`, stijl: { width: '100%', minWidth: '0' },
    }),
  );
  const staal = maak('div', {
    'aria-hidden': 'true',
    stijl: { width: '30px', height: '30px', borderRadius: '6px', border: '1px solid var(--lijn)', flex: 'none' },
  });
  const uitSelectie = maak('button', { klasse: 'knop', type: 'button', tekst: 'Uit selectie' });
  const selectieUitleg = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0' } });

  const keuze = maak('select', { klasse: 'veld' },
    ...Object.entries(HARMONIEEN).map(([waarde, h]) => maak('option', { value: waarde, tekst: h.naam })));
  keuze.value = HARMONIEEN[w0.harmonie] ? w0.harmonie : 'analoog';
  const plaats = maak('select', { klasse: 'veld' },
    maak('option', { value: 'onder', tekst: 'Onder de selectie' }),
    maak('option', { value: 'naast', tekst: 'Naast het tekengebied' }));
  plaats.value = w0.plaats === 'naast' ? 'naast' : 'onder';
  const grootte = maak('input', { klasse: 'veld', type: 'number', min: 3, max: 100, step: 1, value: w0.grootte });
  const tussen = maak('input', { klasse: 'veld', type: 'number', min: 0, max: 50, step: 0.5, value: w0.tussenruimte });
  const waardenVak = maak('input', { type: 'checkbox', stijl: { accentColor: 'var(--accent)', margin: '0' } });
  waardenVak.checked = w0.waarden !== false;

  const harmonieUitleg = maak('p', { klasse: 'uitleg', stijl: { margin: '0' } });
  const stalen = maak('div', { stijl: { display: 'flex', gap: '6px' }, 'aria-label': 'Voorbeeld' });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Vlakjes maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, ...k);
  const formulier = maak('form', { stijl: { display: 'grid', gap: '12px', padding: '14px' } },
    maak('div', { stijl: { display: 'grid', gap: '4px' } },
      maak('span', { klasse: 'label', tekst: 'Beginkleur (CMYK, procent)' }),
      maak('div', { stijl: { display: 'flex', gap: '6px', alignItems: 'center' } },
        staal,
        maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', flex: '1' } }, ...kanalen),
        uitSelectie)),
    selectieUitleg,
    twee(labelMet('Harmonie', keuze), labelMet('Plaats', plaats)),
    harmonieUitleg,
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '10px' } },
      stalen),
    twee(labelMet('Vlakje (mm)', grootte), labelMet('Tussenruimte (mm)', tussen)),
    maak('label', { klasse: 'rij', stijl: { display: 'flex', gap: '6px', alignItems: 'center' } },
      waardenVak, maak('span', { tekst: 'CMYK-waarden onder de vlakjes zetten' })),
    maak('div', { klasse: 'rij', stijl: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const leesBasis = () => kanalen.map((v, i) => rond(leesGetal(v, basis[i])));

  function vertelOverSelectie() {
    if (selectie.fout) selectieUitleg.textContent = 'De selectie kon niet worden gelezen.';
    else if (selectie.kleur) selectieUitleg.textContent = 'Beginkleur uit de selectie gehaald.';
    else if (selectie.items.length) selectieUitleg.textContent = 'De selectie heeft geen vulkleur; kies hierboven zelf een kleur.';
    else selectieUitleg.textContent = 'Niets geselecteerd; kies hierboven zelf een kleur.';
    if (plaats.value === 'onder' && !selectie.items.length) {
      selectieUitleg.textContent += ' De vlakjes komen naast het tekengebied.';
    }
  }

  function werkBij() {
    basis = leesBasis();
    staal.style.background = cssKleur(basis);
    harmonieUitleg.textContent = HARMONIEEN[keuze.value].uitleg;
    stalen.replaceChildren(...harmonie(keuze.value, basis).map((kleur) =>
      maak('div', { stijl: { flex: '1', display: 'grid', gap: '4px', minWidth: '0' } },
        maak('div', { title: cmykTekst(kleur), stijl: { height: '36px', borderRadius: '4px', background: cssKleur(kleur) } }),
        maak('span', {
          klasse: 'uitleg',
          tekst: `C${kleur[0]} M${kleur[1]}\nY${kleur[2]} K${kleur[3]}`,
          stijl: { fontSize: '10px', textAlign: 'center', whiteSpace: 'pre', fontVariantNumeric: 'tabular-nums' },
        }))));
    vertelOverSelectie();
    maakKnop.disabled = doc.alleenLezen;
    if (doc.alleenLezen) selectieUitleg.textContent = 'Dit document is alleen-lezen.';
  }

  uitSelectie.addEventListener('click', async () => {
    selectie = await leesSelectie();
    if (selectie.kleur) selectie.kleur.forEach((n, i) => { kanalen[i].value = n; });
    werkBij();
  });

  formulier.addEventListener('input', werkBij);
  formulier.addEventListener('change', werkBij);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const kleuren = harmonie(keuze.value, leesBasis());
    const maat = vexel.mm(Math.min(100, Math.max(3, leesGetal(grootte, 15))));
    const gat = vexel.mm(Math.min(50, Math.max(0, leesGetal(tussen, 3))));
    const metWaarden = waardenVak.checked;

    const kader = omhullende(selectie.items);
    let x;
    let y;
    if (plaats.value === 'onder' && kader) {
      x = kader.x;
      y = kader.y + kader.h + vexel.mm(5);
    } else {
      x = doc.tekengebied.b + vexel.mm(10);
      y = 0;
    }

    const cmyk = doc.kleurruimte === 'cmyk';
    const kinderen = [];
    kleuren.forEach((kleur, i) => {
      const kx = x + i * (maat + gat);
      kinderen.push({
        soort: 'rechthoek', x: kx, y, b: maat, h: maat, naam: cmykTekst(kleur),
        vulling: cmyk ? { cmyk: kleur } : { hex: hex(kleur) }, lijn: null,
      });
      if (metWaarden) {
        kinderen.push({
          soort: 'tekst', x: kx, y: y + maat + 8, inhoud: cmykTekst(kleur), grootte: 6,
          vulling: cmyk ? { cmyk: [0, 0, 0, 100] } : { hex: '#000000' }, naam: 'Waarde',
        });
      }
    });

    maakKnop.disabled = true;
    try {
      await vexel.maak([{ soort: 'groep', naam: `Kleurharmonie: ${HARMONIEEN[keuze.value].naam.toLowerCase()}`, kinderen }]);
      await vexel.bewaar('instellingen', {
        harmonie: keuze.value, plaats: plaats.value, grootte: leesGetal(grootte, 15),
        tussenruimte: leesGetal(tussen, 3), waarden: metWaarden, laatsteKleur: leesBasis(),
      });
      vexel.melding(`${kleuren.length} kleurvlakjes gemaakt.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De vlakjes konden niet worden gemaakt.', 'fout');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') vexel.sluit();
  });

  werkBij();
  keuze.focus();
}

vexel.opCommando('maken', toonVenster);
