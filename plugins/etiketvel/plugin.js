// Etiketvel: zet de contouren van etiketten op een vel, in kolommen en rijen.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const PT = vexel.mm(1);
const MAX_ETIKETTEN = 4999;

// Veelvoorkomende vellen op A4 (210 × 297 mm), alleen beschreven met maten.
// Ze worden altijd gecentreerd; de marges die daaruit volgen staan erachter.
const VOORINSTELLINGEN = [
  { id: 'a4-3x8-70x36', vorm: 'recht', b: 70, h: 36, k: 3, r: 8, th: 0, tv: 0, afr: 0 }, // marge 0 / 4,5
  { id: 'a4-3x8-70x37', vorm: 'recht', b: 70, h: 37, k: 3, r: 8, th: 0, tv: 0, afr: 0 }, // marge 0 / 0,5
  { id: 'a4-3x11-70x25', vorm: 'recht', b: 70, h: 25.4, k: 3, r: 11, th: 0, tv: 0, afr: 0 }, // 0 / 8,8
  { id: 'a4-2x7-99x38', vorm: 'recht', b: 99.1, h: 38.1, k: 2, r: 7, th: 2.5, tv: 0, afr: 2.5 }, // 4,65 / 15,15
  { id: 'a4-2x8-99x34', vorm: 'recht', b: 99.1, h: 33.9, k: 2, r: 8, th: 2.5, tv: 0, afr: 2.5 }, // 4,65 / 12,9
  { id: 'a4-2x4-99x68', vorm: 'recht', b: 99.1, h: 67.7, k: 2, r: 4, th: 2.5, tv: 0, afr: 2.5 }, // 4,65 / 13,1
  { id: 'a4-3x7-64x38', vorm: 'recht', b: 63.5, h: 38.1, k: 3, r: 7, th: 2.5, tv: 0, afr: 2 }, // 7,25 / 15,15
  { id: 'a4-3x8-64x34', vorm: 'recht', b: 63.5, h: 33.9, k: 3, r: 8, th: 2.5, tv: 0, afr: 2 }, // 7,25 / 12,9
  { id: 'a4-4x10-49x25', vorm: 'recht', b: 48.5, h: 25.4, k: 4, r: 10, th: 0, tv: 0, afr: 0 }, // 8 / 21,5
  { id: 'a4-5x13-38x21', vorm: 'recht', b: 38.1, h: 21.2, k: 5, r: 13, th: 2.5, tv: 0, afr: 1.5 }, // 4,75 / 10,7
  { id: 'a4-1x2-210x148', vorm: 'recht', b: 210, h: 148.5, k: 1, r: 2, th: 0, tv: 0, afr: 0 }, // 0 / 0
  { id: 'a4-1x1-210x297', vorm: 'recht', b: 210, h: 297, k: 1, r: 1, th: 0, tv: 0, afr: 0 }, // 0 / 0
  { id: 'a4-rond-30', vorm: 'rond', b: 30, h: 30, k: 5, r: 7, th: 8, tv: 8, afr: 0 }, // 14 / 19,5
  { id: 'a4-rond-40', vorm: 'rond', b: 40, h: 40, k: 4, r: 6, th: 7, tv: 7, afr: 0 }, // 14,5 / 11
  { id: 'a4-rond-60', vorm: 'rond', b: 60, h: 60, k: 3, r: 4, th: 5, tv: 10, afr: 0 }, // 10 / 13,5
  { id: 'a4-ovaal-60x40', vorm: 'rond', b: 60, h: 40, k: 3, r: 6, th: 5, tv: 5, afr: 0 }, // 10 / 16
];

