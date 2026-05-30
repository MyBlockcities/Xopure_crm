import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AnimatedEaseIn, themeCssVariables } from 'twenty-sdk/ui';
import {
  LiveWidgetSkeleton,
  LiveWidgetStatus,
} from 'src/front-components/components/live-widget-state';
import { useReadOnlySupabaseClient } from 'src/front-components/hooks/use-read-only-supabase-client';
import { useAnimatedNumber } from 'src/front-components/hooks/use-animated-number';
import { getErrorMessage } from 'src/front-components/utils/get-error-message';
import { getLiveMetricTable } from 'src/front-components/utils/get-live-metric-table';

export const XOPURE_LIVE_METRIC_COUNTER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'b2cac5d7-b9b7-4fcb-89de-3c9a264b866d';

type ConnectionState = 'connecting' | 'live' | 'error';

export const LiveMetricCounter = () => {
  const { supabase, configurationError } = useReadOnlySupabaseClient();
  const table = getLiveMetricTable();
  const [count, setCount] = useState<number | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const animatedCount = useAnimatedNumber(count);

  useEffect(() => {
    if (!supabase) {
      setConnectionState('error');
      setErrorMessage(configurationError);
      return;
    }

    let isMounted = true;

    const refreshCount = async () => {
      const { count: nextCount, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        setConnectionState('error');
        setErrorMessage(getErrorMessage(error));
        return;
      }

      setCount(nextCount ?? 0);
      setErrorMessage(null);
      setLastUpdatedAt(new Date());
    };

    void refreshCount();

    const channel = supabase
      .channel(`xopure-live-metric-${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          void refreshCount();
        },
      )
      .subscribe((status) => {
        if (!isMounted) {
          return;
        }

        setConnectionState(status === 'SUBSCRIBED' ? 'live' : 'connecting');
      });

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [configurationError, supabase, table]);

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: themeCssVariables.spacing[2],
        height: '100%',
        justifyContent: 'center',
        minHeight: '160px',
        padding: themeCssVariables.spacing[4],
      }}
    >
      <span
        style={{
          color: themeCssVariables.font.color.tertiary,
          fontFamily: themeCssVariables.font.family,
          fontSize: themeCssVariables.font.size.xs,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Live {table}
      </span>
      {count === null && !errorMessage ? (
        <LiveWidgetSkeleton rows={1} showStatus={false} />
      ) : (
        <AnimatedEaseIn duration="fast">
          <strong
            aria-live="polite"
            style={{
              color: themeCssVariables.font.color.primary,
              fontFamily: themeCssVariables.font.family,
              fontSize: themeCssVariables.font.size.xxl,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {animatedCount ?? '-'}
          </strong>
        </AnimatedEaseIn>
      )}
      <LiveWidgetStatus
        kind={
          connectionState === 'error'
            ? 'error'
            : connectionState === 'live'
              ? 'live'
              : 'loading'
        }
        text={
          errorMessage ??
          (connectionState === 'live'
            ? `Realtime connected${lastUpdatedAt ? ` - updated ${lastUpdatedAt.toLocaleTimeString()}` : ''}`
            : 'Connecting to realtime updates...')
        }
      />
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    XOPURE_LIVE_METRIC_COUNTER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'xopure-live-metric-counter',
  description:
    'Read-only Supabase count metric refreshed through an RLS-scoped realtime subscription.',
  component: LiveMetricCounter,
});
