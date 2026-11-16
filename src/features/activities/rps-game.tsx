"use client";

import { useEffect, useRef } from "react";
import { Check, Hand, HandFist, Scissors, Trophy } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Game, RpsChoice, RpsState, SpaceSnapshot } from "@/shared/types";
import {
  GameFrame,
  HowToPlay,
  StatusBanner,
  playSound,
  useGameCues,
  useSeries,
} from "./game-kit";
import { PlayAgain } from "./play-again";

const choices = [
  { value: "rock", label: "Rock", Icon: HandFist },
  { value: "paper", label: "Paper", Icon: Hand },
  { value: "scissors", label: "Scissors", Icon: Scissors },
] as const;
const TARGET = 3;
const option = (choice: RpsChoice) =>
  choices.find((item) => item.value === choice)!;
const label = (choice: RpsChoice) => option(choice).label;

function Pips({ score, tone }: { score: number; tone: "rose" | "sky" }) {
  return (
    <span className={`rps-pips tone-${tone}`} aria-hidden="true">
      {Array.from({ length: TARGET }, (_, index) => (
        <i key={index} className={index < score ? "is-on" : ""} />
      ))}
    </span>
  );
}

function ChoiceCard({
  choice,
  hidden,
  tone,
  result,
}: {
  choice?: RpsChoice | null;
  hidden?: boolean;
  tone: "rose" | "sky";
  result?: "win" | "lose" | "draw";
}) {
  const Icon = choice ? option(choice).Icon : null;
  return (
    <span
      className={`rps-card tone-${tone}${hidden ? " is-hidden" : ""}${result ? ` is-${result}` : ""}`}
      aria-hidden="true"
    >
      {Icon && !hidden ? <Icon /> : <b>?</b>}
    </span>
  );
}

