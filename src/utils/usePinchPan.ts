import type React from 'react';
import { useCallback, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

export function usePinchPan(minZoom = 1, maxZoom = 4) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const pointersRef = useRef<Map<number, Point>>(new Map());
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);

  const getDistance = (a: Point, b: Point) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        pinchStartRef.current = {
          distance: Math.max(10, getDistance(pts[0], pts[1])),
          zoom,
        };
        setDragging(false);
        return;
      }

      if (pointersRef.current.size === 1 && zoom > 1) {
        setDragging(true);
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    },
    [zoom, pan],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && pinchStartRef.current) {
        const pts = Array.from(pointersRef.current.values());
        const dist = getDistance(pts[0], pts[1]);
        const nextZoom = Math.min(
          maxZoom,
          Math.max(minZoom, Number(((pinchStartRef.current.zoom * dist) / pinchStartRef.current.distance).toFixed(2))),
        );
        setZoom(nextZoom);
        if (nextZoom <= 1) setPan({ x: 0, y: 0 });
        return;
      }

      if (pointersRef.current.size === 1 && dragging) {
        setPan({
          x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
          y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
        });
      }
    },
    [dragging, maxZoom, minZoom],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      setDragging(false);
    }
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(maxZoom, Number((z + 0.5).toFixed(1))));
  }, [maxZoom]);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(minZoom, Number((z - 0.5).toFixed(1)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, [minZoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const delta = -e.deltaY * 0.0025;
      if (Math.abs(delta) < 0.001) return;
      setZoom((z) => {
        const next = Math.min(maxZoom, Math.max(minZoom, Number((z + delta).toFixed(2))));
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    },
    [maxZoom, minZoom],
  );

  const onDoubleClick = useCallback(() => {
    setZoom((z) => {
      if (z > 1) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return Math.min(maxZoom, 2.5);
    });
  }, [maxZoom]);

  return {
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
