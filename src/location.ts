// Shortens an SVRL XPath location for display (namespace prefixes removed, last three steps).
export function shortLocation(loc?: string): string | undefined {
  if (!loc) return undefined;
  if (loc.startsWith('line ')) return loc;
  const parts = loc.replace(/Q\{[^}]*\}/g, '').replace(/\*:/g, '').split('/').filter(Boolean);
  return parts.slice(-3).join(' › ').replace(/\[1\]/g, '');
}
