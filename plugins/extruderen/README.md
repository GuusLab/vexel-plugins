# Extruderen

Maak van gesloten vormen een blok met diepte: een logo, letters in contouren,
een pijl of een vlak krijgen zijkanten, zodat ze er stevig en ruimtelijk uitzien.
De zijvlakken worden vanzelf donkerder naarmate ze verder van het licht af staan.
Het resultaat zijn gewone, nette vectoren: je kunt elk vlak daarna nog aanpassen.

## Gebruik

1. Selecteer een of meer gesloten vormen (rechthoeken, ellipsen, sterren,
   samengestelde vormen met gaten, vormen met krommen).
2. Kies **Plugins › Extruderen…**.
3. Stel de **diepte** in (in mm) en de **richting** waarin het blok naar achteren
   loopt: 0° is naar rechts, 45° naar rechtsonder, 90° naar beneden, -45° naar
   rechtsboven.
4. Kies waar het **licht** vandaan komt en hoe sterk de **schaduw** op de
   zijvlakken is.
5. Zet **Het origineel vervangen** aan als het blok in de plaats van je vorm moet
   komen. Laat je het uit, dan komt het blok precies over het origineel heen en
   blijft het origineel eronder bewaard.
6. Het voorbeeld laat het resultaat zien. Klik **Extruderen**.

Elke vorm wordt één groep **3D – naam**, met daarin een groep **Zijvlakken**
(een achterkant en de zichtbare zijvlakken, de achterste eerst) en daarboven het
**Voorvlak**: een exacte kopie van je vorm, met dezelfde krommen, vulling, lijn en
dekking. Alles samen is één stap: één keer ongedaan maken haalt het weg.

## Tips

- Tekst kun je pas extruderen als je er eerst contouren van maakt. Een groep maak
  je eerst los. Open paden slaat de plugin over; de samenvatting zegt welke.
- **Het origineel vervangen** kan alleen als alles in de selectie een gesloten
  vorm is, zodat er nooit per ongeluk iets anders verdwijnt. Bij vervangen komen
  alle blokken op de plek in de lagen van het eerste object.
- Krommen worden voor de zijvlakken in kleine rechte stukjes benaderd (zo fijn
  dat je het niet ziet). Het voorvlak houdt de echte krommen.
- De zijvlakken hebben een haarlijn in hun eigen kleur, zodat er geen witte
  naadjes tussen de vlakken te zien zijn.
- In een CMYK-document worden de zijvlakken donkerder met extra zwart (K), in een
  RGB-document naar rato donkerder.
- Een vorm zonder vulling krijgt een voorvlak in de lijnkleur, anders zou je door
  het blok heen kijken.
- Het voorvlak krijgt geen streeplijn, lijneinde of verloop mee; die kan de
  plugin niet lezen. Zet ze daarna zo nodig opnieuw.
- Bij meerdere vormen die elkaar overlappen wordt elk blok apart opgebouwd. Wil
  je één geheel, voeg de vormen dan eerst samen.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de vorm, de kleuren en de naam van je
  geselecteerde paden te lezen.
- **Document wijzigen** (`document.schrijven`): om het blok te tekenen, en als je
  dat aanzet, om het origineel te vervangen.

## Licentie

MIT, eigen werk van GuusLab.
