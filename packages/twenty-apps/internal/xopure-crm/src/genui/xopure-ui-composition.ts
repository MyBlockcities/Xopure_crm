export const XOPURE_GENUI_SCHEMA_VERSION = 1;
export const XOPURE_GENUI_CATALOG_VERSION = '1.0.0';
export const XOPURE_GENUI_PREVIOUS_CATALOG_VERSION = '2026-07-26.1';

export const XOPURE_GENUI_LIMITS = {
  maxBlocks: 40,
  maxTableColumns: 12,
  maxTableRows: 100,
  maxChartPoints: 100,
  maxTimelineEntries: 100,
  maxDocumentBytes: 64 * 1024,
  maxTitleLength: 120,
} as const;

const {
  maxBlocks: MAX_BLOCKS,
  maxTableColumns: MAX_TABLE_COLUMNS,
  maxTableRows: MAX_TABLE_ROWS,
  maxChartPoints: MAX_CHART_POINTS,
  maxTimelineEntries: MAX_TIMELINE_ENTRIES,
  maxDocumentBytes: MAX_DOCUMENT_BYTES,
  maxTitleLength: MAX_TITLE_LENGTH,
} = XOPURE_GENUI_LIMITS;

const BLOCK_TYPES = [
  'kpi',
  'chart',
  'table',
  'timeline',
  'alert',
  'markdown',
  'action',
  'record-link',
] as const;
const ACTION_IDS = ['open-composition', 'open-record', 'navigate-internal'] as const;
const ALERT_SEVERITIES = ['info', 'success', 'warning', 'error'] as const;

export type XopureGenUiBlockType = (typeof BLOCK_TYPES)[number];
export type XopureGenUiActionId = (typeof ACTION_IDS)[number];
export type XopureGenUiAlertSeverity = (typeof ALERT_SEVERITIES)[number];

export type XopureGenUiCapability =
  | 'open-record-panel'
  | 'open-composition-panel'
  | 'navigate-internal';

export const XOPURE_GENUI_RECORD_TARGET_OBJECTS = [
  'xopureAmbassador',
  'xopureCommission',
  'xopureCustomer',
  'xopureOrder',
  'xopurePayment',
] as const;

export type XopureUiBlockBase<Type extends XopureGenUiBlockType> = {
  id: string;
  type: Type;
  version: 1;
  title?: string;
};

export type XopureUiKpiBlock = XopureUiBlockBase<'kpi'> & {
  label: string;
  value: string | number;
  detail?: string;
};

export type XopureUiChartPoint = {
  label: string;
  value: number;
};

export type XopureUiChartBlock = XopureUiBlockBase<'chart'> & {
  chartType: 'bar' | 'line';
  points: XopureUiChartPoint[];
};

export type XopureUiTableColumn = {
  key: string;
  label: string;
};

export type XopureUiTableCell = string | number | boolean | null;

export type XopureUiTableBlock = XopureUiBlockBase<'table'> & {
  columns: XopureUiTableColumn[];
  rows: Record<string, XopureUiTableCell>[];
};

export type XopureUiTimelineEntry = {
  timestamp: string;
  title: string;
  detail?: string;
};

export type XopureUiTimelineBlock = XopureUiBlockBase<'timeline'> & {
  entries: XopureUiTimelineEntry[];
};

export type XopureUiAlertBlock = XopureUiBlockBase<'alert'> & {
  severity: XopureGenUiAlertSeverity;
  message: string;
};

export type XopureUiMarkdownBlock = XopureUiBlockBase<'markdown'> & {
  text: string;
};

export type XopureUiOpenCompositionAction = {
  id: 'open-composition';
  compositionId: string;
};

export type XopureUiOpenRecordAction = {
  id: 'open-record';
  recordId: string;
  objectNameSingular: string;
};

export type XopureUiNavigateInternalAction = {
  id: 'navigate-internal';
  path: string;
};

export type XopureUiAction =
  | XopureUiOpenCompositionAction
  | XopureUiOpenRecordAction
  | XopureUiNavigateInternalAction;

export type XopureUiActionBlock = XopureUiBlockBase<'action'> & {
  label: string;
  action: XopureUiAction;
};

export type XopureUiRecordLinkBlock = XopureUiBlockBase<'record-link'> & {
  label: string;
  recordId: string;
  objectNameSingular: string;
};

export type XopureUiBlock =
  | XopureUiKpiBlock
  | XopureUiChartBlock
  | XopureUiTableBlock
  | XopureUiTimelineBlock
  | XopureUiAlertBlock
  | XopureUiMarkdownBlock
  | XopureUiActionBlock
  | XopureUiRecordLinkBlock;

