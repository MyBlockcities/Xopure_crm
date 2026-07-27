import { NextResponse } from 'next/server';

import { UnmappedRankError } from '../../../lib/ranks';
import { loadTree, parseRootId } from '../../../server/ambassador-tree';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Short TTL: the genealogy changes slowly, but stale ranks are misleading. */
const CACHE_SECONDS = Number(process.env.TREE_CACHE_SECONDS ?? 60);

export const GET = async (request: Request): Promise<NextResponse> => {
  const url = new URL(request.url);
  const rawRoot = url.searchParams.get('rootId');
  const rootId = parseRootId(rawRoot);

  if (rawRoot && !rootId) {
    return NextResponse.json(
      { error: 'rootId must be a UUID.' },
      { status: 400 },
    );
  }

  const depthParam = url.searchParams.get('maxDepth');

  try {
    const payload = await loadTree({
      rootId,
      maxDepth: depthParam ? Number(depthParam) : undefined,
    });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': `private, max-age=${CACHE_SECONDS}, stale-while-revalidate=300`,
      },
    });
  } catch (error) {
    // An unmapped rank is a real data problem, not a 500 — say which value
    // broke so it can be added to the ladder (LAW §2.6: never silently drop).
    if (error instanceof UnmappedRankError) {
      return NextResponse.json(
        {
          error: 'Unmapped rank in the genealogy.',
          detail: error.message,
          rawValue: error.rawValue,
        },
        { status: 422 },
      );
    }

    console.error('[ambassador-tree] load failed', error);

    return NextResponse.json(
      { error: 'Failed to load the ambassador tree.' },
      { status: 500 },
    );
  }
};