export function RpsGame({
  game,
  space,
  onStarted,
}: {
  game: Game;
  space: SpaceSnapshot;
  onStarted?: (id: string) => void;
}) {
  const action = useAction();
  const state = game.state as RpsState;
  const series = useSeries(space, "rps");
  const partnerId = state.players.find((id) => id !== space.me.id)!;
  const name = (id: string) =>
    space.members.find((person) => person.id === id)?.name ?? "Your partner";
  const mine = state.choices[space.me.id];
  const partnerReady = Object.hasOwn(state.choices, partnerId);
  const previous = state.rounds.at(-1);
  const cues = useGameCues(game, space.me.id, false);
  const meTone = state.players.indexOf(space.me.id) === 0 ? "rose" : "sky";
  const partnerTone = meTone === "rose" ? "sky" : "rose";
  const revealKey = previous ? `${game.id}:${previous.number}` : null;
  const seenReveal = useRef(revealKey);
  useEffect(() => {
    const before = seenReveal.current;
    seenReveal.current = revealKey;
    if (revealKey && before !== revealKey) playSound("reveal");
  }, [revealKey]);
  const status = state.winner
    ? `${name(state.winner)} wins the match.`
    : mine
      ? `${label(mine)} locked in. Waiting for ${name(partnerId)}.`
      : partnerReady
        ? `${name(partnerId)} is ready. Make your choice.`
        : "Make your choice. It stays hidden until you both choose.";
  const roundResult = (id: string) =>
    !previous
      ? undefined
      : !previous.winner
        ? "draw"
        : previous.winner === id
          ? "win"
          : "lose";
  return (
    <GameFrame
      game={game}
      title="Rock, paper, scissors"
      kicker={
        state.winner
          ? `Match over · ${state.round - 1} rounds`
          : `Round ${state.round}`
      }
      className="rps-game"
      celebrate={cues.celebrate}
      badge={
        state.winner ? (
          <span className="game-badge badge-gold">
            <Trophy size={15} aria-hidden="true" /> Winner
          </span>
        ) : (
          <span className="game-badge">First to {TARGET}</span>
        )
      }
    >
      <div className="rps-score" aria-label="Match score">
        {[space.me.id, partnerId].map((id, index) => (
          <div
            key={id}
            className={`rps-side tone-${index === 0 ? meTone : partnerTone}${state.winner === id ? " is-winner" : ""}`}
          >
            <span className="rps-name">
              {name(id)}
              {id === space.me.id && <em>you</em>}
            </span>
            <strong>{state.scores[id]}</strong>
            <Pips
              score={state.scores[id]}
              tone={index === 0 ? meTone : partnerTone}
            />
            {series.played > 0 && (
              <small>
                {series.wins[id] ?? 0}{" "}
                {(series.wins[id] ?? 0) === 1 ? "match" : "matches"} won
              </small>
            )}
          </div>
        ))}
        <span className="rps-vs" aria-hidden="true">
          vs
        </span>
      </div>

      {previous && (
        <div className="rps-arena" key={previous.number}>
          <div className="rps-shake" aria-hidden="true">
            <span className={`rps-fist tone-${meTone}`}>
              <HandFist />
            </span>
            <span className="rps-chant">
              <i>Rock</i>
              <i>Paper</i>
              <i>Scissors</i>
              <i>Shoot!</i>
            </span>
            <span className={`rps-fist tone-${partnerTone} is-mirrored`}>
              <HandFist />
            </span>
          </div>
          <div className="rps-reveal">
            <ChoiceCard
              choice={previous.choices[space.me.id]}
              tone={meTone}
              result={roundResult(space.me.id)}
            />
            <div className="rps-result">
              <strong>
                Round {previous.number}:{" "}
                {previous.winner ? `${name(previous.winner)} wins` : "Draw"}
              </strong>
              <p>
                {state.players
                  .map((id) => `${name(id)}: ${label(previous.choices[id])}`)
                  .join(" · ")}
              </p>
            </div>
            <ChoiceCard
              choice={previous.choices[partnerId]}
              tone={partnerTone}
              result={roundResult(partnerId)}
            />
          </div>
        </div>
      )}

      <StatusBanner
        tone={
          state.winner
            ? state.winner === space.me.id
              ? "win"
              : "lose"
            : mine
              ? "theirs"
              : "mine"
        }
      >
        {status}
      </StatusBanner>

      {!state.winner && (
        <>
          <div className="rps-table">
            <div className="rps-seat">
              <span className="rps-seat-label">{name(partnerId)}</span>
              <span
                className={`rps-card tone-${partnerTone} is-hidden${partnerReady ? " is-ready" : ""}`}
                aria-hidden="true"
              >
                {partnerReady ? (
                  <Check />
                ) : (
                  <span className="rps-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </span>
              <small>{partnerReady ? "Locked in" : "Choosing…"}</small>
            </div>
          </div>
          <p className="rps-round-label">
            {mine
              ? "Your pick for this round"
              : `Pick for round ${state.round}`}
          </p>
          <div
            className={`rps-choices${mine ? " is-locked" : ""}`}
            role="group"
            aria-label={`Your choice for round ${state.round}`}
          >
            {choices.map(({ value, label: title, Icon }) => (
              <button
                type="button"
                key={value}
                className={`tone-${meTone}`}
                aria-pressed={mine === value}
                disabled={!!mine || action.pending}
                onClick={() => {
                  playSound("lock");
                  void action
                    .run(`/api/games/${game.id}/moves`, {
                      choice: value,
                      round: state.round,
                      revision: game.revision,
                    })
                    .catch(() => {});
                }}
              >
                <span className="rps-choice-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span>{title}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      {state.winner && (
        <PlayAgain kind="rps" space={space} onStarted={onStarted} />
      )}
      <HowToPlay>
        Rock crushes scissors, scissors cut paper, paper covers rock. Your pick
        locks the moment you tap it and stays secret until you’ve both chosen.
        Draws don’t count. First to three takes the match.
      </HowToPlay>
    </GameFrame>
  );
}
