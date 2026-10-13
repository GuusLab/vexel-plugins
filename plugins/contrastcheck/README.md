# Contrastcheck

Controleer of tekst goed leesbaar is op zijn achtergrond. De plugin rekent de
contrastverhouding uit volgens de WCAG-formule, laat zien of je de AA- en
AAA-norm haalt voor gewone en grote tekst, en stelt zo nodig de dichtstbijzijnde
lichtere of donkerdere kleur voor die het wel haalt. Handig voor websites,
apps, presentaties, schermen in een winkel en alles wat toegankelijk moet zijn.

## Gebruik

1. Selecteer twee objecten: de tekst (of een vorm, zoals een pictogram) en de
   achtergrond eronder.
2. Kies **Plugins › Contrastcheck…**.
3. Je ziet de **verhouding** (bijvoorbeeld 3,21 : 1), een voorbeeld met grote en
   gewone tekst, en per norm of hij **gehaald** is:
   - AA, gewone tekst: 4,5 : 1
   - AA, grote tekst: 3 : 1
   - AAA, gewone tekst: 7 : 1
   - AAA, grote tekst: 4,5 : 1
   - Vormen en pictogrammen: 3 : 1
4. Haalt het je **doel** niet, dan staan er voorstellen onder: dezelfde kleur
   iets lichter of iets donkerder, de dichtstbijzijnde bovenaan. Kies bij
   **Aanpassen** of de voorgrond of de achtergrond moet veranderen.
5. Kies een voorstel en klik **Toepassen**. De plugin past de kleur aan in je
   werk (één stap, dus ongedaan te maken) en controleert daarna opnieuw.

Is één van de twee een tekstobject, dan is dat de voorgrond. Anders neemt de
plugin het kleinste object als voorgrond. Klopt dat niet, klik dan **Wissel**.

## Tips

- Grote tekst is vanaf 18 pt, of vanaf 14 pt als hij vet is. Bij een tekstobject
  zegt de plugin welke van de twee het is (de plugin kan niet zien of tekst vet
  is).
- De verhouding wordt naar beneden afgerond: 4,49 : 1 haalt 4,5 : 1 niet.
- Heeft een object een dekking onder 100%, dan rekent de plugin met de kleur
  zoals je hem ziet: de achtergrond op wit papier, de voorgrond daaroverheen.
- Heeft een object geen vulling maar wel een lijn, dan telt de lijnkleur, en
  past **Toepassen** de lijnkleur aan.
- Een groep heeft zelf geen kleur. Selecteer dan het object in de groep.
- Bij een verloop gebruikt de plugin de kleur die Vexel ervoor doorgeeft; dat
  is maar een deel van het verloop. Controleer dan zelf het lichtste en
  donkerste stuk.

## Scherm en drukwerk

De WCAG-normen gaan over beeldschermen (RGB). In een CMYK-document gebruikt de
plugin de schermkleur die Vexel van je CMYK-kleur maakt; dat is een benadering
van wat er uit de pers komt. Voorstellen zijn dan echte CMYK-waarden: lichter
is een tint (alle waarden naar rato omlaag), donkerder is meer zwart. Na het
toepassen kijkt de plugin wat het echt geworden is; haalt het net niet, dan
blijft het venster open met een nieuw voorstel.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de kleuren, de dekking en (bij
  tekst) de lettergrootte van de twee objecten te lezen.
- **Document wijzigen** (`document.schrijven`): alleen om een voorgestelde kleur
  toe te passen als je op **Toepassen** klikt. Alleen kijken verandert niets.

## Licentie

MIT, eigen werk van GuusLab.
