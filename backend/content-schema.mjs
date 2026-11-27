export const CONTENT_SCHEMA_VERSION = 11;

// Incorpora solo campos nuevos de la plantilla. Los valores ya editados siempre prevalecen.
export function fillMissingContent(template, current, path = [], added = []) {
  if (Array.isArray(template) && Array.isArray(current)) {
    return current.map((item, index) => fillMissingContent(template[index] ?? template[0], item, [...path, String(index)], added));
  }
  if (template !== null && current !== null && typeof template === 'object' && typeof current === 'object' && !Array.isArray(template) && !Array.isArray(current)) {
    const result = { ...current };
    for (const [key, value] of Object.entries(template)) {
      if (!Object.hasOwn(result, key)) {
        result[key] = structuredClone(value);
        added.push([...path, key].join('.'));
      } else {
        result[key] = fillMissingContent(value, result[key], [...path, key], added);
      }
    }
    return result;
  }
  return current;
}
