/** Shared drag payload for moving a roster player between the bench and an on-court slot. */
export const PLAYER_DRAG_MIME = 'application/x-vb-player';

export interface PlayerDragPayload {
  source: 'bench' | 'slot';
  playerId: string;
  /** Present when source is 'slot' — which serve-order slot they were dragged from. */
  slot?: number;
}

export const writePlayerDragPayload = (dataTransfer: DataTransfer, payload: PlayerDragPayload): void => {
  dataTransfer.setData(PLAYER_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.effectAllowed = 'move';
};

export const readPlayerDragPayload = (dataTransfer: DataTransfer): PlayerDragPayload | null => {
  const raw = dataTransfer.getData(PLAYER_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerDragPayload;
  } catch {
    return null;
  }
};

export const isPlayerDrag = (dataTransfer: DataTransfer): boolean => dataTransfer.types.includes(PLAYER_DRAG_MIME);
