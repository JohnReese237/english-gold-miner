export type GameState =
  | "ready"
  | "aiming"
  | "launching"
  | "hitSlowMotion"
  | "wordShuffle"
  | "pulling"
  | "scoring"
  | "levelComplete"
  | "shop"
  | "success"
  | "failed";

export type MineralShape = "smallGold" | "largeGold" | "diamond" | "ruby" | "amethyst" | "rock" | "explosiveBarrel";
export type MineralCategory = "gold" | "diamond" | "gem" | "rock" | "explosive";
export type WordMode = "words" | "mixed";
export type ItemId = "dynamite" | "strengthWater" | "clover" | "diamondDrill" | "gemDrill";
export type DrillMode = "normal" | "diamond" | "gem";

export interface MineralTypeConfig {
  id: MineralShape;
  category: MineralCategory;
  name: string;
  score: number;
  weight: string;
  basePullSpeed: number;
  radius: number;
  color: string;
}

export interface MineralInstance {
  id: number;
  typeId: MineralShape;
  x: number;
  y: number;
  radius: number;
  label: string;
  collected: boolean;
  hooked: boolean;
}

export interface LevelConfig {
  id: number;
  name: string;
  durationSeconds: number;
  targetGold: number;
  wordMode: WordMode;
  shopItems: ItemId[];
  minerals: Array<Omit<MineralInstance, "id" | "collected" | "hooked">>;
}

export interface ShopItemConfig {
  id: ItemId;
  name: string;
  price: number;
  icon: string;
  description: string;
}

export interface VolumeFactor {
  label: string;
  min: number;
  multiplier: number;
}

export interface GameConfig {
  width: number;
  height: number;
  stageTop: number;
  wordBank: string[];
  sentenceBank: string[];
  hook: {
    originX: number;
    originY: number;
    minAngle: number;
    maxAngle: number;
    swingSpeed: number;
    launchSpeed: number;
    maxLength: number;
    pullFinishLength: number;
  };
  timing: {
    hitSlowMotionMs: number;
    wordShuffleMs: number;
    scoringMs: number;
    levelCompleteMs: number;
  };
  audio: {
    threshold: number;
    smoothing: number;
    factors: VolumeFactor[];
  };
  items: ShopItemConfig[];
  minerals: MineralTypeConfig[];
  levels: LevelConfig[];
}

const easyWords = [
  "one", "two", "three", "four", "five", "six", "seven", "number",
  "book", "pencil", "pen", "desk", "chair", "door", "window",
  "head", "hand", "leg", "foot", "body",
  "big", "old", "new", "tall", "fast",
  "car", "bus", "plane", "train",
  "apple", "cake", "food",
  "home", "house", "room", "bed", "table", "sofa",
  "sheep", "chicken", "grass", "farm",
  "spring", "summer", "autumn", "winter", "snow",
  "balloon", "robot", "kite", "hat", "card", "football",
  "happy", "sad", "hungry", "tired",
  "doctor", "nurse", "driver", "farmer", "worker", "student",
  "red", "blue", "green", "yellow",
];

const mediumWords = [
  "classroom", "teacher", "school", "blackboard",
  "clean", "tidy", "amazing", "lucky", "yummy", "sweet", "strong",
  "move", "kick", "draw", "dance", "sing", "read", "open", "look",
  "help", "show", "make", "turn",
  "dinner", "noodle", "angry", "season",
  "Chinese", "queen", "child", "very", "some", "many",
  "please", "thank", "live", "next", "by",
  "basketball", "mother", "father", "sister", "brother",
  "orange", "banana", "milk", "water", "rice",
  "cold", "hot", "pretty", "beautiful",
];

