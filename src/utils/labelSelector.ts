/** True when every key/value in `selector` is present in `labels`. Empty/missing selectors never match — an
 * empty selector would otherwise match every pod, which is never what callers want here. */
export function matchesSelector(labels: Record<string, string> | undefined, selector: Record<string, string> | undefined): boolean {
  if (!selector || Object.keys(selector).length === 0) return false;
  if (!labels) return false;
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}
