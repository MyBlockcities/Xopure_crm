import { Status, themeCssVariables } from 'twenty-sdk/ui';

type LiveWidgetStatusKind = 'empty' | 'error' | 'live' | 'loading';

const getStatusColor = (kind: LiveWidgetStatusKind) => {
  if (kind === 'error') {
    return 'red';
  }

  if (kind === 'live') {
    return 'green';
  }

  if (kind === 'loading') {
    return 'blue';
  }

  return 'gray';
};

export const LiveWidgetStatus = ({
  kind,
  text,
}: {
  kind: LiveWidgetStatusKind;
  text: string;
}) => (
  <div style={{ alignItems: 'center', display: 'flex' }}>
    <Status
      color={getStatusColor(kind)}
      isLoaderVisible={kind === 'loading'}
      text={text}
    />
  </div>
);

const SKELETON_WIDTHS = ['88%', '68%', '78%'];

export const LiveWidgetSkeleton = ({
  rows = 3,
  showStatus = true,
}: {
  rows?: number;
  showStatus?: boolean;
}) => (
  <div
    aria-label="Loading live data"
    role="status"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: themeCssVariables.spacing[2],
    }}
  >
    {showStatus ? (
      <LiveWidgetStatus kind="loading" text="Loading live data" />
    ) : null}
    {SKELETON_WIDTHS.slice(0, rows).map((width) => (
      <span
        key={width}
        style={{
          background: themeCssVariables.background.transparent.medium,
          borderRadius: themeCssVariables.border.radius.pill,
          display: 'block',
          height: themeCssVariables.spacing[2],
          opacity: 0.7,
          width,
        }}
      />
    ))}
  </div>
);
