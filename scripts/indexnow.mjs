// Notifies IndexNow search engines (Bing, Yandex, Seznam, Naver, …) about updated URLs. No account needed:
// ownership is proven by the key file served at https://<host>/<key>.txt. Run after a production deploy.
const host = 'e-rechnung-pruefen.pages.dev';
const key = 'bb87ece3b046ba3435a364485dd4fc0b';
const urlList = [`https://${host}/`];
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
});
console.log('IndexNow:', res.status, res.statusText);
