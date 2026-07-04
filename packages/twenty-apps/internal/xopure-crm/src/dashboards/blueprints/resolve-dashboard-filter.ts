/**
 * Convert a blueprint filter (keyed by field name) into a filter
 * keyed by field metadata ID.  Preserves operators, nesting, and
 * unknown keys/values unchanged.
 *
 * Blueprint filters look like:
 *   { status: { in: ['PAID'] } }
 *   { and: [ { status: { eq: 'PAID' } } ] }
 *
 * After resolution, field-name keys are replaced with the
 * corresponding field metadata ID, operators and logical
 * connectors are kept as-is.
 */

type ObjectMetadataLike = {
  fieldsByName: Record<string, { id: string }>;
};

export const resolveDashboardFilter = (
  objectMetadata: ObjectMetadataLike,
  filter: unknown,
): unknown => {
  if (filter === null || filter === undefined) {
    return filter;
  }

  if (Array.isArray(filter)) {
    return filter.map((item) =>
      resolveDashboardFilter(objectMetadata, item),
    );
  }

  if (typeof filter !== 'object') {
    return filter;
  }

  const record = filter as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(record)) {
    const field = objectMetadata.fieldsByName[key];

    if (field) {
      // Known field — replace key with metadata ID, recurse value
      result[field.id] = resolveDashboardFilter(
        objectMetadata,
        record[key],
      );
    } else {
      // Logical operator (and/or) or unknown key — keep key, recurse value
      result[key] = resolveDashboardFilter(objectMetadata, record[key]);
    }
  }

  return result;
};
