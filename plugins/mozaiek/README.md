# Mozaïek

Vul het tekengebied (tot in de afloop) of het kader van je selectie met een
low-poly-mozaïek van driehoeken of een mozaïek van onregelmatige cellen, in een
zacht kleurverloop. Een rustige, moderne achtergrond voor een flyer, poster,
omslag of presentatie, die je met één klik opnieuw kunt laten vallen.

## Gebruik

1. Selecteer eventueel een vorm als je alleen dat stuk wilt vullen.
2. Kies **Plugins › Mozaïek…**.
3. Kies de **soort**: **Driehoeken** (low-poly) of **Cellen** (Voronoi), en hoe
   de punten liggen: **Vrij verspreid** (natuurlijk, nooit te dicht op elkaar)
   of een **Verspringend raster** met een instelbare **onregelmatigheid**.
4. Stel de **celmaat** in millimeter in. De samenvatting onderin zegt hoeveel
   stukjes het worden.
5. Kies een **kleurenreeks** of drie eigen kleuren (begin, midden, eind; zet
   *midden* uit voor een verloop van twee kleuren), het **verloop** (lineair
   onder een **hoek**, of radiaal vanuit het midden) en de **variatie**: hoeveel
   de stukjes onderling verschillen.
6. Kies of je **lijnen** tussen de stukjes wilt (licht of donker, met een
   **lijndikte** in punt).
7. Kies wat je wilt **vullen**: het tekengebied met afloop, alleen het
   tekengebied, of het kader van de selectie.
8. Niet tevreden? Klik **Andere variant** of typ zelf een getal bij **Variant**.
   Hetzelfde getal geeft altijd hetzelfde mozaïek.
9. Klik **Mozaïek maken**.

Het mozaïek komt als één groep **achteraan** in de actieve laag, als
achtergrond achter wat er al staat (vink *Achteraan* uit om hem bovenop te
leggen). Bij **Met afloop** gebruikt de plugin de afloop van je document; alleen
als die niet bekend is, geldt de maat die je zelf invult. Elk stukje is een los pad, dus je kunt er ook een paar
uitlichten of anders kleuren. Eén keer ongedaan maken haalt alles weer weg. Je
laatste instellingen worden onthouden.

## Tips

- Een mozaïek heeft hooguit 4000 stukjes. Wordt het er meer, dan vraagt de
  plugin om een grotere celmaat. Driehoeken zijn er ongeveer twee keer zoveel als
  cellen bij dezelfde celmaat.
- Zonder lijnen krijgt elk stukje een haarlijntje in zijn eigen kleur, zodat er
  bij het drukken en op het scherm geen witte naadjes tussen de stukjes zitten.
- Een lage variatie (10 tot 20 %) geeft een rustig, bijna glad verloop; hoog
  (60 % en meer) een levendig, kristalachtig vlak.
- In een CMYK-document worden de kleuren in CMYK gemengd, anders in RGB.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om het kader van je selectie te kennen
  als je dat wilt vullen. Verder wordt er niets van de selectie gebruikt.
- **Document wijzigen** (`document.schrijven`): om het mozaïek te tekenen.

Mozaïek bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