export type XopureUiCompositionBlock = XopureUiBlock;

export type XopureUiComposition = {
  schemaVersion: typeof XOPURE_GENUI_SCHEMA_VERSION;
  catalogVersion: typeof XOPURE_GENUI_CATALOG_VERSION;
  title: string;
  layout: {
    columns: 1 | 2 | 3;
    gap: 'compact' | 'normal' | 'relaxed';
  };
  blocks: XopureUiBlock[];
  provenance: {
    createdBy: string;
    createdAt: string;
  };
};

export type XopureGenUiJsonSchema = {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'integer' | 'null';
  description?: string;
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, XopureGenUiJsonSchema>;
  required?: string[];
  additionalProperties?: boolean | XopureGenUiJsonSchema;
  items?: XopureGenUiJsonSchema;
  oneOf?: XopureGenUiJsonSchema[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  maxProperties?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
};

type XopureGenUiTemplateCatalogEntry = {
  readonly actionIds: readonly XopureGenUiActionId[];
  readonly capabilities: readonly XopureGenUiCapability[];
  readonly inputSchema: XopureGenUiJsonSchema;
};

export type XopureGenUiTemplateCatalog = {
  schemaVersion: typeof XOPURE_GENUI_SCHEMA_VERSION;
  catalogVersion: typeof XOPURE_GENUI_CATALOG_VERSION;
  dataSource: 'inline-only';
  designTokens: {
    readonly columns: readonly [1, 2, 3];
    readonly gapPixels: { readonly compact: 8; readonly normal: 16; readonly relaxed: 24 };
    readonly colorRoles: readonly ['surface', 'border', 'text', 'muted', 'accent'];
  };
  limits: typeof XOPURE_GENUI_LIMITS;
  migrations: readonly [{
    readonly fromCatalogVersion: typeof XOPURE_GENUI_PREVIOUS_CATALOG_VERSION;
    readonly toCatalogVersion: typeof XOPURE_GENUI_CATALOG_VERSION;
    readonly strategy: 'catalog-version-only';
  }];
  blockTypes: {
    readonly [Type in XopureGenUiBlockType]: XopureGenUiTemplateCatalogEntry;
  };
};

const closedObjectSchema = (
  properties: Record<string, XopureGenUiJsonSchema>,
  required: string[],
): XopureGenUiJsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const safeTextSchema = (maxLength = 4096): XopureGenUiJsonSchema => ({
  type: 'string',
  minLength: 1,
  maxLength,
});

const idSchema: XopureGenUiJsonSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
};
const uuidSchema: XopureGenUiJsonSchema = {
  type: 'string',
  pattern:
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
};
const blockVersionSchema: XopureGenUiJsonSchema = {
  type: 'integer',
  const: 1,
  minimum: 1,
  maximum: 1,
};
const recordTargetSchema: XopureGenUiJsonSchema = {
  type: 'string',
  enum: [...XOPURE_GENUI_RECORD_TARGET_OBJECTS],
};
const scalarSchema: XopureGenUiJsonSchema = {
  oneOf: [
    { type: 'string', maxLength: 4096 },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'null' },
  ],
};

const blockSchema = (
  type: XopureGenUiBlockType,
  properties: Record<string, XopureGenUiJsonSchema>,
  required: string[],
): XopureGenUiJsonSchema =>
  closedObjectSchema(
    {
      id: idSchema,
      type: { type: 'string', enum: [type] },
      version: blockVersionSchema,
      title: safeTextSchema(MAX_TITLE_LENGTH),
      ...properties,
    },
    ['id', 'type', 'version', ...required],
  );