const easySentences = [
  "It's a book.", "It's a pencil.", "It's a desk.", "It's a kite.",
  "What's this?", "I can run.", "I can sing.", "I can dance.",
  "I can draw.", "I can read.", "I'm hungry.", "I'm happy.",
  "I'm sad.", "I'm tired.", "I'm angry.", "I like apples.",
  "I like cake.", "I like football.", "I want noodles.", "I want cake.",
  "He is a doctor.", "She is a nurse.", "He is a driver.",
  "She is a farmer.", "He is a worker.", "I am a student.",
  "I go by bus.", "I go by car.", "I go by plane.", "I go by train.",
  "Open your book.", "Look at the blackboard.", "Hello.", "Thank you.",
  "It's big.", "It's new.", "It's old.", "She is tall.", "He is strong.",
];

const hardSentences = [
  "This is my room.", "This is my home.", "This is my classroom.",
  "The room is clean.", "The room is tidy.",
  "I can play football.", "I like spring.", "I like summer.",
  "It's spring.", "It's winter.", "It's snowing.",
  "Let's make a card.", "Let's make a kite.",
  "Show me your card.", "Show me your kite.",
  "I go to school by bus.", "Touch your head.", "Move your hand.",
  "I can see sheep.", "I can see chickens.", "This is a farm.",
  "It's yummy.", "It's sweet.", "It's very big.",
  "The sheep is on the grass.", "The chicken is on the farm.",
  "I can sing and dance.", "This is my father. He is a driver.",
  "This is my mother. She is a doctor.",
  "I want an apple.", "I want a kite.",
  "This is my head. This is my hand.",
  "I like winter.", "I go to school by bus.",
];

export type WordDifficulty = "easy" | "medium" | "hard";

export function mineralDifficulty(typeId: MineralShape): WordDifficulty {
  switch (typeId) {
    case "smallGold":
      return "easy";
    case "largeGold":
      return "medium";
    case "diamond":
    case "ruby":
      return "hard";
    case "amethyst":
      return "hard";
    case "rock":
      return "medium";
    case "explosiveBarrel":
      return "easy";
  }
}

export function levelWordPool(levelIndex: number, wordMode: WordMode): string[] {
  const level = levelIndex + 1;
  if (wordMode === "words") {
    if (level <= 2) return easyWords;
    if (level <= 4) return [...easyWords, ...mediumWords];
    return [...mediumWords];
  }
  // mixed mode
  if (level <= 2) return [...easyWords, ...easySentences];
  if (level <= 4) return [...easyWords, ...mediumWords, ...easySentences];
  return [...mediumWords, ...easySentences, ...hardSentences];
}

function pickFromPool(pool: string[], preferredDifficulty: WordDifficulty): string {
  // Weight: 60% preferred, 40% any from pool
  const preferred = pool.filter((w) => {
    if (preferredDifficulty === "easy") return easyWords.includes(w);
    if (preferredDifficulty === "medium") return mediumWords.includes(w) || easySentences.includes(w);
    return hardSentences.includes(w) || easySentences.includes(w);
  });
  const source = preferred.length > 0 && Math.random() < 0.6 ? preferred : pool;
  return source[Math.floor(Math.random() * source.length)];
}

export function pickWordForLevel(levelIndex: number, wordMode: WordMode, difficulty?: WordDifficulty): string {
  const pool = levelWordPool(levelIndex, wordMode);
  if (!difficulty) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return pickFromPool(pool, difficulty);
}

const levelFiveMinerals: LevelConfig["minerals"] = [
  { typeId: "largeGold", x: 155, y: 410, radius: 52, label: "classroom" },
  { typeId: "diamond", x: 365, y: 400, radius: 45, label: "It's spring." },
  { typeId: "smallGold", x: 720, y: 430, radius: 38, label: "pencil" },
  { typeId: "ruby", x: 535, y: 475, radius: 38, label: "I can sing and dance." },
  { typeId: "largeGold", x: 905, y: 400, radius: 50, label: "teacher" },
  { typeId: "rock", x: 250, y: 620, radius: 48, label: "strong" },
  { typeId: "ruby", x: 455, y: 625, radius: 38, label: "The room is clean." },
  { typeId: "largeGold", x: 640, y: 555, radius: 52, label: "blackboard" },
  { typeId: "diamond", x: 855, y: 610, radius: 43, label: "I go to school by bus." },
  { typeId: "diamond", x: 1035, y: 365, radius: 43, label: "Let's make a kite." },
  { typeId: "amethyst", x: 1110, y: 635, radius: 45, label: "This is my father. He is a driver." },
  { typeId: "explosiveBarrel", x: 990, y: 455, radius: 34, label: "danger" },
  { typeId: "rock", x: 1040, y: 585, radius: 44, label: "beautiful" },
  { typeId: "largeGold", x: 1165, y: 470, radius: 50, label: "Chinese" },
];

