// src/components/stats/ui/cx.ts
// Tiny classnames joiner — filters falsy values.
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');
