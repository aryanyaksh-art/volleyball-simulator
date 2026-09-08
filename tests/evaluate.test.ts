import { describe, expect, it } from 'vitest';
import { evaluateInto } from '@/core/play/evaluate';
import { createWorldState, type BallTrackSegment, type PlaySchedule } from '@/core/play/schedule';

const ballSeg = (startS: number, endS: number, x: number): BallTrackSegment => ({
  startS,
  endS,
  from: { x, y: 0, z: 0 },
  to: { x, y: 0, z: 0 },
  apexM: 2,
  apexU: 0.5,
  kind: 'pass',
});

const scheduleWithBallTrack = (ballTrack: BallTrackSegment[]): PlaySchedule => ({
  durationS: ballTrack.length ? ballTrack[ballTrack.length - 1].endS : 0,
  playerTracks: {},
  ballTrack,
  serveContactAtS: null,
});

describe('evaluateInto — gaps between segments', () => {
  it('holds at the most recently-completed segment during a gap, not the last segment in the whole track', () => {
    // Segment 0 covers [0, 1] at x=0; there's a gap [1, 3] before segment 1
    // covers [3, 4] at x=100. A later segment 2 covers [10, 11] at x=999 —
    // if evaluate ever falls back to "the last segment in the array" during
    // the gap, it'll wrongly report x=999 instead of holding at x=0.
    const schedule = scheduleWithBallTrack([ballSeg(0, 1, 0), ballSeg(3, 4, 100), ballSeg(10, 11, 999)]);
    const world = createWorldState();

    evaluateInto(schedule, 2, world); // squarely inside the gap
    expect(world.ball.worldPos.x).toBe(0); // holds at segment 0's end, not segment 2's position
  });

  it('picks up the next segment correctly once its own start time arrives', () => {
    const schedule = scheduleWithBallTrack([ballSeg(0, 1, 0), ballSeg(3, 4, 100)]);
    const world = createWorldState();

    evaluateInto(schedule, 3, world);
    expect(world.ball.worldPos.x).toBe(100);
  });

  it('still clamps to the first segment when t precedes everything', () => {
    const schedule = scheduleWithBallTrack([ballSeg(5, 6, 42)]);
    const world = createWorldState();

    evaluateInto(schedule, 0, world);
    expect(world.ball.worldPos.x).toBe(42);
  });

  it('still clamps to the last segment when t is after everything', () => {
    const schedule = scheduleWithBallTrack([ballSeg(0, 1, 0), ballSeg(3, 4, 100)]);
    const world = createWorldState();

    evaluateInto(schedule, 10, world);
    expect(world.ball.worldPos.x).toBe(100);
  });
});
