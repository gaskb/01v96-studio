import React from 'react';

export const handleSliderWheel = (
  e: React.WheelEvent<HTMLInputElement>,
  current: number,
  min: number,
  max: number,
  step: number,
  onChange: (val: number) => void
) => {
  e.preventDefault();
  e.stopPropagation();
  const dir = e.deltaY < 0 ? 1 : -1;
  const next = Math.max(min, Math.min(max, current + dir * step));
  if (next !== current) {
    onChange(next);
  }
};
