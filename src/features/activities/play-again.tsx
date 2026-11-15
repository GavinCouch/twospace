"use client";

import { RotateCcw } from "lucide-react";
import { useAction } from "@/components/space-provider";
import { isGameFinished } from "@/shared/games";
import type { Game, SpaceSnapshot } from "@/shared/types";

export function PlayAgain({
  kind,
  space,
  onStarted,
}: {
  kind: Exclude<Game["kind"], "word">;
  space: SpaceSnapshot;
  onStarted?: (id: string) => void;
}) {
  const action = useAction();
  const inProgress = space.games.some(
    (game) => game.kind === kind && !isGameFinished(game),
  );
  return (
    <div className="play-again">
      <button
        type="button"
        className="secondary"
        disabled={action.pending || inProgress || space.members.length !== 2}
        onClick={() =>
          void action
            .run<Game>("/api/games", { kind })
            .then((game) => {
              if (game.id) onStarted?.(game.id);
            })
            .catch(() => {})
        }
      >
        <RotateCcw size={15} aria-hidden="true" />
        {action.pending
          ? "Starting…"
          : inProgress
            ? "Rematch in progress"
            : "Play again"}
      </button>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </div>
  );
}
