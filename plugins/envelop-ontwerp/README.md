# Envelop-ontwerp

Teken de stansvorm (uitslag) van een papieren envelop: een middenpaneel met een
sluitklep, twee zijkleppen en een onderklep. Kies een standaardformaat (C6, C5,
C4, DL of vierkant) of een eigen maat en je krijgt een nette uitslag met
doorgetrokken snijlijnen en gestreepte rillijnen, klaar voor de stanserij of de
snijplotter.

Dit is iets anders dan de envelop-vervorming in Vexel: deze plugin tekent de
vorm waaruit je een echte envelop vouwt.

## Gebruik

1. Kies **Plugins › Envelop-ontwerp…**.
2. Kies het **formaat** van de afgewerkte envelop, of *Eigen maat* en vul de
   lange en korte zijde in (in millimeter).
3. Kies of de **sluitklep aan de lange zijde** zit (een liggende envelop) of
   **aan de korte zijde** (een zak).
4. Kies de **vorm van de sluitklep** (recht of puntig) en de **hoekafronding**.
5. Laat **Klepmaten automatisch** aan voor goede verhoudingen, of zet het uit
   en vul zelf de diepte van de sluitklep, zijkleppen en onderklep in.
6. Kijk naar het voorbeeld en de regel eronder: daar staat de maat van de hele
   uitslag, of hij op het tekengebied past en hoeveel de sluitklep over de
   onderklep valt.
7. Klik **Stansvorm maken**.

De uitslag komt midden op het tekengebied als één groep met daarin:

- **Snijlijn**: de buitencontour als één gesloten pad, magenta, 0,25 pt.
- **Rillijn**: de vier vouwen rond het middenpaneel als streeplijn, cyaan,
  0,25 pt. Een vouw ligt nooit onder een snijlijn.
- **Panelen** (als je dat aanvinkt): lichte vlakken met de namen Voorkant,
  Sluitklep, Zijklep en Onderklep. Handig om je ontwerp op te plaatsen; gooi de
  groep weg voordat je de stansvorm aanlevert.

Het middenpaneel is precies de envelopmaat, van rillijn tot rillijn. De
zijkleppen en de onderklep lopen taps toe, zodat ze plat over elkaar vallen; de
onderklep komt over de zijkleppen heen.

Past de uitslag alleen gedraaid, dan wordt hij een kwartslag gedraaid. Past hij
helemaal niet (een C4 op een A4 bijvoorbeeld), dan zie je dat in het venster en
krijg je een waarschuwing, maar de stansvorm wordt wel gemaakt. Je laatste
instellingen worden onthouden.

In een CMYK-document zijn de lijnen 100% magenta en 100% cyaan, anders RGB.

## Tips

- Kies een envelop die rondom 2 tot 5 mm ruimer is dan de inhoud. Een C-formaat
  is gemaakt voor het A-formaat met hetzelfde nummer (C5 voor A5).
- Laat de sluitklep minstens 10 mm over de onderklep vallen, dan heb je genoeg
  plakrand. Het venster waarschuwt als het minder is dan 8 mm.
- Leg de vezelrichting van het papier evenwijdig aan de lange zijde; dan vouwt
  de envelop het mooist.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de stansvorm te tekenen.

Envelop-ontwerp leest je selectie niet en bewaart alleen zijn eigen
instellingen.

## Licentie

MIT, eigen werk van GuusLab.
