type HasFieldsByName = {
  fieldsByName: Record<string, { id: string }>;
};

/**
 * Resolves field-name keys in a dashboard graph widget filter object
 * to their corresponding field metadata IDs.
 *
 * Twenty's graph widgets expect filter keys to be field metadata IDs (UUIDs),
 * not field names. This function rewrites the top-level keys of a filter
 * object from field names to metadata IDs, throwing if a field name doesn't
 * exist in the provided metadata.
 *
 * Non-object or falsy filter values are returned as-is (e.g. undefined for
 * blueprints without a filter). Unknown field names throw so the caller
 * doesn't silently ship a broken filter.
 */
export const resolveDashboardFilter = (
  objectMetadata: HasFieldsByName,
  filter: unknown,
): Record<string, unknown> | undefined | null => {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return filter as Record<string, unknown> | undefined | null;
  }

  const resolved: Record<string, unknown> = {};
  for (const [fieldName, condition] of Object.entries(
    filter as Record<string, unknown>,
  )) {
    const field = objectMetadata.fieldsByName[fieldName];
    if (!field) {
      throw new Error(
        `Dashboard filter references unknown field "${fieldName}". Available fields: ${Object.keys(objectMetadata.fieldsByName).join(', ')}`,
      );
    }
    resolved[field.id] = condition;
  }
  return resolved;
};
