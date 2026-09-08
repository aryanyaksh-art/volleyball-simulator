import { useMemo, useState } from 'react';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { useLineupStore } from '@/app/store/useLineupStore';
import { compilePlay } from '@/core/play/compile';
import type { Play } from '@/core/play/types';

function editorBakeContext() {
  const { rosters, lineups, positionOverrides } = useLineupStore.getState();
  return { rosters, lineups, positions: positionOverrides };
}

/**
 * A proper browse/manage view for saved plays — previously the only way to
 * see them was the flat option list in TransportBar's play dropdown, with
 * no rename and no at-a-glance sense of size/length. Reuses the compiled
 * schedule's own durationS (and step count straight off the Play) rather
 * than inventing a separate summary format.
 */
export function PlayLibraryPanel() {
  const savedPlays = usePlayEditorStore((s) => s.savedPlays);
  const loadPlay = usePlayEditorStore((s) => s.loadPlay);
  const deleteSavedPlay = usePlayEditorStore((s) => s.deleteSavedPlay);
  const renamePlay = usePlayEditorStore((s) => s.renamePlay);
  const setMode = usePlaybackStore((s) => s.setMode);
  const setSelectedPlayId = usePlaybackStore((s) => s.setSelectedPlayId);

  const rosters = useLineupStore((s) => s.rosters);
  const lineups = useLineupStore((s) => s.lineups);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const plays = useMemo(() => Object.values(savedPlays), [savedPlays]);

  const summaries = useMemo(() => {
    const out: Record<string, { steps: number; durationS: number }> = {};
    for (const play of plays) {
      try {
        const schedule = compilePlay(play, { rosters, lineups });
        out[play.id] = { steps: play.steps.length, durationS: schedule.durationS };
      } catch {
        out[play.id] = { steps: play.steps.length, durationS: 0 };
      }
    }
    return out;
  }, [plays, rosters, lineups]);

  const startRename = (play: Play) => {
    setRenamingId(play.id);
    setRenameValue(play.name);
  };

  const confirmRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) renamePlay(id, trimmed);
    setRenamingId(null);
  };

  const editPlay = (play: Play) => {
    loadPlay(play, editorBakeContext());
    setMode('author');
  };

  const watchPlay = (play: Play) => {
    setSelectedPlayId(play.id);
    setMode('play');
  };

  return (
    <div className="panel">
      <h3 className="panel-title">Play library</h3>
      {plays.length === 0 ? (
        <p className="panel-note">No saved plays yet. Build one in Design play, then Save play.</p>
      ) : (
        <table className="panel-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Steps</th>
              <th>Duration</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plays.map((play) => {
              const summary = summaries[play.id];
              return (
                <tr key={play.id}>
                  <td>
                    {renamingId === play.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => confirmRename(play.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename(play.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                      />
                    ) : (
                      <button className="chip chip-small" onClick={() => startRename(play)} title="Rename">
                        {play.name}
                      </button>
                    )}
                  </td>
                  <td>{summary?.steps ?? play.steps.length}</td>
                  <td>{(summary?.durationS ?? 0).toFixed(1)}s</td>
                  <td>
                    <div className="control-group">
                      <button className="chip chip-small" onClick={() => editPlay(play)}>
                        Edit
                      </button>
                      <button className="chip chip-small" onClick={() => watchPlay(play)}>
                        Play
                      </button>
                      <button className="chip chip-small" onClick={() => deleteSavedPlay(play.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
