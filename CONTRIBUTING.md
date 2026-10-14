# Bijdragen

Fijn dat je een plugin wilt maken. Dit is de lange versie van
[Een plugin maken in 5 minuten](README.md#een-plugin-maken-in-5-minuten). Je
hebt alleen Node.js 20 of nieuwer nodig: geen build, geen afhankelijkheden,
geen sleutel.

*English is fine too: write your plugin, README and pull request in English if
that is easier for you. Names and messages shown inside Vexel should be Dutch.*

## Wat we aannemen

- **Eén plugin per pull request**, in `plugins/<id>/`, met een id dat nog niet
  bestaat.
- **Gewone, leesbare JavaScript** in één bestand `plugin.js`. Niet
  geminificeerd, niet gecodeerd, geen gebundelde bibliotheken.
- **Iets wat mensen in Vexel echt helpt.** Een kleine plugin die één ding goed
  doet, is beter dan een grote die alles een beetje doet.
- **Zo min mogelijk rechten.** Vraag alleen `selectie.lezen`,
  `document.schrijven`, `beeld.lezen` of `beeld.schrijven` als je ze gebruikt,
  en leg in je README uit waarom.

De exacte regels voor het manifest, de bestanden en de code staan in
[docs/api.md](docs/api.md). `node tools/valideer.mjs plugins/<id>` controleert
ze allemaal, met bestand en regelnummer bij elke fout.

## Stap voor stap

1. Fork deze repo en maak een branch.
2. Maak `plugins/<id>/` met `plugin.json`, `plugin.js`, `icoon.svg` en
   `README.md` (en `LICENSE` als je licentie niet MIT is). Een
   `voorbeeld.svg` (bijvoorbeeld 320 × 200) is optioneel: dat plaatje toont de
   winkel groot bij je plugin. Kijk naar
   [raster](plugins/raster), [kleurharmonie](plugins/kleurharmonie) en
   [rozet](plugins/rozet) als voorbeeld.
3. Draai `node tools/valideer.mjs plugins/<id>` tot hij "In orde" zegt.
4. Probeer de plugin uit met `node tools/proefbank.mjs plugins/<id>` (geen
   account nodig), en als je een Vexel-account hebt ook in Vexel met
   **Plugins › Plugin uitproberen…**: in een leeg document, met en zonder
   selectie, in CMYK en in RGB, en alleen-lezen.
5. Open een pull request en vul de afvinklijst in.

Bestanden buiten `plugins/` (tools, workflows, documentatie) mag je ook
voorstellen, maar die worden altijd door de beheerder beoordeeld.

## Licentie en eigendom

- **Inbound = outbound.** Wat je bijdraagt aan een plugin, valt onder de
  licentie in de `plugin.json` van die plugin. Draag je bij aan iets buiten
  `plugins/`, dan valt dat onder de [MIT-licentie](LICENSE) van deze repo.
- **Alleen eigen werk, of werk met een licentie uit de lijst.** Toegestaan zijn
  `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` en `0BSD`. Neem je
  code over die onder zo'n licentie valt, vermeld dan de bron en de
  oorspronkelijke maker in je README en houd hun copyrightregel intact.
- **Geen assets van derden.** Geen iconen, lettertypen, afbeeldingen,
  kleurenbibliotheken, patronen of andere bestanden die je niet zelf hebt
  gemaakt, ook niet als ze "gratis" lijken.
- **Geen merknamen van anderen.** De naam van een ander product of bedrijf
  hoort niet in het id, de naam, de beschrijving, de README, het icoon of de
  code van een plugin, ook niet als vergelijking ("net als in ..."). Beschrijf
  liever wat je plugin doet. De controle heeft een lijst met namen in
  [`tools/merken.json`](tools/merken.json) (als hash, zodat deze repo ze zelf
  niet noemt; een naam toevoegen gaat met `node tools/merk-hash.mjs "Naam"`),
  maar die lijst is nooit volledig;
  de review let er ook op. Een plugin heet ook niet "Vexel …", zodat niemand
  denkt dat hij officieel is.

## Privacy

Een plugin verzamelt geen persoonsgegevens. Dat volgt al grotendeels uit de
sandbox (er is geen netwerk), maar het geldt ook voor wat je met
`vexel.bewaar()` opslaat: alleen instellingen van de plugin zelf, geen namen,
e-mailadressen of andere gegevens over mensen.

## Wat de review controleert

De automatische controle (`controle`) moet groen zijn. Daarna leest een
beheerder:

- **De code, regel voor regel.** Doet hij wat de README zegt, en niets anders?
  Is hij leesbaar?
- **De rechten.** Gebruikt de plugin elk recht dat hij vraagt, en is dat in de
  README uitgelegd?
- **Herkomst en licentie.** Is het eigen werk of netjes vermeld werk met een
  toegestane licentie? Zitten er geen assets van derden in?
- **Namen.** Geen merknamen van anderen, geen schijn van een officiële plugin.
- **Gedrag in Vexel.** Gaat de plugin netjes om met een lege selectie, een
  alleen-lezen document en fouten van de API (meldt hij ze met
  `vexel.melding`)? Sluit een commando zonder venster zichzelf af?
- **Het venster.** Gebruikt het de basisstijl (`.knop`, `.veld`, `.rij`,
  `.label`, `.uitleg` en de CSS-variabelen), is het met het toetsenbord te
  bedienen, en past het in de opgegeven maat?
- **Teksten.** Nederlandse, duidelijke teksten in het venster en in de
  meldingen.

## Na de merge

Na de merge publiceert GitHub Actions de nieuwe index automatisch; binnen een
paar minuten staat je plugin in Vexel. Een wijziging doe je met een nieuwe pull
request; de hash verandert vanzelf, een versienummer is niet nodig.

Moet een plugin snel uit de lucht (een fout, een klacht, een gat), dan zet de
beheerder hem in `ingetrokken.json`. Vexel zet hem dan bij iedereen uit.

## Gedrag

Voor iedereen die hier meedoet, geldt de [gedragscode](CODE_OF_CONDUCT.md).
Een beveiligingsprobleem meld je zoals in [SECURITY.md](SECURITY.md) staat, niet
in een openbaar issue.
