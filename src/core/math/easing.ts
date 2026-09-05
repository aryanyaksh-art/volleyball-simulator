export type EasingId = 'linear' | 'easeInOutQuad' | 'easeInOutCubic' | 'approachRamp';

export const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const linear = (u: number): number => u;
const easeInOutQuad = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const easeInOutCubic = (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
// Ease-in only: starts slow, accelerates hard toward the end. Used for
// attack approaches so the last two steps read as explosive.
const approachRamp = (u: number): number => u * u * u;

export const EASINGS: Record<EasingId, (u: number) => number> = {
  linear,
  easeInOutQuad,
  easeInOutCubic,
  approachRamp,
};

export const ease = (id: EasingId, u: number): number => EASINGS[id](clamp01(u));