export const config: GameConfig = {
  width: 1280,
  height: 720,
  stageTop: 260,
  wordBank: [...easyWords, ...mediumWords],
  sentenceBank: [...easySentences, ...hardSentences],
  hook: {
    originX: 620,
    originY: 218,
    minAngle: -74,
    maxAngle: 74,
    swingSpeed: 72,
    launchSpeed: 520,
    maxLength: 680,
    pullFinishLength: 30,
  },
  timing: {
    hitSlowMotionMs: 500,
    wordShuffleMs: 800,
    scoringMs: 350,
    levelCompleteMs: 700,
  },
  audio: {
    threshold: 50,
    smoothing: 0.85,
    factors: [
      { label: "没声音", min: 0, multiplier: 0.3 },
      { label: "小声", min: 0.18, multiplier: 0.8 },
      { label: "正常", min: 0.38, multiplier: 1.3 },
      { label: "大声", min: 0.62, multiplier: 2.2 },
      { label: "很大声", min: 0.82, multiplier: 3.2 },
    ],
  },
  items: [
    { id: "dynamite", name: "炸药", price: 120, icon: "💣", description: "误抓石头时炸毁它" },
    { id: "strengthWater", name: "大力水", price: 180, icon: "💪", description: "本次拉回速度翻倍" },
    { id: "clover", name: "幸运三叶草", price: 220, icon: "☘", description: "本关所有物品价值+30%" },
    { id: "diamondDrill", name: "金刚石钻头", price: 300, icon: "◆", description: "本关可抓钻石、金矿和石头" },
    { id: "gemDrill", name: "宝石钻头", price: 350, icon: "✦", description: "本关可抓宝石、钻石、金矿和石头" },
  ],
  minerals: [
    { id: "smallGold", category: "gold", name: "小金块", score: 50, weight: "轻", basePullSpeed: 170, radius: 36, color: "#ffd542" },
    { id: "largeGold", category: "gold", name: "大金块", score: 150, weight: "重", basePullSpeed: 86, radius: 52, color: "#ffc328" },
    { id: "diamond", category: "diamond", name: "钻石", score: 250, weight: "中等", basePullSpeed: 128, radius: 45, color: "#26d8ff" },
    { id: "ruby", category: "gem", name: "红宝石", score: 300, weight: "中等", basePullSpeed: 120, radius: 36, color: "#ff3a35" },
    { id: "amethyst", category: "gem", name: "紫宝石", score: 350, weight: "偏重", basePullSpeed: 102, radius: 43, color: "#9c57ff" },
    { id: "rock", category: "rock", name: "石头", score: 10, weight: "很重", basePullSpeed: 54, radius: 46, color: "#8d8173" },
    { id: "explosiveBarrel", category: "explosive", name: "炸药桶", score: 0, weight: "危险", basePullSpeed: 145, radius: 34, color: "#d64227" },
  ],
  levels: [
    {
      id: 1,
      name: "练习关",
      durationSeconds: 60,
      targetGold: 520,
      wordMode: "words",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: [
        { typeId: "smallGold", x: 170, y: 430, radius: 36, label: "book" },
        { typeId: "largeGold", x: 390, y: 460, radius: 52, label: "teacher" },
        { typeId: "smallGold", x: 720, y: 430, radius: 38, label: "pencil" },
        { typeId: "largeGold", x: 610, y: 585, radius: 52, label: "classroom" },
        { typeId: "smallGold", x: 930, y: 610, radius: 36, label: "desk" },
        { typeId: "largeGold", x: 1100, y: 500, radius: 50, label: "school" },
        { typeId: "largeGold", x: 250, y: 610, radius: 50, label: "seven" },
        { typeId: "smallGold", x: 840, y: 510, radius: 38, label: "chair" },
      ],
    },
    {
      id: 2,
      name: "石头出现",
      durationSeconds: 60,
      targetGold: 600,
      wordMode: "words",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: [
        { typeId: "largeGold", x: 165, y: 430, radius: 52, label: "window" },
        { typeId: "rock", x: 360, y: 410, radius: 46, label: "strong" },
        { typeId: "smallGold", x: 740, y: 440, radius: 38, label: "apple" },
        { typeId: "largeGold", x: 620, y: 560, radius: 52, label: "mother" },
        { typeId: "rock", x: 260, y: 620, radius: 48, label: "beautiful" },
        { typeId: "smallGold", x: 910, y: 610, radius: 38, label: "cake" },
        { typeId: "largeGold", x: 1110, y: 595, radius: 50, label: "father" },
        { typeId: "largeGold", x: 485, y: 600, radius: 50, label: "football" },
        { typeId: "largeGold", x: 950, y: 440, radius: 50, label: "doctor" },
        { typeId: "smallGold", x: 1045, y: 505, radius: 38, label: "nurse" },
      ],
    },
    {
      id: 3,
      name: "钻石关",
      durationSeconds: 60,
      targetGold: 950,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover", "diamondDrill"],
      minerals: [
        { typeId: "largeGold", x: 165, y: 430, radius: 52, label: "blackboard" },
        { typeId: "diamond", x: 365, y: 405, radius: 45, label: "It's spring." },
        { typeId: "rock", x: 760, y: 420, radius: 48, label: "yummy" },
        { typeId: "largeGold", x: 620, y: 550, radius: 52, label: "Chinese" },
        { typeId: "rock", x: 260, y: 620, radius: 48, label: "pretty" },
        { typeId: "smallGold", x: 455, y: 630, radius: 38, label: "kite" },
        { typeId: "diamond", x: 860, y: 610, radius: 43, label: "I can sing and dance." },
        { typeId: "largeGold", x: 1110, y: 635, radius: 50, label: "farmer" },
        { typeId: "largeGold", x: 520, y: 465, radius: 50, label: "noodle" },
        { typeId: "largeGold", x: 945, y: 430, radius: 50, label: "worker" },
        { typeId: "largeGold", x: 1005, y: 535, radius: 50, label: "season" },
      ],
    },
    {
      id: 4,
      name: "炸药桶",
      durationSeconds: 60,
      targetGold: 990,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover", "diamondDrill"],
      minerals: [
        { typeId: "largeGold", x: 155, y: 420, radius: 52, label: "dinner" },
        { typeId: "diamond", x: 365, y: 400, radius: 45, label: "I go to school by bus." },
        { typeId: "rock", x: 750, y: 420, radius: 46, label: "amazing" },
        { typeId: "explosiveBarrel", x: 965, y: 455, radius: 34, label: "danger" },
        { typeId: "largeGold", x: 620, y: 555, radius: 52, label: "thank" },
        { typeId: "rock", x: 260, y: 620, radius: 48, label: "lucky" },
        { typeId: "diamond", x: 850, y: 610, radius: 43, label: "The sheep is on the grass." },
        { typeId: "largeGold", x: 1110, y: 635, radius: 50, label: "sweet" },
        { typeId: "diamond", x: 535, y: 465, radius: 43, label: "Let's make a card." },
        { typeId: "largeGold", x: 690, y: 610, radius: 50, label: "clean" },
        { typeId: "largeGold", x: 1105, y: 505, radius: 50, label: "tidy" },
      ],
    },
    {
      id: 5,
      name: "宝石关",
      durationSeconds: 60,
      targetGold: 1540,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover", "diamondDrill", "gemDrill"],
      minerals: levelFiveMinerals,
    },
    {
      id: 6,
      name: "限时挑战",
      durationSeconds: 45,
      targetGold: 1650,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover", "diamondDrill", "gemDrill"],
      minerals: levelFiveMinerals,
    },
  ],
};
