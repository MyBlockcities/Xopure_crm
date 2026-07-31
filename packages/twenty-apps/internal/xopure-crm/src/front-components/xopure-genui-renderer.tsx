import { type CSSProperties, useEffect, useState, type ReactNode } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  closeSidePanel,
  navigate,
  openSidePanelPage,
  SidePanelPages,
  useFrontComponentExecutionContext,
  type AppPath,
} from 'twenty-sdk/front-component';

import {
  XOPURE_GENUI_CATALOG_VERSION,
  XOPURE_GENUI_LEGACY_CATALOG_VERSION,
  XOPURE_GENUI_LIMITS,
  XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
  XOPURE_GENUI_SCHEMA_VERSION,
  XOPURE_GENUI_TEMPLATE_CATALOG,
  migrateXopureUiComposition,
  type XopureUiComposition,
  type XopureUiAction,
  type XopureUiCompositionBlock,
} from '../genui/xopure-ui-composition';

export const XOPURE_GENUI_RENDERER_FRONT_COMPONENT_ID =
  '1c9a1e56-8d5c-4c59-a27d-1bbd585ff601';

const {
  maxChartPoints: MAX_CHART_POINTS,
  maxTableColumns: MAX_TABLE_COLUMNS,
  maxTableRows: MAX_TABLE_ROWS,
  maxTimelineEntries: MAX_TIMELINE_ENTRIES,
} = XOPURE_GENUI_LIMITS;

type Palette = {
  accent: string;
  background: string;
  border: string;
  muted: string;
  onAccent: string;
  surface: string;
  text: string;
};

export type XopureGenUiPalette = Palette;

type CompositionState =
  | { status: 'loading' }
  | { status: 'missing-context' }
  | { status: 'unavailable' }
  | { status: 'empty' }
  | { status: 'partial-data' }
  | { status: 'query-error' }
  | { status: 'unsupported-version' }
  | { status: 'validation-error'; errors: readonly string[] }
  | { status: 'ready'; name: string; composition: XopureUiComposition };

type ActionErrorReporter = (message: string) => void;

export const isSupportedXopureCompositionVersion = (
  schemaVersion: unknown,
  catalogVersion: unknown,
): boolean =>
  schemaVersion === XOPURE_GENUI_SCHEMA_VERSION &&
  [
    XOPURE_GENUI_CATALOG_VERSION,
    XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
    XOPURE_GENUI_LEGACY_CATALOG_VERSION,
  ].includes(catalogVersion as string);

type BlockRenderer<T extends XopureUiCompositionBlock['type']> = (
  block: Extract<XopureUiCompositionBlock, { type: T }>,
  palette: Palette,
  onActionError: ActionErrorReporter,
  frontComponentId?: string,
) => ReactNode;

const paletteFor = (colorScheme: 'light' | 'dark'): Palette =>
  colorScheme === 'dark'
    ? {
        accent: '#8ab4ff',
        background: '#15191f',
        border: '#39424e',
        muted: '#aeb8c5',
        onAccent: '#101318',
        surface: '#20262e',
        text: '#f2f5f8',
      }
    : {
        accent: '#1d4ed8',
        background: '#f7f8fa',
        border: '#d9dee5',
        muted: '#5f6b7a',
        onAccent: '#ffffff',
        surface: '#ffffff',
        text: '#1b2430',
      };

const shellStyle = (palette: Palette): CSSProperties => ({
  background: palette.background,
  color: palette.text,
  fontFamily: 'sans-serif',
  minHeight: '100%',
  padding: 16,
});

const blockStyle = (palette: Palette): CSSProperties => ({
  background: palette.surface,
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  minWidth: 0,
  overflow: 'hidden',
  padding: 16,
});

const titleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: '0 0 12px',
};

const sectionTitle = (title: string | undefined): ReactNode =>
  title ? <h2 style={titleStyle}>{title}</h2> : null;

const valueText = (value: string | number | boolean | null): string => {
  if (value === null) return '—';
  return String(value);
};

