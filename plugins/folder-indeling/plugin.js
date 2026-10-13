// Folder-indeling: deel het tekengebied in voor een vouwfolder, met vouwlijnen, vouwtekens en benoemde panelen.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  soort: 'wikkel', zijde: 'buiten', richting: 'auto', aantal: 4, inkorting: 2, inkortingAltaar: 1,
  afloop: 3, tekens: true, panelen: true,
};

const SOORTEN = {
  tweeluik: 'Tweeluik (één vouw)',
  wikkel: 'Drieluik wikkelvouw',
  zigzag: 'Zigzag (leporello)',
  kruis: 'Kruisvouw',
  altaar: 'Altaarvouw',
};

const UITLEG = {
  tweeluik: 'Eén vouw in het midden: vier pagina\'s.',
  wikkel: 'Het binnenklappende paneel is smaller, zodat het vlak in de folder past.',
  zigzag: 'Alle panelen even breed, vouwen om en om naar voren en naar achteren.',
  kruis: 'Eerst de horizontale vouw (bovenkant naar achteren), dan de verticale. Zet de bovenste panelen van de buitenkant op hun kop.',
  altaar: 'Twee flappen klappen naar het midden en raken elkaar net niet.',
};

const PT = vexel.mm(1);
const TEKEN_LENGTE = 5; // mm

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
  const label = maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, kop, veld);
  label.kop = kop;
  return label;
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
const mmTekst = (n) => n.toLocaleString('nl-NL', { maximumFractionDigits: 2 });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

// ---- de indeling (alles in mm) -------------------------------------------------

/**
 * Geeft de panelen langs de vouwas, van links naar rechts (of van boven naar
 * onder) zoals je naar de gekozen zijde kijkt. De binnenkant is de buitenkant
 * omgedraaid: wat buiten links staat, staat binnen rechts.
 */
function panelenLangsAs(w, lengte) {
  const buiten = w.zijde === 'buiten';
  if (w.soort === 'tweeluik') {
    const p = lengte / 2;
    return buiten
      ? [{ naam: 'Paneel 4 – achterkant', maat: p }, { naam: 'Paneel 1 – voorkant', maat: p }]
      : [{ naam: 'Paneel 2 – binnen links', maat: p }, { naam: 'Paneel 3 – binnen rechts', maat: p }];
  }
  if (w.soort === 'wikkel') {
    const p = (lengte + w.inkorting) / 3;
    const klap = p - w.inkorting;
    return buiten
      ? [{ naam: 'Paneel 3 – binnenklap', maat: klap, smal: true }, { naam: 'Paneel 6 – achterkant', maat: p },
        { naam: 'Paneel 1 – voorkant', maat: p }]
      : [{ naam: 'Paneel 2 – binnen links', maat: p }, { naam: 'Paneel 4 – binnen midden', maat: p },
        { naam: 'Paneel 5 – binnen rechts (klap)', maat: klap, smal: true }];
  }
  if (w.soort === 'altaar') {
    const midden = lengte / 2 + w.inkortingAltaar;
    const flap = (lengte - midden) / 2;
    return buiten
      ? [{ naam: 'Paneel 2 – voorkant rechts', maat: flap, smal: true }, { naam: 'Paneel 6 – achterkant', maat: midden },
        { naam: 'Paneel 1 – voorkant links', maat: flap, smal: true }]
      : [{ naam: 'Paneel 3 – flap links', maat: flap, smal: true }, { naam: 'Paneel 4 – binnen midden', maat: midden },
        { naam: 'Paneel 5 – flap rechts', maat: flap, smal: true }];
  }
  // zigzag: om en om gevouwen. Bij een even aantal is de achterkant de
  // buitenzijde van het laatste paneel, bij een oneven aantal de binnenzijde.
  const n = w.aantal;
  const p = lengte / n;
  const lijst = [];
  for (let j = 1; j <= n; j++) {
    if (buiten) {
      let naam = `Paneel ${j}`;
      if (j === 1) naam += ' – voorkant';
      else if (j === n && n % 2 === 0) naam += ' – achterkant';
      lijst.push({ naam, maat: p });
    } else {
      let naam = `Paneel ${n + j}`;
      if (j === 1 && n % 2 === 1) naam += ' – achterkant';
      lijst.push({ naam, maat: p });
    }
  }
  return lijst;
}