const kpiInputSchema = blockSchema(
  'kpi',
  {
    label: safeTextSchema(MAX_TITLE_LENGTH),
    value: { oneOf: [safeTextSchema(4096), { type: 'number' }] },
    detail: safeTextSchema(4096),
  },
  ['label', 'value'],
);
const chartInputSchema = blockSchema(
  'chart',
  {
    chartType: { type: 'string', enum: ['bar', 'line'] },
    points: {
      type: 'array',
      maxItems: MAX_CHART_POINTS,
      items: closedObjectSchema(
        {
          label: safeTextSchema(MAX_TITLE_LENGTH),
          value: { type: 'number' },
        },
        ['label', 'value'],
      ),
    },
  },
  ['chartType', 'points'],
);
const tableInputSchema = blockSchema(
  'table',
  {
    columns: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_TABLE_COLUMNS,
      items: closedObjectSchema(
        {
          key: idSchema,
          label: safeTextSchema(MAX_TITLE_LENGTH),
        },
        ['key', 'label'],
      ),
    },
    rows: {
      type: 'array',
      maxItems: MAX_TABLE_ROWS,
      items: {
        type: 'object',
        maxProperties: MAX_TABLE_COLUMNS,
        additionalProperties: scalarSchema,
      },
    },
  },
  ['columns', 'rows'],
);
const timelineInputSchema = blockSchema(
  'timeline',
  {
    entries: {
      type: 'array',
      maxItems: MAX_TIMELINE_ENTRIES,
      items: closedObjectSchema(
        {
          timestamp: { type: 'string', maxLength: 64 },
          title: safeTextSchema(MAX_TITLE_LENGTH),
          detail: safeTextSchema(4096),
        },
        ['timestamp', 'title'],
      ),
    },
  },
  ['entries'],
);
const alertInputSchema = blockSchema(
  'alert',
  {
    severity: { type: 'string', enum: [...ALERT_SEVERITIES] },
    message: safeTextSchema(4096),
  },
  ['severity', 'message'],
);
const markdownInputSchema = blockSchema(
  'markdown',
  { text: safeTextSchema(16_384) },
  ['text'],
);
const actionInputSchema = blockSchema(
  'action',
  {
    label: safeTextSchema(MAX_TITLE_LENGTH),
    action: {
      oneOf: [
        closedObjectSchema(
          {
            id: { type: 'string', enum: ['open-record'] },
            recordId: uuidSchema,
            objectNameSingular: recordTargetSchema,
          },
          ['id', 'recordId', 'objectNameSingular'],
        ),
        closedObjectSchema(
          {
            id: { type: 'string', enum: ['navigate-internal'] },
            path: { type: 'string', minLength: 1, maxLength: 256 },
          },
          ['id', 'path'],
        ),
      ],
    },
  },
  ['label', 'action'],
);
const recordLinkInputSchema = blockSchema(
  'record-link',
  {
    label: safeTextSchema(MAX_TITLE_LENGTH),
    recordId: uuidSchema,
    objectNameSingular: recordTargetSchema,
  },
  ['label', 'recordId', 'objectNameSingular'],
);

export const XOPURE_GENUI_TOOL_COMPOSITION_INPUT_SCHEMA: XopureGenUiJsonSchema =
  closedObjectSchema(
    {
      schemaVersion: {
        type: 'integer',
        const: XOPURE_GENUI_SCHEMA_VERSION,
        minimum: XOPURE_GENUI_SCHEMA_VERSION,
        maximum: XOPURE_GENUI_SCHEMA_VERSION,
      },
      catalogVersion: {
        type: 'string',
        enum: [
          XOPURE_GENUI_CATALOG_VERSION,
          XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
        ],
      },
      title: safeTextSchema(MAX_TITLE_LENGTH),
      layout: closedObjectSchema(
        {
          columns: { type: 'integer', minimum: 1, maximum: 3 },
          gap: { type: 'string', enum: ['compact', 'normal', 'relaxed'] },
        },
        ['columns', 'gap'],
      ),
      blocks: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_BLOCKS,
        items: {
          oneOf: [
            kpiInputSchema,
            chartInputSchema,
            tableInputSchema,
            timelineInputSchema,
            alertInputSchema,
            markdownInputSchema,
            actionInputSchema,
            recordLinkInputSchema,
          ],
        },
      },
    },
    ['schemaVersion', 'catalogVersion', 'title', 'layout', 'blocks'],
  );

export const XOPURE_GENUI_TEMPLATE_CATALOG = {
  schemaVersion: XOPURE_GENUI_SCHEMA_VERSION,
  catalogVersion: XOPURE_GENUI_CATALOG_VERSION,
  dataSource: 'inline-only',
  designTokens: {
    columns: [1, 2, 3],
    gapPixels: { compact: 8, normal: 16, relaxed: 24 },
    colorRoles: ['surface', 'border', 'text', 'muted', 'accent'],
  },
  limits: XOPURE_GENUI_LIMITS,
  migrations: [{
    fromCatalogVersion: XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
    toCatalogVersion: XOPURE_GENUI_CATALOG_VERSION,
    strategy: 'catalog-version-only',
  }],
  blockTypes: {
    kpi: { actionIds: [], capabilities: [], inputSchema: kpiInputSchema },
    chart: { actionIds: [], capabilities: [], inputSchema: chartInputSchema },
    table: { actionIds: [], capabilities: [], inputSchema: tableInputSchema },
    timeline: { actionIds: [], capabilities: [], inputSchema: timelineInputSchema },
    alert: { actionIds: [], capabilities: [], inputSchema: alertInputSchema },
    markdown: { actionIds: [], capabilities: [], inputSchema: markdownInputSchema },
    action: {
      actionIds: ['open-record', 'navigate-internal'],
      capabilities: ['open-record-panel', 'navigate-internal'],
      inputSchema: actionInputSchema,
    },
    'record-link': {
      actionIds: ['open-record'],
      capabilities: ['open-record-panel'],
      inputSchema: recordLinkInputSchema,
    },
  },
} as const satisfies XopureGenUiTemplateCatalog;

