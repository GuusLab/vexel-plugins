<div align="center">

# Vexel-plugins

**De openbare plugins voor Vexel: kleine uitbreidingen die iedereen kan maken.**

[Bekijk de galerij](https://guuslab.github.io/vexel-plugins/) ·
[Een plugin maken](#een-plugin-maken-in-5-minuten) ·
[De API](docs/api.md) ·
[Bijdragen](CONTRIBUTING.md)

</div>

> **In English.** This is the public plugin repository for Vexel. A plugin is
> one plain JavaScript file plus a small manifest. It runs in a sandbox with no
> network and talks to Vexel only through a small API. Everything here is
> written in Dutch, but contributions in English are welcome too: open a pull
> request with your plugin in `plugins/<id>/`, CI checks it automatically, a
> maintainer reviews the code, and once merged it is live within minutes.
> Start with [docs/api.md](docs/api.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Wat is dit?

Een plugin voegt een commando toe aan Vexel: een raster tekenen, kleuren
zoeken die bij elkaar passen, een patroon maken. Elke plugin is één gewoon
JavaScript-bestand, zonder build en zonder afhankelijkheden, met een klein
manifest dat zegt wat hij doet en wat hij mag.

Deze repo is de catalogus. Wat op `main` staat, staat in Vexel.

## Installeren in Vexel

1. Open in Vexel het menu **Plugins › Plugins beheren…**.
2. Kies een plugin. Je ziet wat hij doet, wie hem maakte en precies wat hij
   mag.
3. Klik **Installeren**. De plugin staat daarna in het menu **Plugins**.

Vexel haalt de code zelf op en controleert de sha256 tegen de index. Klopt die
niet, dan weigert Vexel de plugin. Wat je installeert, bewaart Vexel bij
zichzelf, dus een geïnstalleerde plugin blijft werken als deze site even
onbereikbaar is.

## Plugins

| | Plugin | Wat hij doet | Mag |
|---|---|---|---|
| <img src="plugins/raster/icoon.svg" width="40" alt=""> | [**Raster**](plugins/raster) | Verdeel het tekengebied in kolommen en rijen met gelijke tussenruimte. | document wijzigen |
| <img src="plugins/kleurharmonie/icoon.svg" width="40" alt=""> | [**Kleurharmonie**](plugins/kleurharmonie) | Zet een rij CMYK-kleurvlakjes neer die passen bij de vulkleur van je selectie. | selectie lezen, document wijzigen |
| <img src="plugins/rozet/icoon.svg" width="40" alt=""> | [**Rozet**](plugins/rozet) | Teken een sierlijk rozetpatroon als één pad, met instelbare lussen, straal en verhouding. | document wijzigen |

## Een plugin maken in 5 minuten

**1. Fork en clone deze repo,** en maak een map met de naam van je plugin. De
naam bestaat uit kleine letters, cijfers en streepjes:

```sh
git clone https://github.com/<jij>/vexel-plugins
cd vexel-plugins
mkdir plugins/hallo-cirkel
```

**2. Schrijf het manifest,** `plugins/hallo-cirkel/plugin.json`:

```json
{
  "id": "hallo-cirkel",
  "naam": "Hallo cirkel",
  "beschrijving": "Zet een cirkel van 20 mm midden op het tekengebied.",
  "auteur": { "naam": "Jouw Naam", "github": "jouw-gebruikersnaam" },
  "licentie": "MIT",
  "categorie": "vormen",
  "rechten": ["document.schrijven"],
  "commandos": [{ "id": "maken", "titel": "Cirkel maken" }]
}
```

**3. Schrijf de code,** `plugins/hallo-cirkel/plugin.js`:

```js
'use strict';

vexel.opCommando('maken', async () => {
  const doc = await vexel.document();
  const r = vexel.mm(10);
  await vexel.maak([{
    soort: 'ellips',
    cx: doc.tekengebied.b / 2,
    cy: doc.tekengebied.h / 2,
    rx: r,
    ry: r,
    vulling: doc.kleurruimte === 'cmyk' ? { cmyk: [0, 60, 100, 0] } : { hex: '#ff8a1f' },
  }]);
  vexel.melding('Cirkel gemaakt', 'ok');
  vexel.sluit();
});
```

Dit commando heeft geen venster, dus het draait onzichtbaar en sluit zichzelf
met `vexel.sluit()`. Wil je een venster met velden, geef het commando dan een
`venster` en een titel die eindigt op `…`. Kijk in [docs/api.md](docs/api.md)
of in de drie plugins hierboven hoe dat gaat.

**4. Voeg een icoon en een README toe.** `icoon.svg` is een vierkante SVG
zonder tekst, script of externe verwijzingen, hooguit 16 KB. In `README.md`
leg je uit wat de plugin doet, hoe je hem gebruikt en waarom hij elk recht
nodig heeft.

**5. Controleer en probeer hem uit.**

```sh
node tools/valideer.mjs plugins/hallo-cirkel
```

Je hebt alleen Node.js 20 of nieuwer nodig. De controle is dezelfde als in CI
en noemt bij elke fout het bestand en de regel.

Probeer de plugin daarna uit in de proefbank:

```sh
node tools/proefbank.mjs plugins/hallo-cirkel
```

en open http://localhost:4321. Je ziet een tekengebied, je commando's en een
logboek van wat de plugin doet. De plugin draait daar net als in Vexel: in
een afgeschermd venster, met dezelfde API en dezelfde controles op vormen,
kleuren en rechten. Pas je `plugin.js` aan, klik dan gewoon opnieuw op het
commando. Je hebt er geen Vexel-account voor nodig.

Heb je wel een account, probeer hem dan ook in Vexel zelf: **Plugins › Plugin
uitproberen…** en kies `plugin.json`, `plugin.js` en (als je wilt)
`icoon.svg` tegelijk. Hij draait dan alleen bij jou en staat in het menu
Plugins met "(proef)" erachter. Werkt alles, open dan een pull request.

## Hoe publiceren werkt

Er is geen aparte publicatiestap en niemand hoeft een versienummer op te hogen.

1. **Pull request.** Je opent een PR met je map in `plugins/<id>/`.
2. **Controle.** GitHub Actions draait meteen de controle (`controle`): het
   manifest, de bestanden, de grootte, het icoon en de code. Die moet groen
   zijn.
3. **Review.** Een beheerder leest je code, je README en de rechten die je
   vraagt. Wat er gecontroleerd wordt, staat in [CONTRIBUTING.md](CONTRIBUTING.md#wat-de-review-controleert).
4. **Merge.** Na de merge bouwt GitHub Actions de index en de galerij en zet
   ze op GitHub Pages. Binnen een paar minuten staat je plugin in Vexel.

Elke plugin krijgt een `hash` die uit het manifest en de code wordt berekend.
Verander je iets, dan verandert de hash, en Vexel ziet dat er een nieuwe versie
is.

Gaat er iets mis met een plugin, dan komt hij in `ingetrokken.json`. Vexel
zet een ingetrokken plugin meteen uit, ook als hij al geïnstalleerd is.

## Veiligheid

Wat een plugin wel en niet kan, in gewone woorden:

- **Hij draait in een afgeschermd venster.** Vexel start elke plugin in een
  sandbox: een eigen, losstaande omgeving zonder cookies.
- **Hij heeft geen internet.** Een plugin kan niets downloaden en niets
  versturen, dus ook je tekening niet. Netwerkfuncties zijn geblokkeerd
  (ook WebRTC), en zijn venster kan niet naar een andere site.
- **Hij komt niet bij je account of je andere projecten.** Een plugin ziet
  alleen het document waarin je hem start, en alleen via de API: de naam, de
  maat en de kleurruimte, en met het juiste recht je selectie.
- **Hij kan alleen wat zijn rechten toestaan.** Zonder `selectie.lezen` ziet
  hij je selectie niet; zonder `document.schrijven` kan hij niets tekenen of
  wijzigen. Wat een plugin verandert, kun je ongedaan maken zoals elke
  andere wijziging.
- **De code wordt gelezen.** Voordat een plugin hier verschijnt, controleert
  CI hem automatisch en leest een beheerder de code. De controle weigert onder
  meer `eval`, netwerkfuncties, verstopte code en geminificeerde code, zodat
  wat er staat ook te lezen is.

Geen van die maatregelen is op zichzelf waterdicht; samen maken ze het
moeilijk om iets kwaads te doen en makkelijk om het te zien. Vind je toch een
gat, meld het dan zoals in [SECURITY.md](SECURITY.md) staat.

## Deze repo

```
plugins/<id>/          één map per plugin: plugin.json, plugin.js, icoon.svg, README.md (en LICENSE)
ingetrokken.json       plugins die niet meer gebruikt mogen worden
tools/valideer.mjs     de controle (dezelfde als in CI)
tools/proefbank.mjs    een plugin uitproberen zonder Vexel-account
tools/bouw-index.mjs   bouwt _site/: index.json, de code per hash en de galerij
tools/test.mjs         tests voor de controle, met foute voorbeelden in tools/testgevallen/
tools/merken.json      merknamen van anderen (als hash) die niet in een plugin mogen staan
docs/api.md            de API, het manifest en het indexformaat
```

| Commando | Wat het doet |
|---|---|
| `node tools/valideer.mjs` | controleert alle plugins; met een pad alleen die map |
| `node tools/test.mjs` | test de controle zelf |
| `node tools/bouw-index.mjs` | controleert en bouwt `_site/` zoals GitHub Pages hem krijgt |

De index staat op `https://guuslab.github.io/vexel-plugins/index.json`. Het
formaat en hoe de hash berekend wordt, staan in [docs/api.md](docs/api.md#de-index).

## Licentie

De tools en de plugins van GuusLab vallen onder de [MIT-licentie](LICENSE).
Elke plugin noemt zijn eigen licentie in `plugin.json`; is dat niet MIT, dan
staat de licentietekst in de map van die plugin.
