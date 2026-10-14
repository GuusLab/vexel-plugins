# Objecten hernoemen

Geef een hele selectie in één keer nette namen, zodat je lagenpaneel leesbaar
wordt: *Knop 01* tot en met *Knop 12* in plaats van *Rechthoek kopie 7*. Met
een patroon, nummers, zoeken en vervangen en hoofdletters, en een lijst die
vooraf laat zien wat elke naam wordt.

## Gebruik

1. Selecteer de objecten die je wilt hernoemen.
2. Kies **Plugins › Objecten hernoemen…**.
3. Kies bij **Naam** wat de basis is:
   - **Nieuwe naam volgens patroon**: typ een patroon, bijvoorbeeld `Knop {n}`.
     Daarin kun je gebruiken: `{n}` (het nummer), `{a}` (A, B, C … AA),
     `{naam}` (de huidige naam), `{soort}` (Pad, Tekst, Groep …) en `{b}` en
     `{h}` (breedte en hoogte in mm).
   - **Huidige naam houden**: alleen zoeken en vervangen en hoofdletters.
4. Stel **Begin bij**, **Stap** en **Cijfers** in (bij `001` krijg je
   voorloopnullen: 001, 002 …).
5. Kies de **Volgorde** waarin genummerd wordt: in leesvolgorde (rij voor rij,
   van links naar rechts), van links naar rechts, van boven naar onder of in de
   volgorde van de lagen. **Omgekeerd** draait hem om.
6. Vul eventueel **Zoeken** en **Vervangen door** in. Met
   **Hoofdlettergevoelig** telt het verschil tussen A en a; met **Zoek met
   patroon** zoek je met een reguliere expressie (in de vervanging werken dan
   `$1`, `$2` …).
7. Kies bij **Hoofdletters** of de namen zo blijven, HOOFDLETTERS, kleine
   letters, Elk Woord Een Hoofdletter of alleen een hoofdletter aan het begin
   krijgen.
8. Controleer de lijst onderin (nieuwe namen staan in de accentkleur, dubbele in
   geel) en klik **Hernoemen**.

Alles is één stap voor ongedaan maken. Objecten waarvan de naam niet verandert,
blijven ongemoeid.

## Tips

- `{naam} {n}` zet een nummer achter de bestaande namen; zoeken naar ` kopie`
  en vervangen door niets ruimt alle *kopie*-namen op.
- `Rij {a}-{n}` met de leesvolgorde geeft stoelen of vakken een code.
- Een naam is hooguit 100 tekens; langer wordt afgekapt.
- Je laatste instellingen worden onthouden.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de huidige namen, soorten en
  posities van de geselecteerde objecten te zien.
- **Document wijzigen** (`document.schrijven`): om de nieuwe namen te zetten
  (met `vexel.wijzig`). Er verandert verder niets aan de objecten.

## Licentie

MIT, eigen werk van GuusLab.