export type XopureUiCompositionValidationResult =
  | { ok: true; value: XopureUiComposition }
  | { ok: false; errors: string[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const isOneOf = <Value extends string>(value: unknown, values: readonly Value[]): value is Value =>
  typeof value === 'string' && values.includes(value as Value);

const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isIsoLikeTimestamp = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

const OBJECT_NAME_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/;

const isSafeInternalPath = (value: string): boolean => {
  const segments = value.split('/');

  if (value === '/') return true;
  if (segments.length === 3 && segments[1] === 'objects') {
    return OBJECT_NAME_PATTERN.test(segments[2]);
  }
  if (segments.length === 4 && segments[1] === 'object') {
    return OBJECT_NAME_PATTERN.test(segments[2]) && isUuidLike(segments[3]);
  }

  return segments.length === 3 && segments[1] === 'page' && isUuidLike(segments[2]);
};

const utf8ByteLength = (value: string): number => {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }

  return bytes;
};

const readObject = (
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  errors: string[],
): Record<string, unknown> | undefined => {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be a plain object`);
    return undefined;
  }

  for (const key of Object.keys(value).sort()) {
    if (!allowedKeys.includes(key)) errors.push(`${path}.${key} is not allowed`);
  }
  for (const key of requiredKeys) {
    if (!hasOwn(value, key)) errors.push(`${path}.${key} is required`);
  }

  return value;
};

const readString = (
  value: unknown,
  path: string,
  errors: string[],
  options: { nonEmpty?: boolean; maxLength?: number } = {},
): string | undefined => {
  if (typeof value !== 'string') {
    errors.push(`${path} must be a plain string`);
    return undefined;
  }
  if (options.nonEmpty && value.length === 0) errors.push(`${path} must not be empty`);
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    errors.push(`${path} must be at most ${options.maxLength} characters`);
  }
  return value;
};

const FORBIDDEN_TEXT_PATTERNS: readonly RegExp[] = [
  /<\/?[a-z!][^>]*>/i,
  /(?:javascript|data|vbscript):/i,
  /(?:https?:)?\/\/|www\./i,
  /(?:^|[\s;}])(?:function\s+\w*\s*\(|(?:const|let|var)\s+\w+\s*=|eval\s*\(|new\s+Function\s*\(|fetch\s*\(|import\s*\(|window\.|document\.|localStorage|sessionStorage|=>)/i,
  /(?:@import|url\s*\(|(?:^|[\s}])[.#]?[a-z_][\w-]*\s*\{[^}]*:[^}]*\})/i,
  /<>\s*|<\/>|<[A-Z][A-Za-z0-9]*(?:\s|\/?>)/,
];

export const isSafeXopureGenUiText = (value: string): boolean =>
  !FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(value));

const readSafeText = (
  value: unknown,
  path: string,
  errors: string[],
  options: { nonEmpty?: boolean; maxLength?: number } = {},
): string | undefined => {
  const text = readString(value, path, errors, {
    nonEmpty: options.nonEmpty ?? true,
    maxLength: options.maxLength ?? 4096,
  });
  if (text !== undefined && !isSafeXopureGenUiText(text)) {
    errors.push(`${path} contains executable markup, styling, or a URL`);
    return undefined;
  }
  return text;
};

const readFiniteNumber = (value: unknown, path: string, errors: string[]): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number`);
    return undefined;
  }
  return value;
};

const readBlockBase = (
  value: unknown,
  path: string,
  type: XopureGenUiBlockType,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  blockIds: Set<string>,
  errors: string[],
): { record: Record<string, unknown>; id: string; title?: string } | undefined => {
  const record = readObject(value, path, allowedKeys, requiredKeys, errors);
  if (!record) return undefined;

  const id = readString(record.id, `${path}.id`, errors, { nonEmpty: true, maxLength: 128 });
  if (id !== undefined) {
    if (blockIds.has(id)) errors.push(`${path}.id must be unique`);
    else blockIds.add(id);
  }
  if (record.type !== type) errors.push(`${path}.type must be ${type}`);
  if (record.version !== 1) errors.push(`${path}.version must be 1`);

  const title = hasOwn(record, 'title')
    ? readSafeText(record.title, `${path}.title`, errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH })
    : undefined;
  return id === undefined ? undefined : { record, id, ...(title === undefined ? {} : { title }) };
};

