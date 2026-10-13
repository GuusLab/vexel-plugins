// Een kleine testplugin die een rechthoek tekent.
'use strict';

vexel.opCommando('teken', async () => {
  const doc = await vexel.document();
  const marge = vexel.mm(10);
  await vexel.maak([{ soort: 'rechthoek', x: marge, y: marge, b: doc.tekengebied.b / 2, h: 40, lijn: null }]);
  const stuk = '</script><img src=x>';
  vexel.melding(stuk, 'ok');
  vexel.sluit();
});
