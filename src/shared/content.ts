import type { Idea } from "./types";

const ideas: Omit<Idea, "savedBy" | "done">[] = [
  { id: "same-ingredient", title: "One ingredient, two kitchens", description: "Pick an ingredient you both have. Make different snacks, then compare what happened.", duration: 40, mode: "live", category: "Make", materials: "One shared ingredient and whatever is in your kitchen" },
  { id: "three-songs", title: "Three songs for today", description: "Each choose a song for the morning, afternoon and evening. Leave a sentence about why you picked each one.", duration: 15, mode: "anytime", category: "Everyday", materials: "Links to three songs" },
  { id: "drawing-relay", title: "Finish my drawing", description: "Start with a few lines. Pass the drawing over and see what your partner makes of them.", duration: 15, mode: "anytime", category: "Make", materials: "The drawing space here" },
  { id: "tiny-tour", title: "A tour of one shelf", description: "Pick a shelf, desk or small corner. Share three objects and the stories behind them.", duration: 20, mode: "live", category: "Talk", materials: "A few objects nearby; a call or photos" },
  { id: "photo-colors", title: "Find the same color", description: "Choose a color. Each find it somewhere in your day and leave a photo for the other.", duration: 10, mode: "anytime", category: "Discover", materials: "A camera; indoors works too" },
  { id: "parallel-reading", title: "Read a little together", description: "Bring your own book or article. Read quietly for twenty minutes, then share one thing that stayed with you.", duration: 30, mode: "live", category: "Everyday", materials: "Something to read" },
  { id: "four-rounds", title: "A few rounds of four-in-a-row", description: "Play a quick game here. Take turns now, or leave your move for later.", duration: 10, mode: "anytime", category: "Play", materials: "The games space here" },
  { id: "small-story", title: "A story, one sentence at a time", description: "One of you writes the opening line. Take turns adding a sentence until you find an ending.", duration: 20, mode: "anytime", category: "Make", materials: "A note you can reply to" },
  { id: "snack-review", title: "The very unofficial snack review", description: "Bring any snack. Describe the taste, give it an unnecessarily specific award and compare your reviews.", duration: 20, mode: "live", category: "Play", materials: "A snack each" },
  { id: "open-tab", title: "The interesting tab", description: "Swap an article, video or odd little website you found. Say what made you want to share it.", duration: 15, mode: "anytime", category: "Discover", materials: "One link each" },
  { id: "ten-questions", title: "Ask about a good memory", description: "Choose a memory your partner enjoys telling. Ask about the small details you have not heard before.", duration: 25, mode: "live", category: "Talk", materials: "A memory you feel like sharing" },
  { id: "make-playlist", title: "Make a soundtrack for something ordinary", description: "Pick a task: making breakfast, tidying up or a slow Sunday. Take turns adding a few songs for it.", duration: 25, mode: "anytime", category: "Make", materials: "A shared playlist or song links" },
  { id: "three-clues", title: "Guess it in three clues", description: "Choose an everyday object, place or character. Write three clues and let your partner work it out.", duration: 10, mode: "anytime", category: "Play", materials: "The three-clue game here" },
  { id: "same-recipe", title: "Choose something to cook", description: "Find a recipe that works for both kitchens and budgets. Compare substitutions before deciding when to try it.", duration: 30, mode: "live", category: "Make", materials: "A recipe link and your ingredient lists" },
  { id: "quiet-company", title: "Quiet company", description: "Choose separate things to work on. Spend a little time alongside each other on a call, with no need to keep talking.", duration: 30, mode: "live", category: "Everyday", materials: "Your usual calling app, if you want one" },
  { id: "memory-label", title: "Give a photo its story", description: "Find a photo that means something to you. Add the part the picture cannot show, then save it in your shared memories.", duration: 15, mode: "anytime", category: "Talk", materials: "A photo you are comfortable sharing" },
];

export const ACTIVITY_IDEAS: Idea[] = ideas.map(idea => ({ ...idea, savedBy: [], done: false }));

export const QUESTION_PROMPTS = [
  { id: "small-good", category: "Today", prompt: "What was one small good thing about today?" },
  { id: "ordinary-photo", category: "Today", prompt: "What ordinary part of your day would you show me right now?" },
  { id: "made-laugh", category: "Today", prompt: "What made you laugh recently?" },
  { id: "soundtrack", category: "Today", prompt: "What song fits your day, and why?" },
  { id: "unhurried", category: "Everyday", prompt: "What does an unhurried morning look like for you?" },
  { id: "comfort-meal", category: "Everyday", prompt: "What meal do you make when you want something familiar?" },
  { id: "little-ritual", category: "Everyday", prompt: "What small ritual would you like us to try?" },
  { id: "quiet-company", category: "Everyday", prompt: "When do you like quiet company, and when do you prefer time to yourself?" },
  { id: "old-hobby", category: "Stories", prompt: "What hobby did you love when you were younger?" },
  { id: "kept-object", category: "Stories", prompt: "What object have you kept for a long time? What is its story?" },
  { id: "changed-mind", category: "Stories", prompt: "What is something you changed your mind about?" },
  { id: "proud-moment", category: "Stories", prompt: "What is a small thing you did that you are proud of?" },
  { id: "try-together", category: "Us", prompt: "What would be fun to learn together from where we are?" },
  { id: "inside-joke", category: "Us", prompt: "Which of our inside jokes still makes you smile?" },
  { id: "busy-week", category: "Us", prompt: "During a busy week, what kind of message feels nice to receive?" },
  { id: "favorite-moment", category: "Us", prompt: "What is a moment with me you like thinking about?" },
  { id: "tiny-shop", category: "Just for fun", prompt: "If you ran a tiny shop, what would it sell?" },
  { id: "unexpected-skill", category: "Just for fun", prompt: "What very specific skill would you like to be surprisingly good at?" },
] as const;

export const DRAWING_PROMPTS = [
  "A room we invent together", "Something with too many legs", "A postcard from an imaginary place",
  "An animal with a surprising job", "Start with a circle and see what happens", "The world’s smallest café",
];
