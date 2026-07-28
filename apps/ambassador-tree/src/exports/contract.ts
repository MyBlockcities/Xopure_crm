export const EXPORT_FORMATS = [
  'json',
  'newick',
  'nexus',
  'phyloxml',
  'svg',
  'itol-zip',
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportArtifact {
  readonly format: ExportFormat;
  readonly mediaType: string;
  readonly filename: string;
  readonly bytes: Uint8Array;
  readonly graphRevision: string;
}

export const isExportFormat = (value: string | null): value is ExportFormat =>
  EXPORT_FORMATS.includes(value as ExportFormat);