/**
 * Berg- of dalvouw, gezien vanaf de gekozen zijde. Van buiten gezien zijn de
 * vouwen van een tweeluik, wikkelvouw en altaarvouw bergvouwen. Bij een zigzag
 * wisselen ze: de eerste vouw (achter de voorkant) is van buiten een bergvouw.
 */
function vouwSoort(w, k, n, verticaal) {
  const buiten = w.zijde === 'buiten';
  let bergVanBuiten = true;
  if (w.soort === 'zigzag') {
    const buitenVouw = buiten || !verticaal ? k : n - k;
    bergVanBuiten = buitenVouw % 2 === 1;
  }
  return bergVanBuiten === buiten ? 'bergvouw' : 'dalvouw';
}

/** De hele indeling: panelen als rechthoeken, vouwlijnen, vouwtekens. */
function indeling(w, tb, th) {
  const fouten = [];
  const vouwen = []; // { as: 'x' | 'y', pos }
  let panelen = [];
  let verticaal = true;
  if (w.soort === 'kruis') {
    const b = tb / 2;
    const h = th / 2;
    const namen = w.zijde === 'buiten'
      ? ['Paneel 3 – op zijn kop', 'Paneel 2 – op zijn kop', 'Paneel 4 – achterkant', 'Paneel 1 – voorkant']
      : ['Paneel 5 – binnen linksboven', 'Paneel 6 – binnen rechtsboven', 'Paneel 7 – binnen linksonder', 'Paneel 8 – binnen rechtsonder'];
    panelen = [[0, 0], [b, 0], [0, h], [b, h]].map(([x, y], i) => ({ naam: namen[i], x, y, b, h }));
    vouwen.push({ as: 'y', pos: h, soort: 'eerste vouw' }, { as: 'x', pos: b, soort: 'tweede vouw' });
  } else {
    verticaal = w.richting === 'verticaal' || (w.richting === 'auto' && tb >= th);
    const lengte = verticaal ? tb : th;
    // Bij verticale vouwen draai je het vel om de verticale as: de binnenkant is
    // gespiegeld. Bij horizontale vouwen draai je ook om de verticale as, dus
    // blijft boven boven en ligt elk paneel recht achter zijn tegenhanger.
    let lijst = panelenLangsAs(w, lengte);
    if (!verticaal && w.zijde === 'binnen') lijst = [...lijst].reverse();
    let pos = 0;
    for (const [i, p] of lijst.entries()) {
      let naam = p.naam;
      if (!verticaal) naam = naam.replace(/links|rechts/, i === 0 ? 'boven' : 'onder');
      panelen.push(verticaal
        ? { naam, x: pos, y: 0, b: p.maat, h: th, smal: p.smal }
        : { naam, x: 0, y: pos, b: tb, h: p.maat, smal: p.smal });
      pos += p.maat;
      if (i < lijst.length - 1) vouwen.push({ as: verticaal ? 'x' : 'y', pos, soort: vouwSoort(w, i + 1, lijst.length, verticaal) });
    }
  }
  const maten = panelen.map((p) => (w.soort === 'kruis' ? Math.min(p.b, p.h) : (verticaal ? p.b : p.h)));
  const kleinste = Math.min(...maten);
  if (!(kleinste >= 20)) {
    fouten.push(`De panelen worden te smal (${mmTekst(Math.max(0, kleinste))} mm): kies minder panelen, `
      + 'een kleinere inkorting of een groter tekengebied.');
  }
  return { panelen, vouwen, verticaal, fouten };
}

function samenvattingTekst(w, uitkomst, tb, th) {
  const { panelen, verticaal } = uitkomst;
  if (w.soort === 'kruis') {
    return `Kruisvouw: 4 panelen van ${mmTekst(panelen[0].b)} × ${mmTekst(panelen[0].h)} mm; `
      + `gevouwen ${mmTekst(tb / 2)} × ${mmTekst(th / 2)} mm.`;
  }
  const maten = panelen.map((p) => mmTekst(verticaal ? p.b : p.h)).join(' · ');
  const volgorde = verticaal ? 'van links naar rechts' : 'van boven naar onder';
  const groot = Math.max(...panelen.map((p) => (verticaal ? p.b : p.h)));
  const gevouwen = verticaal ? `${mmTekst(groot)} × ${mmTekst(th)}` : `${mmTekst(tb)} × ${mmTekst(groot)}`;
  let tekst = `Panelen ${volgorde}: ${maten} mm. Gevouwen ${gevouwen} mm.`;
  if (w.soort === 'zigzag') tekst += ' Vouwen: ' + uitkomst.vouwen.map((v) => (v.soort === 'bergvouw' ? 'berg' : 'dal')).join(' · ') + '.';
  return tekst;
}

