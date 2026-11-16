"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Hand, HandFist, Scissors } from "lucide-react";
import { useAction } from "@/components/space-provider";
import { isGameFinished } from "@/shared/games";
import type { Game, SpaceSnapshot } from "@/shared/types";
import { FourBoard } from "./four-board";
import { WordCreate } from "./word-create";
import { WordGame } from "./word-game";
import { TicBoard, TicMark } from "./tic-board";
import { RpsGame } from "./rps-game";
import { SoundToggle } from "./game-kit";

const catalog = [
  {
    kind: "four",
    title: "Four-in-a-row",
    description: "Drop pieces, block their lines, connect four first.",
    detail: "Turn-based",
    time: "5–10 min",
  },
  {
    kind: "tic",
    title: "Tic-tac-toe",
    description: "The classic quick one. Perfect for settling small debates.",
    detail: "Turn-based",
    time: "1–2 min",
  },
  {
    kind: "rps",
    title: "Rock, paper, scissors",
    description: "Pick in secret, reveal together. First to three wins.",
    detail: "Simultaneous",
    time: "2–5 min",
  },
  {
    kind: "word",
    title: "Three clues",
    description: "Hide a word behind three clues. They unlock one per miss.",
    detail: "Puzzle",
    time: "Anytime",
  },
] as const;

function GamePreview({ kind }: { kind: Game["kind"] }) {
  return (
    <div className={`game-preview game-preview-${kind}`} aria-hidden="true">
      {kind === "four" ? (
        <div className="preview-four">
          {Array.from({ length: 20 }, (_, index) => (
            <i
              key={index}
              className={
                [10, 15, 16, 17].includes(index)
                  ? "rose"
                  : [11, 12, 18, 19].includes(index)
                    ? "blue"
                    : index === 3
                      ? "rose falling"
                      : ""
              }
            />
          ))}
        </div>
      ) : kind === "tic" ? (
        <div className="preview-tic">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index}>
              {[0, 4, 8].includes(index) ? (
                <TicMark player={0} />
              ) : [2, 3].includes(index) ? (
                <TicMark player={1} />
              ) : null}
            </span>
          ))}
        </div>
      ) : kind === "rps" ? (
        <div className="preview-rps">
          <HandFist />
          <Hand />
          <Scissors />
        </div>
      ) : (
        <div className="preview-clues">
          <span>
            <b>1</b> <i />
          </span>
          <span className="locked">
            <b>2</b> <i />
          </span>
          <span className="locked">
            <b>3</b> <i />
          </span>
        </div>
      )}
    </div>
  );
}

export function GamesPanel({ space }: { space: SpaceSnapshot }) {
  const action = useAction();
  const [creatingWord, setCreatingWord] = useState(false);
  const [history, setHistory] = useState(false);
  const [focusGameId, setFocusGameId] = useState<string | null>(null);
  const games = [...space.games].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const active = games.filter((game) => !isGameFinished(game));
  // Keep the final move visible for games played during this visit.
  const [seenActive, setSeenActive] = useState(
    () => new Set(active.map((game) => game.id)),
  );
  if (active.some((game) => !seenActive.has(game.id)))
    setSeenActive(new Set([...seenActive, ...active.map((game) => game.id)]));
  const visible = history
    ? games
    : games.filter((game) => !isGameFinished(game) || seenActive.has(game.id));
  useEffect(() => {
    if (!focusGameId) return;
    const board = document.getElementById(`game-${focusGameId}`);
    if (!board) return;
    board.focus({ preventScroll: true });
    board.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    setFocusGameId(null);
  }, [focusGameId, space.games]);
  async function startGame(kind: Exclude<Game["kind"], "word">) {
    try {
      const created = await action.run<Game>("/api/games", { kind });
      if (created.id) setFocusGameId(created.id);
    } catch {
      /* Keep the catalog available to retry. */
    }
  }
  const waiting = active.filter((game) =>
    game.kind === "four" || game.kind === "tic"
      ? (game.state as { turn: string }).turn === space.me.id
      : game.kind === "rps"
        ? !Object.hasOwn(
            (game.state as { choices: Record<string, unknown> }).choices,
            space.me.id,
          )
        : (game.state as { authorId: string }).authorId !== space.me.id,
  ).length;
  return (
    <div className="games-panel">
      <div className="games-toolbar">
        <p className="games-summary">
          {active.length === 0
            ? "Nothing in play. Pick a game below to challenge your partner."
            : waiting > 0
              ? `${waiting} ${waiting === 1 ? "game is" : "games are"} waiting on your move.`
              : `${active.length} ${active.length === 1 ? "game" : "games"} in play. Waiting on your partner.`}
        </p>
        <SoundToggle />
      </div>
      {games.length > 0 && (
        <>
          <div className="activity-heading games-list-heading">
            <h2>
              {history || visible.some(isGameFinished)
                ? "Your games"
                : "In play"}
            </h2>
            {games.some(isGameFinished) && (
              <button
                className="quiet"
                aria-pressed={history}
                onClick={() => {
                  if (history)
                    setSeenActive(new Set(active.map((game) => game.id)));
                  setHistory(!history);
                }}
              >
                {history ? "Show current games" : "Include finished games"}
              </button>
            )}
          </div>
          {visible.length ? (
            <div className="games-grid">
              {visible.map((game) =>
                game.kind === "four" ? (
                  <FourBoard
                    key={game.id}
                    game={game}
                    space={space}
                    onStarted={setFocusGameId}
                  />
                ) : game.kind === "tic" ? (
                  <TicBoard
                    key={game.id}
                    game={game}
                    space={space}
                    onStarted={setFocusGameId}
                  />
                ) : game.kind === "rps" ? (
                  <RpsGame
                    key={game.id}
                    game={game}
                    space={space}
                    onStarted={setFocusGameId}
                  />
                ) : (
                  <WordGame key={game.id} game={game} space={space} />
                ),
              )}
            </div>
          ) : (
            <p className="games-empty">No games in progress</p>
          )}
        </>
      )}
      <div className="activity-heading game-catalog-heading">
        <h2>Game library</h2>
        <span>For two players</span>
      </div>
      <div className="game-options">
        {catalog.map((item) => {
          const inProgress =
            item.kind !== "word" &&
            active.find((game) => game.kind === item.kind);
          return (
            <article
              className={`game-option game-option-${item.kind}`}
              key={item.kind}
            >
              <GamePreview kind={item.kind} />
              <div className="game-option-copy">
                <p className="game-duration">
                  <span>{item.detail}</span>
                  <span>{item.time}</span>
                </p>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <button
                className={inProgress ? "secondary" : "button"}
                disabled={action.pending || space.members.length !== 2}
                aria-label={
                  inProgress
                    ? `Continue ${item.title}`
                    : item.kind === "word"
                      ? "Write three clues"
                      : `Play ${item.title}`
                }
                aria-expanded={item.kind === "word" ? creatingWord : undefined}
                onClick={() =>
                  item.kind === "word"
                    ? setCreatingWord(!creatingWord)
                    : inProgress
                      ? setFocusGameId(inProgress.id)
                      : void startGame(item.kind)
                }
              >
                {inProgress
                  ? "Continue"
                  : item.kind === "word"
                    ? "Write clues"
                    : "Play"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      {creatingWord && (
        <WordCreate
          onClose={() => setCreatingWord(false)}
          onCreated={setFocusGameId}
        />
      )}
    </div>
  );
}