const STANDAARD = {
  voorinstelling: 'a4-3x8-70x36', vorm: 'recht', breedte: 70, hoogte: 36, kolommen: 3, rijen: 8,
  tussenH: 0, tussenV: 0, plaatsing: 'midden', margeL: 0, margeB: 4.5, afronding: 0, kleur: 'neutraal',
};

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
const mmTekst = (n) => (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

function voorinstellingNaam(v) {
  if (v.vorm === 'rond') {
    const maat = v.b === v.h ? `rond ${mmTekst(v.b)} mm` : `ovaal ${mmTekst(v.b)} × ${mmTekst(v.h)} mm`;
    return `A4 · ${v.k} × ${v.r} · ${maat}`;
  }
  return `A4 · ${v.k} × ${v.r} · ${mmTekst(v.b)} × ${mmTekst(v.h)} mm`;
}

// ---- de rekensom (mm) ---------------------------------------------------------

/** Rekent de plaats van alle etiketten uit, of geeft een foutmelding. */
function bereken(w, tekengebied) {
  const tb = tekengebied.b / PT;
  const th = tekengebied.h / PT;
  const totaalB = w.kolommen * w.breedte + (w.kolommen - 1) * w.tussenH;
  const totaalH = w.rijen * w.hoogte + (w.rijen - 1) * w.tussenV;
  const aantal = w.kolommen * w.rijen;
  const x0 = w.plaatsing === 'midden' ? (tb - totaalB) / 2 : w.margeL;
  const y0 = w.plaatsing === 'midden' ? (th - totaalH) / 2 : w.margeB;
  const marges = { l: x0, b: y0, r: tb - x0 - totaalB, o: th - y0 - totaalH };
  const past = Object.values(marges).every((m) => m > -0.01);
  const uit = { totaalB, totaalH, aantal, x0, y0, marges, past, tb, th };
  if (aantal > MAX_ETIKETTEN) {
    uit.fout = `Dat zijn ${aantal.toLocaleString('nl-NL')} etiketten; er kunnen er hooguit ${MAX_ETIKETTEN.toLocaleString('nl-NL')} in één keer. Kies minder kolommen of rijen.`;
  }
  return uit;
}

function etiketVorm(w, x, y, naam) {
  const b = w.breedte * PT;
  const h = w.hoogte * PT;
  if (w.vorm === 'rond') return { soort: 'ellips', naam, cx: x + b / 2, cy: y + h / 2, rx: b / 2, ry: h / 2 };
  const r = Math.min(w.afronding, w.breedte / 2, w.hoogte / 2) * PT;
  if (!(r > 0.01)) return { soort: 'rechthoek', naam, x, y, b, h };
  const k = r * 0.5522847498;
  const x1 = x + b;
  const y1 = y + h;
  return {
    soort: 'pad', naam,
    subpaden: [{
      gesloten: true,
      punten: [
        { x: x + r, y, in: { x: x + r - k, y } },
        { x: x1 - r, y, uit: { x: x1 - r + k, y } },
        { x: x1, y: y + r, in: { x: x1, y: y + r - k } },
        { x: x1, y: y1 - r, uit: { x: x1, y: y1 - r + k } },
        { x: x1 - r, y: y1, in: { x: x1 - r + k, y: y1 } },
        { x: x + r, y: y1, uit: { x: x + r - k, y: y1 } },
        { x, y: y1 - r, in: { x, y: y1 - r + k } },
        { x, y: y + r, uit: { x, y: y + r - k } },
      ],
    }],
  };
}

function groepNaam(w) {
  const maat = w.vorm === 'rond'
    ? (w.breedte === w.hoogte ? `rond ${mmTekst(w.breedte)} mm` : `ovaal ${mmTekst(w.breedte)} × ${mmTekst(w.hoogte)} mm`)
    : `${mmTekst(w.breedte)} × ${mmTekst(w.hoogte)} mm`;
  return `Etiketvel ${w.kolommen} × ${w.rijen} · ${maat}`;
}

function bouwVormen(w, uitkomst, cmyk) {
  const lijn = w.kleur === 'snijlijn'
    ? (cmyk ? { cmyk: [0, 100, 0, 0] } : { hex: '#e5007d' })
    : (cmyk ? { cmyk: [0, 0, 0, 50] } : { hex: '#8c8c8c' });
  const kinderen = [];
  let n = 0;
  for (let r = 0; r < w.rijen; r++) {
    for (let k = 0; k < w.kolommen; k++) {
      n += 1;
      const x = (uitkomst.x0 + k * (w.breedte + w.tussenH)) * PT;
      const y = (uitkomst.y0 + r * (w.hoogte + w.tussenV)) * PT;
      kinderen.push({ ...etiketVorm(w, x, y, `Etiket ${n}`), vulling: null, lijn, lijndikte: 0.25 });
    }
  }
  return [{ soort: 'groep', naam: groepNaam(w), kinderen }];
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const keuzes = { eigen: 'Eigen maten' };
  for (const v of VOORINSTELLINGEN) keuzes[v.id] = voorinstellingNaam(v);
  const voorinstelling = keuzeLijst('voorinstelling', keuzes, w0.voorinstelling);
  const vorm = keuzeLijst('vorm', { recht: 'Rechthoek', rond: 'Rond of ovaal' }, w0.vorm);
  const kleur = keuzeLijst('kleur', { neutraal: 'Grijs (50% zwart)', snijlijn: 'Snijlijn (100% magenta)' }, w0.kleur);
  const plaatsing = keuzeLijst('plaatsing', { midden: 'Centreren', marges: 'Eigen marges' }, w0.plaatsing);
  const v = {
    breedte: getalVeld('breedte', w0.breedte, 1, 1000, 0.1),
    hoogte: getalVeld('hoogte', w0.hoogte, 1, 1000, 0.1),
    afronding: getalVeld('afronding', w0.afronding, 0, 500, 0.5),
    kolommen: getalVeld('kolommen', w0.kolommen, 1, 500, 1),
    rijen: getalVeld('rijen', w0.rijen, 1, 500, 1),
    tussenH: getalVeld('tussenH', w0.tussenH, 0, 500, 0.1),
    tussenV: getalVeld('tussenV', w0.tussenV, 0, 500, 0.1),
    margeL: getalVeld('margeL', w0.margeL, -500, 1000, 0.1),
    margeB: getalVeld('margeB', w0.margeB, -500, 1000, 0.1),
  };
  const afrondingVak = veldMetLabel('Hoekafronding', v.afronding, 'mm');
  const margeVakken = [veldMetLabel('Marge links', v.margeL, 'mm'), veldMetLabel('Marge boven', v.margeB, 'mm')];

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '180px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Etiketten maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const kolom = (n, ...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: '8px' } }, ...k);
  const kop = (tekst) => maak('div', { klasse: 'label', tekst, stijl: { fontWeight: '600', color: 'var(--tekst)', margin: '2px 0 -4px' } });

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    veldMetLabel('Vel', voorinstelling),
    kop('Etiket'),
    kolom(3, veldMetLabel('Vorm', vorm), veldMetLabel('Breedte', v.breedte, 'mm'), veldMetLabel('Hoogte', v.hoogte, 'mm')),
    kolom(2, afrondingVak, veldMetLabel('Lijnkleur', kleur)),
    kop('Indeling'),
    kolom(4, veldMetLabel('Kolommen', v.kolommen), veldMetLabel('Rijen', v.rijen),
      veldMetLabel('Tussen ↔', v.tussenH, 'mm'), veldMetLabel('Tussen ↕', v.tussenV, 'mm')),
    kolom(3, veldMetLabel('Plaatsing', plaatsing), ...margeVakken),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    voorinstelling: voorinstelling.value,
    vorm: vorm.value,
    breedte: begrens(leesGetal(v.breedte, 70), 1, 1000),
    hoogte: begrens(leesGetal(v.hoogte, 36), 1, 1000),
    afronding: begrens(leesGetal(v.afronding, 0), 0, 500),
    kolommen: Math.round(begrens(leesGetal(v.kolommen, 1), 1, 500)),
    rijen: Math.round(begrens(leesGetal(v.rijen, 1), 1, 500)),
    tussenH: begrens(leesGetal(v.tussenH, 0), 0, 500),
    tussenV: begrens(leesGetal(v.tussenV, 0), 0, 500),
    plaatsing: plaatsing.value,
    margeL: begrens(leesGetal(v.margeL, 0), -500, 1000),
    margeB: begrens(leesGetal(v.margeB, 0), -500, 1000),
    kleur: kleur.value,
  });

  function vulVoorinstelling() {
    const p = VOORINSTELLINGEN.find((x) => x.id === voorinstelling.value);
    if (!p) return;
    vorm.value = p.vorm;
    v.breedte.value = p.b;
    v.hoogte.value = p.h;
    v.kolommen.value = p.k;
    v.rijen.value = p.r;
    v.tussenH.value = p.th;
    v.tussenV.value = p.tv;
    v.afronding.value = p.afr;
    plaatsing.value = 'midden';
  }

  function teken() {
    const w = waarden();
    const uitkomst = bereken(w, doc.tekengebied);
    const rond = w.vorm === 'rond';
    v.afronding.disabled = rond;
    afrondingVak.style.opacity = rond ? '0.45' : '1';
    const eigenMarges = w.plaatsing === 'marges';
    for (const [i, vak] of margeVakken.entries()) {
      vak.style.opacity = eigenMarges ? '1' : '0.45';
      (i ? v.margeB : v.margeL).disabled = !eigenMarges;
    }
    if (!eigenMarges) {
      v.margeL.value = Math.round(uitkomst.x0 * 100) / 100;
      v.margeB.value = Math.round(uitkomst.y0 * 100) / 100;
    }

    const maat = rond && w.breedte === w.hoogte ? `rond ${mmTekst(w.breedte)} mm` : `${mmTekst(w.breedte)} × ${mmTekst(w.hoogte)} mm`;
    let tekst = `${uitkomst.aantal} ${uitkomst.aantal === 1 ? 'etiket' : 'etiketten'} ${rond && w.breedte === w.hoogte ? '' : 'van '}${maat}`
      + ` · marge links ${mmTekst(uitkomst.marges.l)}, boven ${mmTekst(uitkomst.marges.b)} mm.`;
    const afr = Math.min(w.afronding, w.breedte / 2, w.hoogte / 2);
    if (!rond && w.afronding > afr + 0.001) tekst += ` Hoekafronding begrensd tot ${mmTekst(afr)} mm.`;
    if (!uitkomst.past) {
      tekst += ` Past niet op het tekengebied (${mmTekst(uitkomst.tb)} × ${mmTekst(uitkomst.th)} mm): `
        + 'kies minder of kleinere etiketten.';
    }
    if (uitkomst.fout) tekst = uitkomst.fout;
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier geen etiketten maken.';
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout) || !uitkomst.past);
    maakKnop.disabled = doc.alleenLezen || Boolean(uitkomst.fout);

    // voorvertoning: het tekengebied met de etiketten erop
    const schaal = devicePixelRatio || 1;
    const kader = voorbeeld.getBoundingClientRect();
    voorbeeld.width = Math.round(kader.width * schaal);
    voorbeeld.height = Math.round(kader.height * schaal);
    const g = voorbeeld.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const minX = Math.min(0, uitkomst.x0);
    const minY = Math.min(0, uitkomst.y0);
    const maxX = Math.max(uitkomst.tb, uitkomst.x0 + uitkomst.totaalB);
    const maxY = Math.max(uitkomst.th, uitkomst.y0 + uitkomst.totaalH);
    const s = Math.min((kader.width - 8) / (maxX - minX), (kader.height - 8) / (maxY - minY));
    const ox = (kader.width - (maxX - minX) * s) / 2 - minX * s;
    const oy = (kader.height - (maxY - minY) * s) / 2 - minY * s;
    g.fillStyle = css('--bg', vexel.thema.bg);
    g.fillRect(ox, oy, uitkomst.tb * s, uitkomst.th * s);
    g.strokeStyle = uitkomst.past ? css('--lijn', vexel.thema.lijn) : '#ff5c5c';
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, uitkomst.tb * s - 1, uitkomst.th * s - 1);
    if (uitkomst.fout) return;
    g.strokeStyle = w.kleur === 'snijlijn' ? '#ff4fb4' : css('--tekst-zacht', vexel.thema.tekstZacht);
    g.fillStyle = 'rgba(90, 162, 255, 0.10)';
    const eb = w.breedte * s;
    const eh = w.hoogte * s;
    const r = Math.min(afr * s, eb / 2, eh / 2);
    g.beginPath();
    for (let rij = 0; rij < w.rijen; rij++) {
      for (let k = 0; k < w.kolommen; k++) {
        const x = ox + (uitkomst.x0 + k * (w.breedte + w.tussenH)) * s;
        const y = oy + (uitkomst.y0 + rij * (w.hoogte + w.tussenV)) * s;
        g.moveTo(x + (rond ? eb : eb - r), y + (rond ? eh / 2 : 0));
        if (rond) g.ellipse(x + eb / 2, y + eh / 2, eb / 2, eh / 2, 0, 0, Math.PI * 2);
        else if (r > 0.3) g.roundRect(x, y, eb, eh, r);
        else g.rect(x, y, eb, eh);
      }
    }
    g.fill();
    g.lineWidth = 0.8;
    g.stroke();
  }

  const maatVelden = new Set([vorm, plaatsing, v.breedte, v.hoogte, v.afronding, v.kolommen, v.rijen, v.tussenH, v.tussenV, v.margeL, v.margeB]);
  formulier.addEventListener('input', (e) => {
    if (e.target === voorinstelling) vulVoorinstelling();
    else if (maatVelden.has(e.target)) voorinstelling.value = 'eigen';
    teken();
  });
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const uitkomst = bereken(w, doc.tekengebied);
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    if (uitkomst.fout) return vexel.melding(uitkomst.fout, 'let');

    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(w, uitkomst, doc.kleurruimte === 'cmyk'));
      await vexel.bewaar('instellingen', w);
      const wat = `${uitkomst.aantal} ${uitkomst.aantal === 1 ? 'etiket' : 'etiketten'}`;
      if (uitkomst.past) vexel.melding(`Etiketvel gemaakt: ${wat}.`, 'ok');
      else vexel.melding(`Etiketvel gemaakt: ${wat}, maar ze vallen buiten het tekengebied.`, 'let');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het etiketvel kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  voorinstelling.focus();
}

vexel.opCommando('maken', toonVenster);