const withTitle = <Block extends XopureUiBlock>(block: Block, title: string | undefined): Block =>
  title === undefined ? block : { ...block, title };

const readChartPoints = (value: unknown, path: string, errors: string[]): XopureUiChartPoint[] => {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (value.length > MAX_CHART_POINTS) errors.push(`${path} exceeds maximum of ${MAX_CHART_POINTS} points`);

  const points: XopureUiChartPoint[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const pointPath = `${path}[${index}]`;
    const point = readObject(value[index], pointPath, ['label', 'value'], ['label', 'value'], errors);
    if (!point) continue;
    const label = readSafeText(point.label, `${pointPath}.label`, errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH });
    const chartValue = readFiniteNumber(point.value, `${pointPath}.value`, errors);
    if (label !== undefined && chartValue !== undefined) points.push({ label, value: chartValue });
  }
  return points;
};

const readTableColumns = (value: unknown, path: string, errors: string[]): XopureUiTableColumn[] => {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (value.length === 0) errors.push(`${path} must contain at least one column`);
  if (value.length > MAX_TABLE_COLUMNS) errors.push(`${path} exceeds maximum of ${MAX_TABLE_COLUMNS} columns`);

  const keys = new Set<string>();
  const columns: XopureUiTableColumn[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const columnPath = `${path}[${index}]`;
    const column = readObject(value[index], columnPath, ['key', 'label'], ['key', 'label'], errors);
    if (!column) continue;
    const key = readString(column.key, `${columnPath}.key`, errors, { nonEmpty: true, maxLength: 128 });
    const label = readSafeText(column.label, `${columnPath}.label`, errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH });
    if (key !== undefined) {
      if (keys.has(key)) errors.push(`${columnPath}.key must be unique`);
      else keys.add(key);
    }
    if (key !== undefined && label !== undefined) columns.push({ key, label });
  }
  return columns;
};

const readTableRows = (
  value: unknown,
  path: string,
  columnKeys: Set<string>,
  errors: string[],
): Record<string, XopureUiTableCell>[] => {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (value.length > MAX_TABLE_ROWS) errors.push(`${path} exceeds maximum of ${MAX_TABLE_ROWS} rows`);

  const rows: Record<string, XopureUiTableCell>[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const rowPath = `${path}[${index}]`;
    if (!isPlainObject(value[index])) {
      errors.push(`${rowPath} must be a plain object`);
      continue;
    }

    const row = value[index];
    const canonicalRow: Record<string, XopureUiTableCell> = {};
    for (const key of Object.keys(row).sort()) {
      if (!columnKeys.has(key)) {
        errors.push(`${rowPath}.${key} is not a declared column`);
        continue;
      }
      const cell = row[key];
      if (cell !== null && typeof cell !== 'string' && typeof cell !== 'boolean' && (typeof cell !== 'number' || !Number.isFinite(cell))) {
        errors.push(`${rowPath}.${key} must be a scalar value`);
        continue;
      }
      if (
        typeof cell === 'string' &&
        readSafeText(cell, `${rowPath}.${key}`, errors, { nonEmpty: false }) ===
          undefined
      ) {
        continue;
      }
      canonicalRow[key] = cell;
    }
    rows.push(canonicalRow);
  }
  return rows;
};

const readTimelineEntries = (value: unknown, path: string, errors: string[]): XopureUiTimelineEntry[] => {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (value.length > MAX_TIMELINE_ENTRIES) errors.push(`${path} exceeds maximum of ${MAX_TIMELINE_ENTRIES} entries`);

  const entries: XopureUiTimelineEntry[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entryPath = `${path}[${index}]`;
    const entry = readObject(value[index], entryPath, ['timestamp', 'title', 'detail'], ['timestamp', 'title'], errors);
    if (!entry) continue;
    const timestamp = readString(entry.timestamp, `${entryPath}.timestamp`, errors, { nonEmpty: true, maxLength: 64 });
    const title = readSafeText(entry.title, `${entryPath}.title`, errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH });
    const detail = hasOwn(entry, 'detail') ? readSafeText(entry.detail, `${entryPath}.detail`, errors) : undefined;
    if (timestamp !== undefined && !isIsoLikeTimestamp(timestamp)) errors.push(`${entryPath}.timestamp must be ISO-like`);
    if (timestamp !== undefined && isIsoLikeTimestamp(timestamp) && title !== undefined) {
      entries.push({ timestamp, title, ...(detail === undefined ? {} : { detail }) });
    }
  }
  return entries;
};

