// Walk a booted Express app's router stack and return every mounted endpoint.
//
// More accurate than statically parsing index.js: it reflects what's actually
// mounted (including nested router.use sub-routers) and naturally excludes the
// unmounted "dead" route files. Express 4 (app._router.stack) is assumed.

// Decode the literal mount prefix of an app.use/router.use layer from its
// compiled regexp + keys (e.g. /^\/api\/content\/?(?=\/|$)/i → "/api/content",
// and a :param mount → "/api/workspaces/:workspaceId").
function decodeMountPath(layer) {
  if (!layer.regexp) return '';
  if (layer.regexp.fast_slash) return ''; // mounted at '/', matches everything
  let src = layer.regexp.source;
  src = src
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '') // trailing  \/?(?=\/|$)
    .replace(/\(\?=\\\/\|\$\)$/, '')
    .replace(/\$$/, '');
  // Substitute each param capture group with :name from keys, in order.
  let i = 0;
  src = src.replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, () => {
    const key = layer.keys && layer.keys[i++];
    return key ? `:${key.name}` : ':param';
  });
  src = src.replace(/\\\//g, '/').replace(/\\\./g, '.');
  return src;
}

function methodsOf(route) {
  return Object.keys(route.methods || {})
    .filter((m) => m !== '_all')
    .map((m) => m.toUpperCase());
}

/**
 * @param {import('express').Express} app  a booted express app (module.exports)
 * @returns {Array<{method:string, path:string, paramNames:string[]}>}
 */
function walkRoutes(app) {
  const router = app._router || (app.router);
  if (!router || !Array.isArray(router.stack)) return [];

  const out = [];
  const seen = new Set();

  function visit(stack, prefix) {
    for (const layer of stack) {
      if (layer.route) {
        // Terminal route.
        const routePath = layer.route.path;
        const paths = Array.isArray(routePath) ? routePath : [routePath];
        for (const p of paths) {
          const full = `${prefix}${p}`.replace(/\/{2,}/g, '/') || '/';
          for (const method of methodsOf(layer.route)) {
            const key = `${method} ${full}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const paramNames = (full.match(/:[A-Za-z0-9_]+/g) || []).map((s) => s.slice(1));
            out.push({ method, path: full, paramNames });
          }
        }
      } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
        // Mounted sub-router — recurse with the accumulated prefix.
        const mount = decodeMountPath(layer);
        visit(layer.handle.stack, `${prefix}${mount}`);
      }
    }
  }

  visit(router.stack, '');
  return out;
}

module.exports = { walkRoutes, decodeMountPath };
