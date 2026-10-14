# Meter en voortgang

Maak in één keer voortgangsringen, halve meters met naald en schaal, of
voortgangsbalken uit een simpele lijst als `Klanttevredenheid: 86`. Handig
voor een jaarverslag, een dashboard op een poster, een presentatie of een
duurzaamheidsrapport: één getal per kader, groot en meteen leesbaar.

## Gebruik

1. Kies **Plugins › Meter en voortgang…**.
2. Kies de **soort**: **Ringen** (een ring met het getal in het midden),
   **Halve meters** (een boog met schaalverdeling en naald) of
   **Voortgangsbalken** (één balk per regel).
3. Typ of plak de waarden, één per regel:

   ```
   Klanttevredenheid: 86
   Op tijd geleverd: 94%
   Taken af: 18/24
   ```

   Tussen label en waarde mag een dubbele punt, puntkomma, tab, `|` of `=`
   staan. `18/24` (of `18 van 24`) telt als een eigen schaal van 0 tot 24.
4. Stel het **minimum**, **maximum** en de **eenheid** in (standaard 0–100 en
   `%`), en de doorsnede of breedte, de dikte en de lettergrootte.
5. Kies de **kleuren**, of elke regel een eigen kleur krijgt, ronde of rechte
   **uiteinden**, en een **spoor** in een lichte tint of lichtgrijs. Bij halve
   meters kun je het aantal **schaalstappen**, **kleurzones** (groen, oranje,
   rood) en de **naald** kiezen.
6. Klik **Maken**.

Alles komt midden op het tekengebied als groep **Ringen**, **Meters** of
**Voortgangsbalken**, met per regel een groep (bijvoorbeeld
"Ring · Klanttevredenheid") met daarin het spoor, de voortgang, de waarde en
het label. Ringen en meters zijn echte bogen (lijnen met een dikte), balken
zijn afgeronde vlakken. In een CMYK-document is alles CMYK, anders RGB. Je
laatste invoer en instellingen worden onthouden.

## Tips

- Bij **Kolommen: Automatisch** komen er zoveel ringen of meters naast elkaar
  als op het tekengebied passen, verdeeld over zo gelijk mogelijke rijen.
- Past het geheel niet op het tekengebied, dan wordt het verkleind; de
  samenvatting onderin zegt dat. Kies dan een kleinere doorsnede.
- Een waarde buiten het bereik komt op de rand te staan (0% of 100%); de
  samenvatting waarschuwt dan.
- Wil je een cijfer zonder eenheid, maak het veld **Eenheid** leeg.
- Voor een volledige verdeling in taartpunten is de plugin **Grafiek** er;
  deze plugin toont per regel één getal tegen een maximum.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de meters en balken te
  tekenen.

Meter en voortgang leest je selectie niet en bewaart alleen zijn eigen
instellingen.

## Licentie

MIT, eigen werk van GuusLab.
