export function add(a: number, b: number): number {
  return a + b;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const average = (values: number[]): number => {
  if (values.length === 0) throw new Error('average of an empty list');
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};
