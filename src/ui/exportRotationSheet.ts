import type { Side } from '@/core/court/coordinates';

const waitForFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load a captured rotation frame.'));
    img.src = dataUrl;
  });

export interface RotationSheetParams {
  canvas: HTMLCanvasElement;
  side: Side;
  teamLabel: string;
  currentRotation: number;
  setRotation: (side: Side, rotation: number) => void;
}

/**
 * Captures all six rotations of `side` as one labeled PNG grid — the plan's
 * "PNG rotation-sheet export". Relies on SceneRenderer's
 * `preserveDrawingBuffer` so `canvas.toDataURL()` reads back whatever was
 * last rendered; two rAFs after each rotation change give React and the
 * render loop time to actually redraw the new formation before capturing
 * (a single rAF can land between React's commit and the next draw call).
 */
export const exportRotationSheet = async ({ canvas, side, teamLabel, currentRotation, setRotation }: RotationSheetParams): Promise<void> => {
  const shots: string[] = [];
  for (let r = 0; r < 6; r++) {
    setRotation(side, r);
    await waitForFrame();
    shots.push(canvas.toDataURL('image/png'));
  }
  setRotation(side, currentRotation);

  const images = await Promise.all(shots.map(loadImage));
  const cellW = images[0].width;
  const cellH = images[0].height;
  const labelH = 40;
  const cols = 3;
  const rows = 2;

  const sheet = document.createElement('canvas');
  sheet.width = cellW * cols;
  sheet.height = (cellH + labelH) * rows;
  const ctx = sheet.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';

  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * (cellH + labelH);
    ctx.fillText(`${teamLabel}: R${i + 1}`, x + cellW / 2, y + 28);
    ctx.drawImage(img, x, y + labelH);
  });

  const link = document.createElement('a');
  link.download = `${teamLabel.replace(/\s+/g, '-').toLowerCase()}-rotation-sheet.png`;
  link.href = sheet.toDataURL('image/png');
  link.click();
};
