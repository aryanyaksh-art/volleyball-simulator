import type { Theme } from './Theme';

/**
 * Structural direction from the user's reference (black background, faint
 * grid, line-art court, flat-filled figures) as one preset among several —
 * the palette is the user's call, not hardcoded. Every theme here follows
 * the same shape so the theme switcher can swap between them freely.
 */
const blueprint: Theme = {
  id: 'blueprint',
  label: 'Blueprint',
  background: '#05070a',
  grid: { visible: true, color: '#8fa3b8', opacity: 0.08, spacingM: 1 },
  court: { mode: 'lineArt', lineColor: '#eef2f5', lineWidthM: 0.05 },
  net: { meshColor: '#c9d3da', bandColor: '#ffffff', bottomBandColor: '#15181c', postColor: '#1f5fbf', opacity: 0.55 },
  antenna: { colorA: '#ff3b30', colorB: '#eef2f5', dashed: true },
  teams: {
    A: { body: '#39ff6a', accent: '#1fbf4d', label: 'Team A' },
    B: { body: '#33c7ff', accent: '#1f9fd6', label: 'Team B' },
  },
  ball: { color: '#ffd23f', trailColor: '#ffe9a8' },
  liberoColor: '#ffffff',
  benchColor: '#4a5058',
  overlays: {
    violation: '#ff3b30',
    responsibility: ['#39ff6a', '#33c7ff', '#ffd23f', '#ff8fd8'],
    seam: '#ffd23f',
    blockShadow: '#ff3b30',
    approachLane: '#39ff6a',
    openCone: '#33c7ff',
  },
  bloom: { enabled: false, strength: 0 },
  groundShadow: { enabled: true, opacity: 0.35 },
};

const court: Theme = {
  id: 'court',
  label: 'Court',
  background: '#1b1d21',
  grid: { visible: false, color: '#ffffff', opacity: 0.05, spacingM: 1 },
  court: {
    mode: 'solidFloor',
    lineColor: '#f5f5f0',
    lineWidthM: 0.05,
    floorColor: '#c98a4b',
    attackZoneColor: '#b97b3f',
  },
  net: { meshColor: '#f5f5f0', bandColor: '#ffffff', bottomBandColor: '#101113', postColor: '#1a3d7c', opacity: 0.85 },
  antenna: { colorA: '#d1495b', colorB: '#f5f5f0', dashed: true },
  teams: {
    A: { body: '#d1495b', accent: '#9c2f3e', label: 'Team A' },
    B: { body: '#1f6feb', accent: '#194f9e', label: 'Team B' },
  },
  ball: { color: '#f2b134', trailColor: '#f7d38a' },
  liberoColor: '#ffffff',
  benchColor: '#4a5058',
  overlays: {
    violation: '#ff5c4d',
    responsibility: ['#d1495b', '#1f6feb', '#f2b134', '#7bd389'],
    seam: '#f2b134',
    blockShadow: '#ff5c4d',
    approachLane: '#7bd389',
    openCone: '#1f6feb',
  },
  bloom: { enabled: false, strength: 0 },
  groundShadow: { enabled: true, opacity: 0.25 },
};

const whiteboard: Theme = {
  id: 'whiteboard',
  label: 'Whiteboard',
  background: '#f5f5f2',
  grid: { visible: true, color: '#c7c7c0', opacity: 0.4, spacingM: 1 },
  court: { mode: 'lineArt', lineColor: '#26282b', lineWidthM: 0.04 },
  net: { meshColor: '#4a4d52', bandColor: '#101113', bottomBandColor: '#101113', postColor: '#2b3a55', opacity: 0.7 },
  antenna: { colorA: '#d62828', colorB: '#26282b', dashed: true },
  teams: {
    A: { body: '#14213d', accent: '#3a5a9a', label: 'Team A' },
    B: { body: '#8f2d56', accent: '#c25b7f', label: 'Team B' },
  },
  ball: { color: '#f2542d', trailColor: '#f7a58a' },
  liberoColor: '#101113',
  benchColor: '#9a9a94',
  overlays: {
    violation: '#d62828',
    responsibility: ['#14213d', '#8f2d56', '#f2542d', '#2a9d8f'],
    seam: '#f2542d',
    blockShadow: '#d62828',
    approachLane: '#2a9d8f',
    openCone: '#3a5a9a',
  },
  bloom: { enabled: false, strength: 0 },
  groundShadow: { enabled: false, opacity: 0 },
};

export const THEME_PRESETS: Record<string, Theme> = { blueprint, court, whiteboard };
export const DEFAULT_THEME_ID = 'blueprint';
