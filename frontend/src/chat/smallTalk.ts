export type SmallTalkKind = "greeting" | "how-are-you" | "thanks" | "bye" | "time" | "weather";

export interface SmallTalkMatch {
  kind: SmallTalkKind;
  reply: string;
}

const GREETING_RE =
  /^(h(i+|ey+|ello+)|yo+|sup|howdy|good\s(morning|afternoon|evening))(\s*,?\s*(pepper|there))?[\s!.,]*$/i;
const HOW_ARE_YOU_RE =
  /^(how'?s it going|how are (you|ya)( doing)?|how'?s your day( going)?|how have you been|what'?s up)[\s?!.]*$/i;
const THANKS_RE = /^(thanks?( you)?( so much| a lot)?|thx|ty|cheers|appreciate it|much appreciated)[\s!.,]*$/i;
const BYE_RE =
  /^(bye|goodbye|good ?bye|see ya|see you( later| soon)?|later|good ?night|take care|gotta go|catch you later)[\s!.,]*$/i;
const TIME_RE =
  /\b(what'?s the time|what time (is it|do you have)|current time|tell me the time|do you know (the time|what time it is)|time check|got the time)\b/i;
// Covers direct asks ("what's the weather like") as well as rhetorical remarks
// people actually type ("the weather is good, isn't it?", "lovely weather today").
const WEATHER_RE =
  /\b(what'?s the weather( like)?|how'?s the weather|what'?s it like outside|is it (raining|snowing|sunny|hot|cold|cloudy|windy|humid)\b|(nice|good|great|lovely|beautiful|awful|terrible|bad|crazy|wild) weather|weather('s| is)( so| pretty| really)? (nice|good|great|lovely|beautiful|awful|terrible|bad|crazy|wild|rough)|weather (today|outside|out there))\b/i;

const GREETING_REPLIES = [
  "Hey — good to see you. What's on your mind?",
  "Hi there. Ask me anything about what you've saved, or just say hi.",
  "Hello! I'm here whenever you're ready.",
];

const HOW_ARE_YOU_REPLIES = [
  "Doing well, thanks for asking. How can I help?",
  "All good on my end. What can I dig up for you?",
  "I'm here and ready — what do you need?",
];

const THANKS_REPLIES = [
  "Anytime.",
  "You're welcome — happy to help.",
  "Of course. Let me know if you need anything else.",
];

const BYE_REPLIES = ["Take care — I'll be here when you're back.", "Bye for now.", "See you soon."];

// No weather API/geolocation is wired up, so these acknowledge the question
// without ever claiming to know real conditions.
const WEATHER_REPLIES = [
  "I can't check real weather yet, so I'll take your word for it!",
  "No weather feed on my end — you'd know better than me there.",
  "Can't say myself, I don't have live weather data hooked up.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function currentTimeReply(): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return pick([`It's ${timeStr} right now.`, `Right now it's ${timeStr}.`, `${timeStr} on my end.`]);
}

export function detectSmallTalk(rawInput: string): SmallTalkMatch | null {
  const input = rawInput.trim();
  if (!input) return null;

  if (TIME_RE.test(input)) return { kind: "time", reply: currentTimeReply() };
  if (WEATHER_RE.test(input)) return { kind: "weather", reply: pick(WEATHER_REPLIES) };
  if (GREETING_RE.test(input)) return { kind: "greeting", reply: pick(GREETING_REPLIES) };
  if (HOW_ARE_YOU_RE.test(input)) return { kind: "how-are-you", reply: pick(HOW_ARE_YOU_REPLIES) };
  if (THANKS_RE.test(input)) return { kind: "thanks", reply: pick(THANKS_REPLIES) };
  if (BYE_RE.test(input)) return { kind: "bye", reply: pick(BYE_REPLIES) };

  return null;
}

export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late?";
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}
