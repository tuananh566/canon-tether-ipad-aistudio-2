import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface ViewportBox {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

function getBoxFromTarget(el: EventTarget | null): ViewportBox | null {
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  return {
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
  };
}

function clampPan(pan: Point, zoom: number, box: ViewportBox | null): Point {
  if (zoom <= 1) return { x: 0, y: 0 };
  if (!box) return pan;
  const maxX = ((zoom - 1) * box.width) / 2 + 48;
  const maxY = ((zoom - 1) * box.height) / 2 + 48;
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  };
}

export function usePinchPan(minZoom = 1, maxZoom = 20) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const stageCleanupMapRef = useRef<Map<HTMLDivElement, () => void>>(new Map());
  const zoomRef = useRef(1);
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const boxRef = useRef<ViewportBox | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pointerDownMetaRef = useRef<Map<number, { x: number; y: number; time: number; pointerType: string }>>(
    new Map(),
  );
  const hadMultiTouchRef = useRef(false);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
    pan: Point;
    midOffsetX: number;
    midOffsetY: number;
  } | null>(null);

  const applyTransform = useCallback((nextZoom: number, nextPan: Point) => {
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const getMidpoint = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const zoomAtPoint = useCallback(
    (nextZoomRaw: number, clientX?: number, clientY?: number, box?: ViewportBox | null) => {
      const prevZoom = zoomRef.current;
      const prevPan = panRef.current;
      const nextZoom = Math.min(maxZoom, Math.max(minZoom, Number(nextZoomRaw.toFixed(3))));

      if (nextZoom <= 1) {
        applyTransform(1, { x: 0, y: 0 });
        return;
      }

      const activeBox = box ?? boxRef.current;
      if (activeBox && clientX !== undefined && clientY !== undefined) {
        const offsetX = clientX - activeBox.centerX;
        const offsetY = clientY - activeBox.centerY;
        const ratio = nextZoom / prevZoom;
        const rawPan = {
          x: offsetX - ratio * (offsetX - prevPan.x),
          y: offsetY - ratio * (offsetY - prevPan.y),
        };
        applyTransform(nextZoom, clampPan(rawPan, nextZoom, activeBox));
      } else {
        const ratio = nextZoom / prevZoom;
        const rawPan = {
          x: prevPan.x * ratio,
          y: prevPan.y * ratio,
        };
        applyTransform(nextZoom, clampPan(rawPan, nextZoom, activeBox));
      }
    },
    [applyTransform, maxZoom, minZoom],
  );

  const resetView = useCallback(() => {
    applyTransform(1, { x: 0, y: 0 });
  }, [applyTransform]);

  useEffect(() => {
    const map = stageCleanupMapRef.current;
    return () => {
      for (const cleanup of map.values()) cleanup();
      map.clear();
    };
  }, []);

  // Attach non-passive Safari/iPadOS gesture & trackpad wheel guards directly to each stage element
  const setStageRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      if (stageCleanupMapRef.current.has(el)) return;

      const preventSafariGesture = (e: Event) => {
        e.preventDefault();
      };

      const handleNativeWheel = (e: WheelEvent) => {
        e.preventDefault();
        const box = getBoxFromTarget(el);
        if (box) boxRef.current = box;

        // Trackpad pinch on iPadOS Magic Keyboard sends wheel events with ctrlKey: true
        const sensitivity = e.ctrlKey ? 0.01 : 0.0022;
        const factor = Math.exp(-e.deltaY * sensitivity);
        if (Math.abs(factor - 1) < 0.001) return;
        zoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY, box);
      };

      el.addEventListener('gesturestart', preventSafariGesture, { passive: false });
      el.addEventListener('gesturechange', preventSafariGesture, { passive: false });
      el.addEventListener('gestureend', preventSafariGesture, { passive: false });
      el.addEventListener('wheel', handleNativeWheel, { passive: false });

      stageCleanupMapRef.current.set(el, () => {
        el.removeEventListener('gesturestart', preventSafariGesture);
        el.removeEventListener('gesturechange', preventSafariGesture);
        el.removeEventListener('gestureend', preventSafariGesture);
        el.removeEventListener('wheel', handleNativeWheel);
      });
    },
    [zoomAtPoint],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const box = getBoxFromTarget(e.currentTarget);
    if (box) boxRef.current = box;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pointerDownMetaRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      pointerType: e.pointerType,
    });

    if (pointersRef.current.size >= 2) {
      hadMultiTouchRef.current = true;
    }

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const mid = getMidpoint(pts[0], pts[1]);
      const activeBox = boxRef.current;
      pinchStartRef.current = {
        distance: Math.max(10, getDistance(pts[0], pts[1])),
        zoom: zoomRef.current,
        pan: panRef.current,
        midOffsetX: activeBox ? mid.x - activeBox.centerX : 0,
        midOffsetY: activeBox ? mid.y - activeBox.centerY : 0,
      };
      draggingRef.current = false;
      setDragging(false);
      return;
    }

    if (pointersRef.current.size === 1 && zoomRef.current > 1) {
      draggingRef.current = true;
      setDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && pinchStartRef.current) {
        const pts = Array.from(pointersRef.current.values());
        const dist = getDistance(pts[0], pts[1]);
        const mid = getMidpoint(pts[0], pts[1]);
        const start = pinchStartRef.current;

        const nextZoom = Math.min(
          maxZoom,
          Math.max(minZoom, Number(((start.zoom * dist) / start.distance).toFixed(3))),
        );

        if (nextZoom <= 1) {
          applyTransform(1, { x: 0, y: 0 });
          return;
        }

        const box = boxRef.current;
        const currOffsetX = box ? mid.x - box.centerX : 0;
        const currOffsetY = box ? mid.y - box.centerY : 0;
        const ratio = nextZoom / start.zoom;

        const rawPan = {
          x: currOffsetX - ratio * (start.midOffsetX - start.pan.x),
          y: currOffsetY - ratio * (start.midOffsetY - start.pan.y),
        };
        applyTransform(nextZoom, clampPan(rawPan, nextZoom, box));
        return;
      }

      if (pointersRef.current.size === 1 && draggingRef.current) {
        const rawPan = {
          x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
          y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
        };
        const clamped = clampPan(rawPan, zoomRef.current, boxRef.current);
        panRef.current = clamped;
        setPan(clamped);
      }
    },
    [applyTransform, maxZoom, minZoom],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }

      const downMeta = pointerDownMetaRef.current.get(e.pointerId);
      pointerDownMetaRef.current.delete(e.pointerId);
      pointersRef.current.delete(e.pointerId);

      // Handle touch/pen double-tap reliably on iPadOS (where dblclick isn't always fired with touch-none)
      if (
        e.type === 'pointerup' &&
        downMeta &&
        downMeta.pointerType !== 'mouse' &&
        !hadMultiTouchRef.current &&
        pointersRef.current.size === 0
      ) {
        const now = performance.now();
        const moveDist = Math.hypot(e.clientX - downMeta.x, e.clientY - downMeta.y);
        if (moveDist < 14 && now - downMeta.time < 260) {
          const prevTap = lastTapRef.current;
          if (
            prevTap &&
            now - prevTap.time < 320 &&
            Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 32
          ) {
            lastTapRef.current = null;
            const box = getBoxFromTarget(e.currentTarget);
            if (box) boxRef.current = box;
            if (zoomRef.current > 1.05) {
              resetView();
            } else {
              zoomAtPoint(Math.min(maxZoom, 2.5), e.clientX, e.clientY, box);
            }
          } else {
            lastTapRef.current = { x: e.clientX, y: e.clientY, time: now };
          }
        } else {
          lastTapRef.current = null;
        }
      }

      if (pointersRef.current.size < 2) {
        pinchStartRef.current = null;
      }
      if (pointersRef.current.size === 1 && zoomRef.current > 1) {
        const remaining = Array.from(pointersRef.current.values())[0];
        dragStartRef.current = {
          x: remaining.x,
          y: remaining.y,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
        draggingRef.current = true;
        setDragging(true);
      } else if (pointersRef.current.size === 0) {
        hadMultiTouchRef.current = false;
        draggingRef.current = false;
        setDragging(false);
      }
    },
    [maxZoom, resetView, zoomAtPoint],
  );

  const zoomIn = useCallback(() => {
    zoomAtPoint(zoomRef.current + 0.5);
  }, [zoomAtPoint]);

  const zoomOut = useCallback(() => {
    zoomAtPoint(zoomRef.current - 0.5);
  }, [zoomAtPoint]);

  const onWheel = useCallback((_e: React.WheelEvent) => {
    // Handled via non-passive native wheel listener in useEffect
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const box = getBoxFromTarget(e.currentTarget);
      if (box) boxRef.current = box;

      if (zoomRef.current > 1.05) {
        resetView();
      } else {
        zoomAtPoint(Math.min(maxZoom, 2.5), e.clientX, e.clientY, box);
      }
    },
    [maxZoom, resetView, zoomAtPoint],
  );

  return {
    stageRef: setStageRef,
    zoom,
    pan,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onDoubleClick,
    zoomIn,
    zoomOut,
    resetView,
  };
}
