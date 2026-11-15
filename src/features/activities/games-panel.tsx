"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { FourState, SpaceSnapshot, WordState } from "@/shared/types";
import { SectionArt } from "@/components/section-art";
import { FourBoard } from "./four-board";
import { WordCreate } from "./word-create";
import { WordGame } from "./word-game";

export function GamesPanel({ space }: { space: SpaceSnapshot }) {
  const action = useAction();
  const [creatingWord, setCreatingWord] = useState(false);
  const [history, setHistory] = useState(false);
  const games = [...space.games].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const isFinished = (game: (typeof games)[number]) =>
    game.kind === "word"
      ? (game.state as WordState).solved
      : !!(game.state as FourState).winner || (game.state as FourState).draw;
  const active = games.filter((game) => !isFinished(game));
  const visible = history ? games : active;
  const hasFour = active.some((game) => game.kind === "four");
  return (
    <div className="games-panel">
      <div className="activity-section-intro">
        <div>
          <h2>Games</h2>
          <p className="muted">Your turns are saved between visits.</p>
        </div>
      </div>
      <div className="game-options">
        <article className="game-option">
          <SectionArt name="activities" size={56} />
          <div>
            <h3>Four-in-a-row</h3>
            <p>
              Seven columns. Two players. Get four of your pieces in a line.
            </p>
          </div>
          <button
            className="secondary"
            disabled={action.pending || space.members.length < 2 || hasFour}
            onClick={() =>
              void action.run("/api/games", { kind: "four" }).catch(() => {})
            }
          >
            <Plus size={16} aria-hidden="true" />
            {hasFour ? "Game in progress" : "Start a game"}
          </button>
        </article>
        <article className="game-option">
          <SectionArt name="questions" size={56} />
          <div>
            <h3>Three clues</h3>
            <p>
              Leave a small mystery. Your partner has three clues to solve it.
            </p>
          </div>
          <button
            className="secondary"
            disabled={space.members.length < 2}
            onClick={() => setCreatingWord(!creatingWord)}
            aria-expanded={creatingWord}
          >
            <Plus size={16} aria-hidden="true" />
            Write some clues
          </button>
        </article>
      </div>
      {space.members.length < 2 && (
        <p className="muted">Pair with your partner to start a game.</p>
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      {creatingWord && <WordCreate onClose={() => setCreatingWord(false)} />}
      <div className="activity-heading games-list-heading">
        <h2>{history ? "Your games" : "In play"}</h2>
        {games.some(isFinished) && (
          <button
            className="quiet"
            aria-pressed={history}
            onClick={() => setHistory(!history)}
          >
            {history ? "Show current games" : "Include finished games"}
          </button>
        )}
      </div>
      {visible.length ? (
        <div className="games-grid">
          {visible.map((game) =>
            game.kind === "four" ? (
              <FourBoard key={game.id} game={game} space={space} />
            ) : (
              <WordGame key={game.id} game={game} space={space} />
            ),
          )}
        </div>
      ) : (
        <div className="empty">
          <SectionArt name="activities" size={72} />
          <h3>No games in progress</h3>
          <p>Start a board or leave three clues for your partner.</p>
        </div>
      )}
    </div>
  );
}
