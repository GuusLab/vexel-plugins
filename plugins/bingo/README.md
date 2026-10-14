# Bingokaarten

Maakt unieke bingokaarten om te drukken: de klassieke kaart voor 75 ballen
(5 × 5 met BINGO erboven en een vrij midden), de kaart voor 90 ballen (3 × 9,
in stroken van 6) of een kaart met je eigen woorden voor muziek- of
feestbingo. Met kaartnummers en een trekkingslijst om af te strepen.

## Gebruik

1. Kies **Plugins › Bingokaarten…**.
2. Kies de **Soort**:
   - *75 ballen*: per kolom vijf getallen uit B 1–15, I 16–30, N 31–45,
     G 46–60 en O 61–75, het midden is vrij.
   - *90 ballen*: kaarten van 3 rijen en 9 kolommen (1–9, 10–19, …, 80–90),
     met 5 getallen per rij en minstens één per kolom, oplopend in elke kolom.
     Zes kaarten vormen een strook waarop alle getallen 1–90 precies één keer
     staan, zoals het hoort.
   - *Eigen woorden*: typ of plak je woorden, één per regel (titels, artiesten,
     dingen op het feest). Kies een raster van 3 × 3, 4 × 4 of 5 × 5 en of het
     midden vrij is.
3. Geef een **Titel** (bij 75 ballen staat die klein onder de kaart, anders in
   de kop).
4. Kies het **Aantal kaarten**, hoeveel er **Per vel** komen en het **Eerste
   nummer**. De plugin rekent de grootste kaart uit die past, binnen de
   **Marge**, met 6 mm tussen de kaarten.
5. Kies een **Kleur** en of je **Kaartnummer** en **Trekkingslijst** wilt.
6. Klik **Kaarten maken**.

Het eerste vel komt op het tekengebied. Zijn er meer vellen (of een
trekkingslijst), dan komen die als vlakken rechts naast het tekengebied, elk
met een grijze stippellijn om de rand (*Vlakken naast het tekengebied*). Zet
ze op een eigen tekengebied of pagina en gooi de stippellijnen weg. Elk vel is
een groep (*Vel 2*) met kaarten als *Bingokaart 0007*, met daarin de kop, het
raster en de getallen of woorden als losse tekstjes.

Je laatste instellingen (ook je woordenlijst) worden onthouden.

## Uniek en reproduceerbaar

- Geen twee kaarten zijn gelijk. Bij eigen woorden waarschuwt de plugin als de
  lijst te kort is voor genoeg verschillende kaarten.
- Kaart nummer *n* hangt alleen af van het **Zaadje** en *n*. Zo kun je in
  delen werken: maak 1–100, en later 101–200 met **Eerste nummer** 101 en
  hetzelfde zaadje. Met **Andere** kies je een nieuw zaadje.
- Vexel maakt hooguit 5000 vormen per keer. Met trekkingslijst zijn dat
  ongeveer 125 kaarten van 75 ballen, 210 van 90 ballen of 140 woordkaarten
  van 5 × 5. Vraag je meer, dan zegt de plugin precies hoeveel er passen en bij
  welk nummer je het volgende deel begint.

## Tips

- De trekkingslijst bij 75 ballen heeft per letter een kolom, bij 90 ballen
  tien getallen per rij; bij eigen woorden is het een lijst met afstreepvakjes.
- Bij woorden kiest de plugin één lettergrootte voor de hele kaart en breekt
  lange titels over twee of drie regels. Een heel lang woord wordt kleiner.
- In een CMYK-document krijgen kop, rand en getallen CMYK-kleuren; in RGB
  worden het RGB-kleuren.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de kaarten, de
  trekkingslijst en de hulplijnen te tekenen.

Bingokaarten leest je selectie niet en bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
