import { NextResponse } from 'next/server';

import { isExportFormat } from '../../../exports/contract';
import { exportGraph } from '../../../exports/export-graph';
import { visualizationGraphFromRoots } from '../../../graph/from-tree-node';
import { loadTree, parseRootId, resolveSource } from '../../../server/ambassador-tree';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const enabled = (): boolean =>
  process.env.TREE_EXPORTS_ENABLED === '1' || resolveSource() === 'demo';

export const GET = async (request: Request): Promise<Response> => {
  if (!enabled()) {
    return NextResponse.json(
      { error: 'Tree exports are not enabled.' },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  const rawRoot = url.searchParams.get('rootId');
  const rootId = parseRootId(rawRoot);
  if (!isExportFormat(format)) {
    return NextResponse.json(
      { error: 'Unsupported export format.' },
      { status: 400 },
    );
  }
  if (rawRoot && !rootId) {
    return NextResponse.json({ error: 'rootId must be a UUID.' }, { status: 400 });
  }

  try {
    const payload = await loadTree({ rootId });
    if (payload.cycleIds.length > 0) {
      return NextResponse.json(
        { error: 'Export blocked because the sponsor graph contains a cycle.' },
        { status: 422 },
      );
    }
    const graph = await visualizationGraphFromRoots(payload.roots, {
      graphId: rootId ? `ambassador-${rootId}` : 'xopure-ambassador-network',
      rootId,
      source: payload.source,
    });
    const expectedRevision = request.headers.get('if-match')?.replaceAll('"', '');
    if (expectedRevision && expectedRevision !== graph.source.revision) {
      return NextResponse.json(
        {
          error: 'The genealogy changed before export. Refresh and try again.',
          currentRevision: graph.source.revision,
        },
        { status: 412 },
      );
    }
    const artifact = exportGraph(graph, format);

    return new Response(artifact.bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': artifact.mediaType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-XOPURE-Graph-Revision': artifact.graphRevision,
      },
    });
  } catch (error) {
    console.error('[tree-export] generation failed', error);

    return NextResponse.json(
      { error: 'The tree export could not be generated.' },
      { status: 500 },
    );
  }
};
