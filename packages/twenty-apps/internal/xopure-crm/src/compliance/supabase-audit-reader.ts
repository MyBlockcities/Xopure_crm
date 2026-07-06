// ---------------------------------------------------------------------------
// Supabase audit reader — CRM sync/write-back evidence source
// ---------------------------------------------------------------------------

export type SupabaseAuditSource = 'twenty_sync_audit' | 'twenty_activity_log';

export interface SupabaseAuditRow {
  [field: string]: unknown;
  audit_source: SupabaseAuditSource;
  id: string;
  created_at: string;
  status: string;
}

type FetchLike = typeof fetch;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const readJsonArray = async (response: Response): Promise<Record<string, unknown>[]> => {
  const body = await response.json();
  return Array.isArray(body) ? body.filter(isRecord) : [];
};

export class SupabaseAuditReader {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly supabaseUrl: string,
    private readonly supabaseKey: string,
    fetchImpl: FetchLike = fetch,
  ) {
    this.fetchImpl = fetchImpl;
  }

  async fetchUnsyncedRows(
    since: Date,
    maxRows: number,
  ): Promise<SupabaseAuditRow[]> {
    try {
      const [syncRows, activityRows] = await Promise.all([
        this.fetchTableRows(
          'twenty_sync_audit',
          `status=eq.success&created_at=gt.${encodeURIComponent(since.toISOString())}`,
          maxRows,
        ),
        this.fetchTableRows(
          'twenty_activity_log',
          `status=in.(sent,confirmed)&created_at=gt.${encodeURIComponent(since.toISOString())}`,
          maxRows,
        ),
      ]);

      return [...syncRows, ...activityRows]
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
        .slice(0, maxRows);
    } catch (error) {
      console.error('Failed to read Supabase audit rows for SOC2 evidence.', error);
      return [];
    }
  }

  private async fetchTableRows(
    table: SupabaseAuditSource,
    filters: string,
    maxRows: number,
  ): Promise<SupabaseAuditRow[]> {
    const baseUrl = normalizeBaseUrl(this.supabaseUrl);
    const response = await this.fetchImpl(
      `${baseUrl}/rest/v1/${table}?select=*&${filters}&order=created_at.asc&limit=${maxRows}`,
      {
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          'Accept-Profile': 'crm',
        },
      },
    );

    if (!response.ok) {
      console.error(
        `Supabase audit evidence query failed for ${table}: HTTP ${response.status}`,
      );
      return [];
    }

    const rows = await readJsonArray(response);
    return rows.flatMap((row) => {
      if (
        typeof row.id !== 'string'
        || typeof row.created_at !== 'string'
        || typeof row.status !== 'string'
      ) {
        return [];
      }

      return [{
        ...row,
        audit_source: table,
        id: row.id,
        created_at: row.created_at,
        status: row.status,
      }];
    });
  }
}
