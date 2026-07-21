// The drifting background marks. Only the shape (and its order) lives here — the
// per-mark position, size, and animation timing are driven by `:nth-child`
// rules in marks.css, so this list must stay 14 entries in this exact order.
export type MarkShape = "sq" | "sqf" | "ln" | "pl" | "ang";

export const marks: MarkShape[] = [
  "sq",
  "sqf",
  "ln",
  "pl",
  "ang",
  "sqf",
  "sq",
  "pl",
  "ang",
  "ln",
  "sqf",
  "sq",
  "pl",
  "ang",
];
