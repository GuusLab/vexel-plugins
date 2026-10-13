// Raster: verdeel het tekengebied in kolommen en rijen met gelijke tussenruimte.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { kolommen: 3, rijen: 4, tussenruimte: 5, marge: 10, stijl: 'lijn' };

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

function getalVeld(id, waarde, min, max, stap) {
  return maak('input', { klasse: 'veld', id, type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
}

function veldMetLabel(labelTekst, veld, eenheid) {
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld);
  veld.style.flex = '1';
  veld.style.minWidth = '0';
  if (eenheid) regel.append(maak('span', { klasse: 'uitleg', tekst: eenheid }));
  return maak('label', { stijl: { display: 'grid', gap: '4px' } }, maak('span', { klasse: 'label', tekst: labelTekst }), regel);
}

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const mmTekst = (n) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

// ---- de rekensom ----------------------------------------------------------

/** Geeft de vakken in pt terug, of een foutmelding als het niet past. */
function berekenVakken(tekengebied, w) {
  const marge = vexel.mm(w.marge);
  const tussen = vexel.mm(w.tussenruimte);
  const breedte = (tekengebied.b - 2 * marge - (w.kolommen - 1) * tussen) / w.kolommen;
  const hoogte = (tekengebied.h - 2 * marge - (w.rijen - 1) * tussen) / w.rijen;
  if (!(breedte > 0.5) || !(hoogte > 0.5)) {
    return { fout: 'Dat past niet: maak de marge of tussenruimte kleiner, of kies minder vakken.' };
  }
  const vakken = [];
  for (let r = 0; r < w.rijen; r++) {
    for (let k = 0; k < w.kolommen; k++) {
      vakken.push({ x: marge + k * (breedte + tussen), y: marge + r * (hoogte + tussen), b: breedte, h: hoogte });
    }
  }
  return { vakken, breedte, hoogte };
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const opgeslagen = (await vexel.haal('instellingen')) || {};
  const w0 = { ...STANDAARD, ...opgeslagen };

  const velden = {
    kolommen: getalVeld('kolommen', w0.kolommen, 1, 50, 1),
    rijen: getalVeld('rijen', w0.rijen, 1, 50, 1),
    tussenruimte: getalVeld('tussenruimte', w0.tussenruimte, 0, 200, 0.5),
    marge: getalVeld('marge', w0.marge, 0, 200, 0.5),
  };
  const stijl = maak('select', { klasse: 'veld', id: 'stijl' },
    maak('option', { value: 'lijn', tekst: 'Alleen een lijn' }),
    maak('option', { value: 'vlak', tekst: 'Licht gevulde vakken' }),
  );
  stijl.value = w0.stijl === 'vlak' ? 'vlak' : 'lijn';

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '96px', display: 'block' } });
  const maat = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Raster maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const raster = (...kinderen) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, ...kinderen);
  const formulier = maak('form', { stijl: { display: 'grid', gap: '12px', padding: '14px' } },
    raster(veldMetLabel('Kolommen', velden.kolommen), veldMetLabel('Rijen', velden.rijen)),
    raster(veldMetLabel('Tussenruimte', velden.tussenruimte, 'mm'), veldMetLabel('Marge', velden.marge, 'mm')),
    veldMetLabel('Weergave', stijl),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '8px' } },
      voorbeeld),
    maat,
    maak('div', { klasse: 'rij', stijl: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    kolommen: Math.round(begrens(leesGetal(velden.kolommen, 1), 1, 50)),
    rijen: Math.round(begrens(leesGetal(velden.rijen, 1), 1, 50)),
    tussenruimte: begrens(leesGetal(velden.tussenruimte, 0), 0, 200),
    marge: begrens(leesGetal(velden.marge, 0), 0, 200),
    stijl: stijl.value,
  });

  function teken() {
    const w = waarden();
    const uitkomst = berekenVakken(doc.tekengebied, w);
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    if (doc.alleenLezen) maat.textContent = 'Dit document is alleen-lezen.';
    else if (uitkomst.fout) maat.textContent = uitkomst.fout;
    else {
      const pt = vexel.mm(1);
      maat.textContent = `${w.kolommen * w.rijen} vakken van ${mmTekst(uitkomst.breedte / pt)} × ${mmTekst(uitkomst.hoogte / pt)} mm.`;
    }

    const schaal = devicePixelRatio || 1;
    const kader = voorbeeld.getBoundingClientRect();
    voorbeeld.width = Math.round(kader.width * schaal);
    voorbeeld.height = Math.round(kader.height * schaal);
    const g = voorbeeld.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const s = Math.min((kader.width - 4) / doc.tekengebied.b, (kader.height - 4) / doc.tekengebied.h);
    const ox = (kader.width - doc.tekengebied.b * s) / 2;
    const oy = (kader.height - doc.tekengebied.h * s) / 2;
    g.fillStyle = css('--bg', '#1b1b1f');
    g.strokeStyle = css('--lijn', '#3a3a42');
    g.fillRect(ox, oy, doc.tekengebied.b * s, doc.tekengebied.h * s);
    g.strokeRect(ox + 0.5, oy + 0.5, doc.tekengebied.b * s - 1, doc.tekengebied.h * s - 1);
    if (uitkomst.vakken) {
      const accent = css('--accent', '#5aa2ff');
      g.strokeStyle = accent;
      g.fillStyle = accent;
      for (const v of uitkomst.vakken) {
        if (w.stijl === 'vlak') {
          g.globalAlpha = 0.25;
          g.fillRect(ox + v.x * s, oy + v.y * s, v.b * s, v.h * s);
          g.globalAlpha = 1;
        }
        g.strokeRect(ox + v.x * s + 0.5, oy + v.y * s + 0.5, Math.max(0, v.b * s - 1), Math.max(0, v.h * s - 1));
      }
    }
  }

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const uitkomst = berekenVakken(doc.tekengebied, w);
    if (uitkomst.fout) return vexel.melding(uitkomst.fout, 'let');

    const cmyk = doc.kleurruimte === 'cmyk';
    const lijn = cmyk ? { cmyk: [70, 15, 0, 0] } : { hex: '#3d9be9' };
    const vulling = w.stijl === 'vlak' ? (cmyk ? { cmyk: [20, 4, 0, 0] } : { hex: '#d5e9fb' }) : null;
    const vormen = uitkomst.vakken.map((v, i) => ({
      soort: 'rechthoek', ...v, vulling, lijn, lijndikte: 0.5, naam: `Vak ${i + 1}`,
    }));

    maakKnop.disabled = true;
    try {
      await vexel.maak([{ soort: 'groep', naam: `Raster ${w.kolommen} × ${w.rijen}`, kinderen: vormen }]);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Raster gemaakt: ${vormen.length} vakken.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het raster kon niet worden gemaakt.', 'fout');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') vexel.sluit();
  });

  teken();
  velden.kolommen.focus();
  velden.kolommen.select();
}

vexel.opCommando('maken', toonVenster);
