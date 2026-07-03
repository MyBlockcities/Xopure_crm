import { describe, expect, it } from 'vitest';

import commandMenuItem from 'src/command-menu-items/open-logging-panel.command-menu-item';

describe('open-logging-panel command menu item', () => {
  it('exports a defineCommandMenuItem result', () => {
    expect(commandMenuItem).toBeDefined();
    expect(commandMenuItem.config).toBeDefined();
  });

  it('has a label describing the logging action', () => {
    expect(commandMenuItem.config.label).toBeDefined();
    expect(commandMenuItem.config.label).toMatch(/log/i);
  });

  it('has an icon', () => {
    expect(commandMenuItem.config.icon).toBeDefined();
    expect(typeof commandMenuItem.config.icon).toBe('string');
  });

  it('references a front component universal identifier', () => {
    expect(
      commandMenuItem.config.frontComponentUniversalIdentifier,
    ).toBeDefined();
    expect(
      typeof commandMenuItem.config.frontComponentUniversalIdentifier,
    ).toBe('string');
  });

  it('passes defineCommandMenuItem validation', () => {
    expect(commandMenuItem.errors).toBeDefined();
    expect(commandMenuItem.errors).toHaveLength(0);
  });
});
