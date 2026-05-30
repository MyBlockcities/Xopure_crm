import chalk from 'chalk';
import { Command } from 'nest-commander';

import { ActiveOrSuspendedWorkspaceCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { TwentyStandardApplicationService } from 'src/engine/workspace-manager/twenty-standard-application/services/twenty-standard-application.service';

// XO Pure: existing workspaces created before a standard object (e.g. Dashboards)
// was added to the Twenty Standard Application never receive it — that metadata is
// only provisioned at workspace creation. The `upgrade` command runs per-version
// patches but does NOT re-synchronize the standard application. This command does:
// it re-runs the same synchronize used at workspace creation, which diffs the
// standard-application entities (objects, fields, views, navigation menu items,
// page layouts) and creates anything missing. The diff is scoped to entities owned
// by the standard application, so custom XO Pure objects (ambassador, customer,
// xoOrder, …) and custom fields are NOT touched.
@Command({
  name: 'xopure:sync-standard-application',
  description:
    'Re-synchronize the Twenty Standard Application into existing workspaces, backfilling standard objects (e.g. Dashboards) and navigation menu items added after the workspace was created. Custom objects are not touched. Run with --dry-run first.',
})
export class XopureSyncStandardApplicationCommand extends ActiveOrSuspendedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly twentyStandardApplicationService: TwentyStandardApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
    index,
    total,
  }: RunOnWorkspaceArgs): Promise<void> {
    const progress = `(${index + 1}/${total})`;

    if (options.dryRun === true) {
      this.logger.log(
        chalk.yellow(
          `[DRY RUN] Would re-synchronize the standard application for workspace ${workspaceId} ${progress}`,
        ),
      );

      return;
    }

    this.logger.log(
      `Synchronizing standard application for workspace ${workspaceId} ${progress}`,
    );

    await this.twentyStandardApplicationService.synchronizeTwentyStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      chalk.green(
        `Standard application synchronized for workspace ${workspaceId}`,
      ),
    );
  }
}
