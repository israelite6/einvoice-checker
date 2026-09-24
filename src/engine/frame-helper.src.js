// Source of frame-helper.txt (the minified copy is what gets inlined and hashed in the CSP).
// Runs inside the sandboxed invoice view. It replaces the official viewer's inline onclick
// handlers (blocked by our CSP) with listeners, WITHOUT evaluating the handler strings:
// tab buttons call the viewer's show(el); attachment links are parsed with a strict pattern
// and call downloadData(id, mime, filename). Anything unexpected is simply left inert.
(function () {
  function h() { parent.postMessage({ type: 'xr-height', h: document.documentElement.scrollHeight }, '*'); }
  var dl = /^downloadData\('([^'\\<>"]+)', '([A-Za-z0-9.+/-]*)', '([^'\\<>"]*)'\);?$/;
  document.querySelectorAll('[onclick]').forEach(function (el) {
    var c = (el.getAttribute('onclick') || '').trim();
    el.removeAttribute('onclick');
    if (/^show\(this\);?$/.test(c)) {
      el.addEventListener('click', function () { show(el); h(); });
    } else {
      var m = dl.exec(c);
      // Unrecognised handlers stay inert, and their links must not navigate the sandboxed view.
      el.addEventListener('click', function (ev) { ev.preventDefault(); if (m) downloadData(m[1], m[2], m[3]); });
    }
  });
  addEventListener('load', h);
  addEventListener('resize', h);
  new MutationObserver(h).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  addEventListener('message', function (e) { if (e.source === parent && e.data === 'xr-print') print(); });
  document.documentElement.setAttribute('data-helper', 'ready');
  h();
})();
