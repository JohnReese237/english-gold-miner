export type GameState =
  | "ready"
  | "levelIntro"
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

export type MineralShape =
  | "smallGold"
  | "largeGold"
  | "diamond"
  | "ruby"
  | "amethyst"
  | "mysteryBag"
  | "crystal"
  | "moleBag"
  | "emerald"
  | "sapphire"
  | "rock"
  | "explosiveBarrel";
export type MineralCategory = "gold" | "diamond" | "gem" | "mystery" | "creature" | "rock" | "explosive";
export type WordMode = "words" | "mixed";
export type ItemId = "dynamite" | "strengthWater" | "clover" | "heatShield";
export type BackgroundKey = "normal" | "gem" | "core";

export interface MineralMotion {
  minX: number;
  maxX: number;
  speed: number;
  direction: 1 | -1;
}

export interface ThiefConfig {
  intervalSeconds: number;
  minSteal: number;
  maxSteal: number;
  percent: number;
  laneY: number;
  runDurationMs: number;
}

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
  scoreOverride?: number;
  weightOverride?: string;
  basePullSpeedOverride?: number;
  motion?: MineralMotion;
  restY?: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  durationSeconds: number;
  targetGold: number;
  wordMode: WordMode;
  shopItems: ItemId[];
  backgroundKey?: BackgroundKey;
  heatPullMultiplier?: number;
  thiefConfig?: ThiefConfig;
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

// ── Unit-organized word data ──
interface UnitWordData {
  unit: number; // 1-6, 0 for phonics extras
  name: string;
  easy: string[];
  medium: string[];
  easySentences: string[];
  hardSentences: string[];
}

const unitWordData: UnitWordData[] = [
  {
    unit: 1, name: "Go around",
    easy: ["bus", "car", "train", "plane", "zoo", "school", "park", "farm", "beach"],
    medium: ["by bus", "by car", "by train", "by plane", "look at", "Sanya", "Tianjin", "Harbin"],
    easySentences: ["I go by bus.", "I go by car.", "I go by train.", "I go by plane.", "I go to the zoo.", "I go to school by car."],
    hardSentences: ["It's spring. I go to the zoo. I go by bus.", "Three, two, one. Let's go!"],
  },
  {
    unit: 2, name: "Jobs",
    easy: ["doctor", "nurse", "driver", "farmer", "worker", "teacher", "job", "grandpa", "grandma", "dad", "mum"],
    medium: ["jobs", "student"],
    easySentences: ["This is my grandpa.", "This is my grandma.", "This is my dad.", "This is my mum.", "He is a doctor.", "She is a nurse.", "He is a driver.", "She is a farmer.", "He is a worker.", "I'm a driver."],
    hardSentences: ["We love our jobs!", "This is my father. He is a driver.", "This is my mother. She is a doctor."],
  },
  {
    unit: 3, name: "On the farm",
    easy: ["cow", "chicken", "sheep", "tree", "flower", "grass", "feed", "field", "help", "yes"],
    medium: ["welcome", "Let's feed"],
    easySentences: ["Welcome, children!", "We have some grass."],
    hardSentences: ["Let's feed them.", "Let's feed the cows and sheep!", "It has some trees.", "My farm has trees and grass."],
  },
  {
    unit: 4, name: "In class",
    easy: ["maths", "music", "art", "class", "like", "all", "run", "great", "Chinese", "English"],
    medium: ["PE", "in class", "have", "show"],
    easySentences: ["I have art and music.", "I like PE now.", "I like Chinese and PE.", "Let me show you.", "You can do it!"],
    hardSentences: ["But I have PE. I don't like it.", "Chinese, English and maths. I like them all!", "I like them all!"],
  },
  {
    unit: 5, name: "Fun time",
    easy: ["sing", "dance", "draw", "swim", "jump", "kick", "can", "well"],
    medium: ["football", "play football", "run fast", "do paper folding", "do tai chi", "play Chinese chess", "play the guzheng"],
    easySentences: ["I can sing.", "I can dance.", "I can swim.", "I can draw.", "I can play football.", "Can you jump? Yes, I can.", "I can run fast.", "Good job!"],
    hardSentences: ["What can you do?", "What can he do? He can draw.", "I can play football well."],
  },
  {
    unit: 6, name: "My happy week",
    easy: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "week", "paper", "box", "sorry"],
    medium: ["every day", "on Monday", "draw pictures", "go to the zoo", "coloured paper", "boxes", "Here you are", "Thank you"],
    easySentences: ["Let's go to the zoo.", "Thank you."],
    hardSentences: ["Can I have some boxes?", "Can I have some coloured paper?", "Let's draw pictures on Thursday.", "Let's play football on Friday.", "Let's go to the zoo on Saturday.", "This is my week. On Monday, I have Chinese, PE, English and maths.", "Saturday and Sunday, time to play!"],
  },
  {
    unit: 0, name: "Phonics",
    easy: ["orange", "pen", "queen", "rabbit", "sister", "tiger", "window", "yellow", "mouth", "nose", "van", "umbrella", "new", "see"],
    medium: [],
    easySentences: [],
    hardSentences: [],
  },
];

