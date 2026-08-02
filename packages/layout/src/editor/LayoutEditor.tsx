import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Moveable from "react-moveable";
import Selecto from "react-selecto";

import {
  MIN_RECT_SIZE,
  clampRect,
  rectsEqual,
  roundRect,
} from "../geometry/rect";
import { PixelBox, pxToRect, rectToPx } from "../geometry/scale";
import { Stage } from "../react/Stage";
import { useStage } from "../react/StageContext";
import { DEFAULT_ASPECT_RATIO } from "../schema/defaults";
import { AspectRatio, LayoutFitMode } from "../schema/document";
import { Rect } from "../schema/rect";

export type EditorItem = {
  id: string;
  rect: Rect;
  locked?: boolean;
};

export type RectChange = { id: string; rect: Rect };

export type LayoutEditorProps<T extends EditorItem> = {
  items: T[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Fired once per gesture, on release */
  onChange: (changes: RectChange[]) => void;
  renderItem: (item: T, state: { selected: boolean }) => ReactNode;
  aspectRatio?: AspectRatio;
  fitMode?: LayoutFitMode;
  background?: string;
  className?: string;
  /** Percent moved per arrow key press; Shift multiplies by 10. */
  nudgeStep?: number;
};

type Frame = { tx: number; ty: number; w: number; h: number };

const ITEM_CLASS = "lay--editor-item";

export const LayoutEditor = <T extends EditorItem>({
  aspectRatio = DEFAULT_ASPECT_RATIO,
  fitMode = "fluid",
  background,
  className,
  ...rest
}: LayoutEditorProps<T>) => (
  // The border lives here
  <div className={className ? `lay--editor ${className}` : "lay--editor"}>
    <Stage
      aspectRatio={aspectRatio}
      fitMode={fitMode}
      sizing="aspect"
      background={background}
    >
      <EditorSurface {...rest} />
    </Stage>
  </div>
);

type SurfaceProps<T extends EditorItem> = Omit<
  LayoutEditorProps<T>,
  "aspectRatio" | "fitMode" | "background" | "className"
>;

const EditorSurface = <T extends EditorItem>({
  items,
  selectedIds,
  onSelectionChange,
  onChange,
  renderItem,
  nudgeStep = 0.5,
}: SurfaceProps<T>) => {
  const metrics = useStage();
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const framesRef = useRef(new Map<string, Frame>());
  const startRectsRef = useRef(new Map<string, Rect>());

  // Ref callbacks must be stable per id. An inline arrow gets a fresh identity
  // each render, so React detaches (null) and reattaches every pass, and any
  // state update from inside that would loop forever.
  const refCallbacksRef = useRef(
    new Map<string, (node: HTMLElement | null) => void>(),
  );

  const nodeRef = useCallback((id: string) => {
    const cached = refCallbacksRef.current.get(id);
    if (cached) return cached;
    const callback = (node: HTMLElement | null) => {
      if (node) nodesRef.current.set(id, node);
      else nodesRef.current.delete(id);
    };
    refCallbacksRef.current.set(id, callback);
    return callback;
  }, []);

  const itemsById = useMemo(() => {
    const map = new Map<string, T>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const selectableIds = useMemo(
    () => selectedIds.filter((id) => !itemsById.get(id)?.locked),
    [selectedIds, itemsById],
  );

  // Nodes exist only after commit, so target resolution runs in an effect. The
  // identity guard is what stops setState here from re-triggering itself.
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [guidelines, setGuidelines] = useState<HTMLElement[]>([]);

  useEffect(() => {
    const resolve = (ids: string[]) =>
      ids
        .map((id) => nodesRef.current.get(id))
        .filter((node): node is HTMLElement => !!node);

    const same = (a: HTMLElement[], b: HTMLElement[]) =>
      a.length === b.length && a.every((node, i) => node === b[i]);

    const nextTargets = resolve(selectableIds);
    const nextGuidelines = resolve(
      items.filter((item) => !selectedIds.includes(item.id)).map((i) => i.id),
    );

    setTargets((prev) => (same(prev, nextTargets) ? prev : nextTargets));
    setGuidelines((prev) =>
      same(prev, nextGuidelines) ? prev : nextGuidelines,
    );

    for (const id of refCallbacksRef.current.keys()) {
      if (!itemsById.has(id)) refCallbacksRef.current.delete(id);
    }
  }, [selectableIds, selectedIds, items, itemsById, surface]);

  const moveableRef = useRef<Moveable>(null);

  useEffect(() => {
    moveableRef.current?.updateRect();
  }, [items, metrics, targets]);

  const idOf = (el: HTMLElement | SVGElement): string | null =>
    (el as HTMLElement).dataset?.layId ?? null;

  const beginGesture = useCallback(
    (elements: (HTMLElement | SVGElement)[]) => {
      framesRef.current.clear();
      startRectsRef.current.clear();
      for (const el of elements) {
        const id = idOf(el);
        const item = id ? itemsById.get(id) : null;
        if (!id || !item) continue;
        const px = rectToPx(item.rect, metrics);
        framesRef.current.set(id, {
          tx: 0,
          ty: 0,
          w: px.width,
          h: px.height,
        });
        startRectsRef.current.set(id, item.rect);
      }
    },
    [itemsById, metrics],
  );

  const applyFrame = (el: HTMLElement | SVGElement, frame: Frame) => {
    const style = (el as HTMLElement).style;
    style.transform = `translate(${frame.tx}px, ${frame.ty}px)`;
    style.width = `${frame.w}px`;
    style.height = `${frame.h}px`;
  };

  const commitGesture = useCallback(() => {
    const changes: RectChange[] = [];

    for (const [id, frame] of framesRef.current) {
      const startRect = startRectsRef.current.get(id);
      if (!startRect) continue;

      const startPx = rectToPx(startRect, metrics);
      const finalPx: PixelBox = {
        left: startPx.left + frame.tx,
        top: startPx.top + frame.ty,
        width: frame.w,
        height: frame.h,
      };
      const rect = roundRect(clampRect(pxToRect(finalPx, metrics)));
      const changed = !rectsEqual(rect, startRect);
      if (changed) changes.push({ id, rect });

      // Write the resolved geometry back rather than clearing it. React diffs
      // against its previous props, so on an unchanged dimension it skips the
      // DOM write. Clearing to "" would leave the element sized to content.
      const node = nodesRef.current.get(id);
      if (node) {
        const px = rectToPx(changed ? rect : startRect, metrics);
        node.style.transform = "";
        node.style.left = `${px.left}px`;
        node.style.top = `${px.top}px`;
        node.style.width = `${px.width}px`;
        node.style.height = `${px.height}px`;
      }
    }

    framesRef.current.clear();
    startRectsRef.current.clear();

    if (changes.length > 0) onChange(changes);
  }, [metrics, onChange]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const changes: RectChange[] = [];
      for (const id of selectableIds) {
        const item = itemsById.get(id);
        if (!item) continue;
        changes.push({
          id,
          rect: roundRect(
            clampRect({
              ...item.rect,
              x: item.rect.x + dx,
              y: item.rect.y + dy,
            }),
          ),
        });
      }
      if (changes.length > 0) onChange(changes);
    },
    [selectableIds, itemsById, onChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? nudgeStep * 10 : nudgeStep;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move || selectableIds.length === 0) return;
    event.preventDefault();
    nudge(move[0], move[1]);
  };

  return (
    <div
      ref={setSurface}
      className="lay--editor-surface"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const px = rectToPx(item.rect, metrics);
        const selected = selectedIds.includes(item.id);
        return (
          <div
            key={item.id}
            data-lay-id={item.id}
            className={
              selected ? `${ITEM_CLASS} ${ITEM_CLASS}--selected` : ITEM_CLASS
            }
            ref={nodeRef(item.id)}
            style={{
              left: px.left,
              top: px.top,
              width: px.width,
              height: px.height,
            }}
          >
            {renderItem(item, { selected })}
          </div>
        );
      })}

      <Moveable
        ref={moveableRef}
        target={targets}
        draggable
        resizable
        snappable
        origin={false}
        keepRatio={false}
        edge={false}
        throttleDrag={0}
        throttleResize={0}
        elementGuidelines={guidelines}
        snapThreshold={5}
        // `css` bounds are insets from the container edges, not coordinates.
        // all-zero means "exactly the container box".
        bounds={{ left: 0, top: 0, right: 0, bottom: 0, position: "css" }}
        onDragStart={({ target, set }) => {
          beginGesture([target]);
          set([0, 0]);
        }}
        onDrag={({ target, beforeTranslate }) => {
          const id = idOf(target);
          const frame = id ? framesRef.current.get(id) : null;
          if (!frame) return;
          frame.tx = beforeTranslate[0] ?? 0;
          frame.ty = beforeTranslate[1] ?? 0;
          applyFrame(target, frame);
        }}
        onDragEnd={commitGesture}
        onDragGroupStart={({ events }) => {
          beginGesture(events.map((e) => e.target));
          for (const e of events) e.set([0, 0]);
        }}
        onDragGroup={({ events }) => {
          for (const e of events) {
            const id = idOf(e.target);
            const frame = id ? framesRef.current.get(id) : null;
            if (!frame) continue;
            frame.tx = e.beforeTranslate[0] ?? 0;
            frame.ty = e.beforeTranslate[1] ?? 0;
            applyFrame(e.target, frame);
          }
        }}
        onDragGroupEnd={commitGesture}
        onResizeStart={({ target, setOrigin, dragStart }) => {
          beginGesture([target]);
          setOrigin(["%", "%"]);
          // Typed `false | OnDragStart`, so `?.` does not narrow it.
          if (dragStart) dragStart.set([0, 0]);
        }}
        onResize={({ target, width, height, drag }) => {
          const id = idOf(target);
          const frame = id ? framesRef.current.get(id) : null;
          if (!frame) return;
          frame.w = Math.max(width, (MIN_RECT_SIZE / 100) * metrics.boxWidth);
          frame.h = Math.max(height, (MIN_RECT_SIZE / 100) * metrics.boxHeight);
          frame.tx = drag.beforeTranslate[0] ?? 0;
          frame.ty = drag.beforeTranslate[1] ?? 0;
          applyFrame(target, frame);
        }}
        onResizeEnd={commitGesture}
        onResizeGroupStart={({ events }) => {
          beginGesture(events.map((e) => e.target));
          for (const e of events) {
            e.setOrigin(["%", "%"]);
            if (e.dragStart) e.dragStart.set([0, 0]);
          }
        }}
        onResizeGroup={({ events }) => {
          for (const e of events) {
            const id = idOf(e.target);
            const frame = id ? framesRef.current.get(id) : null;
            if (!frame) continue;
            frame.w = e.width;
            frame.h = e.height;
            frame.tx = e.drag.beforeTranslate[0] ?? 0;
            frame.ty = e.drag.beforeTranslate[1] ?? 0;
            applyFrame(e.target, frame);
          }
        }}
        onResizeGroupEnd={commitGesture}
      />

      {surface && (
        <Selecto
          dragContainer={surface}
          rootContainer={surface}
          boundContainer={surface}
          selectableTargets={[`.${ITEM_CLASS}`]}
          hitRate={0}
          selectByClick
          selectFromInside={false}
          toggleContinueSelect="shift"
          preventDragFromInside={false}
          onDragStart={(e) => {
            const target = e.inputEvent.target as HTMLElement;
            // Let Moveable own the gesture when it starts on its control box or
            // on an already-selected item, otherwise a drag becomes a marquee.
            if (
              target.closest(".moveable-control-box") ||
              selectedIds.some((id) =>
                nodesRef.current.get(id)?.contains(target),
              )
            ) {
              e.stop();
            }
          }}
          onSelectEnd={(e) => {
            const ids = e.selected
              .map((el) => idOf(el as HTMLElement))
              .filter((id): id is string => !!id);
            onSelectionChange(ids);
          }}
        />
      )}
    </div>
  );
};
