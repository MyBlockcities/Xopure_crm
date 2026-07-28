import { TreeExplorer } from '../components/tree-explorer';
import { UnmappedRankError } from '../lib/ranks';
import { loadTree, parseRootId } from '../server/ambassador-tree';

export const dynamic = 'force-dynamic';

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const first = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const Page = async ({ searchParams }: PageProps) => {
  const params = await searchParams;
  const rootId = parseRootId(first(params.rootId));

  try {
    const payload = await loadTree({ rootId });

    return (
      <TreeExplorer
        payload={payload}
        crmBaseUrl={process.env.TWENTY_BASE_URL ?? null}
        exportsEnabled={
          process.env.TREE_EXPORTS_ENABLED === '1' || payload.source === 'demo'
        }
      />
    );
  } catch (error) {
    // A rank we cannot map is a data problem with a name — say which value,
    // rather than rendering a tree with a silently wrong rank (LAW §2.6).
    const isRank = error instanceof UnmappedRankError;

    return (
      <main className="empty-state">
        <p className="eyebrow">{isRank ? 'Unmapped rank' : 'Cannot load the tree'}</p>
        <p style={{ maxWidth: 460 }}>
          {isRank
            ? `The genealogy contains the rank ${JSON.stringify(
                (error as UnmappedRankError).rawValue,
              )}, which is not on the comp-plan ladder. Add it to the rank map before this tree can be trusted.`
            : 'The ambassador genealogy could not be read. Check SUPABASE_DB_URL points at the crm_readonly role, or set DEMO_MODE=1 to preview the interface.'}
        </p>
      </main>
    );
  }
};

export default Page;
