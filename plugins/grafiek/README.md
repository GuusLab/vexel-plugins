# Grafiek

Maak een staafdiagram, lijndiagram, taart- of donutdiagram uit gegevens die je
typt of plakt. Je krijgt nette vectoren in benoemde groepen, met een mooie
schaal, rasterlijnen, labels en een legenda: klaar voor een jaarverslag, folder
of poster.

## Gebruik

1. Kies **Plugins › Grafiek…**.
2. Typ of plak je gegevens, per regel een label en een waarde:

   ```
   Jan; 12
   Feb; 18,5
   Mrt; 1.250
   ```

   Als scheiding werkt een puntkomma, een tab (geplakt uit een rekenblad) of
   een komma. Voor meer reeksen begin je met een kopregel:

   ```
   Maand; 2025; 2026
   Jan; 12; 15
   Feb; 18; 21
   ```

3. Kies de **soort**: staven (verticaal of horizontaal, naast elkaar of
   gestapeld), een lijndiagram, een taart of een donut.
4. Stel de **maat** in millimeter in, de **lettergrootte** in punt, een
   **kleurpalet**, en eventueel een **titel** en een **eenheid** (zoals `%` of
   `mln`).
5. Kies of je **rasterlijnen**, **waarden** en een **legenda** wilt. De
   voorvertoning loopt mee terwijl je typt.
6. Klik **Grafiek maken**. De grafiek komt midden op het tekengebied.

## Wat je krijgt

Eén groep (bijvoorbeeld "Staafdiagram: Omzet") met daarin de groepen
**Rasterlijnen**, **Staven** of **Lijnen** (per reeks een eigen groep),
**Assen**, **Schaal**, **Categorieën**, **Waarden** en **Legenda**. Elke staaf
en elke taartpunt heet naar zijn label en waarde, zodat je in het lagenpaneel
meteen ziet wat wat is. Eén keer ongedaan maken haalt de hele grafiek weg.

In een CMYK-document zijn alle kleuren CMYK, anders RGB. De paletten zijn
gekozen om goed te drukken; heb je meer categorieën dan kleuren, dan volgen
lichtere tinten.

## Tips

- Getallen mogen op z'n Nederlands (`1.250,5`) of met een punt als
  decimaalteken (`1250.5`). Een procent- of euroteken wordt genegeerd.
- De schaal begint altijd bij 0 en loopt in nette stappen (1, 2, 2,5 of 5 maal
  een macht van tien). Negatieve waarden kunnen bij staven en lijnen.
- Een taart of donut gebruikt alleen de eerste reeks. Met **Waarden tonen**
  staan de percentages in de punten en het totaal in het midden van de donut.
- Regels die met `#` beginnen worden overgeslagen.
- Je laatste gegevens en instellingen worden onthouden.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de grafiek te tekenen.

Grafiek leest je selectie niet en bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
