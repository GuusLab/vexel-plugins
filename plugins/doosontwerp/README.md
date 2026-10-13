# Doosontwerp

Teken de stansvorm (uitslag) van een vouwdoos met insteekkleppen, klaar om aan
de stanserij of snijplotter te geven. Je vult de binnenmaten in en krijgt een
nette uitslag met doorgetrokken snijlijnen en gestreepte rillijnen, elk in een
eigen groep en een eigen kleur.

## Gebruik

1. Kies **Plugins › Doosontwerp…**.
2. Vul de **binnenmaten** in: lengte, breedte en hoogte van de ruimte in de doos
   (in millimeter).
3. Kies het materiaal en de kleppen:
   - **Dikte**: de dikte van het karton. Elke wand wordt binnenmaat plus één
     dikte (van rillijn tot rillijn), en de insteekklep wordt per kant één dikte
     smaller zodat hij soepel insteekt.
   - **Lijmklep**: de breedte van de lijmklep (schuin afgesneden aan beide
     uiteinden).
   - **Insteekklep**: hoe diep de insteek in de doos steekt.
   - **Sluiting**: *rechte insteek* (deksel en bodem scharnieren allebei aan de
     achterkant) of *omgekeerde insteek* (deksel aan de achterkant, bodem aan de
     voorkant).
   - **Stofkleppen**: automatisch (ongeveer 45% van de lengte), een eigen hoogte,
     of geen.
   - **Hoekafronding**: de straal van de afgeronde hoeken van de kleppen.
4. Kijk naar het voorbeeld: het tekengebied staat erachter, zodat je ziet of de
   uitslag past. Onderin staat de maat van de hele uitslag.
5. Klik **Stansvorm maken**.

De uitslag komt midden op het tekengebied als één groep met daarin:

- **Snijlijn**: de buitencontour als één gesloten pad, magenta, 0,25 pt.
- **Rillijn**: alle vouwen als streeplijn, cyaan, 0,25 pt. Een vouw ligt nooit
  onder een snijlijn.
- **Panelen** (als je dat aanvinkt): lichte vlakken met de naam en maat van
  elke wand en klep (Achterkant, Zijkant, Voorkant, Deksel, Insteekklep,
  Stofklep, Lijmklep). Handig om je ontwerp op te plaatsen; gooi de groep weg
  voordat je de stansvorm aanlevert.

Past de uitslag alleen gedraaid, dan wordt hij een kwartslag gedraaid. Past hij
helemaal niet, dan zie je dat in het venster en krijg je een waarschuwing, maar
de stansvorm wordt wel gemaakt. Je laatste instellingen worden onthouden.

In een CMYK-document zijn de lijnen 100% magenta en 100% cyaan, anders RGB.

## Tips

- Zet de snij- en rillijnen in je eigen document op een aparte laag en stel ze
  in als niet-afdrukkend of overdrukkend, zoals je stanserij dat wil.
- Werk je met dik karton (golfkarton), vul dan de echte dikte in; de klepdiepte
  en de wanden groeien vanzelf mee.
- Leg de vezelrichting van het karton evenwijdig aan de hoogte van de doos;
  dan vouwen de wanden het mooist.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de stansvorm te tekenen.

Doosontwerp leest je selectie niet en bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
