export type Person = { id: string; name: string; timeZone: string; color: string; availableFrom: number; availableTo: number; avatarMediaId?: string };
export type EntryKind = "note" | "photo" | "link" | "voice" | "drawing" | "memory";
export type Reply = { id: string; authorId: string; body: string; createdAt: string };
export type Entry = {
  id: string; authorId: string; kind: EntryKind; body: string; title: string;
  mediaId?: string; url?: string; createdAt: string; revealAt?: string;
  locked?: boolean; pinned: boolean; collection: string;
  reactions: string[]; replies: Reply[]; drawing?: Stroke[];
};
export type PhotoPair = { id: string; prompt: string; createdAt: string; photos: { userId: string; mediaId: string; caption: string }[] };
export type QuestionRound = { id: string; prompt: string; category: string; createdAt: string; answers: { userId: string; body: string | null }[]; complete: boolean };
export type FourState = { board: (string | null)[][]; turn: string; winner: string | null; draw: boolean; winningCells: number[][] };
export type WordState = { answer: string; clues: string[]; guesses: string[]; solved: boolean; authorId: string };
export type Game = { id: string; kind: "four" | "word"; createdAt: string; revision: number; state: FourState | WordState };
export type Point = { x: number; y: number };
export type Stroke = { id: string; authorId: string; tool: "pen" | "line" | "circle" | "square"; color: string; width: number; points: Point[] };
export type Drawing = { id: string; title: string; caption: string; createdAt: string; strokes: Stroke[]; revision: number; turnUserId: string };
export type Idea = { id: string; title: string; description: string; duration: number; mode: "live" | "anytime"; category: string; materials: string; savedBy: string[]; done: boolean; link?: string };
export type ChecklistItem = { id: string; text: string; done: boolean };
export type Plan = { id: string; title: string; startsAt: string; timeZone: string; duration: number; kind: "call" | "date" | "visit"; status: "proposed" | "accepted" | "done"; proposedBy: string; acceptedBy: string[]; link: string; notes: string; checklist: ChecklistItem[] };
export type SpaceSnapshot = {
  space: { id: string; name: string; createdAt: string; isDemo: boolean };
  me: Person; members: Person[]; entries: Entry[]; photoPairs: PhotoPair[];
  questions: QuestionRound[]; games: Game[]; drawings: Drawing[]; ideas: Idea[]; plans: Plan[];
};
export type Account = {
  id: string; name: string; email: string; spaceId: string | null; isDemo: boolean;
  firstName?: string; lastName?: string;
  gender?: "woman" | "man" | "non-binary" | "prefer-not-to-say";
  birthday?: string;
};
export type ApiError = { error: string; code?: string };
