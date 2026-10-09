import { dirname, join, normalize } from 'node:path';

// This is local path resolution only: it never fetches remote references.
export function resolveLocalAsset(pageFile, reference) {
  if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(reference)) return null;
  return normalize(join(dirname(pageFile), reference.split(/[?#]/, 1)[0]));
}
