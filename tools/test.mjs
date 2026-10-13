#!/usr/bin/env node
// Tests voor de controle en de index. Draai met: node tools/test.mjs
//
// tools/testgevallen/<id>/ bevat opzettelijk foute plugins (en één goede).
// Een paar gevallen worden hier pas tijdens de test gemaakt, in een tijdelijke map:
// de merknaam (een verzonnen merk; de echte namen staan alleen als hash in
// tools/merken.json), het bidi-teken (zodat er geen onzichtbaar teken in de repo
// staat) en het te grote bestand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ROOT, controleerCode, laadMerken, merkHashes, pluginHash, sha256, valideerAlles, valideerPlugin, canoniekManifest,
} from './valideer.mjs';
import { maakIndex, maakGalerij } from './bouw-index.mjs';

const GEVALLEN = join(ROOT, 'tools', 'testgevallen');
// een verzonnen merk voor de tests (de echte namen staan alleen als hash in merken.json)
const merken = new Set([...laadMerken(), ...merkHashes('Voorbeeldmerk'), ...merkHashes('Proef Merk')]);
const controleer = (map) => valideerPlugin(map, { merken, basis: ROOT }).fouten;
const codes = (fouten) => [...new Set(fouten.map((f) => f.code))].sort();
const toon = (fouten) => fouten.map((f) => `${f.bestand}:${f.regel ?? ''} ${f.melding} [${f.code}]`).join('\n');

