import { useEffect, useRef, useState } from "react";

const ROW_HEIGHT = 40;
const VALUES = 60;

const wrap = (value: number, values = VALUES) => ((value % values) + values) % values;
const format = (value: number) => String(value).padStart(2, "0");

interface WheelColumnProps {
  label: string;
  index: number;
  onChange: (index: number) => void;
  values?: number;
}

/**
 * One fully controlled wheel column. Selection is pure state: the middle
 * row always renders the selected value and never moves. Previous/next
 * values wrap naturally between 00 and 59.
 */
/** Max pointer travel (px) for a press to count as a tap, not a drag. */
const CLICK_SLOP_PX = 6;

function WheelColumn({ label, index, onChange, values = VALUES }: WheelColumnProps) {
  const rowsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    baseIndex: number;
    appliedSteps: number;
    maxDelta: number;
    downRow: number;
  } | null>(null);

  const [dir, setDir] = useState(1);

  const change = (delta: number) => {
    setDir(delta);
    onChange(wrap(index + delta, values));
  };

  // Non-passive wheel listener so we can preventDefault page scrolling.
  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      change(e.deltaY < 0 ? -1 : 1);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // No preventDefault(): pointer capture on this container redirects the
    // compatibility click event here anyway, so cell onClick handlers can
    // never fire. Tap selection is therefore handled in endDrag instead.
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const row = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      baseIndex: index,
      appliedSteps: 0,
      maxDelta: 0,
      downRow: Math.min(2, Math.max(0, row)),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    // Dragging up (clientY shrinks) increases the value; down decreases.
    const steps = Math.round((drag.startY - e.clientY) / ROW_HEIGHT);
    drag.maxDelta = Math.max(drag.maxDelta, Math.abs(e.clientY - drag.startY));
    if (steps !== drag.appliedSteps) {
      const delta = steps - drag.appliedSteps;
      drag.appliedSteps = steps;
      change(delta);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // A press with almost no movement is a tap: select the row that was
    // under the pointer (top row = previous value, bottom = next value).
    if (drag.maxDelta <= CLICK_SLOP_PX) {
      if (drag.downRow === 0) change(-1);
      else if (drag.downRow === 2) change(1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      change(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      change(-1);
    }
  };

  const prev = wrap(index - 1, values);
  const next = wrap(index + 1, values);

  return (
    <div className="wheel-column">
      <span className="wheel-label">{label}</span>
      <div
        ref={rowsRef}
        className="wheel-rows"
        style={{ height: ROW_HEIGHT * 3 }}
        tabIndex={0}
        role="spinbutton"
        aria-label={label}
        aria-valuenow={index}
        aria-valuetext={format(index)}
        aria-valuemin={0}
        aria-valuemax={values - 1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        <div className="wheel-cell">
          <span
            key={`p${prev}`}
            className={dir > 0 ? "wheel-value from-below" : "wheel-value from-above"}
          >
            {format(prev)}
          </span>
        </div>
        <div className="wheel-cell selected">
          <span
            key={`s${index}`}
            className={dir > 0 ? "wheel-value from-below" : "wheel-value from-above"}
          >
            {format(index)}
          </span>
        </div>
        <div className="wheel-cell">
          <span
            key={`n${next}`}
            className={dir > 0 ? "wheel-value from-below" : "wheel-value from-above"}
          >
            {format(next)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface WheelPickerProps {
  hours?: number;
  minutes: number;
  seconds: number;
  onHoursChange?: (hours: number) => void;
  onMinutesChange: (minutes: number) => void;
  onSecondsChange: (seconds: number) => void;
}

/** Compact two-column (minutes / seconds) wheel picker, no scrolling. */
export function WheelPicker({
  hours,
  minutes,
  seconds,
  onHoursChange,
  onMinutesChange,
  onSecondsChange,
}: WheelPickerProps) {
  return (
    <div className="wheel-picker">
      <div className="wheel-band" aria-hidden="true" />
      {hours !== undefined && onHoursChange && (
        <>
          <WheelColumn
            label="hr"
            index={hours}
            values={24}
            onChange={onHoursChange}
          />
          <div className="wheel-colon">:</div>
        </>
      )}
      <WheelColumn
        label="min"
        index={minutes}
        onChange={onMinutesChange}
      />
      <div className="wheel-colon">:</div>
      <WheelColumn
        label="sec"
        index={seconds}
        onChange={onSecondsChange}
      />
    </div>
  );
}