const ACTION_CAPABILITIES: {
  readonly [Action in XopureGenUiActionId]: XopureGenUiCapability;
} = {
  'open-composition': 'open-composition-panel',
  'open-record': 'open-record-panel',
  'navigate-internal': 'navigate-internal',
};

const readAction = (value: unknown, path: string, errors: string[]): XopureUiAction | undefined => {
  const action = readObject(value, path, ['id', 'compositionId', 'recordId', 'objectNameSingular', 'path'], ['id'], errors);
  if (
    !action ||
    !isOneOf(
      action.id,
      XOPURE_GENUI_TEMPLATE_CATALOG.blockTypes.action.actionIds,
    )
  ) {
    errors.push(`${path}.id is not allowlisted`);
    return undefined;
  }
  if (
    !XOPURE_GENUI_TEMPLATE_CATALOG.blockTypes.action.capabilities.includes(
      ACTION_CAPABILITIES[action.id],
    )
  ) {
    errors.push(`${path}.id requires an undeclared capability`);
    return undefined;
  }

  switch (action.id) {
    case 'open-composition': {
      for (const key of ['recordId', 'objectNameSingular', 'path']) if (hasOwn(action, key)) errors.push(`${path}.${key} is not valid for open-composition`);
      const compositionId = readString(action.compositionId, `${path}.compositionId`, errors, { nonEmpty: true, maxLength: 36 });
      if (compositionId === undefined || !isUuidLike(compositionId)) {
        if (compositionId !== undefined) errors.push(`${path}.compositionId must be UUID-like`);
        return undefined;
      }
      return { id: action.id, compositionId };
    }
    case 'open-record': {
      for (const key of ['compositionId', 'path']) if (hasOwn(action, key)) errors.push(`${path}.${key} is not valid for open-record`);
      const recordId = readString(action.recordId, `${path}.recordId`, errors, { nonEmpty: true, maxLength: 36 });
      const objectNameSingular = readString(action.objectNameSingular, `${path}.objectNameSingular`, errors, { nonEmpty: true, maxLength: 64 });
      if (recordId === undefined || !isUuidLike(recordId)) {
        if (recordId !== undefined) errors.push(`${path}.recordId must be UUID-like`);
        return undefined;
      }
      if (objectNameSingular === undefined) return undefined;
      if (!isOneOf(objectNameSingular, XOPURE_GENUI_RECORD_TARGET_OBJECTS)) {
        errors.push(`${path}.objectNameSingular is not an allowlisted record target`);
        return undefined;
      }
      return { id: action.id, recordId, objectNameSingular };
    }
    case 'navigate-internal': {
      for (const key of ['compositionId', 'recordId', 'objectNameSingular']) if (hasOwn(action, key)) errors.push(`${path}.${key} is not valid for navigate-internal`);
      const pathValue = readString(action.path, `${path}.path`, errors, { nonEmpty: true, maxLength: 256 });
      if (pathValue === undefined || !isSafeInternalPath(pathValue)) {
        if (pathValue !== undefined) errors.push(`${path}.path must be a safe internal path`);
        return undefined;
      }
      return { id: action.id, path: pathValue };
    }
  }
};

