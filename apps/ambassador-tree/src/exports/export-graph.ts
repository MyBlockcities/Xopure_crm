import { type VisualizationGraphV1 } from '../graph/visualization-graph';
import { type ExportArtifact, type ExportFormat } from './contract';
import {
  serializeCanonicalGraph,
  serializeItolFiles,
  serializeNewick,
  serializeNexus,
  serializePhyloXml,
  serializeSvg,
} from './serialize';
import { createZip } from './zip';

const encoder = new TextEncoder();

const details: Record<
  Exclude<ExportFormat, 'itol-zip'>,
  { readonly extension: string; readonly mediaType: string }
> = {
  json: { extension: 'json', mediaType: 'application/json; charset=utf-8' },
  newick: { extension: 'nwk', mediaType: 'text/plain; charset=utf-8' },
  nexus: { extension: 'nex', mediaType: 'text/plain; charset=utf-8' },
  phyloxml: { extension: 'phyloxml', mediaType: 'application/xml; charset=utf-8' },
  svg: { extension: 'svg', mediaType: 'image/svg+xml; charset=utf-8' },
};

const safeBase = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'xopure-tree';

export const exportGraph = (
  graph: VisualizationGraphV1,
  format: ExportFormat,
): ExportArtifact => {
  const base = safeBase(graph.graphId);
  if (format === 'itol-zip') {
    return {
      format,
      mediaType: 'application/zip',
      filename: `${base}-itol.zip`,
      bytes: createZip(serializeItolFiles(graph)),
      graphRevision: graph.source.revision,
    };
  }

  const serializers = {
    json: serializeCanonicalGraph,
    newick: serializeNewick,
    nexus: serializeNexus,
    phyloxml: serializePhyloXml,
    svg: serializeSvg,
  } satisfies Record<typeof format, (input: VisualizationGraphV1) => string>;
  const descriptor = details[format];

  return {
    format,
    mediaType: descriptor.mediaType,
    filename: `${base}.${descriptor.extension}`,
    bytes: encoder.encode(serializers[format](graph)),
    graphRevision: graph.source.revision,
  };
};