const renderKpi: BlockRenderer<'kpi'> = (block, palette) => (
  <section aria-label={block.title ?? block.label} style={blockStyle(palette)}>
    {sectionTitle(block.title)}
    <div style={{ color: palette.muted, fontSize: 13 }}>{block.label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
      {valueText(block.value)}
    </div>
    {block.detail ? (
      <div style={{ color: palette.muted, fontSize: 13, marginTop: 6 }}>
        {block.detail}
      </div>
    ) : null}
  </section>
);

const renderChart: BlockRenderer<'chart'> = (block, palette) => {
  const points = block.points.slice(0, MAX_CHART_POINTS);
  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const span = maxValue - minValue || 1;
  const width = 600;
  const height = 240;
  const padding = 28;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const pointPosition = (value: number, index: number) => ({
    x: padding + (points.length <= 1 ? chartWidth / 2 : (index * chartWidth) / (points.length - 1)),
    y: padding + chartHeight - ((value - minValue) / span) * chartHeight,
  });
  const linePoints = points
    .map((point, index) => {
      const position = pointPosition(point.value, index);
      return `${position.x},${position.y}`;
    })
    .join(' ');

  return (
    <section aria-label={block.title ?? 'Chart'} style={blockStyle(palette)}>
      {sectionTitle(block.title)}
      <svg
        aria-label={block.title ?? `${block.chartType} chart`}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', height: 240, maxWidth: '100%', width: '100%' }}
      >
        <line
          stroke={palette.border}
          strokeWidth="1"
          x1={String(padding)}
          x2={String(width - padding)}
          y1={String(height - padding)}
          y2={String(height - padding)}
        />
        {block.chartType === 'line' ? (
          <polyline fill="none" points={linePoints} stroke={palette.accent} strokeWidth="3" />
        ) : (
          points.map((point, index) => {
            const position = pointPosition(point.value, index);
            const barWidth = Math.max(2, chartWidth / Math.max(points.length, 1) - 4);
            const zeroY = padding + chartHeight - ((0 - minValue) / span) * chartHeight;
            return (
              <rect
                fill={palette.accent}
                height={String(Math.abs(position.y - zeroY))}
                key={`${point.label}-${index}`}
                width={String(barWidth)}
                x={String(position.x - barWidth / 2)}
                y={String(Math.min(position.y, zeroY))}
              />
            );
          })
        )}
      </svg>
      {points.length > 0 ? (
        <div
          aria-label="Chart labels"
          style={{ color: palette.muted, display: 'flex', fontSize: 12, gap: 8, marginTop: 8, overflow: 'hidden' }}
        >
          {points.map((point, index) => (
            <span key={`${point.label}-${index}`} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {point.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const renderTable: BlockRenderer<'table'> = (block, palette) => {
  const columns = block.columns.slice(0, MAX_TABLE_COLUMNS);
  const rows = block.rows.slice(0, MAX_TABLE_ROWS);

  return (
    <section aria-label={block.title ?? 'Table'} style={blockStyle(palette)}>
      {sectionTitle(block.title)}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ borderBottom: `1px solid ${palette.border}`, padding: '8px', textAlign: 'left' }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{ borderBottom: `1px solid ${palette.border}`, padding: '8px' }}
                  >
                    {valueText(row[column.key] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const renderTimeline: BlockRenderer<'timeline'> = (block, palette) => (
  <section aria-label={block.title ?? 'Timeline'} style={blockStyle(palette)}>
    {sectionTitle(block.title)}
    <ol style={{ margin: 0, paddingLeft: 20 }}>
      {block.entries.slice(0, MAX_TIMELINE_ENTRIES).map((entry, index) => (
        <li key={`${entry.timestamp}-${entry.title}-${index}`} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{entry.title}</div>
          <div style={{ color: palette.muted, fontSize: 13 }}>{entry.timestamp}</div>
          {entry.detail ? <div style={{ marginTop: 4 }}>{entry.detail}</div> : null}
        </li>
      ))}
    </ol>
  </section>
);

const renderAlert: BlockRenderer<'alert'> = (block, palette) => {
  const severityColors = {
    error: '#b42318',
    info: '#175cd3',
    success: '#067647',
    warning: '#b54708',
  } as const;
  const color = severityColors[block.severity];

  return (
    <section
      role="alert"
      style={{ ...blockStyle(palette), borderLeft: `4px solid ${color}` }}
    >
      {sectionTitle(block.title)}
      <div>{block.message}</div>
    </section>
  );
};

const renderMarkdown: BlockRenderer<'markdown'> = (block, palette) => (
  <section aria-label={block.title ?? 'Text'} style={blockStyle(palette)}>
    {sectionTitle(block.title)}
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{block.text}</div>
  </section>
);


type XopureRecordObjectName = Extract<
  XopureUiAction,
  { id: 'open-record' }
>['objectNameSingular'];

const RECORD_QUERY_FIELD_BY_OBJECT: {
  readonly [ObjectName in XopureRecordObjectName]: string;
} = {
  xopureAmbassador: 'xopureAmbassadors',
  xopureCommission: 'xopureCommissions',
  xopureCustomer: 'xopureCustomers',
  xopureOrder: 'xopureOrders',
  xopurePayment: 'xopurePayments',
};

type RecordQueryClient = {
  query: (
    input: Record<string, unknown>,
  ) => Promise<
    Record<
      string,
      { edges?: Array<{ node?: { id?: string } | null }> } | undefined
    >
  >;
};

type CompositionQueryClient = {
  query: (
    input: Record<string, unknown>,
  ) => Promise<{
    xopureUiCompositions?: {
      edges?: Array<{
        node?: { id?: string; name?: string; status?: string } | null;
      }>;
    };
  }>;
};

export const ensureRecordCanOpen = async (
  objectNameSingular: XopureRecordObjectName,
  recordId: string,
  client: RecordQueryClient = new CoreApiClient() as unknown as RecordQueryClient,
): Promise<void> => {
  const queryField = RECORD_QUERY_FIELD_BY_OBJECT[objectNameSingular];
  const result = await client.query({
    [queryField]: {
      __args: { filter: { id: { eq: recordId } }, first: 1 },
      edges: { node: { id: true } },
    },
  });
  if (!result[queryField]?.edges?.[0]?.node?.id) {
    throw new Error('Record target is unavailable.');
  }
};

const openRecordAfterPreflight = async (
  objectNameSingular: XopureRecordObjectName,
  recordId: string,
): Promise<void> => {
  await ensureRecordCanOpen(objectNameSingular, recordId);
  await openSidePanelPage({
    objectNameSingular,
    page: SidePanelPages.ViewRecord,
    recordId,
  });
};

export const openCompositionAfterPreflight = async (
  compositionId: string,
  frontComponentId: string,
  client: CompositionQueryClient = new CoreApiClient() as unknown as CompositionQueryClient,
  openPanel: typeof openSidePanelPage = openSidePanelPage,
): Promise<void> => {
  const result = await client.query({
    xopureUiCompositions: {
      __args: { filter: { id: { eq: compositionId } }, first: 1 },
      edges: { node: { id: true, name: true, status: true } },
    },
  });
  const target = result.xopureUiCompositions?.edges?.[0]?.node;

  if (!target?.id || target.status !== 'READY') {
    throw new Error('Composition target is unavailable.');
  }

  await openPanel({
    frontComponentId,
    objectNameSingular: 'xopureUiComposition',
    page: SidePanelPages.ViewFrontComponent,
    pageIcon: 'IconLayoutDashboard',
    pageTitle: target.name || 'XO Pure composition',
    recordId: target.id,
  });
};

const runAction = async (
  action: XopureUiAction,
  frontComponentId?: string,
): Promise<void> => {
  switch (action.id) {
    case 'open-record':
      await openRecordAfterPreflight(
        action.objectNameSingular,
        action.recordId,
      );
      return;
    case 'open-composition':
      if (!frontComponentId) {
        throw new Error('Mounted front component identity is unavailable.');
      }
      await openCompositionAfterPreflight(action.compositionId, frontComponentId);
      return;
    case 'navigate-internal':
      await navigate(action.path as AppPath);
      return;
  }
};

const renderAction: BlockRenderer<'action'> = (
  block,
  palette,
  onActionError,
  frontComponentId,
) => (
  <section aria-label={block.title ?? block.label} style={blockStyle(palette)}>
    {sectionTitle(block.title)}
    <button
      onClick={() => {
        void runAction(block.action, frontComponentId).catch(() => {
          onActionError(`Could not complete “${block.label}”. Check access and try again.`);
        });
      }}
      style={{
        background: palette.accent,
        border: 0,
        borderRadius: 6,
        color: palette.onAccent,
        cursor: 'pointer',
        padding: '8px 12px',
      }}
      type="button"
    >
      {block.label}
    </button>
  </section>
);

const renderRecordLink: BlockRenderer<'record-link'> = (
  block,
  palette,
  onActionError,
) => (
  <section aria-label={block.title ?? block.label} style={blockStyle(palette)}>
    {sectionTitle(block.title)}
    <button
      onClick={() => {
        void openRecordAfterPreflight(
          block.objectNameSingular,
          block.recordId,
        ).catch(() => {
          onActionError(`Could not open “${block.label}”. Check access and try again.`);
        });
      }}
      style={{
        background: 'transparent',
        border: 0,
        color: palette.accent,
        cursor: 'pointer',
        padding: 0,
        textDecoration: 'underline',
      }}
      type="button"
    >
      {block.label}
    </button>
  </section>
);

const BLOCK_RENDERERS: {
  [T in XopureUiCompositionBlock['type']]: BlockRenderer<T>;
} = {
  action: renderAction,
  alert: renderAlert,
  chart: renderChart,
  kpi: renderKpi,
  markdown: renderMarkdown,
  'record-link': renderRecordLink,
  table: renderTable,
  timeline: renderTimeline,
};

export const renderXopureGenuiBlock = (
  block: XopureUiCompositionBlock,
  palette: XopureGenUiPalette,
  onActionError: ActionErrorReporter,
  frontComponentId?: string,
): ReactNode => {
  switch (block.type) {
    case 'action':
      return BLOCK_RENDERERS.action(
        block,
        palette,
        onActionError,
        frontComponentId,
      );
    case 'alert':
      return BLOCK_RENDERERS.alert(block, palette, onActionError);
    case 'chart':
      return BLOCK_RENDERERS.chart(block, palette, onActionError);
    case 'kpi':
      return BLOCK_RENDERERS.kpi(block, palette, onActionError);
    case 'markdown':
      return BLOCK_RENDERERS.markdown(block, palette, onActionError);
    case 'record-link':
      return BLOCK_RENDERERS['record-link'](block, palette, onActionError);
    case 'table':
      return BLOCK_RENDERERS.table(block, palette, onActionError);
    case 'timeline':
      return BLOCK_RENDERERS.timeline(block, palette, onActionError);
  }
};

export const resolveXopureCompositionRecordId = (context: {
  selectedRecordIds: readonly string[];
  recordId: string | null;
}): string | null =>
  context.selectedRecordIds.length === 1
    ? context.selectedRecordIds[0]
    : context.selectedRecordIds.length === 0
      ? context.recordId
      : null;

export const XopureGenuiRenderer = () => {
  const executionContext = useFrontComponentExecutionContext(
    (context) => context,
  );
  const recordId = resolveXopureCompositionRecordId(executionContext);
  const colorScheme = executionContext.colorScheme;
  const palette = paletteFor(colorScheme);
  const [state, setState] = useState<CompositionState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) {
      setState({ status: 'missing-context' });
      return;
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        recordId,
      )
    ) {
      setState({ status: 'unavailable' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    setActionError(null);

    const loadComposition = async () => {
      try {
        const { xopureUiCompositions } = await new CoreApiClient().query({
          xopureUiCompositions: {
            __args: { filter: { id: { eq: recordId } }, first: 1 },
            edges: {
              node: {
                document: true,
                id: true,
                name: true,
                status: true,
              },
            },
          },
        });
        if (cancelled) return;

        const node = xopureUiCompositions?.edges?.[0]?.node;
        if (!node || node.status !== 'READY') {
          setState({ status: 'unavailable' });
          return;
        }
        if (node.document === null || node.document === undefined) {
          setState({ status: 'partial-data' });
          return;
        }

        const document =
          typeof node.document === 'object' && !Array.isArray(node.document)
            ? node.document as Record<string, unknown>
            : null;
        if (
          document &&
          !isSupportedXopureCompositionVersion(
            document.schemaVersion,
            document.catalogVersion,
          )
        ) {
          setState({ status: 'unsupported-version' });
          return;
        }

        const validation = migrateXopureUiComposition(node.document);
        if (!validation.ok) {
          setState({
            status: 'validation-error',
            errors: validation.errors.slice(0, 20),
          });
          return;
        }

        if (validation.value.blocks.length === 0) {
          setState({ status: 'empty' });
          return;
        }

        setState({
          composition: validation.value,
          name: node.name ?? validation.value.title,
          status: 'ready',
        });
      } catch {
        if (!cancelled) setState({ status: 'query-error' });
      }
    };

    void loadComposition();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, recordId]);

  const statusStyle: CSSProperties = {
    color: palette.muted,
    padding: 24,
    textAlign: 'center',
  };
  const recoveryButtonStyle: CSSProperties = {
    background: palette.accent,
    border: 0,
    borderRadius: 6,
    color: palette.onAccent,
    cursor: 'pointer',
    margin: '12px 4px 0',
    padding: '8px 12px',
  };
  const close = () => {
    void closeSidePanel();
  };
  const retry = () => {
    setLoadAttempt((attempt) => attempt + 1);
  };
  const statusPanel = (
    message: string,
    options: { alert?: boolean; retry?: boolean } = {},
  ) => (
    <div
      role={options.alert ? 'alert' : undefined}
      style={{ ...shellStyle(palette), ...statusStyle }}
    >
      <div>{message}</div>
      {options.retry ? (
        <button onClick={retry} style={recoveryButtonStyle} type="button">
          Retry
        </button>
      ) : null}
      <button onClick={close} style={recoveryButtonStyle} type="button">
        Close panel
      </button>
    </div>
  );

  if (state.status === 'loading') {
    return (
      <div aria-live="polite" style={{ ...shellStyle(palette), ...statusStyle }}>
        Loading composition…
      </div>
    );
  }
  if (state.status === 'missing-context') {
    return statusPanel('Select exactly one composition record to render it here.');
  }
  if (state.status === 'unavailable') {
    return statusPanel('This composition is unavailable.', { alert: true });
  }
  if (state.status === 'empty') {
    return statusPanel('This composition has no blocks to display.');
  }
  if (state.status === 'partial-data') {
    return statusPanel('This composition is missing required data.', {
      alert: true,
      retry: true,
    });
  }
  if (state.status === 'query-error') {
    return statusPanel('Unable to load this composition.', {
      alert: true,
      retry: true,
    });
  }
  if (state.status === 'unsupported-version') {
    return statusPanel(
      'This composition uses an unsupported schema or catalog version.',
      { alert: true },
    );
  }
  if (state.status === 'validation-error') {
    return (
      <div role="alert" style={{ ...shellStyle(palette), ...statusStyle }}>
        <div>This composition cannot be rendered safely.</div>
        <ul style={{ margin: '12px auto 0', maxWidth: 640, textAlign: 'left' }}>
          {state.errors.slice(0, 20).map((error, index) => (
            <li key={`${error}-${index}`}>{error}</li>
          ))}
        </ul>
        <button onClick={close} style={recoveryButtonStyle} type="button">
          Close panel
        </button>
      </div>
    );
  }

  const composition = state.composition;
  const templateCatalogEntryCount = Object.keys(
    XOPURE_GENUI_TEMPLATE_CATALOG.blockTypes,
  ).length;
  const layoutGap =
    XOPURE_GENUI_TEMPLATE_CATALOG.designTokens.gapPixels[
      composition.layout.gap
    ];

  return (
    <main style={shellStyle(palette)}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{state.name}</h1>
        <div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>
          Schema {XOPURE_GENUI_SCHEMA_VERSION} · Catalog{' '}
          {XOPURE_GENUI_CATALOG_VERSION} · {templateCatalogEntryCount} block
          types
        </div>
      </header>
      {actionError ? (
        <div
          role="alert"
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 6,
            marginBottom: 12,
            padding: 12,
          }}
        >
          <div>{actionError}</div>
          <button
            onClick={() => setActionError(null)}
            style={recoveryButtonStyle}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gap: layoutGap,
          gridTemplateColumns: `repeat(${composition.layout.columns}, minmax(0, 1fr))`,
        }}
      >
        {composition.blocks.map((block) => (
          <div key={block.id}>
            {renderXopureGenuiBlock(
              block,
              palette,
              setActionError,
              executionContext.frontComponentId,
            )}
          </div>
        ))}
      </div>
    </main>
  );
};

