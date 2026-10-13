# Halftoon

Vul het tekengebied of een vorm met een halftoonraster: stippen,
vierkantjes, ruiten of lijnen die van klein naar groot verlopen. Als echte
vectoren, dus scherp op elk formaat; mooi als achtergrond, als
overgang in een affiche of als stoer effect in één steunkleur.

## Gebruik

1. Selecteer eventueel de vorm die je wilt vullen.
2. Kies **Plugins › Halftoon…**.
3. Kies bij **Vullen** het **Tekengebied** (tot in de afloop) of de
   **Selectie**. Bij een selectie komen alleen vormpjes waarvan het midden
   binnen de vorm ligt, dus ook een cirkel of een ster wordt netjes gevuld.
   Tekst vult het kader; zet letters eerst om naar paden om ze zelf te
   vullen.
4. Kies de **vorm** van de puntjes, de **rastermaat** in millimeter en de
   **rasterhoek** (45° is klassiek).
5. Kies het **verloop**: lineair (met een richting in graden: 0° van links
   naar rechts, 90° van boven naar onder), radiaal vanuit het midden, of van
   het midden naar de rand.
6. Stel de **grootte** in, van klein naar groot, in procenten van de
   rastermaat. Bij 100 % raken de vormpjes elkaar; stippen zijn bij 141 %
   helemaal dicht, ruiten bij 200 %. Met **Omkeren** wissel je klein en groot.
7. Kies een kleur en klik **Halftoon maken**.

Het raster komt als één groep **Halftoon** met per rasterrij één samengesteld
pad. Vormpjes kleiner dan 0,1 mm laat de plugin weg: die drukken toch niet.
Onder het voorbeeld staat hoeveel vormen en punten het worden; past het niet
in één keer, dan zegt het venster welke rastermaat wel kan.

In een CMYK-document krijgt het raster een CMYK-kleur, anders RGB.

## Tips

- Een rastermaat van 3 tot 6 mm is goed zichtbaar als effect. Een heel A4
  kan tot ongeveer 2,5 mm, een A3 tot ongeveer 3,5 mm; een kleiner gebied kan
  fijner.
- Nieuwe vormen komen bovenop je ontwerp. Zet de groep naar achteren als hij
  achter tekst moet staan.
- Wit op een donker vlak werkt ook: kies **Wit** als kleur.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om te zien welke vorm je wilt vullen
  (kader en omtrek).
- **Document wijzigen** (`document.schrijven`): om het raster te tekenen.

Halftoon bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
