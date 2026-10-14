# Meten

Meet van je selectie de echte oppervlakte, de omtrek (de lengte van het pad),
het aantal punten en de maat, met totalen. Handig voor snijplotter, laser en
borduurmachine: hoe lang is de snijlijn, hoeveel materiaal gaat erin en hoe lang
is de machine bezig?

## Gebruik

1. Selecteer een of meer vormen (paden, rechthoeken, ellipsen, samengestelde
   paden).
2. Kies **Plugins › Meten…**.
3. Lees de tabel: per object de oppervlakte, de omtrek, het aantal punten en de
   maat (breedte × hoogte), en onderaan het totaal. Ga met de muis over een rij
   om de vorm in de voorvertoning op te laten lichten.
4. Kies de **Eenheid** (mm, cm of m). Vul eventueel een **Snijsnelheid** in
   (mm/s) voor een schatting van de snijtijd.
5. Wil je de uitkomst in je ontwerp? Kies wat er op het **Label** komt en klik
   **Als label plaatsen**. Het label komt rechts naast de selectie, of eronder
   als het daar niet past, als groep *Meting*.

## Hoe er gemeten wordt

- **Oppervlakte** is de echte gevulde oppervlakte: gaten tellen niet mee, en de
  vulregel van het pad (*nonzero* of *evenodd*) wordt gevolgd. Een ring heeft
  dus de oppervlakte van de ring, een ster met elkaar snijdende lijnen die van
  de hele ster.
- **Omtrek** is de lengte van alle subpaden samen, ook van gaten, met de echte
  lengte van gebogen stukken (Bézier-krommen), niet van de rechte lijnen
  ertussen. Bij een open pad is het de lengte van de lijn.
- De lijndikte telt niet mee: gemeten wordt het pad zelf.

## Tips

- Een groep kan niet in één keer gemeten worden: open de groep en selecteer de
  vormen erin. Tekst eerst omzetten in paden.
- De totale omtrek is de lengte van de snijlijn; bij een rillijn of
  borduursteek meet je die lijnen apart.
- Je eenheid en labelkeuze worden onthouden.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de paden van de selectie te kunnen
  meten.
- **Document wijzigen** (`document.schrijven`): alleen om het label te plaatsen
  als je daarom vraagt. Meten zelf verandert niets.

## Licentie

MIT, eigen werk van GuusLab.
