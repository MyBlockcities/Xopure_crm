'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  clampScale,
  fitToViewport,
  IDENTITY_VIEWPORT,
  layoutForest,
  linkPath,
  type LayoutLink,
  type Viewport,
  zoomAbout,
} from '../lib/layout';
import { type TreeNode } from '../lib/tree';
import { CARD_WIDTH, LEVEL_SPACING, NODE_SPACING, linkAnchors } from './geometry';
import { NodeMark } from './node-mark';

interface TreeCanvasProps {
  readonly roots: readonly TreeNode[];
  readonly collapsed: ReadonlySet<string>;
  readonly selectedId: string | null;
  readonly lineageIds: ReadonlySet<string>;
  readonly dark: boolean;
  readonly onSelect: (id: string | null) => void;
  readonly onToggle: (id: string) => void;
  /** Bumped by the caller to request a re-fit (e.g. after "Fit"). */
  readonly fitToken: number;
  /** Width the inspector covers on the right, so focus can avoid it. */
  readonly obscuredRight: number;
}

/** Stratum bands run down the depth axis: one band per generation. */
const STRATUM_PAD = 42;

export const TreeCanvas = ({
  roots,
  collapsed,
  selectedId,
  lineageIds,
  dark,
  onSelect,
  onToggle,
  fitToken,
  obscuredRight,
}: TreeCanvasProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>(IDENTITY_VIEWPORT);
  const [panning, setPanning] = useState(false);
  const panOrigin = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const layout = useMemo(
    () =>
      layoutForest(roots, {
        orientation: 'horizontal',
        nodeSpacing: NODE_SPACING,
        levelSpacing: LEVEL_SPACING,
        collapsed,
      }),
    [roots, collapsed],
  );

  // Track the container so "fit" is computed against real pixels.
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (size.width === 0 || size.height === 0) return;

    // The bounds describe anchor points; cards extend right of theirs.
    const padded = {
      ...layout.bounds,
      maxX: layout.bounds.maxX + CARD_WIDTH,
      width: layout.bounds.width + CARD_WIDTH,
    };

    setViewport(fitToViewport(padded, size.width, size.height));
  }, [layout.bounds, size.width, size.height]);

  useEffect(fit, [fit, fitToken]);

  // Keep the selected node inside the part of the canvas the inspector does not
  // cover. Selecting a node whose card sits under the panel reads as a no-op.
  useEffect(() => {
    if (!selectedId || size.width === 0) return;

    const item = layout.nodes.find((n) => n.node.id === selectedId);
    if (!item) return;

    setViewport((current) => {
      const left = item.x * current.scale + current.x;
      const right = left + CARD_WIDTH * current.scale;
      const visibleRight = size.width - obscuredRight;
      const margin = 32;

      if (left >= margin && right <= visibleRight - margin) return current;

      // Park it a third of the way into the visible band, so its downline
      // stays on screen to the right.
      const target = (visibleRight - margin) / 3;

      return { ...current, x: target - item.x * current.scale };
    });
  }, [selectedId, layout.nodes, size.width, obscuredRight]);

  // ── Pan & zoom ──────────────────────────────────────────────────────────

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    panOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      vx: viewport.x,
      vy: viewport.y,
    };
    setPanning(true);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const origin = panOrigin.current;
    if (!origin) return;

    setViewport((current) => ({
      ...current,
      x: origin.vx + (event.clientX - origin.x),
      y: origin.vy + (event.clientY - origin.y),
    }));
  };

  const endPan = () => {
    panOrigin.current = null;
    setPanning(false);
  };

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const factor = Math.exp(-event.deltaY * 0.0015);

    setViewport((current) =>
      zoomAbout(current, factor, event.clientX - rect.left, event.clientY - rect.top),
    );
  };

  const nudgeZoom = useCallback(
    (factor: number) =>
      setViewport((current) =>
        zoomAbout(current, factor, size.width / 2, size.height / 2),
      ),
    [size.width, size.height],
  );

  // Keyboard zoom, so the canvas is usable without a trackpad.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) return;
      if (event.key === '+' || event.key === '=') nudgeZoom(1.2);
      if (event.key === '-' || event.key === '_') nudgeZoom(1 / 1.2);
      if (event.key === '0') fit();
      if (event.key === 'Escape') onSelect(null);
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [nudgeZoom, fit, onSelect]);

  // ── Strata: the signature. One band per generation, deepening with depth. ──

  const strata = useMemo(() => {
    const maxDepth = layout.nodes.reduce((max, n) => Math.max(max, n.depth), 0);
    const top = layout.bounds.minY - STRATUM_PAD * 1.6;
    const height = layout.bounds.height + STRATUM_PAD * 3.2;

    return Array.from({ length: maxDepth + 1 }, (_, depth) => ({
      depth,
      x: depth * LEVEL_SPACING - STRATUM_PAD,
      width: CARD_WIDTH + STRATUM_PAD * 2,
      y: top,
      height,
      // The band darkens with depth, so the column reads as a depth profile.
      // Generation depth is not decoration here: it is what gates generation
      // commissions (guide §1.4), so the axis earns its emphasis.
      tint: 0.22 + (depth / Math.max(1, maxDepth)) * 0.62,
      // A lineage passing through a generation lights that band's label.
      lit: layout.nodes.some(
        (n) => n.depth === depth && lineageIds.has(n.node.id),
      ),
    }));
  }, [layout, lineageIds]);

  const hasSelection = selectedId !== null;

  const pathFor = (link: LayoutLink) =>
    linkPath({ ...link, ...linkAnchors(link.source, link.target) }, 'horizontal');

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ height: '100%' }}>
      <svg
        className="tree-svg"
        data-panning={panning}
        role="tree"
        aria-label="Ambassador genealogy"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
        onPointerCancel={endPan}
        onWheel={onWheel}
        onClick={() => onSelect(null)}
      >
        <g
          transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`}
        >
          {strata.map((band) => (
            <g key={band.depth}>
              <rect
                className="stratum-band"
                x={band.x}
                y={band.y}
                width={band.width}
                height={band.height}
                opacity={band.tint}
              />
              <line
                className="stratum-rule"
                x1={band.x}
                y1={band.y}
                x2={band.x}
                y2={band.y + band.height}
              />
              <text
                className="stratum-label"
                data-lit={band.lit}
                x={band.x + 10}
                y={band.y + 20}
              >
                {band.depth === 0 ? 'Root' : `G${band.depth}`}
              </text>
            </g>
          ))}

          {layout.links.map((link) => {
            const onLineage =
              lineageIds.has(link.sourceId) && lineageIds.has(link.targetId);

            return (
              <path
                key={link.id}
                className="link"
                d={pathFor(link)}
                data-lineage={onLineage}
                data-dimmed={hasSelection && !onLineage}
              />
            );
          })}

          {layout.nodes.map((item) => {
            const onLineage = lineageIds.has(item.node.id);

            return (
              <NodeMark
                key={item.node.id}
                item={item}
                selected={item.node.id === selectedId}
                onLineage={onLineage}
                dimmed={hasSelection && !onLineage}
                dark={dark}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            );
          })}
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          display: 'flex',
          gap: 6,
        }}
      >
        <button className="btn" onClick={() => nudgeZoom(1.2)} aria-label="Zoom in">
          +
        </button>
        <button className="btn" onClick={() => nudgeZoom(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <button className="btn" onClick={fit}>
          Fit
        </button>
        <span
          className="figure"
          style={{ alignSelf: 'center', fontSize: 11, color: 'var(--ink-faint)' }}
        >
          {Math.round(clampScale(viewport.scale) * 100)}%
        </span>
      </div>
    </div>
  );
};
