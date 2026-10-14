# Kleurenblindheid

Bekijk je ontwerp zoals mensen met een vorm van kleurenblindheid het zien:
protanopie, deuteranopie, tritanopie en achromatopsie naast elkaar. De plugin
waarschuwt voor kleurparen die dan samenvallen, zodat een grafiek, kaart of
legenda voor iedereen leesbaar blijft. Ongeveer 1 op de 12 mannen ziet kleuren
anders.

## Gebruik

1. Selecteer de vormen die je wilt controleren (bijvoorbeeld de staven en de
   legenda van een grafiek).
2. Kies **Plugins › Kleurenblindheid…**.
3. Bekijk de vijf voorvertoningen: normaal zicht en de vier soorten. Het zesde
   vak toont elke kleur uit de selectie, normaal en per soort.
4. Lees de waarschuwingen: elk kleurpaar dat normaal goed te onderscheiden is,
   maar bij een soort kleurenblindheid bijna gelijk wordt, met links de echte
   kleuren en rechts hoe ze dan overkomen.
5. Kies bij **Sterkte** *Volledig* (de -anopieën) of *Gedeeltelijk* (de
   mildere -anomalieën, die vaker voorkomen).
6. Wil je het in je document zien? Kies bij **Kopie ernaast** een soort (of
   alle vier) en klik **Gesimuleerde kopie maken**. De kopie komt rechts naast
   de selectie, met de omgerekende kleuren en een bijschrift.

## Tips

- Lost een waarschuwing op door de kleuren ook in licht en donker te laten
  verschillen, of voeg een patroon, label of vorm toe.
- Rood en groen vallen het vaakst samen (deuteranopie en protanopie); blauw en
  oranje blijven meestal goed te onderscheiden.
- Groepen en foto’s kan de plugin niet uitlezen: open de groep en selecteer de
  vormen erin. Tekst wordt wel getoond, maar niet gekopieerd.
- De simulatie gebruikt de gepubliceerde matrices van Machado, Oliveira en
  Fernandes (2009); het kleurverschil is CIEDE2000. Een waarschuwing komt bij
  een verschil onder 8 (normaal minstens 12). CMYK-kleuren worden eenvoudig
  naar schermkleuren omgerekend, dus zie het als een goede benadering.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de vormen en kleuren van de
  selectie te zien.
- **Document wijzigen** (`document.schrijven`): alleen voor de gesimuleerde
  kopie, als je daarom vraagt. Je eigen vormen blijven onveranderd.

## Licentie

MIT, eigen werk van GuusLab.
