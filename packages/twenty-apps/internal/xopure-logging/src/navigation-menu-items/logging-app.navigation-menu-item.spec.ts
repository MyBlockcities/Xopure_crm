import { describe, expect, it } from 'vitest';

import navMenuItem from 'src/navigation-menu-items/logging-app.navigation-menu-item';

describe('logging-app navigation menu item', () => {
  it('exports a defineNavigationMenuItem result', () => {
    expect(navMenuItem).toBeDefined();
    expect(navMenuItem.config).toBeDefined();
  });

  it('has a numeric position', () => {
    expect(typeof navMenuItem.config.position).toBe('number');
  });

  it('has a name describing the logging entry point', () => {
    expect(navMenuItem.config.name).toBeDefined();
    expect(navMenuItem.config.name).toMatch(/log/i);
  });

  it('has an icon', () => {
    expect(navMenuItem.config.icon).toBeDefined();
    expect(typeof navMenuItem.config.icon).toBe('string');
  });

  it('uses LINK type with a link pointing to the Grafana panel', () => {
    expect(navMenuItem.config.type).toBe('LINK');
    expect(navMenuItem.config.link).toBeDefined();
    expect(typeof navMenuItem.config.link).toBe('string');
    expect(navMenuItem.config.link).toMatch(/grafana/i);
  });

  it('passes defineNavigationMenuItem validation', () => {
    expect(navMenuItem.errors).toBeDefined();
    expect(navMenuItem.errors).toHaveLength(0);
  });
});