const readBlock = (
  value: unknown,
  path: string,
  blockIds: Set<string>,
  errors: string[],
): XopureUiBlock | undefined => {
  if (!isPlainObject(value) || !isOneOf(value.type, BLOCK_TYPES)) {
    errors.push(`${path}.type is not supported`);
    return undefined;
  }

  switch (value.type) {
    case 'kpi': {
      const base = readBlockBase(value, path, 'kpi', ['id', 'type', 'version', 'title', 'label', 'value', 'detail'], ['id', 'type', 'version', 'label', 'value'], blockIds, errors);
      if (!base) return undefined;
      const label = readSafeText(base.record.label, `${path}.label`, errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH });
      const valueString = typeof base.record.value === 'string'
        ? readSafeText(base.record.value, `${path}.value`, errors)
        : undefined;
      const valueNumber = typeof base.record.value === 'number' ? readFiniteNumber(base.record.value, `${path}.value`, errors) : undefined;
      if (valueString === undefined && valueNumber === undefined) errors.push(`${path}.value must be a safe plain string or finite number`);
      const detail = hasOwn(base.record, 'detail') ? readSafeText(base.record.detail, `${path}.detail`, errors) : undefined;
      if (label === undefined || (valueString === undefined && valueNumber === undefined)) return undefined;
      return withTitle({ id: base.id, type: 'kpi', version: 1, label, value: valueString ?? valueNumber!, ...(detail === undefined ? {} : { detail }) }, base.title);
    }
    case 'chart': {
      const base = readBlockBase(value, path, 'chart', ['id', 'type', 'version', 'title', 'chartType', 'points'], ['id', 'type', 'version', 'chartType', 'points'], blockIds, errors);
      if (!base) return undefined;
      const chartType = isOneOf(base.record.chartType, ['bar', 'line'] as const) ? base.record.chartType : undefined;
      if (chartType === undefined) errors.push(`${path}.chartType must be bar or line`);
      const points = readChartPoints(base.record.points, `${path}.points`, errors);
      return chartType === undefined ? undefined : withTitle({ id: base.id, type: 'chart', version: 1, chartType, points }, base.title);
    }
    case 'table': {
      const base = readBlockBase(value, path, 'table', ['id', 'type', 'version', 'title', 'columns', 'rows'], ['id', 'type', 'version', 'columns', 'rows'], blockIds, errors);
      if (!base) return undefined;
      const columns = readTableColumns(base.record.columns, `${path}.columns`, errors);
      const rows = readTableRows(base.record.rows, `${path}.rows`, new Set(columns.map(({ key }) => key)), errors);
      return withTitle({ id: base.id, type: 'table', version: 1, columns, rows }, base.title);
    }
    case 'timeline': {
      const base = readBlockBase(value, path, 'timeline', ['id', 'type', 'version', 'title', 'entries'], ['id', 'type', 'version', 'entries'], blockIds, errors);
      if (!base) return undefined;
      return withTitle({ id: base.id, type: 'timeline', version: 1, entries: readTimelineEntries(base.record.entries, `${path}.entries`, errors) }, base.title);
    }
    case 'alert': {
      const base = readBlockBase(value, path, 'alert', ['id', 'type', 'version', 'title', 'severity', 'message'], ['id', 'type', 'version', 'severity', 'message'], blockIds, errors);
      if (!base) return undefined;
      const severity = isOneOf(base.record.severity, ALERT_SEVERITIES) ? base.record.severity : undefined;
      if (severity === undefined) errors.push(`${path}.severity is not supported`);
      const message = readSafeText(base.record.message, `${path}.message`, errors);
      return severity === undefined || message === undefined ? undefined : withTitle({ id: base.id, type: 'alert', version: 1, severity, message }, base.title);
    }
    case 'markdown': {
      const base = readBlockBase(value, path, 'markdown', ['id', 'type', 'version', 'title', 'text'], ['id', 'type', 'version', 'text'], blockIds, errors);
      if (!base) return undefined;
      const text = readSafeText(base.record.text, `${path}.text`, errors, { maxLength: 16_384 });
      return text === undefined ? undefined : withTitle({ id: base.id, type: 'markdown', version: 1, text }, base.title);
    }
    case 'action': {
      const base = readBlockBase(value, path, 'action', ['id', 'type', 'version', 'title', 'label', 'action'], ['id', 'type', 'version', 'label', 'action'], blockIds, errors);
      if (!base) return undefined;
      const label = readSafeText(base.record.label, `${path}.label`, errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH });
      const action = readAction(base.record.action, `${path}.action`, errors);
      return label === undefined || action === undefined ? undefined : withTitle({ id: base.id, type: 'action', version: 1, label, action }, base.title);
    }
    case 'record-link': {
      const base = readBlockBase(value, path, 'record-link', ['id', 'type', 'version', 'title', 'label', 'recordId', 'objectNameSingular'], ['id', 'type', 'version', 'label', 'recordId', 'objectNameSingular'], blockIds, errors);
      if (!base) return undefined;
      const label = readSafeText(base.record.label, `${path}.label`, errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH });
      const recordId = readString(base.record.recordId, `${path}.recordId`, errors, { nonEmpty: true, maxLength: 36 });
      const objectNameSingular = readString(base.record.objectNameSingular, `${path}.objectNameSingular`, errors, { nonEmpty: true, maxLength: 64 });
      if (recordId !== undefined && !isUuidLike(recordId)) errors.push(`${path}.recordId must be UUID-like`);
      if (
        objectNameSingular !== undefined &&
        !isOneOf(objectNameSingular, XOPURE_GENUI_RECORD_TARGET_OBJECTS)
      ) {
        errors.push(`${path}.objectNameSingular is not an allowlisted record target`);
      }
      return label === undefined ||
        recordId === undefined ||
        !isUuidLike(recordId) ||
        objectNameSingular === undefined ||
        !isOneOf(objectNameSingular, XOPURE_GENUI_RECORD_TARGET_OBJECTS)
        ? undefined
        : withTitle({ id: base.id, type: 'record-link', version: 1, label, recordId, objectNameSingular }, base.title);
    }
  }
};

