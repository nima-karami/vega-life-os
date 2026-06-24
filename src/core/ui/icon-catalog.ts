import { CHROME_ICON_NAMES, type IconName } from "@/core/lib/icon-names";

/** Fixed display order for the browse view. */
export const ICON_CATEGORIES = [
  "Focus & goals",
  "Work & money",
  "Health & body",
  "Mind & learning",
  "Nature & weather",
  "Food & drink",
  "Home & places",
  "People & social",
  "Tech & devices",
  "Travel & movement",
  "Time & planning",
  "Creative & play",
  "Communication",
  "Symbols & misc",
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number];

export interface CatalogEntry {
  name: IconName;
  category: IconCategory;
  /** Space-separated English search aliases (name is always implicitly searched). */
  keywords: string;
}

/** Programmatic-only names that must never be offered as a pickable entity icon. */
export const CHROME_ICONS: ReadonlySet<IconName> = new Set(CHROME_ICON_NAMES);

/** Single source of truth for the pickable catalog (order within a category is display order). */
export const ICON_CATALOG: readonly CatalogEntry[] = [
  // Focus & goals
  { name: "target", category: "Focus & goals", keywords: "goal aim bullseye focus objective" },
  { name: "compass", category: "Focus & goals", keywords: "direction navigate values north" },
  { name: "flag", category: "Focus & goals", keywords: "milestone marker checkpoint start" },
  { name: "trophy", category: "Focus & goals", keywords: "win award achievement prize champion" },
  { name: "medal", category: "Focus & goals", keywords: "award achievement reward win" },
  { name: "rocket", category: "Focus & goals", keywords: "launch start growth ambition fast" },
  { name: "crosshair", category: "Focus & goals", keywords: "aim precision target focus" },
  { name: "telescope", category: "Focus & goals", keywords: "vision future foresight look ahead" },
  { name: "milestone", category: "Focus & goals", keywords: "marker progress signpost stage" },
  { name: "mountain-flag", category: "Focus & goals", keywords: "summit peak goal climb achieve" },
  { name: "spark", category: "Focus & goals", keywords: "idea inspiration magic new" },
  { name: "gem", category: "Focus & goals", keywords: "value gem diamond precious quality" },

  // Work & money
  { name: "briefcase", category: "Work & money", keywords: "work job career office business" },
  { name: "card", category: "Work & money", keywords: "credit payment spend bank money" },
  { name: "coins", category: "Work & money", keywords: "money cash savings currency" },
  { name: "wallet", category: "Work & money", keywords: "money budget cash spend" },
  { name: "banknote", category: "Work & money", keywords: "money cash bill income salary" },
  { name: "piggy-bank", category: "Work & money", keywords: "savings save budget money" },
  { name: "receipt", category: "Work & money", keywords: "expense bill invoice spend tax" },
  { name: "chart", category: "Work & money", keywords: "stats graph metrics analytics growth" },
  { name: "trending-up", category: "Work & money", keywords: "growth increase up progress gains" },
  { name: "calculator", category: "Work & money", keywords: "math budget numbers finance" },
  { name: "handshake", category: "Work & money", keywords: "deal agreement partner business" },
  { name: "building", category: "Work & money", keywords: "office company corporate workplace" },

  // Health & body
  { name: "heart", category: "Health & body", keywords: "love health wellbeing care like" },
  { name: "heart-pulse", category: "Health & body", keywords: "health heartbeat cardio vitals" },
  { name: "activity", category: "Health & body", keywords: "fitness pulse heartbeat exercise" },
  { name: "dumbbell", category: "Health & body", keywords: "gym workout strength lift exercise" },
  { name: "footprints", category: "Health & body", keywords: "walk steps run move track" },
  { name: "bike", category: "Health & body", keywords: "cycle ride bicycle exercise commute" },
  { name: "pill", category: "Health & body", keywords: "medicine medication health supplement" },
  { name: "stethoscope", category: "Health & body", keywords: "doctor health medical checkup" },
  { name: "bed", category: "Health & body", keywords: "sleep rest nap recovery night" },
  { name: "salad", category: "Health & body", keywords: "food healthy diet veggies nutrition" },
  { name: "scale", category: "Health & body", keywords: "weight balance measure body" },
  { name: "flame", category: "Health & body", keywords: "streak energy burn calories hot fire" },

  // Mind & learning
  { name: "book", category: "Mind & learning", keywords: "read study learn knowledge" },
  { name: "graduation-cap", category: "Mind & learning", keywords: "school degree learn graduate" },
  { name: "brain", category: "Mind & learning", keywords: "mind think smart focus mental" },
  { name: "lightbulb", category: "Mind & learning", keywords: "idea insight think creative" },
  { name: "puzzle", category: "Mind & learning", keywords: "problem solve logic piece game" },
  { name: "microscope", category: "Mind & learning", keywords: "science research study lab" },
  { name: "atom", category: "Mind & learning", keywords: "science physics chemistry research" },
  { name: "notebook-pen", category: "Mind & learning", keywords: "notes write journal study" },
  { name: "highlighter", category: "Mind & learning", keywords: "study mark notes annotate" },
  { name: "school", category: "Mind & learning", keywords: "education class learn building" },
  { name: "library", category: "Mind & learning", keywords: "books read study knowledge" },
  { name: "glasses", category: "Mind & learning", keywords: "read focus study vision" },

  // Nature & weather
  { name: "leaf", category: "Nature & weather", keywords: "nature plant green eco growth" },
  { name: "tree-pine", category: "Nature & weather", keywords: "tree forest nature outdoor" },
  { name: "flower", category: "Nature & weather", keywords: "bloom plant nature spring garden" },
  { name: "sun", category: "Nature & weather", keywords: "morning day weather light warm" },
  { name: "moon", category: "Nature & weather", keywords: "night sleep evening dark" },
  { name: "cloud", category: "Nature & weather", keywords: "weather sky cloudy" },
  { name: "cloud-rain", category: "Nature & weather", keywords: "rain weather storm wet" },
  { name: "snowflake", category: "Nature & weather", keywords: "snow cold winter freeze" },
  { name: "droplet", category: "Nature & weather", keywords: "water drop hydrate rain liquid" },
  { name: "wind", category: "Nature & weather", keywords: "breeze air weather blow" },
  { name: "sprout", category: "Nature & weather", keywords: "grow plant seed new start" },
  { name: "waves", category: "Nature & weather", keywords: "water sea ocean beach calm" },

  // Food & drink
  { name: "coffee", category: "Food & drink", keywords: "drink caffeine morning cafe tea" },
  { name: "utensils", category: "Food & drink", keywords: "food eat meal dinner restaurant" },
  { name: "apple", category: "Food & drink", keywords: "fruit healthy snack food" },
  { name: "pizza", category: "Food & drink", keywords: "food meal dinner fast" },
  { name: "wine", category: "Food & drink", keywords: "drink alcohol dinner celebrate" },
  { name: "beer", category: "Food & drink", keywords: "drink alcohol bar social" },
  { name: "cake", category: "Food & drink", keywords: "birthday dessert celebrate sweet" },
  { name: "carrot", category: "Food & drink", keywords: "veggie food healthy garden" },
  { name: "egg", category: "Food & drink", keywords: "food breakfast protein cook" },
  { name: "cup-soda", category: "Food & drink", keywords: "drink soda beverage cold" },
  { name: "cookie", category: "Food & drink", keywords: "snack sweet dessert treat" },
  { name: "ice-cream", category: "Food & drink", keywords: "dessert sweet cold treat" },

  // Home & places
  { name: "home", category: "Home & places", keywords: "house home family living place" },
  { name: "building-2", category: "Home & places", keywords: "apartment city building place" },
  { name: "store", category: "Home & places", keywords: "shop market buy retail" },
  { name: "warehouse", category: "Home & places", keywords: "storage industrial building" },
  { name: "tent", category: "Home & places", keywords: "camp outdoor adventure travel" },
  { name: "church", category: "Home & places", keywords: "faith worship religion place" },
  { name: "hotel", category: "Home & places", keywords: "stay travel room lodging" },
  { name: "factory", category: "Home & places", keywords: "industry work production building" },
  { name: "armchair", category: "Home & places", keywords: "relax home furniture rest comfort" },
  { name: "lamp", category: "Home & places", keywords: "light home room cozy" },
  { name: "door-open", category: "Home & places", keywords: "entrance exit open opportunity" },
  { name: "key", category: "Home & places", keywords: "unlock access security home" },

  // People & social
  { name: "user", category: "People & social", keywords: "person self profile me individual" },
  { name: "users", category: "People & social", keywords: "team group people friends social" },
  { name: "user-plus", category: "People & social", keywords: "add friend invite connect new" },
  { name: "baby", category: "People & social", keywords: "child kid family parenting" },
  { name: "smile", category: "People & social", keywords: "happy mood face emotion joy" },
  { name: "handshake-2", category: "People & social", keywords: "care give support kindness" },
  { name: "contact", category: "People & social", keywords: "person profile contact card" },
  { name: "venus-mars", category: "People & social", keywords: "gender relationship partner" },
  { name: "person-standing", category: "People & social", keywords: "body posture person stand" },
  { name: "hand", category: "People & social", keywords: "wave hello help gesture" },
  { name: "party", category: "People & social", keywords: "celebrate fun event social party" },
  { name: "gift", category: "People & social", keywords: "present birthday reward give" },

  // Tech & devices
  { name: "laptop", category: "Tech & devices", keywords: "computer work code device" },
  { name: "smartphone", category: "Tech & devices", keywords: "phone mobile device call" },
  { name: "monitor", category: "Tech & devices", keywords: "screen display computer desktop" },
  { name: "keyboard", category: "Tech & devices", keywords: "type input computer write" },
  { name: "mouse", category: "Tech & devices", keywords: "click computer device pointer" },
  { name: "cpu", category: "Tech & devices", keywords: "chip processor tech compute" },
  { name: "database", category: "Tech & devices", keywords: "data storage records server" },
  { name: "server", category: "Tech & devices", keywords: "host backend data cloud" },
  { name: "wifi", category: "Tech & devices", keywords: "internet network signal online" },
  { name: "bluetooth", category: "Tech & devices", keywords: "connect wireless device pair" },
  { name: "battery", category: "Tech & devices", keywords: "power charge energy device" },
  { name: "plug", category: "Tech & devices", keywords: "power charge electric energy" },

  // Travel & movement
  { name: "plane", category: "Travel & movement", keywords: "fly travel trip flight vacation" },
  { name: "car", category: "Travel & movement", keywords: "drive commute vehicle road" },
  { name: "train", category: "Travel & movement", keywords: "rail commute travel transit" },
  { name: "ship", category: "Travel & movement", keywords: "boat sea cruise travel" },
  { name: "bus", category: "Travel & movement", keywords: "transit commute public travel" },
  { name: "map", category: "Travel & movement", keywords: "location navigate explore route" },
  { name: "map-pin", category: "Travel & movement", keywords: "location place spot marker" },
  { name: "navigation", category: "Travel & movement", keywords: "direction gps route compass" },
  { name: "luggage", category: "Travel & movement", keywords: "trip travel suitcase pack" },
  { name: "globe", category: "Travel & movement", keywords: "world travel international earth" },
  { name: "anchor", category: "Travel & movement", keywords: "boat sea stable harbor ground" },
  { name: "fuel", category: "Travel & movement", keywords: "gas energy car drive station" },

  // Time & planning
  { name: "calendar", category: "Time & planning", keywords: "date schedule plan event day" },
  { name: "clock", category: "Time & planning", keywords: "time hour schedule when" },
  { name: "alarm", category: "Time & planning", keywords: "wake reminder time morning" },
  { name: "hourglass", category: "Time & planning", keywords: "time wait deadline duration" },
  { name: "timer", category: "Time & planning", keywords: "countdown stopwatch focus time" },
  { name: "repeat", category: "Time & planning", keywords: "habit recurring loop daily routine" },
  { name: "history", category: "Time & planning", keywords: "past log recent rewind time" },
  { name: "calendar-check", category: "Time & planning", keywords: "done scheduled plan complete" },
  { name: "watch", category: "Time & planning", keywords: "time wrist clock track" },
  { name: "bell", category: "Time & planning", keywords: "reminder notify alert ring" },
  { name: "list-checks", category: "Time & planning", keywords: "todo checklist tasks plan" },
  { name: "clipboard", category: "Time & planning", keywords: "list notes tasks plan record" },

  // Creative & play
  { name: "palette", category: "Creative & play", keywords: "art paint color design creative" },
  { name: "brush", category: "Creative & play", keywords: "paint art draw design" },
  { name: "music", category: "Creative & play", keywords: "song audio play sound notes" },
  { name: "guitar", category: "Creative & play", keywords: "music instrument play band" },
  { name: "camera", category: "Creative & play", keywords: "photo picture capture shoot" },
  { name: "film", category: "Creative & play", keywords: "movie video watch cinema media" },
  { name: "gamepad", category: "Creative & play", keywords: "game play console fun" },
  { name: "dice", category: "Creative & play", keywords: "game chance random play board" },
  { name: "scissors", category: "Creative & play", keywords: "craft cut make diy" },
  { name: "pen-tool", category: "Creative & play", keywords: "design draw vector create" },
  { name: "drama", category: "Creative & play", keywords: "theater act play performance" },
  { name: "headphones", category: "Creative & play", keywords: "music audio listen sound" },

  // Communication
  { name: "mail", category: "Communication", keywords: "email message send inbox letter" },
  { name: "message-circle", category: "Communication", keywords: "chat talk message text reply" },
  { name: "phone", category: "Communication", keywords: "call talk contact ring" },
  { name: "megaphone", category: "Communication", keywords: "announce shout promote broadcast" },
  { name: "send", category: "Communication", keywords: "submit message share deliver" },
  { name: "at-sign", category: "Communication", keywords: "mention email handle social" },
  { name: "speech", category: "Communication", keywords: "talk chat conversation discuss" },
  { name: "rss", category: "Communication", keywords: "feed subscribe news updates" },
  { name: "mailbox", category: "Communication", keywords: "mail post inbox receive" },
  { name: "voicemail", category: "Communication", keywords: "message call audio recording" },
  { name: "inbox", category: "Communication", keywords: "messages received tasks collect" },
  { name: "note", category: "Communication", keywords: "memo sticky reminder write" },

  // Symbols & misc
  { name: "star", category: "Symbols & misc", keywords: "favorite rate important highlight" },
  { name: "sparkles", category: "Symbols & misc", keywords: "magic shine special new ai" },
  { name: "shield", category: "Symbols & misc", keywords: "protect security safe defend" },
  { name: "eye", category: "Symbols & misc", keywords: "see watch view focus attention" },
  { name: "zap", category: "Symbols & misc", keywords: "energy power fast lightning bolt" },
  { name: "anchor-2", category: "Symbols & misc", keywords: "stable ground steady fixed" },
  { name: "infinity", category: "Symbols & misc", keywords: "forever endless loop unlimited" },
  { name: "orbit", category: "Symbols & misc", keywords: "cycle space loop revolve" },
  { name: "languages", category: "Symbols & misc", keywords: "translate speak words learn" },
  { name: "feather", category: "Symbols & misc", keywords: "light write quill gentle calm" },
  { name: "bookmark", category: "Symbols & misc", keywords: "save mark keep favorite" },
  { name: "tag", category: "Symbols & misc", keywords: "label category mark price" },
  { name: "alert", category: "Symbols & misc", keywords: "warning caution important notice" },
];

/** Catalog entries grouped in fixed category order (only non-empty categories). */
export function groupedCatalog(): { category: IconCategory; entries: CatalogEntry[] }[] {
  return ICON_CATEGORIES.map((category) => ({
    category,
    entries: ICON_CATALOG.filter((e) => e.category === category),
  })).filter((g) => g.entries.length > 0);
}

/** Flat, case-insensitive substring match over name + keywords. Empty query = whole catalog. */
export function filterCatalog(query: string): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ICON_CATALOG];
  return ICON_CATALOG.filter(
    (e) => e.name.toLowerCase().includes(q) || e.keywords.toLowerCase().includes(q),
  );
}
