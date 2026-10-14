# Nummeren

Maakt genummerde tickets, bonnen, loten en garderobenummers, met of zonder
afscheurstrook en perforatielijn, netjes verdeeld over vellen met snijlijnen.
Op volgorde van de snijstapel, zodat je na het snijden meteen nette stapels
op volgorde hebt.

## Gebruik

1. Kies **Plugins › Nummeren…**.
2. **Vak**: de maat van één ticket (met strook), en waar de **Strook** zit
   (links, rechts, boven, onder of geen) en hoe groot hij is.
3. **Nummer**: voorvoegsel (*Nr.*), aantal **Cijfers** (voorloopnullen:
   4 geeft *0007*), achtervoegsel, **Beginnummer**, **Stap** en **Aantal**.
4. **Volgorde**:
   - *Op snijstapel*: vel 1 krijgt 1, 11, 21, …, vel 2 krijgt 2, 12, 22, …
     Leg de gedrukte vellen op elkaar, snijd ze, en elke stapel loopt netjes
     op. Het aantal wordt afgerond op hele vellen.
   - *Per vel*: 1, 2, 3, … gewoon op volgorde over het vel.
5. Kies de **Plek** van het nummer in het vak en de **Kleur** (rood is
   klassiek voor nummers).
6. **Opmaak en vel**: een **Titel** en **Omschrijving**, de **Marge** rond het
   vel en de **Snijruimte** tussen de vakken (0 = één snede tussen twee
   vakken). Zet aan wat je wilt:
   - *Alleen nummers*: geen titel of omschrijving, voor vellen die al
     voorgedrukt zijn (je drukt alleen de nummers erbij).
   - *Snijlijnen*: de rand van elk vak in de steunkleur *Snijlijn*.
   - *Stippellijn drukken*: een fijne grijze stippellijn op de perforatie,
     zodat je ziet waar je moet scheuren.
   - *Naam en telefoon op strook*: invulregels op de strook (als hij groot
     genoeg is).
7. Klik **Nummeren**.

Het nummer staat in het vak én op de strook. De perforatie zelf is een
streeplijn in de steunkleur *Perforatie*; snijlijnen en perforatie
overdrukken, zodat de drukker ze makkelijk uit de drukvorm haalt of als
stans- of perforatielijn gebruikt.

Vel 1 komt op het tekengebied; de andere vellen komen ernaast, tien op een
rij, elk met een grijze stippellijn om de rand (*Vlakken naast het
tekengebied*). Zet ze op eigen pagina's en gooi de stippellijnen weg. Elk
vak is een groep met het nummer als naam (*Nr. 0042*).

## Je eigen tekst als sjabloon

Selecteer een tekst voordat je de plugin opent, bijvoorbeeld *Lot ####* in
je eigen kleur en grootte. De plugin gebruikt die tekst dan voor het nummer:
de langste reeks `#` wordt het nummer met evenveel cijfers (*Lot 0042*).
Zonder `#` komt het nummer achter je tekst. Lettergrootte en kleur komen uit
je tekst.

Heb je ook een rechthoek geselecteerd (bijvoorbeeld de rand van je ontwerp),
dan neem je met de knop **Maat … mm** de maat daarvan over voor het vak.

## Tips

- Het venster laat zien welke nummers er komen en waarschuwt als het laatste
  nummer meer cijfers heeft dan je gekozen hebt.
- Vexel maakt hooguit 5000 vormen per keer. Met strook en invulregels zijn dat
  zo'n 400 tickets, met *Alleen nummers* zonder snijlijnen zo'n 2500. Vraag je
  meer, dan zegt de plugin precies hoeveel er passen en bij welk nummer je het
  volgende deel begint. Werk je *Op snijstapel*, maak dan alles in één keer,
  anders klopt de stapel niet.
- Snijruimte groter dan 0 heb je nodig als je ontwerp tot over de rand loopt
  (afloop): elk vak wordt dan apart gesneden.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om een geselecteerde tekst als
  sjabloon te gebruiken en de maat van een geselecteerde rechthoek over te
  nemen. Er wordt niets aan je selectie veranderd.
- **Document wijzigen** (`document.schrijven`): om de tickets, nummers en
  hulplijnen te tekenen.

## Licentie

MIT, eigen werk van GuusLab.
