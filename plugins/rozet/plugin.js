// Rozet: teken een rozetpatroon (een rolkromme) als één gesloten pad.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { lussen: 12, windingen: 5, verhouding: 0.8, straal: 40, lijndikte: 0.5, kleur: 'zwart' };

const KLEUREN = {
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
  blauw: { naam: 'Diepblauw', cmyk: [100, 70, 0, 10], hex: '#1f4fa3' },
  rood: { naam: 'Warm rood', cmyk: [0, 90, 85, 0], hex: '#e2402f' },
  groen: { naam: 'Groen', cmyk: [80, 0, 70, 10], hex: '#1d9a63' },
  goud: { naam: 'Oker', cmyk: [0, 30, 90, 10], hex: '#d9a521' },
};

// ---- de kromme -------------------------------------------------------------
// Een kleine cirkel (straal r) rolt binnen in een grote cirkel (straal 1).
// Een pen op afstand d van het midden van de kleine cirkel tekent de rozet.
// Met r = windingen / lussen sluit de kromme na `windingen` rondes.

function grootsteDeler(a, b) {
  return b ? grootsteDeler(b, a % b) : a;
}

/** Punten van de rozet rond (0, 0), geschaald zodat de buitenrand op `straal` ligt. */
function rozetPunten(w, straal) {
  const deler = grootsteDeler(w.lussen, w.windingen);
  const lussen = w.lussen / deler;
  const windingen = w.windingen / deler;
  const r = windingen / lussen;
  const d = w.verhouding * r;
  const k = (1 - r) / r;
  const rand = Math.abs(1 - r) + d;
  const schaal = rand > 0 ? straal / rand : 0;
  const aantal = Math.min(20000, Math.max(720, 64 * lussen));
  const eind = 2 * Math.PI * windingen;
  const punten = [];
  for (let i = 0; i < aantal; i++) {
    const t = (i / aantal) * eind;
    punten.push({
      x: ((1 - r) * Math.cos(t) + d * Math.cos(k * t)) * schaal,
      y: ((1 - r) * Math.sin(t) - d * Math.sin(k * t)) * schaal,
    });
  }
  return punten;
}

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

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const getal = (n, cijfers = 2) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });

/** Een schuif met de waarde ernaast. */
function schuif(label, waarde, min, max, stap) {
  const invoer = maak('input', { type: 'range', min, max, step: stap, value: waarde, stijl: { width: '100%', margin: '0', accentColor: 'var(--accent)' } });
  const uitkomst = maak('output', { klasse: 'uitleg', stijl: { minWidth: '34px', textAlign: 'right' } });
  const toon = () => { uitkomst.textContent = getal(Number(invoer.value)); };
  invoer.addEventListener('input', toon);
  toon();
  const blok = maak('label', { stijl: { display: 'grid', gap: '2px' } },
    maak('span', { klasse: 'label', tekst: label }),
    maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '8px' } }, invoer, uitkomst));
  return { blok, invoer };
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const lussen = schuif('Lussen', w0.lussen, 3, 48, 1);
  const windingen = schuif('Windingen', w0.windingen, 1, 15, 1);
  const verhouding = schuif('Verhouding pen / wiel', w0.verhouding, 0.1, 3, 0.05);
  const straal = maak('input', { klasse: 'veld', type: 'number', min: 2, max: 1000, step: 1, value: w0.straal });
  const dikte = maak('input', { klasse: 'veld', type: 'number', min: 0.1, max: 10, step: 0.1, value: w0.lijndikte });
  const kleur = maak('select', { klasse: 'veld' },
    ...Object.entries(KLEUREN).map(([sleutel, k]) => maak('option', { value: sleutel, tekst: k.naam })));
  kleur.value = KLEUREN[w0.kleur] ? w0.kleur : 'zwart';

  const doek = maak('canvas', {
    'aria-hidden': 'true',
    stijl: { width: '168px', height: '168px', display: 'block', borderRadius: '8px', background: 'var(--bg-2)', flex: 'none' },
  });
  const tip = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Rozet maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const labelMet = (tekst, veld) =>
    maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, maak('span', { klasse: 'label', tekst }), veld);

  const formulier = maak('form', { stijl: { display: 'grid', gap: '12px', padding: '14px' } },
    maak('div', { stijl: { display: 'flex', gap: '14px', alignItems: 'flex-start' } },
      doek,
      maak('div', { stijl: { display: 'grid', gap: '10px', flex: '1', minWidth: '0' } },
        lussen.blok, windingen.blok, verhouding.blok)),
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: '10px' } },
      labelMet('Straal (mm)', straal), labelMet('Lijn (pt)', dikte), labelMet('Kleur', kleur)),
    tip,
    maak('div', { klasse: 'rij', stijl: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    lussen: Math.round(begrens(leesGetal(lussen.invoer, 12), 3, 48)),
    windingen: Math.round(begrens(leesGetal(windingen.invoer, 5), 1, 15)),
    verhouding: begrens(leesGetal(verhouding.invoer, 0.8), 0.1, 3),
    straal: begrens(leesGetal(straal, 40), 2, 1000),
    lijndikte: begrens(leesGetal(dikte, 0.5), 0.1, 10),
    kleur: kleur.value,
  });

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    const maat = 168;
    const schaal = devicePixelRatio || 1;
    doek.width = maat * schaal;
    doek.height = maat * schaal;
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, (maat / 2) * schaal, (maat / 2) * schaal);
    g.clearRect(-maat / 2, -maat / 2, maat, maat);
    const punten = rozetPunten(w, maat / 2 - 8);
    g.beginPath();
    punten.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.lineWidth = 1;
    g.lineJoin = 'round';
    g.strokeStyle = css('--accent', '#5aa2ff');
    g.stroke();

    if (doc.alleenLezen) tip.textContent = 'Dit document is alleen-lezen.';
    else if (w.windingen >= w.lussen) tip.textContent = 'Tip: met minder windingen dan lussen wordt het patroon rijker.';
    else if (grootsteDeler(w.lussen, w.windingen) > 1) tip.textContent = 'Lussen en windingen hebben een gemeenschappelijke deler, dus het patroon is eenvoudiger.';
    else tip.textContent = `Eén pad van ${punten.length} punten, ${getal(w.straal * 2, 1)} mm breed, midden op het tekengebied.`;
    maakKnop.disabled = doc.alleenLezen;
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const cx = doc.tekengebied.b / 2;
    const cy = doc.tekengebied.h / 2;
    const punten = rozetPunten(w, vexel.mm(w.straal)).map((p) => ({ x: cx + p.x, y: cy + p.y }));
    const k = KLEUREN[w.kleur];
    const vorm = {
      soort: 'pad',
      naam: `Rozet ${w.lussen}/${w.windingen}`,
      subpaden: [{ gesloten: true, punten }],
      vulling: null,
      lijn: doc.kleurruimte === 'cmyk' ? { cmyk: k.cmyk } : { hex: k.hex },
      lijndikte: w.lijndikte,
    };

    maakKnop.disabled = true;
    try {
      await vexel.maak([vorm]);
      await vexel.bewaar('instellingen', w);
      vexel.melding('Rozet gemaakt.', 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De rozet kon niet worden gemaakt.', 'fout');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') vexel.sluit();
  });

  teken();
  lussen.invoer.focus();
}

vexel.opCommando('maken', toonVenster);
