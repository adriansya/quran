// node render.js  ->  200-kata-kunci.pdf (dari 200-kata-kunci.html di folder ini)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '200-kata-kunci.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, '200-kata-kunci.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font:8px sans-serif;color:#8a90a0;width:100%;padding:0 13mm;display:flex;justify-content:space-between"><span>200 Kata Kunci Al-Qur\'an · adriansya.github.io/quran</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>' });
  await b.close();
})();
