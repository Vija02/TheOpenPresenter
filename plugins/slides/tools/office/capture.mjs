// Captures a deck the way the viewer loads it: node capture.mjs <publicPptxUrl> <outDir> [format]
// Direct (browserless) capture: bootstrap -> GetPresentationWithSlideById -> GetSlide* -> images
import fs from 'node:fs'; import path from 'node:path';
const [,, SRC, OUT, FORMAT = '6'] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const dec = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const embed = await (await fetch(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(SRC)}`, { headers: { 'User-Agent': UA } })).text();
const m = /var _iframeUrl = '([^']*)'/.exec(embed); if (!m) throw new Error('no iframe');
const u = new URL(dec(m[1])); const host = u.host; const wopi = u.searchParams.get('WOPISrc');
const presentationId = `WOPIsrc=${encodeURIComponent(wopi)}&access_token=1&access_token_ttl=0`;
console.log('host', host);
const svc = async (method, body) => {
  for (let i = 0; i < +(process.env.TRIES ?? 40); i++) {
    const r = await fetch(`https://${host}/p/ppt/view.https.svc/jsonAnonymous/${method}`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json; charset=utf-8', 'X-Requested-With': 'XMLHttpRequest', Origin: `https://${host}` }, body: JSON.stringify({ presentationId, ...body }) });
    const j = await r.json();
    if (j.Result) return j.Result;
    console.log(method, 'err', j.Error?.Code, 'retry', i); await sleep(2000);
  }
  throw new Error(method + ' failed');
};
const pres = await svc('GetPresentationWithSlideById', { slideId: '0', slideIndex: 0, powerpointView: 6, format: +FORMAT });
fs.writeFileSync(path.join(OUT, 'presentation.json'), JSON.stringify(pres, null, 1));
console.log('slides', pres.sldLst.length, pres.w, pres.h);
const imgs = new Set();
for (const [i, s] of pres.sldLst.entries()) {
  const r = await svc('GetSlide', { slideInfoId: s.sldInfo, powerpointView: 6, format: +FORMAT });
  fs.writeFileSync(path.join(OUT, `slide${String(i + 1).padStart(2, '0')}.json`), JSON.stringify(r, null, 1));
  for (const sl of r.sld) for (const res of sl.resCat) {
    const id = res.id; if (imgs.has(id)) continue; imgs.add(id);
    const url = `https://${host}/p/${res.name.replace(/^\.\//, '')}`;
    const ir = await fetch(url, { headers: { 'User-Agent': UA } });
    const b = Buffer.from(await ir.arrayBuffer());
    fs.writeFileSync(path.join(OUT, `${id}.${ir.headers.get('content-type')?.split('/')[1] ?? 'bin'}`), b);
  }
  console.log('slide', i + 1, s.sldInfo, 'imgs so far', imgs.size);
}