// ---- de vormen voor Vexel -------------------------------------------------------

function bouwVormen(w, uitkomst, tb, th, cmyk) {
  const kleur = (c, h) => (cmyk ? { cmyk: c } : { hex: h });
  const kinderen = [];
  const naamSoort = { tweeluik: 'tweeluik', wikkel: 'drieluik wikkelvouw', zigzag: `zigzag ${w.aantal} panelen`, kruis: 'kruisvouw', altaar: 'altaarvouw' }[w.soort];

  if (w.panelen) {
    const vlakken = [];
    const labels = [];
    // Eén lettergrootte voor alle panelen: die van het krapste paneel.
    const grootte = begrens(Math.min(...uitkomst.panelen.map((p) => Math.min(
      Math.min(Math.max(p.b, p.h) * 0.04, Math.min(p.b, p.h) * 0.12) * PT,
      (p.b * PT * 0.9) / (p.naam.length * 0.56)))), 4, 14);
    uitkomst.panelen.forEach((p, i) => {
      vlakken.push({
        soort: 'rechthoek', naam: p.naam, x: p.x * PT, y: p.y * PT, b: p.b * PT, h: p.h * PT, lijn: null,
        vulling: (w.soort === 'kruis' ? [0, 1, 1, 0][i] : i % 2) ? kleur([0, 0, 0, 5], '#f2f2f2') : kleur([7, 0, 0, 0], '#ecf6fc'),
      });
      const cx = (p.x + p.b / 2) * PT;
      const cy = (p.y + p.h / 2) * PT;
      const maat = w.soort === 'kruis' ? `${mmTekst(p.b)} × ${mmTekst(p.h)} mm` : `${mmTekst(uitkomst.verticaal ? p.b : p.h)} mm`;
      labels.push({
        soort: 'tekst', naam: `Label ${p.naam}`, x: cx, y: cy - grootte * 0.15, inhoud: p.naam, grootte, gewicht: 600,
        uitlijning: 'midden', vulling: kleur([0, 0, 0, 70], '#4d4d4d'), lijn: null,
      });
      labels.push({
        soort: 'tekst', naam: `Maat ${p.naam}`, x: cx, y: cy + grootte * 1.15, inhoud: maat, grootte: grootte * 0.85,
        uitlijning: 'midden', vulling: kleur([0, 0, 0, 50], '#808080'), lijn: null,
      });
    });
    kinderen.push({ soort: 'groep', naam: 'Panelen (hulpvlakken)', kinderen: [...vlakken, ...labels] });
  }

  const lijnen = uitkomst.vouwen.map((v, i) => ({
    soort: 'pad', naam: `Vouwlijn ${i + 1}, ${v.soort} (niet drukken)`, vulling: null, lijn: kleur([0, 60, 100, 0], '#f28c00'),
    lijndikte: 0.5, streep: [vexel.mm(3), vexel.mm(1.5)], lijneinde: 'butt',
    subpaden: [{
      gesloten: false,
      punten: v.as === 'x' ? [{ x: v.pos * PT, y: 0 }, { x: v.pos * PT, y: th * PT }] : [{ x: 0, y: v.pos * PT }, { x: tb * PT, y: v.pos * PT }],
    }],
  }));
  kinderen.push({ soort: 'groep', naam: 'Vouwlijnen (niet drukken)', kinderen: lijnen });

  if (w.tekens && uitkomst.vouwen.length) {
    const a = w.afloop;
    const z = a + TEKEN_LENGTE;
    const tekens = uitkomst.vouwen.map((v, i) => ({
      soort: 'pad', naam: `Vouwteken ${i + 1}`, vulling: null, lijn: kleur([100, 100, 100, 100], '#000000'),
      lijndikte: 0.25, lijneinde: 'butt',
      subpaden: (v.as === 'x'
        ? [[[v.pos, -a], [v.pos, -z]], [[v.pos, th + a], [v.pos, th + z]]]
        : [[[-a, v.pos], [-z, v.pos]], [[tb + a, v.pos], [tb + z, v.pos]]])
        .map((l) => ({ gesloten: false, punten: l.map(([x, y]) => ({ x: x * PT, y: y * PT })) })),
    }));
    kinderen.push({ soort: 'groep', naam: 'Vouwtekens', kinderen: tekens });
  }

  return [{
    soort: 'groep', naam: `Folder ${naamSoort} – ${w.zijde === 'buiten' ? 'buitenkant' : 'binnenkant'}`, kinderen,
  }];
}

