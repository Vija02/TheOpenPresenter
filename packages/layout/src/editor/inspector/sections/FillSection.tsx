import { ReactNode, useState } from "react";
import { LuArrowLeftRight, LuMinus, LuPlus } from "react-icons/lu";

import { setElementFill } from "../../../doc/edit";
import { paintToCss } from "../../../react/css";
import {
  LinearGradientPaint,
  Paint,
  solidPaint,
  sortGradientStops,
} from "../../../schema/paint";
import {
  ColorField,
  CompactNumberField,
  GradientBar,
  GradientStop,
  NumberField,
  Row,
  Section,
  ToggleGroupField,
  colorAt,
  roundOffset,
} from "../primitives";
import { SectionProps } from "./types";

type FillMode = "none" | "solid" | "linearGradient";

const MODES = [
  { value: "none" as const, label: "None" },
  { value: "solid" as const, label: "Solid" },
  { value: "linearGradient" as const, label: "Gradient" },
];

const DEFAULT_COLOR = "#000000";

const toPercent = (offset: number) => Math.round(offset * 100);
const fromPercent = (percent: number) => roundOffset(percent / 100);

const modeOf = (fill: Paint | null): FillMode => fill?.type ?? "none";

/** Carries the colours across a mode change rather than resetting. */
const convert = (fill: Paint | null, mode: FillMode): Paint | null => {
  if (mode === "none") return null;

  const firstColor =
    fill?.type === "solid"
      ? fill.color
      : (fill?.stops[0]?.color ?? DEFAULT_COLOR);

  if (mode === "solid") return solidPaint(firstColor);

  if (fill?.type === "linearGradient") return fill;
  return {
    type: "linearGradient",
    angle: 180,
    stops: [
      { offset: 0, color: firstColor },
      { offset: 1, color: "#ffffff" },
    ],
    opacity: 1,
  };
};

const IconButton = ({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className="grid size-6 shrink-0 place-items-center rounded text-secondary hover:bg-surface-secondary-hover disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {children}
  </button>
);

export const FillSection = ({
  doc,
  element,
  onChange,
  title = "Fill",
}: SectionProps & { title?: string }) => {
  const fill = element.fill;
  const [selected, setSelected] = useState(0);

  const set = (next: Paint | null) =>
    onChange(setElementFill(doc, element.id, next));

  return (
    <Section title={title}>
      <Row label="Type">
        <ToggleGroupField
          value={modeOf(fill)}
          onChange={(next) => set(convert(fill, next))}
          options={MODES}
        />
      </Row>

      {fill?.type === "solid" && (
        <Row label="Colour">
          <ColorField
            alpha
            value={fill.color}
            onChange={(v) => set(solidPaint(v))}
          />
        </Row>
      )}

      {fill?.type === "linearGradient" && (
        <GradientControls
          fill={fill}
          selected={selected}
          onSelect={setSelected}
          onChange={set}
        />
      )}
    </Section>
  );
};

const GradientControls = ({
  fill,
  selected,
  onSelect,
  onChange,
}: {
  fill: LinearGradientPaint;
  selected: number;
  onSelect: (index: number) => void;
  onChange: (next: LinearGradientPaint) => void;
}) => {
  const stops = fill.stops;
  // Removing the last stop would otherwise leave the selection out of range.
  const selectedIndex = Math.min(selected, stops.length - 1);

  const writeStops = (next: GradientStop[]) =>
    onChange({ ...fill, stops: sortGradientStops(next) });

  /** Returns the moved stop's index after sorting, so a drag can follow it. */
  const moveStop = (index: number, offset: number): number => {
    const next = stops.map((s, j) => (j === index ? { ...s, offset } : s));
    const moved = next[index];
    const sorted = sortGradientStops(next);
    onChange({ ...fill, stops: sorted });
    // The sort copies the array but keeps the stop objects, so identity holds.
    return moved ? sorted.indexOf(moved) : index;
  };

  const addStop = (offset: number): number => {
    const stop = { offset, color: colorAt(stops, offset) };
    const sorted = sortGradientStops([...stops, stop]);
    onChange({ ...fill, stops: sorted });
    return sorted.indexOf(stop);
  };

  /** Lands the new stop in the widest gap, where it is visible and useful. */
  const addStopInLargestGap = () => {
    const sorted = sortGradientStops(stops);
    let at = 0.5;
    let widest = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (!a || !b) continue;
      const gap = b.offset - a.offset;
      if (gap > widest) {
        widest = gap;
        at = a.offset + gap / 2;
      }
    }
    onSelect(addStop(roundOffset(at)));
  };

  const reverse = () =>
    writeStops(stops.map((s) => ({ ...s, offset: roundOffset(1 - s.offset) })));

  return (
    <>
      <GradientBar
        stops={stops}
        selected={selectedIndex}
        onSelect={onSelect}
        onMove={moveStop}
        onAdd={addStop}
      />

      <Row label="Angle">
        <div className="flex items-center gap-1.5">
          <NumberField
            value={fill.angle}
            min={0}
            max={360}
            step={15}
            onChange={(angle) => onChange({ ...fill, angle })}
          />
          <div
            aria-hidden
            title="Preview"
            className="size-8 shrink-0 rounded border border-stroke"
            style={{ background: paintToCss(fill) }}
          />
        </div>
      </Row>

      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary">Stops</span>
        <div className="flex items-center gap-0.5">
          <IconButton onClick={reverse} label="Reverse the gradient">
            <LuArrowLeftRight />
          </IconButton>
          <IconButton onClick={addStopInLargestGap} label="Add a stop">
            <LuPlus />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        {stops.map((stop, index) => (
          <div
            key={index}
            onPointerDown={() => onSelect(index)}
            className={`lay--gradient-row grid grid-cols-[1fr_auto_auto] items-center gap-1.5 rounded px-1 py-1 ${
              index === selectedIndex
                ? "bg-surface-tertiary"
                : "hover:bg-surface-secondary"
            }`}
          >
            <ColorField
              alpha
              value={stop.color}
              onChange={(color) =>
                writeStops(
                  stops.map((s, j) => (j === index ? { ...s, color } : s)),
                )
              }
            />

            <CompactNumberField
              value={toPercent(stop.offset)}
              min={0}
              max={100}
              suffix="%"
              label={`Stop ${index + 1} position`}
              onChange={(percent) => moveStop(index, fromPercent(percent))}
            />
            <IconButton
              disabled={stops.length <= 2}
              onClick={() => writeStops(stops.filter((_, j) => j !== index))}
              label={`Remove stop ${index + 1}`}
            >
              <LuMinus />
            </IconButton>
          </div>
        ))}
      </div>
    </>
  );
};
