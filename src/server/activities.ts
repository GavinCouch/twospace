import { z } from "zod";
import { initialFour, playFour } from "@/shared/four";
import {
  initialRps,
  initialTic,
  isGameFinished,
  playRps,
  playTic,
  visibleRps,
} from "@/shared/games";
import { ACTIVITY_IDEAS } from "@/shared/content";
import type {
  FourState,
  Game,
  Idea,
  QuestionRound,
  RpsState,
  TicState,
  WordState,
} from "@/shared/types";
import {
  id,
  now,
  resource,
  resources,
  insertResource,
  updateResource,
} from "./database";
import {
  spaceTransaction,
  context,
  found,
  HttpError,
  json,
  optionalUrl,
  requirePartner,
  shortText,
} from "./http";
export function visibleQuestion(
  question: QuestionRound,
  userId: string,
): QuestionRound {
  return {
    ...question,
    answers: question.answers.map((answer) => ({
      ...answer,
      body: question.complete || answer.userId === userId ? answer.body : null,
    })),
  };
}
export function visibleGame(game: Game, userId: string): Game {
  if (game.kind === "rps")
    return { ...game, state: visibleRps(game.state as RpsState, userId) };
  if (game.kind !== "word") return game;
  const state = game.state as WordState;
  return {
    ...game,
    state: {
      ...state,
      answer: state.solved || state.authorId === userId ? state.answer : "",
    },
  };
}
export async function createQuestion(request: Request) {
  const ctx = await context(request);
  requirePartner(ctx);
  const input = await json(
    request,
    z.object({
      prompt: z.string().trim().min(1).max(500),
      category: shortText.default("Your question"),
    }),
  );
  return spaceTransaction(ctx, () =>
    insertResource(ctx.spaceId, "question", ctx.account.id, {
      ...input,
      id: id(),
      createdAt: now(),
      answers: [],
      complete: false,
    } satisfies QuestionRound),
  );
}
export async function answerQuestion(request: Request, questionId: string) {
  const ctx = await context(request);
  requirePartner(ctx);
  const { body } = await json(
    request,
    z.object({ body: z.string().trim().min(1).max(2000) }),
  );
  return await spaceTransaction(ctx, async () => {
    const question = found(
      await resource<QuestionRound>(ctx.spaceId, "question", questionId),
    );
    if (question.answers.some((answer) => answer.userId === ctx.account.id))
      throw new HttpError(409, "Your answer has already been submitted.");
    question.answers.push({ userId: ctx.account.id, body });
    question.complete = ctx.members.every((member) =>
      question.answers.some((answer) => answer.userId === member.id),
    );
    return visibleQuestion(
      await updateResource(ctx.spaceId, "question", question),
      ctx.account.id,
    );
  });
}
export async function createGame(request: Request) {
  const ctx = await context(request);
  requirePartner(ctx);
  const input = await json(
    request,
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("four") }),
      z.object({ kind: z.literal("tic") }),
      z.object({ kind: z.literal("rps") }),
      z.object({
        kind: z.literal("word"),
        answer: z.string().trim().min(2).max(80),
        clues: z.array(z.string().trim().min(3).max(160)).length(3),
      }),
    ]),
  );
  const players = [
    ctx.account.id,
    ctx.members.find((member) => member.id !== ctx.account.id)!.id,
  ];
  const state: Game["state"] =
    input.kind === "four"
      ? initialFour(players)
      : input.kind === "tic"
        ? initialTic(players)
        : input.kind === "rps"
          ? initialRps(players)
          : {
              answer: input.answer,
              clues: input.clues,
              guesses: [],
              solved: false,
              authorId: ctx.account.id,
            };
  return spaceTransaction(ctx, async () => {
    if (
      input.kind !== "word" &&
      (await resources<Game>(ctx.spaceId, "game")).some(
        (game) => game.kind === input.kind && !isGameFinished(game),
      )
    )
      throw new HttpError(
        409,
        "You already have this game in progress. Finish it before starting another.",
      );
    return insertResource(ctx.spaceId, "game", ctx.account.id, {
      id: id(),
      kind: input.kind,
      createdAt: now(),
      revision: 0,
      state,
    } satisfies Game);
  });
}
export async function moveGame(request: Request, gameId: string) {
  const ctx = await context(request);
  requirePartner(ctx);
  const input = await json(
    request,
    z.object({
      revision: z.number().int().nonnegative(),
      column: z.number().int().min(0).max(6).optional(),
      cell: z.number().int().min(0).max(8).optional(),
      choice: z.enum(["rock", "paper", "scissors"]).optional(),
      round: z.number().int().positive().optional(),
      guess: z.string().trim().min(1).max(80).optional(),
    }),
  );
  return await spaceTransaction(ctx, async () => {
    const game = found(await resource<Game>(ctx.spaceId, "game", gameId));
    // Two choices sent from the same snapshot may both land in this round.
    // The round number still prevents a delayed choice from entering the next one.
    const sameRpsRound =
      game.kind === "rps" &&
      input.round === (game.state as RpsState).round &&
      input.revision <= game.revision;
    if (input.revision !== game.revision && !sameRpsRound)
      throw new HttpError(
        409,
        "The game changed. Try your move again.",
        "STALE_REVISION",
      );
    if (game.kind === "four") {
      if (input.column === undefined)
        throw new HttpError(400, "Choose a column.");
      try {
        game.state = playFour(
          game.state as FourState,
          ctx.account.id,
          input.column,
          ctx.members.map((member) => member.id),
        );
      } catch (error) {
        throw new HttpError(409, (error as Error).message);
      }
    } else if (game.kind === "tic" || game.kind === "rps") {
      if (game.kind === "tic" && input.cell === undefined)
        throw new HttpError(400, "Choose a square.");
      if (game.kind === "rps" && (!input.choice || input.round === undefined))
        throw new HttpError(
          400,
          "Choose rock, paper, or scissors for this round.",
        );
      try {
        game.state =
          game.kind === "tic"
            ? playTic(game.state as TicState, ctx.account.id, input.cell!)
            : playRps(
                game.state as RpsState,
                ctx.account.id,
                input.choice!,
                input.round!,
              );
      } catch (error) {
        throw new HttpError(409, (error as Error).message);
      }
    } else {
      const state = game.state as WordState;
      if (!input.guess) throw new HttpError(400, "Enter your guess.");
      if (state.authorId === ctx.account.id)
        throw new HttpError(403, "Your partner gets to guess this one.");
      if (state.solved)
        throw new HttpError(409, "You already solved this word.");
      const normalized = (text: string) =>
        text
          .normalize("NFKC")
          .trim()
          .toLocaleLowerCase("en-US")
          .replace(/\s+/g, " ");
      state.guesses = [...state.guesses.slice(-49), input.guess];
      state.solved = normalized(input.guess) === normalized(state.answer);
    }
    game.revision++;
    return visibleGame(
      await updateResource(ctx.spaceId, "game", game),
      ctx.account.id,
    );
  });
}
export async function allIdeas(spaceId: string): Promise<Idea[]> {
  const custom = await resources<Idea>(spaceId, "idea");
  return [
    ...ACTIVITY_IDEAS.map(
      (idea) =>
        custom.find((saved) => saved.id === idea.id) ?? {
          ...idea,
          savedBy: [],
        },
    ),
    ...custom.filter(
      (idea) => !ACTIVITY_IDEAS.some((base) => base.id === idea.id),
    ),
  ];
}
export async function createIdea(request: Request) {
  const ctx = await context(request);
  requirePartner(ctx);
  const input = await json(
    request,
    z.object({
      title: shortText.min(1),
      description: z.string().trim().max(2000).default(""),
      duration: z.number().int().min(1).max(1440),
      mode: z.enum(["live", "anytime"]),
      category: shortText.default("Your idea"),
      materials: z.string().trim().max(1000).default(""),
      link: optionalUrl.optional(),
    }),
  );
  return spaceTransaction(ctx, () =>
    insertResource(ctx.spaceId, "idea", ctx.account.id, {
      ...input,
      id: id(),
      savedBy: [ctx.account.id],
      done: false,
    } satisfies Idea),
  );
}
export async function editIdea(request: Request, ideaId: string) {
  const ctx = await context(request);
  requirePartner(ctx);
  const input = await json(
    request,
    z.object({ saved: z.boolean().optional(), done: z.boolean().optional() }),
  );
  return await spaceTransaction(ctx, async () => {
    const stored = await resource<Idea>(ctx.spaceId, "idea", ideaId);
    const idea = found(
      stored ?? ACTIVITY_IDEAS.find((base) => base.id === ideaId),
    );
    const result = {
      ...idea,
      savedBy: [...idea.savedBy],
      done: input.done ?? idea.done,
    };
    if (input.saved !== undefined)
      result.savedBy = input.saved
        ? [...new Set([...result.savedBy, ctx.account.id])]
        : result.savedBy.filter((member) => member !== ctx.account.id);
    return stored
      ? await updateResource(ctx.spaceId, "idea", result)
      : await insertResource(ctx.spaceId, "idea", ctx.account.id, result);
  });
}
