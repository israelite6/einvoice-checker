// Google Search Console ownership file (URL-prefix property, owner's account). Served by a function because
// Cloudflare Pages redirects static *.html URLs to the extensionless path, and Google fetches this exact URL.
export const onRequestGet: PagesFunction = () =>
  new Response('google-site-verification: google61284f35f72d16eb.html', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
