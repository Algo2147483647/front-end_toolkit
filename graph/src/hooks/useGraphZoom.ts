import { useCallback, useLayoutEffect, useMemo } from "react";
import type { StageData } from "../layout/types";

const MIN_ZOOM_FLOOR = 0.05;

interface UseGraphZoomInput {
  containerRef: React.RefObject<HTMLElement>;
  svgRef: React.RefObject<SVGSVGElement>;
  topbarRef: React.RefObject<HTMLElement>;
  stage: StageData | null;
  scale: number;
  minScale: number;
  maxScale: number;
  onZoomChange: (scale: number, minScale?: number) => void;
}

export function useGraphZoom({ containerRef, svgRef, topbarRef, stage, scale, minScale, maxScale, onZoomChange }: UseGraphZoomInput) {
  const apply = useCallback((nextScale: number, preserveCenter: boolean, nextMinScale = minScale) => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg || !stage) {
      return;
    }
    const clampedScale = clamp(nextScale, nextMinScale, maxScale);
    applyGraphZoom(container, svg, topbarRef.current, stage, clampedScale, preserveCenter);
    if (Math.abs(scale - clampedScale) > 0.0001 || Math.abs(minScale - nextMinScale) > 0.0001) {
      onZoomChange(clampedScale, nextMinScale);
    }
  }, [containerRef, maxScale, minScale, onZoomChange, scale, stage, svgRef, topbarRef]);

  const refresh = useCallback((preserveCenter: boolean) => {
    const container = containerRef.current;
    if (!container || !stage) {
      return;
    }
    const nextMinScale = getFitZoomScale(container, topbarRef.current, stage);
    const nextScale = Math.abs(scale - minScale) < 0.001 ? nextMinScale : clamp(scale, nextMinScale, maxScale);
    apply(nextScale, preserveCenter, nextMinScale);
  }, [apply, containerRef, maxScale, minScale, scale, stage, topbarRef]);

  useLayoutEffect(() => {
    refresh(false);
  }, [refresh]);

  return useMemo(() => ({
    zoomIn: () => apply(scale + 0.1, true),
    zoomOut: () => apply(scale - 0.1, true),
    zoomFit: () => apply(minScale, false),
    setZoomPercent: (percent: number) => {
      if (!Number.isFinite(percent) || percent <= 0) {
        return false;
      }
      apply(percent / 100, true);
      return true;
    },
    refresh,
  }), [apply, minScale, refresh, scale]);
}

function getFitZoomScale(container: HTMLElement, topbar: HTMLElement | null, stage: StageData): number {
  const viewportMetrics = getViewportMetrics(container, topbar);
  const availableWidth = Math.max(viewportMetrics.availableWidth, 1);
  const availableHeight = Math.max(viewportMetrics.availableHeight, 1);
  const fitScale = Math.min(availableWidth / stage.stageWidth, availableHeight / stage.stageHeight, 1);
  return Math.max(fitScale, MIN_ZOOM_FLOOR);
}

function applyGraphZoom(container: HTMLElement, svg: SVGSVGElement, topbar: HTMLElement | null, stage: StageData, scale: number, preserveCenter: boolean): void {
  const previousScale = Number(svg.dataset.zoomScale || 1);
  const previousMarginLeft = Number(svg.dataset.marginLeft || 0);
  const previousMarginTop = Number(svg.dataset.marginTop || 0);
  const viewportMetrics = getViewportMetrics(container, topbar);
  const scaledWidth = stage.stageWidth * scale;
  const scaledHeight = stage.stageHeight * scale;
  const marginLeft = Math.max((viewportMetrics.availableWidth - scaledWidth) / 2, 0);
  const marginTop = viewportMetrics.safeTop + Math.max((viewportMetrics.availableHeight - scaledHeight) / 2, 0);
  const centerX = preserveCenter ? (container.scrollLeft + container.clientWidth / 2 - previousMarginLeft) / previousScale : stage.stageWidth / 2;
  const centerY = preserveCenter ? (container.scrollTop + container.clientHeight / 2 - previousMarginTop) / previousScale : stage.stageHeight / 2;

  svg.style.width = `${scaledWidth}px`;
  svg.style.height = `${scaledHeight}px`;
  svg.style.marginLeft = `${marginLeft}px`;
  svg.style.marginTop = `${marginTop}px`;
  svg.dataset.zoomScale = String(scale);
  svg.dataset.marginLeft = String(marginLeft);
  svg.dataset.marginTop = String(marginTop);

  container.scrollLeft = Math.max(centerX * scale + marginLeft - container.clientWidth / 2, 0);
  container.scrollTop = Math.max(centerY * scale + marginTop - container.clientHeight / 2, 0);
}

function getViewportMetrics(container: HTMLElement, topbar: HTMLElement | null) {
  const containerRect = container.getBoundingClientRect();
  const topbarRect = topbar ? topbar.getBoundingClientRect() : null;
  const safeTop = topbarRect ? Math.max(topbarRect.bottom - containerRect.top + 12, 0) : 0;
  const horizontalInset = 24;
  const bottomInset = 16;
  return {
    safeTop,
    availableWidth: container.clientWidth - horizontalInset * 2,
    availableHeight: container.clientHeight - safeTop - bottomInset,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