// ---- het venster -----------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  const tb = doc.tekengebied.b / PT;
  const th = doc.tekengebied.h / PT;

  const soort = keuzeLijst('soort', SOORTEN, w0.soort);
  const zijde = keuzeLijst('zijde', { buiten: 'Buitenkant', binnen: 'Binnenkant' }, w0.zijde);
  const richting = keuzeLijst('richting', {
    auto: 'Automatisch', verticaal: 'Verticale vouwen', horizontaal: 'Horizontale vouwen',
  }, w0.richting);
  const aantal = getalVeld('aantal', w0.aantal, 3, 8, 1);
  const inkorting = getalVeld('inkorting', w0.soort === 'altaar' ? w0.inkortingAltaar : w0.inkorting, 0, 20, 0.5);
  const afloop = getalVeld('afloop', w0.afloop, 0, 20, 0.5);
  const tekens = maak('input', { type: 'checkbox', id: 'tekens', stijl: { margin: '0' } });
  tekens.checked = w0.tekens !== false;
  const panelen = maak('input', { type: 'checkbox', id: 'panelen', stijl: { margin: '0' } });
  panelen.checked = w0.panelen !== false;
  const inkortingen = { wikkel: w0.inkorting, altaar: w0.inkortingAltaar };
  let vorigeSoort = soort.value;

  const soortUitleg = maak('p', { klasse: 'uitleg', stijl: { margin: '-4px 0 0', minHeight: '30px' } });
  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '170px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Indeling maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, ...k);
  const drie = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } }, ...k);
  const vinkje = (vak, tekst) => maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center' } }, vak, maak('span', { tekst }));
  const aantalVak = veldMetLabel('Panelen', aantal);
  const inkortingVak = veldMetLabel('Inkorting', inkorting, 'mm');
  const richtingVak = veldMetLabel('Vouwen', richting);

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    twee(veldMetLabel('Vouwsoort', soort), veldMetLabel('Zijde', zijde)),
    soortUitleg,
    drie(richtingVak, aantalVak, inkortingVak),
    twee(veldMetLabel('Vouwtekens buiten de afloop', afloop, 'mm'),
      maak('div', { stijl: { display: 'grid', gap: '4px', alignSelf: 'end' } },
        vinkje(tekens, 'Vouwtekens'), vinkje(panelen, 'Panelen met namen'))),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => {
    const ink = begrens(leesGetal(inkorting, 2), 0, 20);
    if (soort.value === 'wikkel' || soort.value === 'altaar') inkortingen[soort.value] = ink;
    return {
      soort: soort.value,
      zijde: zijde.value,
      richting: richting.value,
      aantal: Math.round(begrens(leesGetal(aantal, 4), 3, 8)),
      inkorting: inkortingen.wikkel,
      inkortingAltaar: inkortingen.altaar,
      afloop: begrens(leesGetal(afloop, 3), 0, 20),
      tekens: tekens.checked,
      panelen: panelen.checked,
    };
  };

  function zetBeschikbaar(vak, aan) {
    vak.style.opacity = aan ? '1' : '0.45';
    vak.querySelector('input, select').disabled = !aan;
  }

  function teken() {
    if (soort.value !== vorigeSoort) {
      if (soort.value === 'wikkel' || soort.value === 'altaar') inkorting.value = inkortingen[soort.value];
      vorigeSoort = soort.value;
    }
    const w = waarden();
    soortUitleg.textContent = UITLEG[w.soort];
    zetBeschikbaar(aantalVak, w.soort === 'zigzag');
    zetBeschikbaar(inkortingVak, w.soort === 'wikkel' || w.soort === 'altaar');
    zetBeschikbaar(richtingVak, w.soort !== 'kruis');
    inkortingVak.kop.firstChild.textContent = w.soort === 'altaar' ? 'Flap korter' : 'Klap smaller';
    afloop.disabled = !w.tekens;

    const uitkomst = indeling(w, tb, th);
    let tekst = samenvattingTekst(w, uitkomst, tb, th);
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier geen indeling maken.';
    if (uitkomst.fouten.length) tekst = uitkomst.fouten[0];
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fouten.length));
    maakKnop.disabled = doc.alleenLezen || Boolean(uitkomst.fouten.length);

    // voorvertoning
    const schaal = devicePixelRatio || 1;
    const kader = voorbeeld.getBoundingClientRect();
    voorbeeld.width = Math.round(kader.width * schaal);
    voorbeeld.height = Math.round(kader.height * schaal);
    const g = voorbeeld.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const rand = w.tekens ? w.afloop + TEKEN_LENGTE + 2 : 2;
    const s = Math.min((kader.width - 8) / (tb + 2 * rand), (kader.height - 8) / (th + 2 * rand));
    const ox = (kader.width - tb * s) / 2;
    const oy = (kader.height - th * s) / 2;
    const accent = css('--accent', vexel.thema.accent);

    uitkomst.panelen.forEach((p, i) => {
      g.fillStyle = i % 2 ? css('--bg', vexel.thema.bg) : css('--bg-2', vexel.thema.bg2);
      g.fillRect(ox + p.x * s, oy + p.y * s, p.b * s, p.h * s);
    });
    if (w.panelen && !uitkomst.fouten.length) {
      g.fillStyle = css('--tekst-zacht', vexel.thema.tekstZacht);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const p of uitkomst.panelen) {
        const nummer = p.naam.replace(/^Paneel (\d+).*$/, '$1');
        const maat = w.soort === 'kruis' ? `${mmTekst(p.b)} × ${mmTekst(p.h)}` : mmTekst(uitkomst.verticaal ? p.b : p.h);
        const cx = ox + (p.x + p.b / 2) * s;
        const cy = oy + (p.y + p.h / 2) * s;
        g.font = '600 11px Inter, system-ui, sans-serif';
        g.fillText(nummer, cx, cy - 7);
        g.font = '10px Inter, system-ui, sans-serif';
        if (g.measureText(maat).width < p.b * s - 4) g.fillText(maat, cx, cy + 7);
      }
    }
    g.strokeStyle = css('--lijn', vexel.thema.lijn);
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, tb * s - 1, th * s - 1);
    g.strokeStyle = '#f28c00';
    g.setLineDash([5, 3]);
    g.beginPath();
    for (const v of uitkomst.vouwen) {
      if (v.as === 'x') { g.moveTo(ox + v.pos * s, oy); g.lineTo(ox + v.pos * s, oy + th * s); }
      else { g.moveTo(ox, oy + v.pos * s); g.lineTo(ox + tb * s, oy + v.pos * s); }
    }
    g.stroke();
    g.setLineDash([]);
    if (w.tekens) {
      g.strokeStyle = accent;
      g.lineWidth = 1.5;
      g.beginPath();
      const a = w.afloop * s;
      const z = (w.afloop + TEKEN_LENGTE) * s;
      for (const v of uitkomst.vouwen) {
        if (v.as === 'x') {
          const x = ox + v.pos * s;
          g.moveTo(x, oy - a); g.lineTo(x, oy - z);
          g.moveTo(x, oy + th * s + a); g.lineTo(x, oy + th * s + z);
        } else {
          const y = oy + v.pos * s;
          g.moveTo(ox - a, y); g.lineTo(ox - z, y);
          g.moveTo(ox + tb * s + a, y); g.lineTo(ox + tb * s + z, y);
        }
      }
      g.stroke();
    }
  }

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const uitkomst = indeling(w, tb, th);
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    if (uitkomst.fouten.length) return vexel.melding(uitkomst.fouten[0], 'let');

    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(w, uitkomst, tb, th, doc.kleurruimte === 'cmyk'));
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Folderindeling gemaakt: ${uitkomst.panelen.length} panelen, ${uitkomst.vouwen.length} `
        + `${uitkomst.vouwen.length === 1 ? 'vouw' : 'vouwen'}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De indeling kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  soort.focus();
}

vexel.opCommando('maken', toonVenster);
