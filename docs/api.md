# De plugin-API (v1.1)

Alles wat een plugin nodig heeft: de bestanden, het manifest, de API in de
plugin, het venster, wat de controle afwijst en het formaat van de index.

- [Bestanden](#bestanden)
- [Het manifest](#het-manifest-pluginjson)
- [De API](#de-api-windowvexel)
- [Vormen](#vormen)
- [Kleuren](#kleuren)
- [Het venster](#het-venster)
- [Wat de controle afwijst](#wat-de-controle-afwijst)
- [De index](#de-index)

## Bestanden

Elke plugin staat in `plugins/<id>/`:

| bestand | verplicht | wat |
|---|---|---|
| `plugin.json` | ja | het manifest |
| `plugin.js` | ja | de code: een gewoon script (geen module), hooguit 200 KB |
| `icoon.svg` | ja | vierkant icoon, hooguit 16 KB, zonder script, events of externe verwijzingen |
| `README.md` | ja | wat de plugin doet, hoe je hem gebruikt, waarom hij zijn rechten nodig heeft |
| `LICENSE` | alleen als `licentie` niet `MIT` is | de licentietekst |

Samen hooguit 256 KB (1 KB = 1024 bytes). Andere bestanden en submappen worden
geweigerd. Alle tekstbestanden zijn UTF-8 zonder BOM.

## Het manifest (`plugin.json`)

```json
{
  "id": "raster",
  "naam": "Raster",
  "beschrijving": "Verdeel het tekengebied in kolommen en rijen met gelijke tussenruimte.",
  "auteur": { "naam": "GuusLab", "github": "GuusLab" },
  "licentie": "MIT",
  "categorie": "vormen",
  "rechten": ["document.schrijven"],
  "commandos": [
    { "id": "maken", "titel": "Raster maken…", "venster": { "breedte": 340, "hoogte": 400 } }
  ]
}
```

| veld | regels |
|---|---|
| `id` | `^[a-z0-9]+(-[a-z0-9]+)*$`, 2 tot 40 tekens, gelijk aan de mapnaam, begint niet met `vexel` |
| `naam` | 2 tot 40 tekens, begint niet met "Vexel" |
| `beschrijving` | 10 tot 140 tekens, één zin |
| `auteur.naam` | 1 tot 60 tekens |
| `auteur.github` | optioneel, `^[A-Za-z0-9-]{1,39}$` |
| `licentie` | `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` of `0BSD` |
| `categorie` | `vormen`, `kleur`, `tekst`, `ordenen`, `patronen` of `hulpmiddelen` |
| `rechten` | een deel van `selectie.lezen`, `document.schrijven` (mag leeg) |
| `commandos` | 1 tot 10 commando's |
| `commandos[].id` | zelfde patroon als het plugin-id, uniek binnen de plugin |
| `commandos[].titel` | 2 tot 40 tekens; eindigt op `…` als er een venster opengaat, anders niet |
| `commandos[].venster` | optioneel: `breedte` 200 tot 800, `hoogte` 120 tot 800 (hele pixels) |

Andere velden zijn niet toegestaan. Er is geen versienummer: de
[hash](#de-index) is de versie.

### Rechten

| recht | wat de plugin dan mag |
|---|---|
| `selectie.lezen` | `vexel.selectie()`: zien wat er geselecteerd is (soort, naam, kader, kleuren, lijndikte) |
| `document.schrijven` | `vexel.maak()` en `vexel.wijzigSelectie()`: vormen toevoegen en de selectie aanpassen |

Vraag alleen wat je echt gebruikt. `vexel.document()`, `vexel.melding()`,
`vexel.bewaar()` en `vexel.haal()` werken altijd.

## De API (`window.vexel`)

De plugin draait in een eigen venster (een iframe met sandbox) en praat
alleen via het object `vexel`. Alle maten zijn in **punt** (pt; 1 mm = 72/25,4
pt). `x` en `y` gaan uit van de linkerbovenhoek van het actieve tekengebied, met
`y` omlaag.

Alles wat `await` krijgt, geeft een Promise terug. Gaat iets mis (geen recht,
document alleen-lezen, ongeldige vorm), dan wordt de Promise afgewezen met een
Nederlandse melding in `fout.message`.

### `vexel.opCommando(id, functie)`

Koppelt een functie aan een commando-id uit het manifest. Vexel roept de
functie aan als iemand het commando kiest.

```js
vexel.opCommando('maken', async () => {
  // ...
});
```

### `vexel.document()`

```js
const doc = await vexel.document();
// {
//   naam: 'Folder voorjaar',
//   eenheid: 'mm',              // 'mm' | 'pt' | 'cm' | 'in' | 'px': wat de gebruiker ziet
//   kleurruimte: 'cmyk',        // 'cmyk' | 'rgb' | ...
//   tekengebied: { b: 595.28, h: 841.89 },   // in pt
//   afloop: { boven: 8.5, rechts: 8.5, onder: 8.5, links: 8.5 },   // in pt (3 mm)
//   alleenLezen: false
// }
```

Gebruik `eenheid` om maten in je venster in de eenheid van de gebruiker te
tonen, en `kleurruimte` om CMYK- of RGB-kleuren te kiezen.

### `vexel.selectie()` (recht `selectie.lezen`)

```js
const items = await vexel.selectie();
// [{
//   id: 'o12',
//   soort: 'pad',                                    // pad, samengesteld, tekst, groep, beeld, …
//   naam: 'Achtergrond',
//   kader: { x: 28.35, y: 28.35, b: 200, h: 120 },   // in pt
//   vulling: { cmyk: [0, 60, 100, 0], hex: '#f07c00' }, // of null
//   lijn: null,                                      // of een kleur
//   lijndikte: 0,
//   dekking: 1,
//   subpaden: [{ gesloten: true, punten: [{ x, y, in?, uit? }, …] }]   // bij pad en samengesteld
// }]
```

Een lege lijst betekent: niets geselecteerd. Een rechthoek of ellips is in
Vexel gewoon een `pad`. Bij `pad` en `samengesteld` krijg je de `subpaden`
(in hetzelfde stelsel als bij `maak`, hooguit 50 000 punten); bij `tekst`
krijg je `inhoud` en `grootte`; bij een `groep` het `aantal` kinderen.

### `vexel.maak(vormen)` (recht `document.schrijven`)

Voegt vormen toe aan het actieve tekengebied. Alles wat in één aanroep wordt
gemaakt, is één stap voor ongedaan maken. Het nieuwe wordt geselecteerd. Geeft
de ids van de nieuwe vormen terug.

```js
const ids = await vexel.maak([
  { soort: 'rechthoek', x: 0, y: 0, b: vexel.mm(50), h: vexel.mm(20), vulling: { hex: '#ffcc00' } },
]);
```

Maximaal 5000 vormen en 50 000 punten per aanroep; groepen hooguit 8 diep.
Zie [Vormen](#vormen).

Met `{ vervangSelectie: true }` vervangt het nieuwe de selectie, op dezelfde
plek in de lagen, in één stap. Handig voor een plugin die een pad omzet:

```js
const [pad] = await vexel.selectie();
await vexel.maak([{ soort: 'pad', subpaden: maakGolvend(pad.subpaden), vulling: pad.vulling }], { vervangSelectie: true });
```

### `vexel.wijzig(lijst)` (recht `document.schrijven`)

Verandert geselecteerde objecten, elk apart. Draaien en schalen gaan om het
midden van het object. Alles samen is één stap voor ongedaan maken. Een id die
niet geselecteerd is, wordt geweigerd.

```js
const sel = await vexel.selectie();
await vexel.wijzig(sel.map((o, i) => ({
  id: o.id,
  verplaats: { dx: i * 10, dy: 0 },   // pt
  draai: 15,                           // graden, met de klok mee
  schaal: 1.2,                         // of { x: 1.2, y: 0.8 }
  vulling: { cmyk: [0, 0, 0, 20 + i * 10] },
})));
```

Naast `verplaats`, `draai` en `schaal` kan alles uit `stijl` (zie
[Vormen](#vormen)) en `naam`.

### `vexel.wijzigSelectie(stijl)` (recht `document.schrijven`)

Past de stijl van alles wat geselecteerd is aan. Geef alleen mee wat moet
veranderen.

```js
await vexel.wijzigSelectie({ vulling: { cmyk: [100, 0, 0, 0] }, dekking: 0.5 });
await vexel.wijzigSelectie({ lijn: null });          // lijn weghalen
await vexel.wijzigSelectie({ lijn: { hex: '#000000' }, lijndikte: 0.25 });
```

### `vexel.melding(tekst, soort)`

Laat een korte melding zien in Vexel. `soort` is `'ok'`, `'info'`, `'let'`
(let op) of `'fout'`.

```js
vexel.melding('Raster gemaakt: 12 vakken.', 'ok');
```

### `vexel.bewaar(sleutel, waarde)` en `vexel.haal(sleutel)`

Bewaart een waarde per plugin, bijvoorbeeld de laatste instellingen. De waarde
moet als JSON te schrijven zijn en is hooguit 64 KB. `haal` geeft
`null` terug als er nog niets is.

```js
const instellingen = (await vexel.haal('instellingen')) || { kolommen: 3 };
await vexel.bewaar('instellingen', { kolommen: 4 });
```

Bewaar geen persoonsgegevens.

### `vexel.sluit()`

Sluit de plugin (en zijn venster). Een commando zonder venster draait
onzichtbaar en moet `vexel.sluit()` aanroepen als het klaar is.

### `vexel.mm(getal)`

Rekent millimeter om naar punt: `vexel.mm(10)` is ongeveer `28.35`.

### `vexel.naarMm(pt)`

Het omgekeerde van `vexel.mm`: punt naar millimeter.

### `vexel.thema`

De kleuren van het venster, voor bijvoorbeeld een voorvertoning op een
`canvas`: `{ bg, bg2, lijn, tekst, tekstZacht, accent }` (hex). Ze staan ook
al als CSS-variabelen op `:root`, zie [Het venster](#het-venster).

## Vormen

Alle getallen moeten eindig zijn (geen `NaN` of `Infinity`). Alle
coördinaten zijn in pt, vanaf linksboven in het actieve tekengebied, met y
naar beneden. Dat geldt ook voor de handvatten `in` en `uit` van een
padpunt: dat zijn punten in hetzelfde stelsel, niet de afstand tot het punt.
Bij `tekst` is `y` de basislijn van de eerste regel; een volgende regel
begin je met `\n` in `inhoud`.

```js
{ soort: 'rechthoek', x, y, b, h, ...stijl }
{ soort: 'ellips', cx, cy, rx, ry, ...stijl }
{ soort: 'pad', subpaden: [{ gesloten, punten: [{ x, y, in?: { x, y }, uit?: { x, y } }] }], ...stijl }
{ soort: 'tekst', x, y, inhoud: 'tekst', grootte?, gewicht?, uitlijning?, regelafstand?, letterafstand?, ...stijl }   // inhoud hooguit 10 000 tekens
{ soort: 'groep', kinderen: [vorm, ...], naam? }
```

`stijl` bestaat uit:

| veld | wat |
|---|---|
| `vulling` | een [Kleur](#kleuren) of `null` (geen vulling) |
| `lijn` | een Kleur of `null` (geen lijn) |
| `lijndikte` | 0 tot 1000 pt |
| `dekking` | 0 tot 1 |
| `streep` | streeplijn: `[streep, tussenruimte, …]` in pt, hooguit 20 getallen; `[]` is doorgetrokken |
| `lijneinde` | `'butt'`, `'round'` of `'square'` |
| `lijnhoek` | `'miter'`, `'round'` of `'bevel'` |
| `overdrukLijn`, `overdrukVulling` | `true`: deze kleur overdrukt (voor snij- en rillijnen in een eigen steunkleur) |

Bij een `pad` kan ook `vulregel`: `'nonzero'` (standaard) of `'evenodd'`
(een ring of letter met een gat). Bij `tekst` kan ook `draai` (graden, om het
punt `x, y`; negatief is tegen de klok in, handig voor een asbijschrift).

Bij tekst kan ook: `gewicht` (100, 200, … 900), `uitlijning` (`'links'`,
`'midden'`, `'rechts'`; bij midden en rechts is `x` het midden of de
rechterkant), `regelafstand` (pt) en `letterafstand` (duizendsten van een em).
Tekst staat in Inter.
| `naam` | hooguit 100 tekens; zo heet de vorm in het lagenpaneel |

Een driehoek als pad:

```js
await vexel.maak([{
  soort: 'pad',
  naam: 'Driehoek',
  subpaden: [{
    gesloten: true,
    punten: [{ x: 0, y: 100 }, { x: 50, y: 0 }, { x: 100, y: 100 }],
  }],
  vulling: null,
  lijn: { cmyk: [0, 0, 0, 100] },
  lijndikte: 1,
}]);
```

Een groep met tekst:

```js
await vexel.maak([{
  soort: 'groep',
  naam: 'Label',
  kinderen: [
    { soort: 'rechthoek', x: 0, y: 0, b: 120, h: 30, vulling: { hex: '#eeeeee' }, lijn: null },
    { soort: 'tekst', x: 8, y: 20, inhoud: 'Hallo', grootte: 12, vulling: { hex: '#111111' } },
  ],
}]);
```

## Kleuren

Een `Kleur` is een van:

```js
{ cmyk: [c, m, y, k] }   // elk 0 tot 100
{ hex: '#rrggbb' }
{ steunkleur: { naam: 'Stans', cmyk: [0, 100, 0, 0] }, tint: 100 }   // een steunkleur (zie hieronder)
{ registratie: true }     // de registratiekleur (op alle platen), voor paskruizen
null                      // geen kleur
```

Een **steunkleur** wordt een staal in het document. Bestaat er al een
steunkleur met die naam (hoofdletters tellen niet), dan wordt die gebruikt en
mag je `cmyk` weglaten; anders is `cmyk` de kleur op het scherm en in de
proef. Gebruik dit voor snij-, ril- en vouwlijnen, met `overdrukLijn: true`.
`tint` (0–100) is optioneel. In `selectie()` staat bij zo'n kleur ook
`steunkleur: 'Naam'`.

Kies CMYK in een CMYK-document (`doc.kleurruimte === 'cmyk'`) en anders hex.

## Het venster

Een commando met `venster` opent een venster van de opgegeven maat. Daarin
draait `plugin.js`, en je bouwt de inhoud zelf op met `document.createElement`.
Er staat al een basisstijl klaar in de stijl van Vexel: donker, Inter of het
systeemlettertype, 11 tot 12 px.

Klassen:

| klasse | voor |
|---|---|
| `.knop` | een knop |
| `.knop.primair` | de hoofdknop (bijvoorbeeld "Maken") |
| `.veld` | invoervelden en keuzelijsten |
| `.rij` | een rij naast elkaar |
| `.label` | het label boven of naast een veld |
| `.uitleg` | kleine, zachtere uitlegtekst |

CSS-variabelen op `:root`: `--bg`, `--bg-2`, `--lijn`, `--tekst`,
`--tekst-zacht`, `--accent`.

Het venster heeft geen netwerk en een strikte beveiliging. Daarom:

- Stijlen mogen gewoon: een `<style>`-element, `style="..."` of `element.style`.
- Koppel gebeurtenissen met `addEventListener`, niet met `onclick="..."`
  (inline scripts draaien niet).
- Een `<form>` werkt: Enter in een veld en een knop met `type="submit"`
  geven het `submit`-event, er wordt niets verstuurd. Roep in je handler
  `gebeurtenis.preventDefault()` aan.
- Escape sluit het venster (net als het kruisje in de kop).
- Gebruik `canvas` gerust voor een voorvertoning.
- Laad geen afbeeldingen of lettertypen van buiten.

Een klein venster:

```js
vexel.opCommando('maken', async () => {
  const veld = document.createElement('input');
  veld.className = 'veld';
  veld.type = 'number';
  veld.value = '10';

  const knop = document.createElement('button');
  knop.className = 'knop primair';
  knop.textContent = 'Maken';
  knop.addEventListener('click', async () => {
    try {
      const r = vexel.mm(Number(veld.value) || 10);
      await vexel.maak([{ soort: 'ellips', cx: r, cy: r, rx: r, ry: r, vulling: { hex: '#5aa2ff' } }]);
      vexel.sluit();
    } catch (fout) {
      vexel.melding(fout.message, 'fout');
    }
  });

  const rij = document.createElement('div');
  rij.className = 'rij';
  rij.append(veld, knop);
  document.body.append(rij);
  veld.focus();
});
```

## Wat de controle afwijst

`node tools/valideer.mjs` (en dus CI) weigert in `plugin.js`:

- `eval`, `Function`, `import(`, `importScripts`
- netwerk: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`
- buiten het eigen venster komen: `top`, `parent`, `opener`, `frames`, `self`,
  `window`, `globalThis` (als losse naam; `el.style.top` en `{ top: 1 }` mogen
  wel), `postMessage`, `open(`, `location`, `defaultView`
- opslag buiten de API: `document.cookie` (en `cookie` overal),
  `document.domain`, `localStorage`, `sessionStorage`, `indexedDB`, `caches`
- workers: `Worker`, `SharedWorker`, `navigator.serviceWorker`
- `document.write`, `</script` (ook in tekst en commentaar)
- `setTimeout` of `setInterval` met tekst als eerste argument
- `atob` en `btoa` (geen verstopte code), en backslash-escapes in namen
  (zoals `fetch`)
- regels langer dan 200 tekens (geen geminificeerde code)
- bidi-stuurtekens en andere onzichtbare tekens (in elk bestand)
- merknamen van anderen (in manifest, README, icoon en code, ook in commentaar
  en tekst)

De woorden worden in de code gezocht nadat tekst tussen aanhalingstekens,
templates en commentaar zijn weggehaald, dus `'fetch'` in een melding of
`// top` in commentaar is geen probleem. Je hoeft alleen te zorgen dat je geen
variabele `top` of `parent` noemt.

Het icoon wordt geweigerd bij `<script`, `on…`-attributen, `<foreignObject`,
`<!DOCTYPE`, `<!ENTITY`, `javascript:`, `href` of `url(...)` naar iets buiten
het bestand, of een viewBox die niet vierkant is.

## De index

GitHub Actions bouwt bij elke push naar `main` de index en zet hem op
`https://guuslab.github.io/vexel-plugins/index.json`:

```json
{
  "schema": 1,
  "gemaakt": "2026-10-13T12:00:00Z",
  "commit": "<40 hex>",
  "plugins": [
    {
      "id": "raster",
      "naam": "Raster",
      "beschrijving": "...",
      "auteur": { "naam": "GuusLab", "github": "GuusLab" },
      "licentie": "MIT",
      "categorie": "vormen",
      "rechten": ["document.schrijven"],
      "commandos": [{ "id": "maken", "titel": "Raster maken…", "venster": { "breedte": 340, "hoogte": 400 } }],
      "icoon": "data:image/svg+xml;base64,...",
      "bron": "https://github.com/GuusLab/vexel-plugins/tree/<commit>/plugins/raster",
      "hash": "<64 hex>",
      "bestanden": { "plugin.js": { "sha256": "<64 hex>", "grootte": 1234 } }
    }
  ],
  "ingetrokken": [{ "id": "oud-ding", "reden": "..." }]
}
```

- `bestanden` noemt alleen `plugin.js`. Het icoon zit als data-URI in de index.
- De code staat op `plugins/<id>/<sha256>.js` naast de index. Het adres hangt af
  van de inhoud, dus een oude index wijst nooit naar nieuwe code.
- `grootte` is het aantal bytes van `plugin.js`.
- `ingetrokken` komt uit `ingetrokken.json`. Een ingetrokken plugin staat niet
  meer in `plugins`, en Vexel zet hem meteen uit, ook als hij al
  geïnstalleerd is.

### Hoe de hash wordt berekend

```
hash = sha256_hex( UTF-8( id + "\n" + JSON.stringify(manifest) + "\n" + sha256_hex(plugin.js) ) )
```

- `sha256_hex(plugin.js)` is de sha256 van de ruwe bytes van het bestand, in
  kleine hex-letters (dezelfde als `bestanden["plugin.js"].sha256`).
- `manifest` bevat de velden in deze vaste volgorde, zonder spaties, zoals
  `JSON.stringify` ze zonder extra argumenten schrijft:
  `id`, `naam`, `beschrijving`, `auteur` (`naam`, dan `github` als die er is),
  `licentie`, `categorie`, `rechten` (in de volgorde van het manifest),
  `commandos` (in de volgorde van het manifest; per commando `id`, `titel`,
  dan `venster` als dat er is, met `breedte` en `hoogte`).
- Optionele velden die ontbreken, worden weggelaten (niet `null`).
- Het moet byte voor byte de uitvoer van JavaScripts `JSON.stringify` zijn:
  geen spaties na `:` of `,`, tekens buiten ASCII (zoals `…`) letterlijk in
  UTF-8 en niet als `\u2026`, en `<`, `>`, `&` en `/` niet ge-escaped. Let
  daarop als je de hash in een andere taal narekent; sommige JSON-bibliotheken
  doen standaard wel spaties of escapes, en dan klopt geen enkele hash.
- Dit is precies het eerste deel van het index-item, dus Vexel kan de hash
  narekenen uit de index plus de opgehaalde code.

Voorbeeld voor `raster`:

```
raster
{"id":"raster","naam":"Raster","beschrijving":"Verdeel het tekengebied in kolommen en rijen met gelijke tussenruimte.","auteur":{"naam":"GuusLab","github":"GuusLab"},"licentie":"MIT","categorie":"vormen","rechten":["document.schrijven"],"commandos":[{"id":"maken","titel":"Raster maken…","venster":{"breedte":340,"hoogte":400}}]}
<sha256 van plugin.js>
```

(drie regels, gescheiden door `\n`, zonder `\n` aan het eind).