/** Kopieert het goede testgeval naar een tijdelijke map met id `id` en past het aan. */
function variant(id, aanpassen) {
  const tijdelijk = mkdtempSync(join(tmpdir(), 'vexel-plugins-test-'));
  const map = join(tijdelijk, id);
  cpSync(join(GEVALLEN, 'goed'), map, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(map, 'plugin.json'), 'utf8'));
  manifest.id = id;
  writeFileSync(join(map, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
  aanpassen(map, manifest);
  return { map, opruimen: () => rmSync(tijdelijk, { recursive: true, force: true }) };
}

function verwachtVariant(id, aanpassen, verwachteCodes, extra) {
  const { map, opruimen } = variant(id, aanpassen);
  try {
    const fouten = controleer(map);
    assert.deepEqual(codes(fouten), verwachteCodes, toon(fouten));
    if (extra) extra(fouten);
  } finally {
    opruimen();
  }
}

const schrijfManifest = (map, m) => writeFileSync(join(map, 'plugin.json'), JSON.stringify(m, null, 2) + '\n');

// ---- de echte plugins ----------------------------------------------------------

test('alle plugins in plugins/ slagen voor de controle', () => {
  const { fouten, plugins } = valideerAlles();
  assert.equal(fouten.length, 0, toon(fouten));
  assert.ok(plugins.length >= 3);
});

test('het goede testgeval slaagt', () => {
  const fouten = controleer(join(GEVALLEN, 'goed'));
  assert.equal(fouten.length, 0, toon(fouten));
});

// ---- foute testgevallen in tools/testgevallen -----------------------------------

const VAST = [
  ['eval-gebruik', ['code.verboden'], /"eval"/],
  ['fetch-via-window', ['code.verboden'], /"window"/],
  ['gpl-licentie', ['licentie'], /GPL-3\.0/],
  ['onbekend-veld', ['manifest.onbekend-veld'], /"versie"/],
  ['kwaadaardig-icoon', ['icoon'], /on…-attributen/],
  ['script-sluiting', ['code.verboden'], /<\/script/],
];

for (const [id, verwacht, melding] of VAST) {
  test(`testgeval ${id} wordt afgewezen`, () => {
    const fouten = controleer(join(GEVALLEN, id));
    assert.deepEqual(codes(fouten), verwacht, toon(fouten));
    assert.ok(fouten.some((f) => melding.test(f.melding)), toon(fouten));
    assert.ok(fouten.every((f) => f.bestand.startsWith(`tools/testgevallen/${id}/`)), 'bestand staat in de melding');
  });
}

test('kwaadaardig icoon: ook <script> wordt genoemd, met regelnummer', () => {
  const fouten = controleer(join(GEVALLEN, 'kwaadaardig-icoon'));
  assert.ok(fouten.some((f) => /<script>/.test(f.melding) && f.regel === 2), toon(fouten));
});

// ---- foute gevallen die tijdens de test worden gemaakt --------------------------

test('merknaam in README, code-commentaar en tekst wordt afgewezen (hoofdletterongevoelig)', () => {
  const merk = 'Voorbeeldmerk';
  verwachtVariant('merknaam', (map) => {
    appendFileSync(join(map, 'README.md'), `\nWerkt net als ${merk}.\n`);
    appendFileSync(join(map, 'plugin.js'), `// zoals in ${merk.toUpperCase()}\nconst x = '${merk.toLowerCase()}';\n`);
  }, ['merknaam'], (fouten) => {
    assert.equal(fouten.length, 3, toon(fouten));
    assert.ok(fouten.some((f) => f.bestand.endsWith('README.md')));
  });
});

test('een merknaam van twee woorden wordt ook herkend, met spatie, streepje of aan elkaar', () => {
  verwachtVariant('twee-woorden', (map) => {
    appendFileSync(join(map, 'README.md'), `\nNet als Proef Merk, proef-merk en ProefMerk.\n`);
  }, ['merknaam'], (fouten) => assert.equal(fouten.length, 3, toon(fouten)));
});

test('de echte lijst met merknamen staat alleen als hash in merken.json', () => {
  const data = JSON.parse(readFileSync(join(ROOT, 'tools', 'merken.json'), 'utf8'));
  assert.ok(Array.isArray(data.hashes) && data.hashes.length >= 30);
  assert.ok(data.hashes.every((h) => /^[0-9a-f]{64}$/.test(h)));
  assert.equal(data.merken, undefined);
});

test('WebRTC wordt afgewezen', () => {
  const f = codeFouten("const pc = new RTCPeerConnection({});\nconst w = webkitRTCPeerConnection;\n");
  assert.equal(f.filter((x) => x.code === 'code.verboden').length, 2, toon(f));
});

test('een merknaam als deel van een ander woord mag wel', () => {
  verwachtVariant('deelwoord', (map) => {
    appendFileSync(join(map, 'README.md'), `\nOvervoorbeeldmerken is geen woord.\n`);
  }, []);
});

test('bidi-stuurteken en tekens zonder breedte worden afgewezen', () => {
  const bidi = String.fromCodePoint(0x202e);
  const nulbreedte = String.fromCodePoint(0x200b);
  verwachtVariant('bidi-teken', (map) => {
    appendFileSync(join(map, 'plugin.js'), `// controle ${bidi} klaar\n`);
    appendFileSync(join(map, 'README.md'), `Twee${nulbreedte}woorden.\n`);
  }, ['onzichtbaar-teken'], (fouten) => {
    assert.ok(fouten.some((f) => /U\+202E/.test(f.melding) && f.bestand.endsWith('plugin.js') && f.regel === 11), toon(fouten));
    assert.ok(fouten.some((f) => /U\+200B/.test(f.melding) && f.bestand.endsWith('README.md')), toon(fouten));
  });
});

test('te grote plugin.js wordt afgewezen', () => {
  verwachtVariant('te-groot', (map) => {
    const regel = '// ' + 'opvulling '.repeat(15) + '\n';
    appendFileSync(join(map, 'plugin.js'), regel.repeat(Math.ceil((205 * 1024) / regel.length)));
  }, ['grootte']);
});

test('te groot icoon en te grote plugin in totaal worden afgewezen', () => {
  verwachtVariant('te-groot-totaal', (map) => {
    writeFileSync(join(map, 'icoon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">\n${'<g/>\n'.repeat(4000)}</svg>\n`);
    appendFileSync(join(map, 'README.md'), ('Een lange regel tekst voor de test.\n').repeat(7000));
  }, ['grootte'], (fouten) => assert.equal(fouten.length, 2, toon(fouten)));
});

test('onbekende bestanden, submappen en ontbrekende bestanden worden afgewezen', () => {
  verwachtVariant('rommel', (map) => {
    writeFileSync(join(map, 'notities.txt'), 'hallo');
    rmSync(join(map, 'README.md'));
  }, ['bestand.onbekend', 'bestand.ontbreekt']);
});

test('een andere licentie dan MIT zonder LICENSE wordt afgewezen', () => {
  verwachtVariant('apache-zonder-tekst', (map, m) => schrijfManifest(map, { ...m, licentie: 'Apache-2.0' }), ['licentie.ontbreekt']);
});

test('een naam die met Vexel begint wordt afgewezen', () => {
  verwachtVariant('officieel', (map, m) => schrijfManifest(map, { ...m, naam: 'Vexel Hulp' }), ['naam.vexel']);
});

test('id moet gelijk zijn aan de mapnaam', () => {
  verwachtVariant('andere-map', (map, m) => schrijfManifest(map, { ...m, id: 'iets-anders' }), ['manifest.id']);
});

test('titel met venster moet op … eindigen, en venstermaten hebben grenzen', () => {
  verwachtVariant('venster', (map, m) => schrijfManifest(map, {
    ...m, commandos: [{ id: 'teken', titel: 'Teken', venster: { breedte: 100, hoogte: 300 } }],
  }), ['manifest.veld'], (fouten) => assert.equal(fouten.length, 2, toon(fouten)));
});

test('niet-vierkant icoon wordt afgewezen', () => {
  verwachtVariant('scheef-icoon', (map) => {
    writeFileSync(join(map, 'icoon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 10"><rect width="4" height="4"/></svg>\n');
  }, ['icoon']);
});

test('icoon met externe verwijzing wordt afgewezen', () => {
  verwachtVariant('extern-icoon', (map) => {
    writeFileSync(join(map, 'icoon.svg'), [
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16">',
      '<image xlink:href="https://voorbeeld.invalid/x.png" width="16" height="16"/>',
      '<rect width="16" height="16" fill="url(http://voorbeeld.invalid/v.svg#a)"/>',
      '<a href="javascript:alert(1)"><rect width="2" height="2"/></a>',
      '</svg>',
    ].join('\n'));
  }, ['icoon'], (fouten) => assert.ok(fouten.length >= 4, toon(fouten)));
});

// ---- de codecontrole zelf ---------------------------------------------------------

function codeFouten(tekst) {
  const fouten = [];
  controleerCode(tekst, (code, melding, regel) => fouten.push({ code, melding, regel }));
  return fouten;
}

const MAG = [
  ["el.style.top = '3px';", 'top als eigenschap'],
  ['const o = { top: 1, parent: 2 };', 'top en parent als objectsleutel'],
  ["const s = 'fetch eval window';", 'verboden woorden in tekst'],
  ['// eval(fetch(top))\nconst a = 1;', 'verboden woorden in commentaar'],
  ['/* window.parent */ const a = 1;', 'blokcommentaar'],
  ["const r = /['\"`]/g; const b = 'x';", 'regex met aanhalingstekens'],
  ['const t = `a ${1 + 2} b ${`c ${3}`}`;', 'geneste templates'],
  ['const h = (a, b) => (a + b) / 2 / 3;', 'deling na haakje'],
  ['setTimeout(() => {}, 10);', 'setTimeout met functie'],
  ['const knop = { open: true }; knop.parentNode = 1;', 'open als sleutel, parentNode'],
  ['const tekst = "regel\\neen \\"citaat\\"";', 'escapes binnen tekst'],
];
for (const [code, uitleg] of MAG) {
  test(`codecontrole laat dit door: ${uitleg}`, () => {
    const fouten = codeFouten(code);
    assert.equal(fouten.length, 0, fouten.map((f) => f.melding).join('\n'));
  });
}

const MAG_NIET = [
  ['eval("1")', 'eval'],
  ['const f = Function("return 1");', 'Function'],
  ['new Function("x")', 'Function'],
  ['import("./x.js")', 'import('],
  ['fetch("/x")', 'fetch'],
  ['const x = new XMLHttpRequest();', 'XMLHttpRequest'],
  ['new WebSocket("wss://x")', 'WebSocket'],
  ['navigator.sendBeacon("/x")', 'sendBeacon'],
  ['const a = document.cookie;', 'cookie'],
  ['document.write("x")', 'document.write/domain'],
  ['localStorage.setItem("a", 1)', 'localStorage'],
  ['const w = new Worker("x.js");', 'Worker'],
  ['top.document', 'top'],
  ['const p = parent;', 'parent'],
  ['a ? top : b', 'top'],
  ['self.x = 1', 'self'],
  ['globalThis["fe" + "tch"]', 'globalThis'],
  ['x.ownerDocument.defaultView', 'defaultView'],
  ['const l = obj.location;', 'location'],
  ['open("https://x")', 'open('],
  ['setTimeout("alert(1)", 10)', 'setTimeout/setInterval met tekst'],
  ['setInterval(`x`, 10)', 'setTimeout/setInterval met tekst'],
  ['atob("ZmV0Y2g=")', 'atob'],
  ['const t = `${fetch("/x")}`;', 'fetch'],
  ['const v = \\u0066etch;', null],
  ['const s = "<\\/script>"; const u = "</script>";', null],
  ['postMessage("x", "*")', 'postMessage'],
  ['const z = {}/fetch(1)/1;', 'fetch'],
  ['const g = { ...window };', 'window'],
  ['f(...self)', 'self'],
  ['const a = [... frames];', 'frames'],
];
for (const [code, naam] of MAG_NIET) {
  test(`codecontrole houdt tegen: ${code}`, () => {
    const fouten = codeFouten(code);
    assert.ok(fouten.length > 0, 'geen fout gevonden');
    if (naam) assert.ok(fouten.some((f) => f.melding.includes(`"${naam}"`)), fouten.map((f) => f.melding).join('\n'));
  });
}

test('codecontrole: regel langer dan 200 tekens', () => {
  const fouten = codeFouten(`const a = '${'x'.repeat(200)}';`);
  assert.deepEqual(codes(fouten), ['code.regel-te-lang']);
  assert.equal(fouten[0].regel, 1);
});

test('codecontrole: syntaxfout en module-syntax worden afgewezen', () => {
  assert.ok(codeFouten('const = 1;').some((f) => f.code === 'code.syntaxis'));
  assert.ok(codeFouten('import x from "y";').some((f) => f.code === 'code.syntaxis'));
});

// ---- hash en index ------------------------------------------------------------------

test('hash volgt exact de formule uit het contract en is deterministisch', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'plugins', 'raster', 'plugin.json'), 'utf8'));
  const js = readFileSync(join(ROOT, 'plugins', 'raster', 'plugin.js'));

  const zelf = sha256(Buffer.from(`raster\n${JSON.stringify(canoniekManifest(manifest))}\n${sha256(js)}`, 'utf8'));
  assert.equal(pluginHash(manifest, js), zelf);
  assert.equal(pluginHash(manifest, js), pluginHash(structuredClone(manifest), Buffer.from(js)));

  // Andere volgorde van velden in plugin.json geeft dezelfde hash.
  const omgedraaid = Object.fromEntries(Object.entries(manifest).reverse());
  omgedraaid.auteur = Object.fromEntries(Object.entries(manifest.auteur).reverse());
  omgedraaid.commandos = manifest.commandos.map((c) => ({ venster: { hoogte: c.venster.hoogte, breedte: c.venster.breedte }, titel: c.titel, id: c.id }));
  assert.equal(pluginHash(omgedraaid, js), zelf);

  // Elke wijziging geeft een andere hash.
  assert.notEqual(pluginHash({ ...manifest, naam: 'Raster 2' }, js), zelf);
  assert.notEqual(pluginHash(manifest, Buffer.concat([js, Buffer.from('\n')])), zelf);

  // De vaste volgorde zelf.
  assert.deepEqual(Object.keys(canoniekManifest(omgedraaid)),
    ['id', 'naam', 'beschrijving', 'auteur', 'licentie', 'categorie', 'rechten', 'commandos']);
  assert.equal(JSON.stringify(canoniekManifest(omgedraaid).commandos[0]),
    '{"id":"maken","titel":"Raster maken…","venster":{"breedte":340,"hoogte":400}}');
});

