import { useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { themeCssVariables } from 'twenty-sdk/ui';
import { useReadOnlySupabaseClient } from 'src/front-components/hooks/use-read-only-supabase-client';
import { getErrorMessage } from 'src/front-components/utils/get-error-message';

export const XOPURE_REALTIME_REVENUE_LINE_CHART_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '17b51f1d-24dd-4fc5-b62f-07b3d168f361';

type OrderRevenue = {
  id: string;
  total_cents: number | null;
  created_at: string;
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;

export const RealtimeRevenueLineChart = () => {
  const { supabase, configurationError } = useReadOnlySupabaseClient();
  const [orders, setOrders] = useState<OrderRevenue[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setErrorMessage(configurationError);
      return;
    }

    let isMounted = true;

    const refreshOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,total_cents,created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(getErrorMessage(error));
        return;
      }

      setOrders([...(data ?? [])].reverse());
      setErrorMessage(null);
    };

    void refreshOrders();

    const channel = supabase
      .channel('xopure-realtime-revenue-line-chart-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          void refreshOrders();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [configurationError, supabase]);

  const points = useMemo(() => {
    const values = orders.map((order) => (order.total_cents ?? 0) / 100);
    const maxValue = Math.max(...values, 1);
    const widthStep = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;

    return values
      .map((value, index) => {
        const x = index * widthStep;
        const y = CHART_HEIGHT - (value / maxValue) * CHART_HEIGHT;

        return `${x},${y}`;
      })
      .join(' ');
  }, [orders]);

  const totalRevenue = orders.reduce(
    (sum, order) => sum + (order.total_cents ?? 0),
    0,
  );

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: themeCssVariables.spacing[2],
        height: '100%',
        justifyContent: 'center',
        minHeight: '220px',
        padding: themeCssVariables.spacing[4],
      }}
    >
      <span
        style={{
          color: themeCssVariables.font.color.tertiary,
          fontFamily: themeCssVariables.font.family,
          fontSize: themeCssVariables.font.size.xs,
        }}
      >
        Realtime revenue - latest {orders.length} orders
      </span>
      <strong
        style={{
          fontFamily: themeCssVariables.font.family,
          fontSize: themeCssVariables.font.size.xl,
        }}
      >
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(totalRevenue / 100)}
      </strong>
      {errorMessage ? (
        <span
          style={{
            color: themeCssVariables.color.red,
            fontFamily: themeCssVariables.font.family,
            fontSize: themeCssVariables.font.size.xs,
          }}
        >
          {errorMessage}
        </span>
      ) : orders.length === 0 ? (
        <span
          style={{
            color: themeCssVariables.font.color.tertiary,
            fontFamily: themeCssVariables.font.family,
            fontSize: themeCssVariables.font.size.xs,
          }}
        >
          No orders available.
        </span>
      ) : (
        <svg
          aria-label="Realtime revenue trend"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          style={{ height: '120px', overflow: 'visible', width: '100%' }}
        >
          <polyline
            fill="none"
            points={points}
            stroke={themeCssVariables.color.blue}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </svg>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    XOPURE_REALTIME_REVENUE_LINE_CHART_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'xopure-realtime-revenue-line-chart',
  description:
    'Read-only Supabase revenue trend refreshed through an RLS-scoped realtime subscription.',
  component: RealtimeRevenueLineChart,
});
