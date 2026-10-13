// Contrastcheck: is tekst (of een vorm) goed leesbaar op zijn achtergrond?
// Rekent de contrastverhouding uit volgens de WCAG-formule en stelt zo nodig
// een iets lichtere of donkerdere kleur voor die het wel haalt.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const DOELEN = [
  { id: 'aa', naam: 'AA, gewone tekst', min: 4.5 },
  { id: 'aa-groot', naam: 'AA, grote tekst', min: 3 },
  { id: 'aaa', naam: 'AAA, gewone tekst', min: 7 },
  { id: 'aaa-groot', naam: 'AAA, grote tekst', min: 4.5 },
];

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

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));

/** Een verhouding naar beneden afgerond op twee decimalen: 4,496 is géén 4,5. */
const verhoudingTekst = (r) => (Math.floor(r * 100 + 1e-9) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- kleur ---------------------------------------------------------------

function hexNaarRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbNaarHex = (rgb) => '#' + rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');

const naarLineair = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const naarGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Relatieve luminantie volgens WCAG (sRGB). */
function luminantie(rgb) {
  const [r, g, b] = rgb.map((v) => naarLineair(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminantie(a);
  const lb = luminantie(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Kleur a met dekking over kleur b (zoals het scherm het mengt). */
const meng = (a, dekking, b) => a.map((v, i) => v * dekking + b[i] * (1 - dekking));

// CIE Lab (D65), om lichter en donkerder te maken zonder de tint te veranderen
const WIT = [0.95047, 1, 1.08883];
function rgbNaarLab(rgb) {
  const [r, g, b] = rgb.map((v) => naarLineair(v / 255));
  const xyz = [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ].map((v, i) => v / WIT[i]);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Lab naar sRGB (0..1 per kanaal, kan buiten het bereik vallen). */
function labNaarRgb01([l, a, b]) {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const [x, y, z] = [inv(fx), inv(fy), inv(fz)].map((v, i) => v * WIT[i]);
  const lin = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
  return lin.map((v) => naarGamma(Math.max(0, v)) * (v < 0 ? -1 : 1));
}

/** Lab naar een sRGB-kleur die bestaat: zo nodig met wat minder verzadiging. */
function labNaarRgb(lab) {
  const binnen = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let rgb = labNaarRgb01(lab);
  if (!binnen(rgb)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (binnen(labNaarRgb01([lab[0], lab[1] * m, lab[2] * m]))) lo = m;
      else hi = m;
    }
    rgb = labNaarRgb01([lab[0], lab[1] * lo, lab[2] * lo]);
  }
  return rgb.map((v) => Math.round(begrens(v, 0, 1) * 255));
}

const verschil = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// CMYK: een eenvoudige omrekening, alleen gebruikt om te schatten hoeveel een
// aanpassing scheelt. De echte schermkleur komt van Vexel (de hex in de selectie).
const cmykNaief = ([c, m, y, k]) => [c, m, y].map((v) => 255 * (1 - v / 100) * (1 - k / 100));

/** Schat de schermkleur van cmyk2, uitgaande van wat Vexel van cmyk1 maakte (hex1). */
function schatCmyk(cmyk1, rgb1, cmyk2, lichter) {
  const n1 = cmykNaief(cmyk1).map((v) => naarLineair(v / 255));
  const n2 = cmykNaief(cmyk2).map((v) => naarLineair(v / 255));
  const p1 = rgb1.map((v) => naarLineair(v / 255));
  const uit = p1.map((p, i) => {
    if (lichter) {
      // lichter: het donkere deel slinkt naar rato
      const d1 = 1 - n1[i];
      return d1 < 1e-6 ? p : 1 - (1 - p) * ((1 - n2[i]) / d1);
    }
    // donkerder: alleen meer zwart, dus elk kanaal zakt evenveel
    return p * (naarLineair(1 - cmyk2[3] / 100) / Math.max(1e-6, naarLineair(1 - cmyk1[3] / 100)));
  });
  return uit.map((v) => Math.round(naarGamma(begrens(v, 0, 1)) * 255));
}

const cmykTekst = (c) => {
  const r = (v) => Math.round(v * 10) / 10;
  return `C${r(c[0])} M${r(c[1])} Y${r(c[2])} K${r(c[3])}`;
};

// ---- selectie ------------------------------------------------------------

/** Een kleur uit de selectie: altijd met rgb (van Vexel) en cmyk als die er is. */
function kleurVan(k) {
  if (!k) return null;
  const cmyk = Array.isArray(k.cmyk) && k.cmyk.length === 4 ? k.cmyk.map(Number) : null;
  let rgb = hexNaarRgb(k.hex);
  if (!rgb && cmyk) rgb = cmykNaief(cmyk).map(Math.round);
  return rgb ? { rgb, cmyk, hex: rgbNaarHex(rgb) } : null;
}

function beschrijf(o) {
  const kleurBron = o.vulling ? 'vulling' : 'lijn';
  const kleur = kleurVan(o.vulling) || kleurVan(o.lijn);
  return {
    id: o.id, soort: o.soort, naam: o.naam || '', kader: o.kader,
    tekst: o.soort === 'tekst' ? String(o.inhoud || '') : '', grootte: o.soort === 'tekst' ? o.grootte : null,
    kleur, bron: kleurVan(o.vulling) ? 'vulling' : kleurBron, dekking: o.dekking == null ? 1 : o.dekking,
  };
}

function naamVan(d) {
  if (d.soort === 'tekst' && d.tekst) {
    const t = d.tekst.replace(/\s+/g, ' ').trim();
    return `tekst "${t.length > 18 ? t.slice(0, 17) + '…' : t}"`;
  }
  if (d.naam) return d.naam;
  return { pad: 'vorm', samengesteld: 'samengestelde vorm', groep: 'groep', beeld: 'afbeelding' }[d.soort] || d.soort;
}

/** Welke van de twee is de voorgrond? Tekst gaat voor; anders het kleinste
    object (dat ligt meestal bovenop). */
function kiesVoorgrond(a, b) {
  if (a.soort === 'tekst' && b.soort !== 'tekst') return [a, b];
  if (b.soort === 'tekst' && a.soort !== 'tekst') return [b, a];
  const opp = (d) => (d.kader ? d.kader.b * d.kader.h : 0);
  return opp(a) <= opp(b) ? [a, b] : [b, a];
}

// ---- de rekensom ----------------------------------------------------------

const PAPIER = [255, 255, 255];

/** De kleuren zoals je ze ziet: achtergrond op wit, voorgrond daarop. */
function zichtbaar(vg, ag, vgRgb = vg.kleur.rgb, agRgb = ag.kleur.rgb) {
  const achter = meng(agRgb, ag.dekking, PAPIER);
  const voor = meng(vgRgb, vg.dekking, achter);
  return { voor, achter, verhouding: contrast(voor, achter) };
}

/** Zoek de dichtstbijzijnde lichtere en donkerdere kleur die het doel haalt. */
function voorstellen(vg, ag, welke, doel, cmykDoc) {
  const aan = welke === 'voorgrond' ? vg : ag;
  const reken = (rgb) => (welke === 'voorgrond' ? zichtbaar(vg, ag, rgb, undefined) : zichtbaar(vg, ag, undefined, rgb)).verhouding;
  const uit = [];
  if (cmykDoc && aan.kleur.cmyk) {
    // In CMYK: lichter is een tint (alle waarden naar rato omlaag), donkerder is meer zwart.
    const marge = doel + 0.08;
    const c0 = aan.kleur.cmyk;
    for (const lichter of [true, false]) {
      for (let stap = 1; stap <= 100; stap++) {
        const a = stap / 100;
        const c = lichter ? c0.map((v) => Math.round(v * (1 - a))) : [c0[0], c0[1], c0[2], Math.round(c0[3] + (100 - c0[3]) * a)];
        if (c.every((v, i) => v === Math.round(c0[i]))) continue;
        const rgb = schatCmyk(c0, aan.kleur.rgb, c, lichter);
        if (reken(rgb) >= marge) {
          uit.push({ richting: lichter ? 'lichter' : 'donkerder', cmyk: c, rgb, hex: rgbNaarHex(rgb), verhouding: reken(rgb),
            afstand: verschil(rgbNaarLab(rgb), rgbNaarLab(aan.kleur.rgb)) });
          break;
        }
        if (lichter && c.every((v) => v === 0)) break;
      }
    }
  } else {
    const lab = rgbNaarLab(aan.kleur.rgb);
    for (const richting of [1, -1]) {
      for (let l = lab[0]; l >= -0.001 && l <= 100.001; l += richting * 0.2) {
        const rgb = labNaarRgb([begrens(l, 0, 100), lab[1], lab[2]]);
        if (rgbNaarHex(rgb) === aan.kleur.hex) continue;
        if (reken(rgb) >= doel + 0.005) {
          uit.push({ richting: richting > 0 ? 'lichter' : 'donkerder', rgb, hex: rgbNaarHex(rgb), verhouding: reken(rgb),
            afstand: verschil(rgbNaarLab(rgb), lab) });
          break;
        }
      }
    }
  }
  uit.sort((p, q) => p.afstand - q.afstand);
  return uit;
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmykDoc = doc.kleurruimte === 'cmyk';
  const opgeslagen = (await vexel.haal('instellingen')) || {};
  let vg = null;
  let ag = null;
  let melding = '';
  let gekozenVoorstel = 0;

  async function lees() {
    vg = null;
    ag = null;
    let items;
    try {
      items = await vexel.selectie();
    } catch (fout) {
      melding = 'De selectie kon niet worden gelezen: ' + fout.message;
      return;
    }
    if (items.length !== 2) {
      melding = items.length < 2
        ? 'Selecteer twee objecten: de tekst (of vorm) en de achtergrond eronder. Open dit venster daarna opnieuw.'
        : `Je hebt ${items.length} objecten geselecteerd. Selecteer er precies twee: de tekst en de achtergrond.`;
      return;
    }
    const [a, b] = items.map(beschrijf);
    const zonder = [a, b].filter((d) => !d.kleur);
    if (zonder.length) {
      const wie = zonder.map(naamVan).join(' en ');
      melding = `${wie.charAt(0).toUpperCase() + wie.slice(1)} ${zonder.length === 1 ? 'heeft' : 'hebben'} geen egale kleur. `
        + (zonder.some((d) => d.soort === 'groep') ? 'Een groep heeft zelf geen kleur: selecteer het object in de groep. ' : '')
        + 'Kies objecten met een vul- of lijnkleur.';
      return;
    }
    [vg, ag] = kiesVoorgrond(a, b);
    if (opgeslagen.wissel && opgeslagen.paar === [vg.id, ag.id].sort().join('|')) [vg, ag] = [ag, vg];
    melding = '';
  }
  await lees();

  // -- de onderdelen
  const staal = () => maak('span', { stijl: { width: '22px', height: '22px', borderRadius: '5px', border: '1px solid var(--lijn)', flex: 'none' } });
  const vgStaal = staal();
  const agStaal = staal();
  const vgTekst = maak('div', { stijl: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } });
  const agTekst = maak('div', { stijl: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } });
  const wissel = maak('button', { klasse: 'knop', type: 'button', tekst: 'Wissel', title: 'Voorgrond en achtergrond omdraaien' });
  const rij = (label, s, t) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '84px 22px minmax(0, 1fr)', gap: '8px', alignItems: 'center' } },
    maak('span', { klasse: 'label', tekst: label, stijl: { minWidth: '0' } }), s, t);

  const proef = maak('div', { stijl: { borderRadius: '6px', padding: '12px 14px', border: '1px solid var(--lijn)', display: 'grid', gap: '4px' } });
  const proefGroot = maak('div', { tekst: 'Grote tekst Aa', stijl: { fontSize: '24px', fontWeight: '700', lineHeight: '1.15' } });
  const proefKlein = maak('div', { tekst: 'Gewone tekst in een zin, zoals een bijschrift of een adres.', stijl: { fontSize: '12px', lineHeight: '1.4' } });
  proef.append(proefGroot, proefKlein);

  const verhouding = maak('div', { stijl: { fontSize: '26px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', lineHeight: '1' } });
  const tabel = maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', fontSize: '11.5px' } });
  const tekstUitleg = maak('p', { klasse: 'uitleg', stijl: { margin: '0' } });

  const doel = maak('select', { klasse: 'veld' }, ...DOELEN.map((d) => maak('option', { value: d.id, tekst: `${d.naam} · ${String(d.min).replace('.', ',')}` })));
  const aanpassen = maak('select', { klasse: 'veld' }, maak('option', { value: 'voorgrond', tekst: 'Voorgrond' }), maak('option', { value: 'achtergrond', tekst: 'Achtergrond' }));
  aanpassen.value = opgeslagen.aanpassen === 'achtergrond' ? 'achtergrond' : 'voorgrond';
  const voorstelLijst = maak('div', { stijl: { display: 'grid', gap: '6px' }, role: 'radiogroup', 'aria-label': 'Voorstellen' });
  const status = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0' } });
  const toepassen = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Toepassen' });
  const sluiten = maak('button', { klasse: 'knop', type: 'button', tekst: 'Sluiten', bijClick: () => vexel.sluit() });

  const voorstelBlok = maak('div', { stijl: { display: 'grid', gap: '8px' } },
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '8px' } },
      maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, maak('span', { klasse: 'label', tekst: 'Doel' }), doel),
      maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, maak('span', { klasse: 'label', tekst: 'Aanpassen' }), aanpassen)),
    voorstelLijst);

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px', padding: '14px' } },
    maak('div', { stijl: { display: 'grid', gap: '6px', minWidth: '0' } }, rij('Voorgrond', vgStaal, vgTekst), rij('Achtergrond', agStaal, agTekst)),
    proef,
    maak('div', { stijl: { display: 'grid', gap: '8px' } }, verhouding, tabel),
    tekstUitleg,
    voorstelBlok,
    status,
    maak('p', { klasse: 'uitleg', stijl: { margin: '0', fontSize: '11px' },
      tekst: 'Bedoeld voor scherm (RGB). Van CMYK-kleuren gebruikt de plugin de schermkleur die Vexel ervan maakt: een benadering van de druk.' }),
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, maak('span', { stijl: { flex: '1' } }, wissel), sluiten, toepassen),
  );
  document.body.append(formulier);

  // standaarddoel: groot als de tekst groot is, anders gewone tekst
  const groot = () => vg && vg.grootte && vg.grootte >= 18;
  doel.value = DOELEN.some((d) => d.id === opgeslagen.doel) ? opgeslagen.doel : (groot() ? 'aa-groot' : 'aa');

  let voorstelNu = [];

  function kleurRegel(d) {
    const delen = [d.kleur.hex];
    if (cmykDoc && d.kleur.cmyk) delen.push(cmykTekst(d.kleur.cmyk));
    delen.push(naamVan(d));
    if (d.dekking < 1) delen.push(`dekking ${Math.round(d.dekking * 100)}%`);
    return delen.join(' · ');
  }

  function werkBij() {
    const ok = Boolean(vg && ag);
    for (const el of [proef, voorstelBlok, verhouding.parentElement]) el.style.display = ok ? 'grid' : 'none';
    wissel.disabled = !ok;
    if (!ok) {
      vgStaal.style.background = 'transparent';
      agStaal.style.background = 'transparent';
      vgTekst.textContent = '–';
      agTekst.textContent = '–';
      tekstUitleg.textContent = '';
      status.textContent = melding;
      status.classList.add('fout');
      toepassen.disabled = true;
      return;
    }
    status.classList.remove('fout');
    const z = zichtbaar(vg, ag);
    vgStaal.style.background = vg.kleur.hex;
    agStaal.style.background = ag.kleur.hex;
    vgTekst.textContent = kleurRegel(vg);
    agTekst.textContent = kleurRegel(ag);
    vgTekst.title = vgTekst.textContent;
    agTekst.title = agTekst.textContent;
    proef.style.background = rgbNaarHex(z.achter);
    proef.style.color = rgbNaarHex(z.voor);

    verhouding.textContent = `${verhoudingTekst(z.verhouding)} : 1`;
    const regels = [...DOELEN, { id: 'vorm', naam: 'Vormen en pictogrammen', min: 3 }];
    tabel.replaceChildren(...regels.flatMap((d) => {
      const haalt = z.verhouding >= d.min;
      return [
        maak('span', { tekst: `${d.naam} (${String(d.min).replace('.', ',')})`, klasse: d.id === doel.value ? '' : 'uitleg' }),
        maak('span', { tekst: haalt ? '✓ gehaald' : '✗ niet gehaald', stijl: { color: haalt ? 'var(--accent)' : 'var(--rood, #ff5c5c)', fontWeight: '600' } }),
      ];
    }));

    if (vg.soort === 'tekst' && vg.grootte) {
      const pt = Math.round(vg.grootte * 10) / 10;
      tekstUitleg.textContent = vg.grootte >= 18
        ? `De tekst is ${String(pt).replace('.', ',')} pt: dat telt als grote tekst.`
        : vg.grootte >= 14
          ? `De tekst is ${String(pt).replace('.', ',')} pt: grote tekst als hij vet is, anders gewone tekst.`
          : `De tekst is ${String(pt).replace('.', ',')} pt: dat is gewone tekst.`;
    } else tekstUitleg.textContent = 'Grote tekst is vanaf 18 pt, of vanaf 14 pt als hij vet is.';
    if (vg.dekking < 1 || ag.dekking < 1) tekstUitleg.textContent += ' Gerekend met de dekking, op wit papier.';

    const d = DOELEN.find((x) => x.id === doel.value);
    const welke = aanpassen.value;
    if (z.verhouding >= d.min) {
      voorstelNu = [];
      voorstelLijst.replaceChildren(maak('p', { klasse: 'uitleg', stijl: { margin: '0' }, tekst: `Dit haalt ${d.naam} al. Er hoeft niets te veranderen.` }));
      status.textContent = melding;
      toepassen.disabled = true;
      return;
    }
    voorstelNu = voorstellen(vg, ag, welke, d.min, cmykDoc);
    if (gekozenVoorstel >= voorstelNu.length) gekozenVoorstel = 0;
    if (!voorstelNu.length) {
      voorstelLijst.replaceChildren(maak('p', { klasse: 'uitleg', stijl: { margin: '0' },
        tekst: `Met alleen lichter of donkerder maken van de ${welke} lukt ${d.naam} niet. Probeer de ${welke === 'voorgrond' ? 'achtergrond' : 'voorgrond'} aan te passen of kies een lager doel.` }));
      toepassen.disabled = true;
    } else {
      voorstelLijst.replaceChildren(...voorstelNu.map((v, i) => {
        const keuze = maak('input', { type: 'radio', name: 'voorstel', value: String(i), stijl: { margin: '0' } });
        keuze.checked = i === gekozenVoorstel;
        keuze.addEventListener('change', () => { gekozenVoorstel = i; });
        const waarde = cmykDoc && v.cmyk ? `${cmykTekst(v.cmyk)} (≈ ${v.hex})` : v.hex;
        return maak('label', { stijl: { display: 'grid', gridTemplateColumns: 'auto 22px minmax(0, 1fr) auto', gap: '8px', alignItems: 'center',
          padding: '6px 8px', border: '1px solid var(--lijn)', borderRadius: '6px', background: 'var(--bg-2)', cursor: 'pointer' } },
        keuze,
        maak('span', { stijl: { width: '22px', height: '22px', borderRadius: '5px', background: v.hex, border: '1px solid var(--lijn)' } }),
        maak('span', { stijl: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          tekst: `${waarde} · ${v.richting}` , title: `${v.richting === 'lichter' ? 'Lichter' : 'Donkerder'}${i === 0 ? ', het dichtst bij de huidige kleur' : ''}: ${waarde}` }),
        maak('span', { klasse: 'uitleg', stijl: { fontVariantNumeric: 'tabular-nums' }, tekst: `${verhoudingTekst(v.verhouding)} : 1` }));
      }));
      toepassen.disabled = doc.alleenLezen;
    }
    status.textContent = melding || (doc.alleenLezen ? 'Dit document is alleen-lezen: je kunt kijken, maar niets aanpassen.' : '');
  }

  wissel.addEventListener('click', async () => {
    [vg, ag] = [ag, vg];
    gekozenVoorstel = 0;
    const nu = { ...opgeslagen, wissel: !opgeslagen.wissel, paar: [vg.id, ag.id].sort().join('|') };
    Object.assign(opgeslagen, nu);
    await vexel.bewaar('instellingen', opgeslagen);
    werkBij();
  });
  formulier.addEventListener('change', async (e) => {
    if (e.target === doel || e.target === aanpassen) {
      gekozenVoorstel = 0;
      opgeslagen.doel = doel.value;
      opgeslagen.aanpassen = aanpassen.value;
      await vexel.bewaar('instellingen', opgeslagen);
      werkBij();
    }
  });
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const v = voorstelNu[gekozenVoorstel];
    if (!v || !vg || !ag) return;
    const welke = aanpassen.value === 'voorgrond' ? vg : ag;
    const d = DOELEN.find((x) => x.id === doel.value);
    const ids = [vg.id, ag.id];
    toepassen.disabled = true;
    try {
      const kleur = cmykDoc && v.cmyk ? { cmyk: v.cmyk } : { hex: v.hex };
      await vexel.wijzig([{ id: welke.id, [welke.bron]: kleur }]);
      // kijk wat Vexel er echt van maakt (in CMYK gaat het door het profiel)
      await lees();
      if (vg && ag && ![vg.id, ag.id].some((id) => !ids.includes(id))) {
        if (vg.id !== ids[0]) [vg, ag] = [ag, vg];
        const nu = zichtbaar(vg, ag).verhouding;
        if (nu >= d.min) {
          vexel.melding(`Contrast nu ${verhoudingTekst(nu)} : 1, ${d.naam} gehaald.`, 'ok');
          vexel.sluit();
          return;
        }
        melding = `Toegepast, maar Vexel maakt van deze kleur ${verhoudingTekst(nu)} : 1. Hieronder staat een nieuw voorstel.`;
      }
    } catch (fout) {
      vexel.melding(fout && fout.message ? fout.message : 'De kleur kon niet worden aangepast.', 'fout');
    }
    werkBij();
  });

  werkBij();
  (toepassen.disabled ? sluiten : toepassen).focus();
}

vexel.opCommando('controleren', toonVenster);
