"use client";

import { Hand, Scissors, Circle } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Game, RpsChoice, RpsState, SpaceSnapshot } from "@/shared/types";
import { PlayAgain } from "./play-again";

const choices = [
  { value: "rock", label: "Rock", Icon: Circle },
  { value: "paper", label: "Paper", Icon: Hand },
  { value: "scissors", label: "Scissors", Icon: Scissors },
] as const;
const label = (choice: RpsChoice) =>
  choices.find((item) => item.value === choice)!.label;

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
  const partnerId = state.players.find((id) => id !== space.me.id)!;
  const name = (id: string) =>
    space.members.find((person) => person.id === id)?.name ?? "Your partner";
  const mine = state.choices[space.me.id];
  const partnerReady = Object.hasOwn(state.choices, partnerId);
  const previous = state.rounds.at(-1);
  const status = state.winner
    ? `${name(state.winner)} wins the match.`
    : mine
      ? `${label(mine)} locked in. Waiting for ${name(partnerId)}.`
      : partnerReady
        ? `${name(partnerId)} is ready. Make your choice.`
        : "Make your choice. It stays hidden until you both choose.";
  return (
    <article
      className="panel rps-game"
      id={`game-${game.id}`}
      tabIndex={-1}
      aria-labelledby={`game-heading-${game.id}`}
    >
      <div className="activity-heading">
        <h3 id={`game-heading-${game.id}`}>Rock, paper, scissors</h3>
        <span className="rps-target">First to 3</span>
      </div>
      <div className="rps-score" aria-label="Match score">
        {state.players.map((id) => (
          <div key={id}>
            <span>
              {name(id)}
              {id === space.me.id ? " (you)" : ""}
            </span>
            <strong>{state.scores[id]}</strong>
          </div>
        ))}
      </div>
      <p className="game-status" role="status">
        {status}
      </p>
      {!state.winner && (
        <>
          <p className="rps-round-label">Round {state.round}</p>
          <div
            className="rps-choices"
            role="group"
            aria-label={`Your choice for round ${state.round}`}
          >
            {choices.map(({ value, label: title, Icon }) => (
              <button
                type="button"
                key={value}
                aria-pressed={mine === value}
                disabled={!!mine || action.pending}
                onClick={() =>
                  void action
                    .run(`/api/games/${game.id}/moves`, {
                      choice: value,
                      round: state.round,
                      revision: game.revision,
                    })
                    .catch(() => {})
                }
              >
                <Icon aria-hidden="true" />
                <span>{title}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {previous && (
        <div className="rps-result" key={previous.number}>
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
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      {state.winner && (
        <PlayAgain kind="rps" space={space} onStarted={onStarted} />
      )}
      <details className="game-rules">
        <summary>How to play</summary>
        <p>
          Rock beats scissors, scissors beats paper, and paper beats rock. Each
          choice locks when you select it. Both choices are revealed together.
          Draws don’t score; the first to three wins takes the match.
        </p>
      </details>
    </article>
  );
}
