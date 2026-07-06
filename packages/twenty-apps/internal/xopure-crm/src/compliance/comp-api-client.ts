// ---------------------------------------------------------------------------
// Comp AI API client — SOC2 evidence submissions
// ---------------------------------------------------------------------------

export const COMP_EVIDENCE_FORM_TYPES = [
  'board-meeting',
  'access-request',
  'rbac-matrix',
  'employee-performance-evaluation',
] as const;

export type EvidenceFormType = (typeof COMP_EVIDENCE_FORM_TYPES)[number];

export interface ControlSummary {
  id: string;
  name?: string;
  description?: string;
  status?: string;
}

export interface FrameworkLookupResult {
  instanceId: string;
  controls: ControlSummary[];
}

export interface EvidenceSubmissionResult {
  ok: boolean;
  submissionId?: string;
  error?: string;
}

export interface TaskUpdateResult {
  ok: boolean;
  error?: string;
}

export type TaskUpdateAction = 'submit-for-review' | 'approve' | 'reject';

export interface TaskUpdateOptions {
  /** Required by Comp AI for submit-for-review. */
  approverId?: string;
}

type FetchLike = typeof fetch;

interface ResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

const AUTH_FAILED = 'Comp auth failed';
const UNREACHABLE = 'Comp API unreachable';
const SERVER_ERROR = 'Comp 5xx';
const UNKNOWN_ERROR = 'Comp API request failed';

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readSubmissionId = (value: unknown): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.id === 'string') {
    return value.id;
  }

  if (typeof value.submissionId === 'string') {
    return value.submissionId;
  }

  if (isRecord(value.submission)) {
    if (typeof value.submission.id === 'string') {
      return value.submission.id;
    }

    if (typeof value.submission.submissionId === 'string') {
      return value.submission.submissionId;
    }
  }

  return undefined;
};

const mapHttpError = (status: number): string => {
  if (status === 401 || status === 403) {
    return AUTH_FAILED;
  }

  if (status >= 500) {
    return SERVER_ERROR;
  }

  return `${UNKNOWN_ERROR}: HTTP ${status}`;
};

export class CompApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: FetchLike;

  constructor(
    baseUrl = process.env.COMP_API_URL ?? 'http://localhost:13333',
    apiKey = process.env.COMP_API_KEY,
    fetchImpl: FetchLike = fetch,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async getFrameworks(): Promise<FrameworkLookupResult | null> {
    const response = await this.request('/v1/frameworks');
    if (!response.ok) {
      return null;
    }

    const body = await this.safeJson(response.response);
    const frameworks = this.extractArray(body);
    const soc2 = frameworks.find((framework) => {
      const nestedFramework = isRecord(framework.framework)
        ? framework.framework
        : null;
      const name = String(
        framework.name ?? nestedFramework?.name ?? '',
      ).toLowerCase();
      return name === 'soc2' || name === 'soc 2';
    });

    if (!soc2) {
      return null;
    }

    const instanceId = String(soc2.instanceId ?? soc2.id ?? '');
    if (!instanceId) {
      return null;
    }

    const controls = this.extractControls(soc2.controls);
    return { instanceId, controls };
  }

  async submitEvidenceForm(
    formType: EvidenceFormType,
    payload: Record<string, unknown>,
  ): Promise<EvidenceSubmissionResult> {
    const response = await this.request(`/v1/evidence-forms/${formType}/upload-submission`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, error: response.error };
    }

    const body = await this.safeJson(response.response);
    return { ok: true, submissionId: readSubmissionId(body) };
  }

  async updateTask(
    taskId: string,
    action: TaskUpdateAction,
    options: TaskUpdateOptions = {},
  ): Promise<TaskUpdateResult> {
    if (action === 'submit-for-review' && !options.approverId) {
      return {
        ok: false,
        error: 'Comp submit-for-review requires approverId',
      };
    }

    const body = action === 'submit-for-review'
      ? JSON.stringify({ approverId: options.approverId })
      : undefined;

    const response = await this.request(`/v1/tasks/${taskId}/${action}`, {
      method: 'POST',
      body,
    });

    return response.ok ? { ok: true } : { ok: false, error: response.error };
  }

  async heartbeat(): Promise<boolean> {
    const response = await this.request('/v1/health');
    return response.ok;
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<{ ok: true; response: ResponseLike } | { ok: false; error: string }> {
    if (!this.apiKey) {
      return { ok: false, error: AUTH_FAILED };
    }

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...init.headers,
        },
      }) as ResponseLike;

      if (!response.ok) {
        return { ok: false, error: mapHttpError(response.status) };
      }

      return { ok: true, response };
    } catch {
      return { ok: false, error: UNREACHABLE };
    }
  }

  private async safeJson(response: ResponseLike): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private extractArray(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }

    if (!isRecord(value)) {
      return [];
    }

    if (Array.isArray(value.frameworks)) {
      return value.frameworks.filter(isRecord);
    }

    if (Array.isArray(value.data)) {
      return value.data.filter(isRecord);
    }

    return [];
  }

  private extractControls(value: unknown): ControlSummary[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(isRecord).flatMap((control) => {
      const id = control.id;
      if (typeof id !== 'string') {
        return [];
      }

      return [{
        id,
        name: typeof control.name === 'string' ? control.name : undefined,
        description: typeof control.description === 'string'
          ? control.description
          : undefined,
        status: typeof control.status === 'string' ? control.status : undefined,
      }];
    });
  }
}