test('index heeft precies het contract-formaat', () => {
  const resultaat = valideerAlles();
  const commit = 'a'.repeat(40);
  const index = maakIndex({ ...resultaat, ingetrokken: [{ id: 'oud-ding', reden: 'Voorbeeld.' }] }, commit, '2026-10-13T12:00:00Z');
  assert.deepEqual(Object.keys(index), ['schema', 'gemaakt', 'commit', 'plugins', 'ingetrokken']);
  assert.equal(index.schema, 1);
  for (const p of index.plugins) {
    assert.deepEqual(Object.keys(p), [
      'id', 'naam', 'beschrijving', 'auteur', 'licentie', 'categorie', 'rechten', 'commandos',
      'icoon', 'bron', 'hash', 'bestanden',
    ]);
    assert.match(p.icoon, /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
    assert.equal(p.bron, `https://github.com/GuusLab/vexel-plugins/tree/${commit}/plugins/${p.id}`);
    assert.match(p.hash, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(p.bestanden), ['plugin.js']);
    const js = readFileSync(join(ROOT, 'plugins', p.id, 'plugin.js'));
    assert.deepEqual(p.bestanden['plugin.js'], { sha256: sha256(js), grootte: js.length });
  }
  // Tweemaal bouwen met dezelfde invoer geeft hetzelfde resultaat.
  assert.equal(JSON.stringify(index), JSON.stringify(maakIndex({ ...resultaat, ingetrokken: index.ingetrokken }, commit, '2026-10-13T12:00:00Z')));
  // Een ingetrokken plugin staat niet meer in de lijst.
  const zonder = maakIndex({ ...resultaat, ingetrokken: [{ id: 'raster', reden: 'Test.' }] }, commit);
  assert.ok(!zonder.plugins.some((p) => p.id === 'raster'));
});

test('galerij ontsnapt tekst en heeft de strikte CSP', () => {
  const resultaat = valideerAlles();
  const index = maakIndex(resultaat, 'b'.repeat(40), '2026-10-13T12:00:00Z');
  index.plugins[0] = { ...index.plugins[0], naam: '<img src=x onerror=alert(1)>' };
  const html = maakGalerij(index);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes("default-src 'none'; img-src data:; style-src 'unsafe-inline'"));
  assert.ok(!/<script/i.test(html));
});
