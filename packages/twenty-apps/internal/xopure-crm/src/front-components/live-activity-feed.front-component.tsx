import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AnimatedEaseIn, themeCssVariables } from 'twenty-sdk/ui';
import {
  LiveWidgetSkeleton,
  LiveWidgetStatus,
} from 'src/front-components/components/live-widget-state';
import { useReadOnlySupabaseClient } from 'src/front-components/hooks/use-read-only-supabase-client';
import { getErrorMessage } from 'src/front-components/utils/get-error-message';

export const XOPURE_LIVE_ACTIVITY_FEED_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '41f61b3b-ab7a-44df-a22e-4bb62f58021e';

type OrderActivity = {
  id: string;
  payment_status: string | null;
  total_cents: number | null;
  created_at: string;
};

const formatOrderAmount = (totalCents: number | null): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((totalCents ?? 0) / 100);

export const LiveActivityFeed = () => {
  const { supabase, configurationError } = useReadOnlySupabaseClient();
  const [activities, setActivities] = useState<OrderActivity[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setErrorMessage(configurationError);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const refreshActivities = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,payment_status,total_cents,created_at')
        .order('created_at', { ascending: false })
        .limit(6);

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(getErrorMessage(error));
        setIsLoading(false);
        return;
      }

      setActivities(data ?? []);
      setErrorMessage(null);
      setIsLoading(false);
    };

    void refreshActivities();

    const channel = supabase
      .channel('xopure-live-activity-feed-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          void refreshActivities();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [configurationError, supabase]);

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: themeCssVariables.spacing[2],
        height: '100%',
        minHeight: '220px',
        overflow: 'auto',
        padding: themeCssVariables.spacing[4],
      }}
    >
      <strong
        style={{
          fontFamily: themeCssVariables.font.family,
          fontSize: themeCssVariables.font.size.sm,
        }}
      >
        Live order activity
      </strong>
      {isLoading ? (
        <LiveWidgetSkeleton />
      ) : errorMessage ? (
        <LiveWidgetStatus kind="error" text={errorMessage} />
      ) : activities.length === 0 ? (
        <LiveWidgetStatus kind="empty" text="No orders available" />
      ) : (
        <AnimatedEaseIn duration="fast">
          {activities.map((activity) => (
            <div
              key={activity.id}
              style={{
                borderBottom: `1px solid ${themeCssVariables.border.color.light}`,
                display: 'flex',
                fontFamily: themeCssVariables.font.family,
                fontSize: themeCssVariables.font.size.xs,
                justifyContent: 'space-between',
                paddingBottom: themeCssVariables.spacing[2],
              }}
            >
              <span>
                {activity.payment_status ?? 'PENDING'} - {activity.id.slice(0, 8)}
              </span>
              <span>{formatOrderAmount(activity.total_cents)}</span>
            </div>
          ))}
        </AnimatedEaseIn>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    XOPURE_LIVE_ACTIVITY_FEED_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'xopure-live-activity-feed',
  description:
    'Read-only Supabase order activity refreshed through an RLS-scoped realtime subscription.',
  component: LiveActivityFeed,
});
