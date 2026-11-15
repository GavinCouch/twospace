import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { id, now, insertResource } from "./database";
import { storeImage } from "./media";
import { initialFour, playFour } from "@/shared/four";
import { ACTIVITY_IDEAS } from "@/shared/content";
import type {
  Drawing,
  Entry,
  Game,
  PhotoPair,
  Plan,
  QuestionRound,
} from "@/shared/types";
export async function seedDemo(spaceId: string, alex: string, jamie: string) {
  const photo = async (file: string, userId: string) =>
    storeImage(
      spaceId,
      userId,
      await readFile(join(process.cwd(), "public", "demo", file)),
    );
  const [pasta, clouds, evening, coffee] = await Promise.all([
    photo("pasta.jpg", alex),
    photo("clouds.jpg", alex),
    photo("evening-sky.jpg", jamie),
    photo("coffee.jpg", jamie),
  ]);
  const ago = (hours: number) =>
    new Date(Date.now() - hours * 3600000).toISOString();
  const entry = async (
    authorId: string,
    data: Partial<Entry> & Pick<Entry, "body">,
  ) =>
    await insertResource(spaceId, "entry", authorId, {
      id: id(),
      authorId,
      kind: "note",
      title: "",
      createdAt: now(),
      pinned: false,
      collection: "",
      reactions: [],
      replies: [],
      ...data,
    } as Entry);
  await entry(alex, {
    kind: "photo",
    mediaId: pasta.id,
    body: "We followed the same recipe on our call. Mine needed more lemon.",
    title: "Sunday pasta",
    createdAt: ago(18),
    collection: "Things we made",
    reactions: [jamie],
    replies: [
      {
        id: id(),
        authorId: jamie,
        body: "Next time I’m trying the garlic trick you showed me.",
        createdAt: ago(17),
      },
    ],
  });
  await entry(jamie, {
    body: "The little bakery had your favorite pastries today. Sending the thought, since I can’t send the smell.",
    createdAt: ago(3),
    title: "On the way home",
    pinned: true,
  });
  await entry(jamie, {
    kind: "photo",
    mediaId: coffee.id,
    body: "First coffee, before everything gets busy.",
    title: "A slow morning",
    createdAt: ago(28),
    collection: "Ordinary days",
  });
  await entry(alex, {
    kind: "link",
    body: "This is the song I was trying to remember yesterday.",
    title: "For your walk",
    url: "https://www.youtube.com/results?search_query=Khruangbin+Friday+Morning",
    createdAt: ago(7),
    collection: "Music",
  });
  await entry(jamie, {
    body: "Pick any little thing you want to tell me about today. I want the long version.",
    title: "Something for tomorrow",
    revealAt: new Date(Date.now() + 18 * 3600000).toISOString(),
    createdAt: ago(2),
  });
  await insertResource(spaceId, "photoPair", alex, {
    id: id(),
    prompt: "The sky where you are",
    createdAt: ago(5),
    photos: [
      {
        userId: alex,
        mediaId: clouds.id,
        caption: "A break between the rain.",
      },
      { userId: jamie, mediaId: evening.id, caption: "Nearly sunset here." },
    ],
  } satisfies PhotoPair);
  await insertResource(spaceId, "question", jamie, {
    id: id(),
    prompt: "What small thing made your day better?",
    category: "Everyday",
    createdAt: ago(1),
    complete: false,
    answers: [
      {
        userId: jamie,
        body: "You sent that photo of your very serious lunch.",
      },
    ],
  } satisfies QuestionRound);
  await insertResource(spaceId, "question", alex, {
    id: id(),
    prompt: "What should we try making together?",
    category: "Something to do",
    createdAt: ago(25),
    complete: true,
    answers: [
      {
        userId: alex,
        body: "Dumplings. We can compare our terrible folding skills.",
      },
      {
        userId: jamie,
        body: "Dumplings! I have already watched three videos.",
      },
    ],
  } satisfies QuestionRound);
  let board = initialFour([alex, jamie]);
  for (const [player, column] of [
    [alex, 3],
    [jamie, 2],
    [alex, 3],
    [jamie, 4],
  ] as const)
    board = playFour(board, player, column, [alex, jamie]);
  await insertResource(spaceId, "game", alex, {
    id: id(),
    kind: "four",
    createdAt: ago(2),
    revision: 4,
    state: board,
  } satisfies Game);
  await insertResource(spaceId, "game", jamie, {
    id: id(),
    kind: "word",
    createdAt: ago(2),
    revision: 0,
    state: {
      answer: "umbrella",
      clues: [
        "Something I nearly forgot this morning.",
        "It stays by the front door.",
        "We both needed one this week.",
      ],
      guesses: [],
      solved: false,
      authorId: jamie,
    },
  } satisfies Game);
  await insertResource(spaceId, "drawing", jamie, {
    id: id(),
    title: "A very small garden",
    caption: "Add something that belongs here.",
    createdAt: ago(6),
    revision: 2,
    turnUserId: alex,
    strokes: [
      {
        id: id(),
        authorId: jamie,
        tool: "line",
        color: "#416B67",
        width: 4,
        points: [
          { x: 280, y: 330 },
          { x: 280, y: 220 },
        ],
      },
      {
        id: id(),
        authorId: jamie,
        tool: "circle",
        color: "#CB785F",
        width: 4,
        points: [
          { x: 245, y: 150 },
          { x: 315, y: 220 },
        ],
      },
    ],
  } satisfies Drawing);
  const starts = new Date(Date.now() + 2 * 86400000);
  starts.setUTCHours(18, 0, 0, 0);
  await insertResource(spaceId, "plan", alex, {
    id: id(),
    title: "Make dumplings together",
    startsAt: starts.toISOString(),
    timeZone: "Europe/London",
    duration: 60,
    kind: "date",
    status: "accepted",
    proposedBy: alex,
    acceptedBy: [alex, jamie],
    link: "",
    notes: "Make whatever filling we have. Call before we start folding.",
    checklist: [
      { id: id(), text: "Check the flour situation", done: true },
      { id: id(), text: "Pick a filling", done: false },
    ],
  } satisfies Plan);
  for (const idea of ACTIVITY_IDEAS.slice(0, 3))
    await insertResource(spaceId, "idea", alex, {
      ...idea,
      savedBy: [alex, jamie],
    });
}
