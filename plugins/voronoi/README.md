# Voronoi-cellen

Vul het tekengebied (tot in de afloop), het kader van je selectie of de
geselecteerde vorm zelf met organische cellen: afgeronde stukjes met een voeg
ertussen, als kiezels, een giraffevacht, celweefsel of een honingraat. Voor
affiches, verpakkingen, omslagen en achtergronden.

Anders dan **Mozaïek**, dat het vlak naadloos betegelt met scherpe driehoeken
of cellen, maakt Voronoi-cellen losse, afgeronde cellen met een open voeg in
de achtergrondkleur, die je met Lloyd-stappen van rommelig naar regelmatig
schuift, die naar één kant of naar het midden kleiner kunnen worden en die
ook precies binnen een vorm passen.

## Gebruik

1. Selecteer eventueel een vorm als je alleen dat stuk wilt vullen.
2. Kies **Plugins › Voronoi-cellen…**.
3. Kies wat je wilt **vullen**: het tekengebied met afloop, alleen het
   tekengebied, het **kader** van de selectie of **binnen de vorm**. Bij
   binnen de vorm worden de cellen langs de rand van de vorm afgeknipt
   (gaten in de vorm blijven open).
4. Kies de **weergave**: **Cellen met voeg** (gevulde cellen) of **Alleen de
   randen** (lijnen; de voeg is dan de lijndikte).
5. Stel de **celmaat** in millimeter in. **Regelmaat** is het aantal
   Lloyd-stappen: bij 0 liggen de cellen rommelig door elkaar, bij 5 tot 10
   worden ze gelijkmatig, bijna als een honingraat.
6. Bij **Kleiner** kies je of de cellen naar onderen, boven, links, rechts,
   het midden of de rand kleiner worden; **Verschil** is hoeveel keer kleiner
   ze daar worden.
7. Stel de **voeg** (de ruimte tussen de cellen) en de **afronding** van de
   hoeken in. Bij 100 % worden de cellen kiezels zonder rechte stukken.
8. Kies een **palet** en hoe de **kleuren** vallen: een **verloop** over het
   vlak onder een **hoek** (met wat **variatie** per cel), of **willekeurig**
   uit het palet.
9. Het **zaadje** bepaalt de cellen: hetzelfde getal geeft altijd hetzelfde
   resultaat. Klik **Anders** voor een nieuwe variant.
10. Klik **Cellen maken**.

Het resultaat is één groep **Voronoi-cellen** met een vlak **Voeg** in de
achtergrondkleur (als je dat aanvinkt) en een groep **Cellen** met per kleur
één pad (**Kleur 1**, **Kleur 2**, …). Zo verander je in één keer alle cellen
van een tint. De cellen zijn vloeiende krommen. Bij het tekengebied komt het
geheel achteraan in de actieve laag (vink dat uit om het bovenop te zetten);
in de selectie komt het bovenop de vorm. Je laatste instellingen worden
onthouden.

In een CMYK-document krijgen alle vlakken CMYK-kleuren, anders RGB.

## Tips

- **Giraffe** met **Willekeurig**, regelmaat 2 en een voeg van 1,5 mm geeft
  een vachtpatroon; **Kiezels** met afronding 100 % een kiezelstrand.
- Met **Alleen de randen**, palet **Inkt** en een dunne lijn krijg je een
  getekend celpatroon om in te kleuren of te graveren.
- Wil je de cellen zonder voeg? Zet de voeg op 0 en de afronding laag.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om het kader of de vorm van de
  selectie te kennen als je die wilt vullen.
- **Document wijzigen** (`document.schrijven`): om de cellen te tekenen.

Voronoi-cellen bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
