"use client";

import React from "react";

type SpinnerProps = {
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
};

export function Spinner({ size = 16, stroke = 2, className, label }: SpinnerProps) {
  const s = Math.max(8, size);
  const w = Math.max(1, stroke);
  return (
    <span className={"spinner" + (className ? " " + className : "")} role="status" aria-label={label || "Loading"} style={{ width: s, height: s, borderWidth: w }} />
  );
}

export default Spinner;