export const validateXopureUiComposition = (input: unknown): XopureUiCompositionValidationResult => {
  const errors: string[] = [];
  const root = readObject(
    input,
    '$',
    ['schemaVersion', 'catalogVersion', 'title', 'layout', 'blocks', 'provenance'],
    ['schemaVersion', 'catalogVersion', 'title', 'layout', 'blocks', 'provenance'],
    errors,
  );
  if (!root) return { ok: false, errors };

  try {
    const serialized = JSON.stringify(input);
    if (serialized === undefined) errors.push('$ must be JSON-serializable');
    else if (utf8ByteLength(serialized) > MAX_DOCUMENT_BYTES) errors.push(`$ exceeds maximum document size of ${MAX_DOCUMENT_BYTES} bytes`);
  } catch {
    errors.push('$ must be JSON-serializable');
  }

  if (root.schemaVersion !== XOPURE_GENUI_SCHEMA_VERSION) errors.push('$.schemaVersion is not supported');
  if (root.catalogVersion !== XOPURE_GENUI_CATALOG_VERSION) errors.push('$.catalogVersion is not supported');
  const title = readSafeText(root.title, '$.title', errors, { nonEmpty: true, maxLength: MAX_TITLE_LENGTH });

  const layout = readObject(root.layout, '$.layout', ['columns', 'gap'], ['columns', 'gap'], errors);
  const columns = layout?.columns;
  const gap = layout?.gap;
  if (columns !== 1 && columns !== 2 && columns !== 3) errors.push('$.layout.columns must be 1, 2, or 3');
  if (!isOneOf(gap, ['compact', 'normal', 'relaxed'] as const)) errors.push('$.layout.gap is not supported');

  const provenance = readObject(root.provenance, '$.provenance', ['createdBy', 'createdAt'], ['createdBy', 'createdAt'], errors);
  const createdBy = provenance ? readString(provenance.createdBy, '$.provenance.createdBy', errors, { nonEmpty: true, maxLength: 128 }) : undefined;
  const createdAt = provenance ? readString(provenance.createdAt, '$.provenance.createdAt', errors, { nonEmpty: true, maxLength: 64 }) : undefined;
  if (createdAt !== undefined && !isIsoLikeTimestamp(createdAt)) errors.push('$.provenance.createdAt must be ISO-like');

  const blocks: XopureUiBlock[] = [];
  if (!Array.isArray(root.blocks)) errors.push('$.blocks must be an array');
  else {
    if (root.blocks.length > MAX_BLOCKS) errors.push(`$.blocks exceeds maximum of ${MAX_BLOCKS} blocks`);
    if (root.blocks.length === 0) errors.push('$.blocks must contain at least one block');
    const blockIds = new Set<string>();
    for (let index = 0; index < root.blocks.length; index += 1) {
      const block = readBlock(root.blocks[index], `$.blocks[${index}]`, blockIds, errors);
      if (block) blocks.push(block);
    }
  }

  if (
    errors.length > 0 ||
    title === undefined ||
    columns !== 1 && columns !== 2 && columns !== 3 ||
    !isOneOf(gap, ['compact', 'normal', 'relaxed'] as const) ||
    createdBy === undefined ||
    createdAt === undefined ||
    !isIsoLikeTimestamp(createdAt)
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      schemaVersion: XOPURE_GENUI_SCHEMA_VERSION,
      catalogVersion: XOPURE_GENUI_CATALOG_VERSION,
      title,
      layout: { columns, gap },
      blocks,
      provenance: { createdBy, createdAt },
    },
  };
};

export type XopureUiCompositionMigrationResult =
  | {
      ok: true;
      value: XopureUiComposition;
      fromCatalogVersion: string;
      migrated: boolean;
    }
  | { ok: false; errors: string[] };

export const migrateXopureUiComposition = (
  input: unknown,
): XopureUiCompositionMigrationResult => {
  if (
    isPlainObject(input) &&
    input.schemaVersion === XOPURE_GENUI_SCHEMA_VERSION &&
    input.catalogVersion === XOPURE_GENUI_PREVIOUS_CATALOG_VERSION
  ) {
    const validation = validateXopureUiComposition({
      ...input,
      catalogVersion: XOPURE_GENUI_CATALOG_VERSION,
    });
    return validation.ok
      ? {
          ok: true,
          value: validation.value,
          fromCatalogVersion: XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
          migrated: true,
        }
      : validation;
  }

  const validation = validateXopureUiComposition(input);
  return validation.ok
    ? {
        ok: true,
        value: validation.value,
        fromCatalogVersion: XOPURE_GENUI_CATALOG_VERSION,
        migrated: false,
      }
    : validation;
};