// Derived flat arrays (kept for backward compatibility)
const easyWords = unitWordData.flatMap((u) => u.easy);
const mediumWords = unitWordData.flatMap((u) => u.medium);
const easySentences = unitWordData.flatMap((u) => u.easySentences);
const hardSentences = unitWordData.flatMap((u) => u.hardSentences);

// Word-to-unit lookup map
const wordUnitMap = new Map<string, number>();
for (const unit of unitWordData) {
  for (const w of unit.easy) wordUnitMap.set(w, unit.unit);
  for (const w of unit.medium) wordUnitMap.set(w, unit.unit);
  for (const w of unit.easySentences) wordUnitMap.set(w, unit.unit);
  for (const w of unit.hardSentences) wordUnitMap.set(w, unit.unit);
}

function getWordUnit(word: string): number {
  return wordUnitMap.get(word) ?? 0;
}

export type WordDifficulty = "easy" | "medium" | "hard";

export function mineralDifficulty(typeId: MineralShape): WordDifficulty {
  switch (typeId) {
    case "smallGold":
      return "easy";
    case "largeGold":
      return "medium";
    case "diamond":
    case "ruby":
    case "crystal":
    case "mysteryBag":
    case "moleBag":
      return "hard";
    case "amethyst":
    case "emerald":
    case "sapphire":
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

// ── Word Picker: ensures no repeats + six-unit coverage ──
export class WordPicker {
  private used = new Set<string>();
  private unitCounts = new Map<number, number>();

  /** Reset used-word tracking (call when loading a new level). */
  reset(): void {
    this.used.clear();
    this.unitCounts.clear();
  }

  /**
   * Pick a word from the level pool, avoiding repeats and balancing across units.
   * When almost all words in the pool have been used, it auto-resets.
   */
  pick(levelIndex: number, wordMode: WordMode, difficulty?: WordDifficulty): string {
    const pool = levelWordPool(levelIndex, wordMode);

    // Exclude already-used words
    let available = pool.filter((w) => !this.used.has(w));

    // Auto-reset when running out of fresh words
    if (available.length < 3) {
      this.used.clear();
      available = pool;
    }

    // Determine which real units (1-6) have been picked the least
    const realUnits = [1, 2, 3, 4, 5, 6];
    const minCount = Math.min(...realUnits.map((u) => this.unitCounts.get(u) ?? 0));
    const targetUnits = new Set(realUnits.filter((u) => (this.unitCounts.get(u) ?? 0) === minCount));

    // Try to pick from least-used units first
    const fromTargetUnits = available.filter((w) => {
      const u = getWordUnit(w);
      return u > 0 && targetUnits.has(u);
    });

    let source = fromTargetUnits.length > 0 ? fromTargetUnits : available;

    // Apply difficulty preference: 60% chance to narrow to matching difficulty
    if (difficulty) {
      const preferred = source.filter((w) => {
        if (difficulty === "easy") return easyWords.includes(w);
        if (difficulty === "medium") return mediumWords.includes(w) || easySentences.includes(w);
        return hardSentences.includes(w) || easySentences.includes(w);
      });
      if (preferred.length > 0 && Math.random() < 0.6) {
        source = preferred;
      }
    }

    const word = source[Math.floor(Math.random() * source.length)];

    // Track
    this.used.add(word);
    const unit = getWordUnit(word);
    if (unit > 0) {
      this.unitCounts.set(unit, (this.unitCounts.get(unit) ?? 0) + 1);
    }

    return word;
  }
}

export function pickWordForLevel(levelIndex: number, wordMode: WordMode, difficulty?: WordDifficulty): string {
  const pool = levelWordPool(levelIndex, wordMode);
  if (!difficulty) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Fallback simple pick (used by legacy code paths)
  const preferred = pool.filter((w) => {
    if (difficulty === "easy") return easyWords.includes(w);
    if (difficulty === "medium") return mediumWords.includes(w) || easySentences.includes(w);
    return hardSentences.includes(w) || easySentences.includes(w);
  });
  const source = preferred.length > 0 && Math.random() < 0.6 ? preferred : pool;
  return source[Math.floor(Math.random() * source.length)];
}

const levelFiveMinerals: LevelConfig["minerals"] = [
  { typeId: "largeGold", x: 155, y: 410, radius: 52, label: "by bus" },
  { typeId: "diamond", x: 365, y: 400, radius: 23, label: "I go to the zoo." },
  { typeId: "smallGold", x: 720, y: 430, radius: 36, label: "pen" },
  { typeId: "ruby", x: 535, y: 475, radius: 18, label: "I like Chinese and PE." },
  { typeId: "largeGold", x: 905, y: 400, radius: 50, label: "teacher" },
  { typeId: "rock", x: 250, y: 620, radius: 48, label: "student" },
  { typeId: "ruby", x: 455, y: 625, radius: 18, label: "My farm has trees and grass." },
  { typeId: "largeGold", x: 640, y: 555, radius: 52, label: "Chinese" },
  { typeId: "diamond", x: 855, y: 610, radius: 23, label: "I go to school by car." },
  { typeId: "diamond", x: 1035, y: 365, radius: 23, label: "Let's go to the zoo on Saturday." },
  { typeId: "amethyst", x: 1110, y: 635, radius: 22, label: "This is my father. He is a driver." },
  { typeId: "explosiveBarrel", x: 990, y: 455, radius: 34, label: "danger" },
  { typeId: "rock", x: 1040, y: 585, radius: 44, label: "great" },
  { typeId: "largeGold", x: 1165, y: 470, radius: 50, label: "Chinese" },
];

const levelSevenMinerals: LevelConfig["minerals"] = [
  { typeId: "largeGold", x: 150, y: 410, radius: 52, label: "by bus" },
  { typeId: "mysteryBag", x: 330, y: 455, radius: 34, label: "mystery" },
  { typeId: "crystal", x: 520, y: 410, radius: 24, label: "It has some trees." },
  { typeId: "ruby", x: 715, y: 455, radius: 18, label: "What can you do?" },
  { typeId: "diamond", x: 935, y: 420, radius: 23, label: "I can play football well." },
  { typeId: "rock", x: 245, y: 620, radius: 46, label: "student" },
  { typeId: "amethyst", x: 455, y: 620, radius: 22, label: "My farm has trees and grass." },
  { typeId: "mysteryBag", x: 650, y: 585, radius: 34, label: "welcome" },
  { typeId: "largeGold", x: 840, y: 610, radius: 52, label: "teacher" },
  { typeId: "explosiveBarrel", x: 990, y: 475, radius: 34, label: "danger" },
  { typeId: "crystal", x: 1100, y: 610, radius: 24, label: "Let's draw pictures on Thursday." },
  { typeId: "rock", x: 1160, y: 470, radius: 44, label: "great" },
];

const levelEightMinerals: LevelConfig["minerals"] = [
  { typeId: "moleBag", x: 165, y: 425, radius: 36, label: "sing", motion: { minX: 90, maxX: 360, speed: 70, direction: 1 } },
  { typeId: "mysteryBag", x: 360, y: 450, radius: 34, label: "welcome" },
  { typeId: "crystal", x: 545, y: 415, radius: 24, label: "This is my mum. She is a doctor." },
  { typeId: "diamond", x: 760, y: 430, radius: 23, label: "I can draw." },
  { typeId: "ruby", x: 975, y: 425, radius: 18, label: "Can I have some boxes?" },
  { typeId: "smallGold", x: 1120, y: 500, radius: 36, label: "bus" },
  { typeId: "rock", x: 245, y: 620, radius: 48, label: "great" },
  { typeId: "moleBag", x: 500, y: 620, radius: 36, label: "dance", motion: { minX: 375, maxX: 700, speed: 86, direction: -1 } },
  { typeId: "amethyst", x: 725, y: 610, radius: 22, label: "I go to school by car." },
  { typeId: "mysteryBag", x: 915, y: 600, radius: 34, label: "draw pictures" },
  { typeId: "explosiveBarrel", x: 1035, y: 500, radius: 34, label: "danger" },
  { typeId: "rock", x: 1130, y: 620, radius: 46, label: "every day" },
];

const levelNineMinerals: LevelConfig["minerals"] = [
  { typeId: "emerald", x: 150, y: 425, radius: 22, label: "This is my week. On Monday, I have Chinese, PE, English and maths." },
  { typeId: "sapphire", x: 330, y: 455, radius: 22, label: "I can play football." },
  { typeId: "crystal", x: 520, y: 410, radius: 24, label: "Can I have some coloured paper?" },
  { typeId: "mysteryBag", x: 705, y: 455, radius: 34, label: "welcome" },
  { typeId: "moleBag", x: 930, y: 420, radius: 36, label: "jump", motion: { minX: 790, maxX: 1160, speed: 92, direction: 1 } },
  { typeId: "diamond", x: 1120, y: 510, radius: 23, label: "Let's play football on Friday." },
  { typeId: "rock", x: 240, y: 610, radius: 48, label: "student" },
  { typeId: "amethyst", x: 450, y: 625, radius: 22, label: "My farm has trees and grass." },
  { typeId: "largeGold", x: 635, y: 585, radius: 50, label: "mum" },
  { typeId: "emerald", x: 835, y: 620, radius: 22, label: "This is my father. He is a driver." },
  { typeId: "explosiveBarrel", x: 995, y: 480, radius: 34, label: "danger" },
  { typeId: "sapphire", x: 1120, y: 640, radius: 22, label: "This is my mother. She is a doctor." },
  { typeId: "rock", x: 1185, y: 445, radius: 44, label: "great" },
];

const levelTenMinerals: LevelConfig["minerals"] = [
  { typeId: "sapphire", x: 165, y: 425, radius: 22, label: "I go to school by car." },
  { typeId: "mysteryBag", x: 330, y: 455, radius: 34, label: "welcome" },
  { typeId: "rock", x: 520, y: 410, radius: 48, label: "student" },
  { typeId: "emerald", x: 700, y: 450, radius: 22, label: "But I have PE. I don't like it." },
  { typeId: "moleBag", x: 935, y: 425, radius: 36, label: "swim", motion: { minX: 800, maxX: 1170, speed: 105, direction: -1 } },
  { typeId: "explosiveBarrel", x: 1090, y: 510, radius: 34, label: "danger" },
  { typeId: "crystal", x: 245, y: 615, radius: 24, label: "I like Chinese and PE." },
  { typeId: "rock", x: 455, y: 625, radius: 48, label: "great" },
  { typeId: "amethyst", x: 645, y: 585, radius: 22, label: "What can he do? He can draw." },
  { typeId: "mysteryBag", x: 835, y: 620, radius: 34, label: "draw pictures" },
  { typeId: "diamond", x: 995, y: 465, radius: 23, label: "Let's go to the zoo on Saturday." },
  { typeId: "rock", x: 1130, y: 635, radius: 46, label: "every day" },
  { typeId: "explosiveBarrel", x: 1190, y: 480, radius: 34, label: "danger" },
];

const levelElevenMinerals: LevelConfig["minerals"] = [
  { typeId: "emerald", x: 150, y: 430, radius: 22, label: "Saturday and Sunday, time to play!" },
  { typeId: "sapphire", x: 325, y: 455, radius: 22, label: "This is my week. On Monday, I have Chinese, PE, English and maths." },
  { typeId: "rock", x: 505, y: 420, radius: 50, label: "student" },
  { typeId: "crystal", x: 700, y: 450, radius: 24, label: "My farm has trees and grass." },
  { typeId: "moleBag", x: 930, y: 425, radius: 36, label: "kick", motion: { minX: 780, maxX: 1175, speed: 116, direction: 1 } },
  { typeId: "explosiveBarrel", x: 1100, y: 500, radius: 34, label: "danger" },
  { typeId: "mysteryBag", x: 245, y: 610, radius: 34, label: "welcome" },
  { typeId: "diamond", x: 430, y: 625, radius: 23, label: "Let's go to the zoo on Saturday." },
  { typeId: "amethyst", x: 620, y: 590, radius: 22, label: "Let's feed the cows and sheep!" },
  { typeId: "rock", x: 820, y: 615, radius: 50, label: "great" },
  { typeId: "ruby", x: 990, y: 610, radius: 18, label: "Can I have some boxes?" },
  { typeId: "sapphire", x: 1110, y: 635, radius: 22, label: "This is my mother. She is a doctor." },
  { typeId: "explosiveBarrel", x: 1180, y: 470, radius: 34, label: "danger" },
  { typeId: "moleBag", x: 615, y: 500, radius: 36, label: "draw", motion: { minX: 420, maxX: 760, speed: 95, direction: -1 } },
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
    minAngle: -80,
    maxAngle: 80,
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
      { label: "没声音", min: 0, multiplier: 0.25 },
      { label: "小声", min: 0.18, multiplier: 0.6 },
      { label: "正常", min: 0.38, multiplier: 1.0 },
      { label: "大声", min: 0.62, multiplier: 1.6 },
      { label: "很大声", min: 0.82, multiplier: 2.2 },
    ],
  },
  items: [
    { id: "dynamite", name: "炸药", price: 120, icon: "💣", description: "误抓石头时炸毁它" },
    { id: "strengthWater", name: "大力水", price: 180, icon: "💪", description: "本次拉回速度翻倍" },
    { id: "clover", name: "幸运三叶草", price: 220, icon: "☘", description: "本关所有物品价值+30%" },
    { id: "heatShield", name: "防护罩", price: 420, icon: "◉", description: "本关免疫高温和偷金币" },
  ],
  minerals: [
    { id: "smallGold", category: "gold", name: "小金块", score: 50, weight: "轻", basePullSpeed: 140, radius: 36, color: "#ffd542" },
    { id: "largeGold", category: "gold", name: "大金块", score: 150, weight: "重", basePullSpeed: 55, radius: 52, color: "#ffc328" },
    { id: "diamond", category: "diamond", name: "钻石", score: 250, weight: "中等", basePullSpeed: 90, radius: 23, color: "#26d8ff" },
    { id: "ruby", category: "gem", name: "红宝石", score: 300, weight: "中等", basePullSpeed: 85, radius: 18, color: "#ff3a35" },
    { id: "amethyst", category: "gem", name: "紫宝石", score: 350, weight: "偏重", basePullSpeed: 70, radius: 22, color: "#9c57ff" },
    { id: "mysteryBag", category: "mystery", name: "神秘袋子", score: 180, weight: "随机", basePullSpeed: 85, radius: 34, color: "#c9853a" },
    { id: "crystal", category: "gem", name: "水晶", score: 300, weight: "中等", basePullSpeed: 82, radius: 24, color: "#b8fbff" },
    { id: "moleBag", category: "creature", name: "背袋鼹鼠", score: 220, weight: "随机", basePullSpeed: 95, radius: 36, color: "#8b5736" },
    { id: "emerald", category: "gem", name: "祖母绿", score: 480, weight: "偏重", basePullSpeed: 62, radius: 22, color: "#23d56f" },
    { id: "sapphire", category: "gem", name: "蓝宝石", score: 520, weight: "偏重", basePullSpeed: 58, radius: 22, color: "#246bff" },
    { id: "rock", category: "rock", name: "石头", score: 10, weight: "很重", basePullSpeed: 25, radius: 46, color: "#8d8173" },
    { id: "explosiveBarrel", category: "explosive", name: "炸药桶", score: 0, weight: "危险", basePullSpeed: 130, radius: 34, color: "#d64227" },
  ],
  levels: [
    {
      id: 1,
      name: "练习关",
      durationSeconds: 60,
      targetGold: 450,
      wordMode: "words",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: [
        { typeId: "smallGold", x: 170, y: 430, radius: 36, label: "bus" },
        { typeId: "largeGold", x: 390, y: 460, radius: 52, label: "teacher" },
        { typeId: "smallGold", x: 720, y: 430, radius: 38, label: "pen" },
        { typeId: "largeGold", x: 610, y: 585, radius: 52, label: "Chinese" },
        { typeId: "smallGold", x: 930, y: 610, radius: 36, label: "maths" },
        { typeId: "largeGold", x: 1100, y: 500, radius: 50, label: "school" },
        { typeId: "largeGold", x: 250, y: 610, radius: 50, label: "Monday" },
        { typeId: "smallGold", x: 840, y: 510, radius: 38, label: "music" },
      ],
    },
    {
      id: 2,
      name: "石头出现",
      durationSeconds: 60,
      targetGold: 800,
      wordMode: "words",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: [
        { typeId: "largeGold", x: 165, y: 430, radius: 52, label: "window" },
        { typeId: "rock", x: 360, y: 410, radius: 46, label: "student" },
        { typeId: "smallGold", x: 740, y: 440, radius: 38, label: "orange" },
        { typeId: "largeGold", x: 620, y: 560, radius: 52, label: "mum" },
        { typeId: "rock", x: 260, y: 620, radius: 48, label: "great" },
        { typeId: "smallGold", x: 910, y: 610, radius: 38, label: "paper" },
        { typeId: "largeGold", x: 1110, y: 595, radius: 50, label: "dad" },
        { typeId: "largeGold", x: 485, y: 600, radius: 50, label: "play football" },
        { typeId: "largeGold", x: 950, y: 440, radius: 50, label: "doctor" },
        { typeId: "smallGold", x: 1045, y: 505, radius: 38, label: "nurse" },
      ],
    },
    {
      id: 3,
      name: "钻石关",
      durationSeconds: 60,
      targetGold: 1400,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: [
        { typeId: "largeGold", x: 165, y: 430, radius: 52, label: "by bus" },
        { typeId: "diamond", x: 365, y: 405, radius: 45, label: "I go to the zoo." },
        { typeId: "rock", x: 760, y: 420, radius: 48, label: "welcome" },
        { typeId: "largeGold", x: 620, y: 550, radius: 52, label: "Chinese" },
        { typeId: "rock", x: 260, y: 620, radius: 48, label: "great" },
        { typeId: "smallGold", x: 455, y: 630, radius: 38, label: "pen" },
        { typeId: "diamond", x: 860, y: 610, radius: 43, label: "I like Chinese and PE." },
        { typeId: "largeGold", x: 1110, y: 635, radius: 50, label: "farmer" },
        { typeId: "largeGold", x: 520, y: 465, radius: 50, label: "orange" },
        { typeId: "largeGold", x: 945, y: 430, radius: 50, label: "worker" },
        { typeId: "largeGold", x: 1005, y: 535, radius: 50, label: "every day" },
      ],
    },
    {
      id: 4,
      name: "炸药桶",
      durationSeconds: 60,
      targetGold: 1500,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: [
        { typeId: "largeGold", x: 155, y: 420, radius: 52, label: "grandpa" },
        { typeId: "diamond", x: 365, y: 400, radius: 45, label: "I go to school by car." },
        { typeId: "rock", x: 750, y: 420, radius: 46, label: "student" },
        { typeId: "explosiveBarrel", x: 965, y: 455, radius: 34, label: "danger" },
        { typeId: "largeGold", x: 620, y: 555, radius: 52, label: "Thank you" },
        { typeId: "rock", x: 260, y: 620, radius: 48, label: "welcome" },
        { typeId: "diamond", x: 850, y: 610, radius: 43, label: "My farm has trees and grass." },
        { typeId: "largeGold", x: 1110, y: 635, radius: 50, label: "draw pictures" },
        { typeId: "diamond", x: 535, y: 465, radius: 43, label: "This is my mum. She is a doctor." },
        { typeId: "largeGold", x: 690, y: 610, radius: 50, label: "great" },
        { typeId: "largeGold", x: 1105, y: 505, radius: 50, label: "sorry" },
      ],
    },
    {
      id: 5,
      name: "宝石关",
      durationSeconds: 55,
      targetGold: 2300,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: levelFiveMinerals,
    },
    {
      id: 6,
      name: "限时挑战",
      durationSeconds: 40,
      targetGold: 2300,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: levelFiveMinerals,
    },
    {
      id: 7,
      name: "神秘矿洞",
      durationSeconds: 50,
      targetGold: 2100,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: levelSevenMinerals,
    },
    {
      id: 8,
      name: "背袋鼹鼠",
      durationSeconds: 45,
      targetGold: 2000,
      wordMode: "mixed",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: levelEightMinerals,
    },
    {
      id: 9,
      name: "地心世界",
      durationSeconds: 45,
      targetGold: 3200,
      wordMode: "mixed",
      backgroundKey: "core",
      shopItems: ["dynamite", "strengthWater", "clover"],
      minerals: levelNineMinerals,
    },
    {
      id: 10,
      name: "高温矿脉",
      durationSeconds: 40,
      targetGold: 2400,
      wordMode: "mixed",
      backgroundKey: "core",
      heatPullMultiplier: 0.72,
      thiefConfig: { intervalSeconds: 10, minSteal: 60, maxSteal: 150, percent: 0.08, laneY: 276, runDurationMs: 4800 },
      shopItems: ["dynamite", "strengthWater", "clover", "heatShield"],
      minerals: levelTenMinerals,
    },
    {
      id: 11,
      name: "终极挑战",
      durationSeconds: 35,
      targetGold: 3500,
      wordMode: "mixed",
      backgroundKey: "core",
      heatPullMultiplier: 0.72,
      thiefConfig: { intervalSeconds: 10, minSteal: 60, maxSteal: 150, percent: 0.08, laneY: 276, runDurationMs: 4800 },
      shopItems: ["dynamite", "strengthWater", "clover", "heatShield"],
      minerals: levelElevenMinerals,
    },
  ],
};
