import { useCallback, useEffect, useRef, useState } from "react";
import { config, BackgroundKey, GameState, ItemId, LevelConfig, MineralInstance, MineralShape, pickWordForLevel, mineralDifficulty } from "./config";
import { initAudioOnInteraction, playClick, playCollect, playExplosion, playFail, playHit, playItemUse, playLaunch, playLevelComplete, playShopBuy, setMasterVolume, startMusic, stopMusic } from "./audio";

interface HookState {
  angle: number;
  direction: 1 | -1;
  length: number;
  originX: number;
  originY: number;
}

interface AudioState {
  currentVolume: number;
  smoothedVolume: number;
  volumeFactor: number;
  micAvailable: boolean;
  testMode: boolean;
  threshold: number;
}

type Inventory = Record<ItemId, number>;

interface LevelSnapshot {
  gold: number;
  inventory: Inventory;
}

type AssetKey =
  | "bgNormal"
  | "bgGem"
  | "bgCore"
  | "minerSheet"
  | "resourcesSheet"
  | "equipmentSheet"
  | "hookJoint"
  | "mysteryBag"
  | "crystal"
  | "moleSheet"
  | "emerald"
  | "sapphire"
  | "thiefSheet"
  | "heatShield";

const assetSources: Record<AssetKey, string> = {
  bgNormal: "/assets/game/bg-normal.png",
  bgGem: "/assets/game/bg-gem.png",
  bgCore: "/assets/game/bg-core.png",
  minerSheet: "/assets/game/miner-anim-sheet.png",
  resourcesSheet: "/assets/game/resources-sheet.png",
  equipmentSheet: "/assets/game/equipment-sheet.png",
  hookJoint: "/assets/game/hook-joint.png",
  mysteryBag: "/assets/game/resources/mystery-bag.png",
  crystal: "/assets/game/resources/crystal.png",
  moleSheet: "/assets/game/resources/mole-sheet.png",
  emerald: "/assets/game/resources/emerald.png",
  sapphire: "/assets/game/resources/sapphire.png",
  thiefSheet: "/assets/game/resources/thief-sheet.png",
  heatShield: "/assets/game/items/heatShield.png",
};

const HOOK_INITIAL_LENGTH = 42;
const HOOK_JOINT_SIZE = 46;
const HOOK_SPRITE_SIZE = 52;
const HOOK_CENTER_OFFSET = 26;
const HOOK_GRAB_OFFSET = 48;
const HOOKED_MINERAL_OFFSET = 12;
const MINER_ROPE_X_RATIO = 0.44;
const CORE_SCENE_HOOK_DROP = 78;
const MOLE_ESCAPE_FACTOR = 1.25;
const MOLE_STRUGGLE_GAIN_PER_SECOND = 1.35;
const MOLE_STRUGGLE_RECOVER_PER_SECOND = 0.45;
const MOLE_LOW_VOICE_PULL_MULTIPLIER = 0.42;
const BARREL_BLAST_RADIUS = 185;
const THIEF_IMPACT_PROGRESS = 0.58;
const THIEF_SPRITE_SIZE = 98;

const backgroundAssetKey: Record<BackgroundKey, AssetKey> = {
  normal: "bgNormal",
  gem: "bgGem",
  core: "bgCore",
};

const mineralSpriteIndex: Partial<Record<MineralShape, number>> = {
  smallGold: 0,
  largeGold: 1,
  rock: 2,
  diamond: 3,
  ruby: 4,
  amethyst: 5,
  explosiveBarrel: 6,
};

const resourceAssetKey: Partial<Record<MineralShape, AssetKey>> = {
  mysteryBag: "mysteryBag",
  crystal: "crystal",
  emerald: "emerald",
  sapphire: "sapphire",
};

const hookOriginForLevelIndex = (levelIndex: number) => ({
  x: config.hook.originX,
  y: config.hook.originY + (levelIndex >= 8 ? CORE_SCENE_HOOK_DROP : 0),
});

type EffectState =
  | {
      type: "dynamite";
      startedAt: number;
      duration: number;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }
  | {
      type: "explosion";
      startedAt: number;
      duration: number;
      x: number;
      y: number;
      radius: number;
    }
  | {
      type: "clover";
      startedAt: number;
      duration: number;
    }
  | {
      type: "strength";
      startedAt: number;
      duration: number;
    };

interface ThiefRunState {
  startedAt: number;
  duration: number;
  side: "left" | "right";
  laneY: number;
  amount: number;
  impactResolved: boolean;
  blocked: boolean;
}

const emptyInventory = (): Inventory => ({
  dynamite: 0,
  strengthWater: 0,
  clover: 0,
  heatShield: 0,
});

const randomInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

const randomMysteryProfile = () => {
  const roll = Math.random();
  if (roll < 0.34) {
    return { scoreOverride: randomInt(80, 180), weightOverride: "轻", basePullSpeedOverride: 125 };
  }
  if (roll < 0.72) {
    return { scoreOverride: randomInt(180, 340), weightOverride: "中等", basePullSpeedOverride: 85 };
  }
  return { scoreOverride: randomInt(340, 560), weightOverride: "很重", basePullSpeedOverride: 45 };
};

const initialMinerals = (level: LevelConfig): MineralInstance[] => {
  const placed: Array<{ x: number; y: number; radius: number }> = [];
  return level.minerals.map((mineral, index) => {
    const typeRadius = mineralById(mineral.typeId).radius;
    // Random position within the soil area, avoiding overlaps
    let x: number;
    let y: number;
    let attempts = 0;
    const minY = config.stageTop + 60;
    const maxY = config.height - 50;
    const minX = 60;
    const maxX = config.width - 60;
    do {
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);
      attempts++;
      // Check overlap with already-placed minerals
      const overlaps = placed.some(
        (p) => Math.hypot(p.x - x, p.y - y) < p.radius + typeRadius + 20,
      );
      if (!overlaps || attempts > 200) break;
    } while (true);
    placed.push({ x, y, radius: typeRadius });
    const mysteryProfile =
      mineral.typeId === "mysteryBag" || mineral.typeId === "moleBag" ? randomMysteryProfile() : {};
    const motion =
      mineral.typeId === "moleBag"
        ? {
            minX: Math.max(minX, mineral.motion?.minX ?? x - 150),
            maxX: Math.min(maxX, mineral.motion?.maxX ?? x + 150),
            speed: mineral.motion?.speed ?? 82,
            direction: mineral.motion?.direction ?? (Math.random() > 0.5 ? 1 : -1),
          }
        : mineral.motion;
    return {
      ...mineral,
      ...mysteryProfile,
      id: index + 1,
      collected: false,
      hooked: false,
      radius: typeRadius,
      x,
      y,
      restY: y,
      motion,
    };
  });
};

const mineralById = (id: MineralShape) => config.minerals.find((mineral) => mineral.id === id)!;
const itemById = (id: ItemId) => config.items.find((item) => item.id === id)!;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

const drawSheetSprite = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  index: number,
  total: number,
  width: number,
  height: number,
) => {
  const cellWidth = image.width / total;
  const sourceSize = Math.min(cellWidth, image.height);
  const sourceX = index * cellWidth + (cellWidth - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, -width / 2, -height / 2, width, height);
};

interface SpriteFrameOptions {
  sourceInsetX?: number;
  sourceInsetY?: number;
  anchorX?: number;
  anchorY?: number;
}

const drawSpriteFrame = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frameIndex: number,
  columns: number,
  rows: number,
  width: number,
  height: number,
  flipX = false,
  options: SpriteFrameOptions = {},
) => {
  const cellWidth = image.width / columns;
  const cellHeight = image.height / rows;
  const column = frameIndex % columns;
  const row = Math.floor(frameIndex / columns);
  const insetX = cellWidth * (options.sourceInsetX ?? 0);
  const insetY = cellHeight * (options.sourceInsetY ?? 0);
  const sourceX = column * cellWidth + insetX;
  const sourceY = row * cellHeight + insetY;
  const sourceWidth = cellWidth - insetX * 2;
  const sourceHeight = cellHeight - insetY * 2;
  const anchorX = options.anchorX ?? 0.5;
  const anchorY = options.anchorY ?? 0.5;
  ctx.save();
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    -width * anchorX,
    -height * anchorY,
    width,
    height,
  );
  ctx.restore();
};

const isHeavyPull = (mineral: MineralInstance | null) => {
  if (!mineral) return false;
  const type = mineralById(mineral.typeId);
  if (type.category === "mystery" || type.category === "creature") {
    return mineral.weightOverride !== "轻";
  }
  return mineral.typeId === "largeGold" || type.category === "rock" || type.category === "diamond" || type.category === "gem";
};

const minerFrameForState = (
  state: GameState,
  timestamp: number,
  hookedMineral: MineralInstance | null,
  boostActive: boolean,
) => {
  if (state === "success" || state === "levelComplete" || state === "shop") return 8;
  if (state === "failed") return 9;
  if (state === "pulling" || state === "scoring") {
    const heavy = isHeavyPull(hookedMineral);
    const frameMs = boostActive && hookedMineral ? 220 : heavy ? 520 : 360;
    const offset = Math.floor(timestamp / frameMs) % 2;
    if (boostActive && hookedMineral) return 6 + offset;
    if (heavy) return 4 + offset;
    return 2 + offset;
  }
  if (state === "launching" || state === "hitSlowMotion" || state === "wordShuffle") return 1;
  return 0;
};

const angleToVector = (angle: number) => {
  const radians = ((angle + 90) * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
};

const endpointForHook = (hook: HookState) => {
  const vector = angleToVector(hook.angle);
  return {
    x: hook.originX + vector.x * hook.length,
    y: hook.originY + vector.y * hook.length,
  };
};

const pointAlongHook = (hook: HookState, distanceFromTop: number) => {
  const top = endpointForHook(hook);
  const vector = angleToVector(hook.angle);
  return {
    x: top.x + vector.x * distanceFromTop,
    y: top.y + vector.y * distanceFromTop,
  };
};

const grabPointForHook = (hook: HookState) => pointAlongHook(hook, HOOK_GRAB_OFFSET);

function App() {
  const firstLevel = config.levels[0];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const gameTimeRef = useRef(0);
  const gameStateRef = useRef<GameState>("ready");
  const levelIndexRef = useRef(0);
  const mineralsRef = useRef<MineralInstance[]>(initialMinerals(firstLevel));
  const initialHookOrigin = hookOriginForLevelIndex(0);
  const hookRef = useRef<HookState>({
    angle: 0,
    direction: 1,
    length: HOOK_INITIAL_LENGTH,
    originX: initialHookOrigin.x,
    originY: initialHookOrigin.y,
  });
  const targetWordRef = useRef("school");
  const hookedMineralRef = useRef<MineralInstance | null>(null);
  const stateStartedAtRef = useRef(0);
  const wordShuffleTickRef = useRef(-1);
  const rawVolumeRef = useRef(0);
  const smoothedVolumeRef = useRef(0);
  const forcedBoostRef = useRef(false);
  const settingsRef = useRef({ testMode: false, threshold: config.audio.threshold });
  const settingsOpenRef = useRef(false);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const goldRef = useRef(0);
  const inventoryRef = useRef<Inventory>(emptyInventory());
  const cloverActiveRef = useRef(false);
  const boostActiveRef = useRef(false);
  const heatShieldActiveRef = useRef(false);
  const effectsRef = useRef<EffectState[]>([]);
  const levelStartSnapshotRef = useRef<LevelSnapshot>({ gold: 0, inventory: emptyInventory() });
  const levelCompleteTargetRef = useRef<"shop" | "success">("shop");
  const imageAssetsRef = useRef<Partial<Record<AssetKey, HTMLImageElement>>>({});
  const nextThiefAtRef = useRef(0);
  const thiefRunRef = useRef<ThiefRunState | null>(null);
  const nextThiefSideRef = useRef<"left" | "right">("left");
  const lastActionExpiresAtRef = useRef(0);
  const moleStruggleProgressRef = useRef(0);

  const [gameState, setGameStateValue] = useState<GameState>("ready");
  const [levelIndex, setLevelIndex] = useState(0);
  const [shopLevelIndex, setShopLevelIndex] = useState(1);
  const [gold, setGoldState] = useState(0);
  const [timeLeft, setTimeLeft] = useState(firstLevel.durationSeconds);
  const [mineralsVersion, setMineralsVersion] = useState(0);
  const [targetWord, setTargetWord] = useState("school");
  const [settingsOpen, setSettingsOpenState] = useState(false);
  const [inventory, setInventoryState] = useState<Inventory>(emptyInventory());
  const [shopPurchases, setShopPurchases] = useState<Inventory>(emptyInventory());
  const [cloverActive, setCloverActiveState] = useState(false);
  const [boostActive, setBoostActiveState] = useState(false);
  const [heatShieldActive, setHeatShieldActiveState] = useState(false);
  const [manualBoostActive, setManualBoostActive] = useState(false);
  const [loadedAssetCount, setAssetLoadTick] = useState(0);
  const totalAssetCount = Object.keys(assetSources).length;
  const [lastAction, setLastAction] = useState("");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [audioState, setAudioState] = useState<AudioState>({
    currentVolume: 0,
    smoothedVolume: 0,
    volumeFactor: 0.3,
    micAvailable: true,
    testMode: false,
    threshold: config.audio.threshold,
  });

  const currentLevel = config.levels[levelIndex];
  const shopLevel = config.levels[shopLevelIndex] ?? config.levels[config.levels.length - 1];

  const setGameState = useCallback((next: GameState) => {
    gameStateRef.current = next;
    stateStartedAtRef.current = gameTimeRef.current;
    if (next === "wordShuffle") wordShuffleTickRef.current = -1;
    setGameStateValue(next);
  }, []);

  const setGoldValue = (next: number) => {
    goldRef.current = next;
    setGoldState(next);
  };

  const setSettingsOpen = (next: boolean) => {
    settingsOpenRef.current = next;
    setSettingsOpenState(next);
  };

  const togglePause = () => {
    if (["levelIntro", "shop", "success", "failed", "levelComplete"].includes(gameStateRef.current)) return;
    setPaused((prev) => {
      const next = !prev;
      pausedRef.current = next;
      if (next) stopMusic();
      else startMusic();
      return next;
    });
  };

  const handleRestart = () => {
    setPaused(false);
    pausedRef.current = false;
    retryLevel();
  };

  const setInventoryValue = (next: Inventory) => {
    inventoryRef.current = next;
    setInventoryState(next);
  };

  const setCloverActive = (next: boolean) => {
    cloverActiveRef.current = next;
    setCloverActiveState(next);
  };

  const setBoostActive = (next: boolean) => {
    boostActiveRef.current = next;
    setBoostActiveState(next);
  };

  const setHeatShieldActive = (next: boolean) => {
    heatShieldActiveRef.current = next;
    setHeatShieldActiveState(next);
  };

  const addEffect = (effect: EffectState) => {
    effectsRef.current = [...effectsRef.current, effect];
  };

  const showTimedAction = (message: string, durationMs = 2200) => {
    lastActionExpiresAtRef.current = gameTimeRef.current + durationMs;
    setLastAction(message);
  };

  useEffect(() => {
    let cancelled = false;
    for (const [key, source] of Object.entries(assetSources) as Array<[AssetKey, string]>) {
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        imageAssetsRef.current[key] = image;
        setAssetLoadTick((value) => value + 1);
      };
      image.onerror = () => {
        if (cancelled) return;
        setAssetLoadTick((value) => value + 1);
      };
      image.src = source;
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const pickWord = useCallback((level: LevelConfig, difficulty?: "easy" | "medium" | "hard") => {
    return pickWordForLevel(levelIndexRef.current, level.wordMode, difficulty);
  }, []);

  const scoreFor = useCallback((mineral: MineralInstance) => {
    const type = mineralById(mineral.typeId);
    if (type.category === "explosive") return 0;
    const score = mineral.scoreOverride ?? type.score;
    return cloverActiveRef.current ? Math.round(score * 1.3) : score;
  }, []);

  const canCapture = useCallback((mineral: MineralInstance) => {
    return !mineral.collected;
  }, []);

  const resetHook = () => {
    const origin = hookOriginForLevelIndex(levelIndexRef.current);
    hookedMineralRef.current = null;
    hookRef.current = { angle: 0, direction: 1, length: HOOK_INITIAL_LENGTH, originX: origin.x, originY: origin.y };
    forcedBoostRef.current = false;
    moleStruggleProgressRef.current = 0;
    setManualBoostActive(false);
  };

  const loadLevel = useCallback(
    (nextLevelIndex: number) => {
      const nextLevel = config.levels[nextLevelIndex];
      levelIndexRef.current = nextLevelIndex;
      setLevelIndex(nextLevelIndex);
      mineralsRef.current = initialMinerals(nextLevel);
      effectsRef.current = [];
      thiefRunRef.current = null;
      resetHook();
      setTimeLeft(nextLevel.durationSeconds);
      setCloverActive(false);
      setBoostActive(false);
      setHeatShieldActive(false);
      nextThiefAtRef.current = 0;
      nextThiefSideRef.current = "left";
      setTargetWord(pickWord(nextLevel));
      setMineralsVersion((value) => value + 1);
      setLastAction("");
      levelStartSnapshotRef.current = {
        gold: goldRef.current,
        inventory: { ...inventoryRef.current },
      };
      setGameState("levelIntro");
    },
    [pickWord, setGameState],
  );

  const resetToLevel = (nextLevelIndex: number) => {
    setGoldValue(0);
    setInventoryValue(emptyInventory());
    setShopPurchases(emptyInventory());
    loadLevel(nextLevelIndex);
  };

  const retryLevel = () => {
    const snapshot = levelStartSnapshotRef.current;
    setGoldValue(snapshot.gold);
    setInventoryValue({ ...snapshot.inventory });
    loadLevel(levelIndexRef.current);
  };

  const finishLevel = useCallback(() => {
    stopMusic();
    playLevelComplete();
    const nextLevelIndex = levelIndexRef.current + 1;
    if (nextLevelIndex >= config.levels.length) {
      levelCompleteTargetRef.current = "success";
    } else {
      levelCompleteTargetRef.current = "shop";
      setShopLevelIndex(nextLevelIndex);
      setShopPurchases(emptyInventory());
    }
    resetHook();
    setGameState("levelComplete");
  }, [setGameState]);

  const beginAiming = useCallback(() => {
    resetHook();
    mineralsRef.current = mineralsRef.current.map((mineral) => ({ ...mineral, hooked: false }));
    setMineralsVersion((value) => value + 1);
    setLastAction("");
    setGameState("aiming");
  }, [setGameState]);

  const startLevel = useCallback(() => {
    if (gameStateRef.current !== "levelIntro") return;
    const level = config.levels[levelIndexRef.current];
    nextThiefAtRef.current = level.thiefConfig ? gameTimeRef.current + level.thiefConfig.intervalSeconds * 1000 : 0;
    startMusic();
    setGameState("aiming");
  }, [setGameState]);

  const launchHook = useCallback(() => {
    initAudioOnInteraction();
    if (gameStateRef.current === "ready") {
      startMusic();
      startLevel();
      return;
    }
    if (gameStateRef.current === "levelIntro") {
      startLevel();
      return;
    }
    if (gameStateRef.current !== "aiming") return;
    playLaunch();
    setGameState("launching");
  }, [beginAiming, setGameState, startLevel]);

  const toggleTestMode = (enabled: boolean) => {
    settingsRef.current.testMode = enabled;
    forcedBoostRef.current = false;
    setManualBoostActive(false);
    setAudioState((previous) => ({ ...previous, testMode: enabled }));
  };

  const setThreshold = (threshold: number) => {
    settingsRef.current.threshold = threshold;
    setAudioState((previous) => ({ ...previous, threshold }));
  };

  const startManualBoost = () => {
    if (!settingsRef.current.testMode || gameStateRef.current !== "pulling") return;
    forcedBoostRef.current = true;
    setManualBoostActive(true);
  };

  const stopManualBoost = () => {
    forcedBoostRef.current = false;
    setManualBoostActive(false);
  };

  const buyItem = (itemId: ItemId) => {
    if (gameStateRef.current !== "shop") return;
    const item = itemById(itemId);
    if (goldRef.current < item.price || !shopLevel.shopItems.includes(itemId)) return;
    playShopBuy();
    setGoldValue(goldRef.current - item.price);
    setInventoryValue({ ...inventoryRef.current, [itemId]: inventoryRef.current[itemId] + 1 });
    setShopPurchases({ ...shopPurchases, [itemId]: shopPurchases[itemId] + 1 });
  };

  const enterShopLevel = () => {
    loadLevel(shopLevelIndex);
  };

  const useInventoryItem = (itemId: ItemId) => {
    const testModeActive = settingsRef.current.testMode;
    if (!testModeActive && inventoryRef.current[itemId] <= 0) return;
    const spendItem = (id: ItemId) => {
      if (testModeActive) return;
      setInventoryValue({ ...inventoryRef.current, [id]: inventoryRef.current[id] - 1 });
    };
    playItemUse();
    const hooked = hookedMineralRef.current;
    const type = hooked ? mineralById(hooked.typeId) : null;

    if (itemId === "dynamite") {
      if (gameStateRef.current !== "pulling" || !hooked || type?.category !== "rock") return;
      addEffect({
        type: "dynamite",
        startedAt: gameTimeRef.current,
        duration: 620,
        from: { x: 714, y: 158 },
        to: { x: hooked.x, y: hooked.y },
      });
      addEffect({
        type: "explosion",
        startedAt: gameTimeRef.current + 360,
        duration: 560,
        x: hooked.x,
        y: hooked.y,
        radius: hooked.radius + 46,
      });
      spendItem("dynamite");
      mineralsRef.current = mineralsRef.current.map((mineral) =>
        mineral.id === hooked.id ? { ...mineral, collected: true, hooked: false } : mineral,
      );
      resetHook();
      setMineralsVersion((value) => value + 1);
      setLastAction("炸药炸毁了石头");
      setGameState("scoring");
      return;
    }

    if (itemId === "strengthWater") {
      if (boostActiveRef.current) return;
      spendItem("strengthWater");
      setBoostActive(true);
      addEffect({ type: "strength", startedAt: gameTimeRef.current, duration: 900 });
      setLastAction("大力水生效，本关拉回加速");
      return;
    }

    if (itemId === "clover") {
      if (cloverActiveRef.current) return;
      spendItem("clover");
      setCloverActive(true);
      addEffect({ type: "clover", startedAt: gameTimeRef.current, duration: 1400 });
      setLastAction("幸运三叶草生效，本关价值提高");
      return;
    }

    if (itemId === "heatShield") {
      if (heatShieldActiveRef.current) return;
      spendItem("heatShield");
      setHeatShieldActive(true);
      showTimedAction("防护罩启动", 1800);
    }
  };

  const explodeBarrel = (barrel: MineralInstance) => {
    const blastRadius = BARREL_BLAST_RADIUS;
    mineralsRef.current = mineralsRef.current.map((mineral) => {
      const distance = Math.hypot(mineral.x - barrel.x, mineral.y - barrel.y);
      if (mineral.id === barrel.id || (!mineral.collected && distance <= blastRadius)) {
        return { ...mineral, collected: true, hooked: false };
      }
      return mineral;
    });
    addEffect({
      type: "explosion",
      startedAt: gameTimeRef.current,
      duration: 720,
      x: barrel.x,
      y: barrel.y,
      radius: blastRadius,
    });
    hookedMineralRef.current = null;
    setMineralsVersion((value) => value + 1);
    setLastAction("炸药桶爆炸，清空了周围资源");
    setGameState("pulling");
  };

  const volumeFactorFor = useCallback((volume: number) => {
    const thresholdScale = clamp(settingsRef.current.threshold / 50, 0.35, 2.2);
    const normalized = clamp(volume / thresholdScale, 0, 1);
    let selected = config.audio.factors[0];
    for (const factor of config.audio.factors) {
      if (normalized >= factor.min) selected = factor;
    }
    return selected.multiplier;
  }, []);

  useEffect(() => {
    if (loadedAssetCount >= totalAssetCount) {
      loadLevel(0);
    }
  }, [loadLevel, loadedAssetCount, totalAssetCount]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (settingsOpenRef.current || pausedRef.current || ["levelIntro", "shop", "success", "failed", "levelComplete"].includes(gameStateRef.current)) {
          return previous;
        }
        const next = Math.max(0, previous - 1);
        if (next === 0) {
          if (goldRef.current >= config.levels[levelIndexRef.current].targetGold) finishLevel();
          else { stopMusic(); playFail(); setGameState("failed"); }
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finishLevel, setGameState]);

  useEffect(() => {
    let cancelled = false;

    const setupAudio = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAudioState((previous) => ({ ...previous, micAvailable: false }));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        analyser.fftSize = 1024;
        const data = new Uint8Array(analyser.fftSize);
        source.connect(analyser);

        const sample = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const value of data) {
            const centered = (value - 128) / 128;
            sum += centered * centered;
          }
          rawVolumeRef.current = clamp(Math.sqrt(sum / data.length) * 3.2, 0, 1);
          if (!cancelled) requestAnimationFrame(sample);
        };
        sample();

        audioCleanupRef.current = () => {
          source.disconnect();
          analyser.disconnect();
          void audioContext.close();
          stream.getTracks().forEach((track) => track.stop());
        };
      } catch {
        setAudioState((previous) => ({ ...previous, micAvailable: false }));
      }
    };

    void setupAudio();
    return () => {
      cancelled = true;
      audioCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        launchHook();
      }
      if (event.code === "KeyT" && settingsRef.current.testMode && gameStateRef.current === "pulling") {
        forcedBoostRef.current = true;
        setManualBoostActive(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyT") {
        forcedBoostRef.current = false;
        setManualBoostActive(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [launchHook]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const loop = (timestamp: number) => {
      const previous = lastFrameRef.current || timestamp;
      const dt = pausedRef.current ? 0 : Math.min(0.033, (timestamp - previous) / 1000);
      lastFrameRef.current = timestamp;
      if (!pausedRef.current) {
        gameTimeRef.current += dt * 1000;
      }

      updateGame(dt, gameTimeRef.current);
      drawGame(context, gameTimeRef.current);
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const updateMovingMinerals = (dt: number) => {
    mineralsRef.current = mineralsRef.current.map((mineral) => {
      if (mineral.collected || mineral.hooked || !mineral.motion) return mineral;
      const nextX = mineral.x + mineral.motion.speed * mineral.motion.direction * dt;
      if (nextX <= mineral.motion.minX) {
        return { ...mineral, x: mineral.motion.minX, motion: { ...mineral.motion, direction: 1 } };
      }
      if (nextX >= mineral.motion.maxX) {
        return { ...mineral, x: mineral.motion.maxX, motion: { ...mineral.motion, direction: -1 } };
      }
      return { ...mineral, x: nextX };
    });
  };

  const runThiefEvent = (timestamp: number, level: LevelConfig) => {
    if (!level.thiefConfig || !nextThiefAtRef.current || timestamp < nextThiefAtRef.current) return;
    if (thiefRunRef.current) {
      nextThiefAtRef.current = timestamp + 1000;
      return;
    }
    nextThiefAtRef.current = timestamp + level.thiefConfig.intervalSeconds * 1000;

    const side = nextThiefSideRef.current;
    nextThiefSideRef.current = side === "left" ? "right" : "left";
    thiefRunRef.current = {
      startedAt: timestamp,
      duration: level.thiefConfig.runDurationMs,
      side,
      laneY: level.thiefConfig.laneY,
      amount: 0,
      impactResolved: false,
      blocked: false,
    };
  };

  const updateThiefRun = (timestamp: number, level: LevelConfig) => {
    const run = thiefRunRef.current;
    if (!run || !level.thiefConfig) return;
    const progress = clamp((timestamp - run.startedAt) / run.duration, 0, 1);

    if (!run.impactResolved && progress >= THIEF_IMPACT_PROGRESS) {
      if (heatShieldActiveRef.current) {
        thiefRunRef.current = { ...run, impactResolved: true, blocked: true, amount: 0 };
        showTimedAction("防护罩挡住了偷金币生物", 1500);
      } else {
        const calculated = Math.max(level.thiefConfig.minSteal, Math.round(goldRef.current * level.thiefConfig.percent));
        const stolen = Math.min(level.thiefConfig.maxSteal, calculated, goldRef.current);
        if (stolen > 0) {
          setGoldValue(goldRef.current - stolen);
          showTimedAction(`偷金币生物偷走了 ${stolen} 金币`, 1500);
        }
        thiefRunRef.current = { ...run, impactResolved: true, blocked: false, amount: stolen };
      }
    }

    if (progress >= 1) {
      thiefRunRef.current = null;
    }
  };

  const escapeMole = (mole: MineralInstance) => {
    const motion = mole.motion;
    const nextX = motion ? clamp(mole.x, motion.minX, motion.maxX) : clamp(mole.x, 60, config.width - 60);
    mineralsRef.current = mineralsRef.current.map((mineral) =>
      mineral.id === mole.id
        ? {
            ...mineral,
            hooked: false,
            x: nextX,
            y: mineral.restY ?? Math.max(config.stageTop + 90, Math.min(config.height - 70, mole.y + 120)),
          }
        : mineral,
    );
    resetHook();
    setMineralsVersion((value) => value + 1);
    showTimedAction("鼹鼠挣脱了", 1800);
    setGameState("aiming");
  };

  const updateGame = (dt: number, timestamp: number) => {
    if (pausedRef.current) return;
    const state = gameStateRef.current;
    const level = config.levels[levelIndexRef.current];
    const hook = hookRef.current;
    const elapsed = timestamp - stateStartedAtRef.current;

    if (lastActionExpiresAtRef.current && timestamp >= lastActionExpiresAtRef.current) {
      lastActionExpiresAtRef.current = 0;
      setLastAction("");
    }

    const simulatedVolume = settingsRef.current.testMode && forcedBoostRef.current && state === "pulling" ? 1 : rawVolumeRef.current;
    smoothedVolumeRef.current =
      smoothedVolumeRef.current * config.audio.smoothing + simulatedVolume * (1 - config.audio.smoothing);
    const factor = volumeFactorFor(smoothedVolumeRef.current);

    setAudioState((previous) => {
      if (
        Math.abs(previous.currentVolume - simulatedVolume) < 0.01 &&
        Math.abs(previous.smoothedVolume - smoothedVolumeRef.current) < 0.01 &&
        previous.volumeFactor === factor &&
        previous.testMode === settingsRef.current.testMode &&
        previous.threshold === settingsRef.current.threshold
      ) {
        return previous;
      }
      return {
        ...previous,
        currentVolume: simulatedVolume,
        smoothedVolume: smoothedVolumeRef.current,
        volumeFactor: factor,
        testMode: settingsRef.current.testMode,
        threshold: settingsRef.current.threshold,
      };
    });

    const activePlayState = !["levelIntro", "shop", "success", "failed", "levelComplete"].includes(state);
    if (activePlayState) {
      updateMovingMinerals(dt);
      runThiefEvent(timestamp, level);
      updateThiefRun(timestamp, level);
    }

    if (state === "levelComplete" && elapsed >= config.timing.levelCompleteMs) {
      setGameState(levelCompleteTargetRef.current === "success" ? "success" : "shop");
      return;
    }

    if (state === "aiming") {
      hook.angle += hook.direction * config.hook.swingSpeed * dt;
      if (hook.angle >= config.hook.maxAngle) {
        hook.angle = config.hook.maxAngle;
        hook.direction = -1;
      }
      if (hook.angle <= config.hook.minAngle) {
        hook.angle = config.hook.minAngle;
        hook.direction = 1;
      }
      return;
    }

    if (state === "launching") {
      hook.length += config.hook.launchSpeed * dt;
      const endpoint = endpointForHook(hook);
      const grabPoint = grabPointForHook(hook);
      const hit = mineralsRef.current.find((mineral) => {
        if (mineral.collected || !canCapture(mineral)) return false;
        const distance = Math.hypot(grabPoint.x - mineral.x, grabPoint.y - mineral.y);
        return distance <= mineral.radius + 18;
      });

      if (hit) {
        const type = mineralById(hit.typeId);
        if (type.category === "explosive") {
          playExplosion();
          explodeBarrel(hit);
          return;
        }
        playHit();
        moleStruggleProgressRef.current = 0;
        hookedMineralRef.current = hit;
        mineralsRef.current = mineralsRef.current.map((mineral) =>
          mineral.id === hit.id ? { ...mineral, hooked: true } : mineral,
        );
        setMineralsVersion((value) => value + 1);
        setGameState("hitSlowMotion");
        return;
      }

      if (
        hook.length >= config.hook.maxLength ||
        grabPoint.x < 12 ||
        grabPoint.x > config.width - 12 ||
        grabPoint.y > config.height - 8
      ) {
        setGameState("pulling");
      }
      return;
    }

    if (state === "hitSlowMotion" && elapsed >= config.timing.hitSlowMotionMs) {
      setGameState("wordShuffle");
      return;
    }

    if (state === "wordShuffle") {
      const tick = Math.floor(elapsed / 80);
      if (tick !== wordShuffleTickRef.current) {
        wordShuffleTickRef.current = tick;
        const shuffled = pickWord(level);
        targetWordRef.current = shuffled;
        setTargetWord(shuffled);
        if (hookedMineralRef.current) {
          mineralsRef.current = mineralsRef.current.map((mineral) =>
            mineral.id === hookedMineralRef.current?.id ? { ...mineral, label: shuffled } : mineral,
          );
        }
      }
      if (elapsed >= config.timing.wordShuffleMs) {
        const hookedType = hookedMineralRef.current?.typeId;
        const finalWord = pickWord(level, hookedType ? mineralDifficulty(hookedType) : undefined);
        targetWordRef.current = finalWord;
        setTargetWord(finalWord);
        if (hookedMineralRef.current) {
          mineralsRef.current = mineralsRef.current.map((mineral) =>
            mineral.id === hookedMineralRef.current?.id ? { ...mineral, label: finalWord } : mineral,
          );
        }
        setMineralsVersion((value) => value + 1);
        setGameState("pulling");
      }
      return;
    }

    if (state === "pulling") {
      const hooked = hookedMineralRef.current;
      const mineralType = hooked ? mineralById(hooked.typeId) : null;
      const baseSpeed = hooked?.basePullSpeedOverride ?? mineralType?.basePullSpeed ?? 220;
      const itemMultiplier = boostActiveRef.current && hooked ? 2 : 1;
      const heatMultiplier = level.heatPullMultiplier && !heatShieldActiveRef.current ? level.heatPullMultiplier : 1;
      let speed = baseSpeed * (hooked ? factor * itemMultiplier * heatMultiplier : 1.6);

      if (hooked && mineralType?.category === "creature") {
        const loudEnough = factor >= MOLE_ESCAPE_FACTOR || (settingsRef.current.testMode && forcedBoostRef.current);
        if (loudEnough) {
          moleStruggleProgressRef.current = clamp(
            moleStruggleProgressRef.current - MOLE_STRUGGLE_RECOVER_PER_SECOND * dt,
            0,
            1,
          );
        } else {
          const pressure = 1 + Math.max(0, MOLE_ESCAPE_FACTOR - factor) * 0.35;
          moleStruggleProgressRef.current = clamp(
            moleStruggleProgressRef.current + MOLE_STRUGGLE_GAIN_PER_SECOND * pressure * dt,
            0,
            1,
          );
          speed *= MOLE_LOW_VOICE_PULL_MULTIPLIER * (1 - moleStruggleProgressRef.current * 0.18);
          if (moleStruggleProgressRef.current >= 1) {
            escapeMole(hooked);
            return;
          }
        }
      }

      hook.length -= speed * dt;
      if (hooked) {
        const grabPoint = grabPointForHook(hook);
        mineralsRef.current = mineralsRef.current.map((mineral) =>
          mineral.id === hooked.id ? { ...mineral, x: grabPoint.x, y: grabPoint.y + HOOKED_MINERAL_OFFSET } : mineral,
        );
      }
      if (hook.length <= config.hook.pullFinishLength) {
        hook.length = HOOK_INITIAL_LENGTH;
        if (hooked) {
          const type = mineralById(hooked.typeId);
          const gained = scoreFor(hooked);
          playCollect(gained);
          if (gained > 0) setGoldValue(goldRef.current + gained);
          mineralsRef.current = mineralsRef.current.map((mineral) =>
            mineral.id === hooked.id ? { ...mineral, collected: true, hooked: false } : mineral,
          );
          hookedMineralRef.current = null;
          moleStruggleProgressRef.current = 0;
          forcedBoostRef.current = false;
          setManualBoostActive(false);
          setMineralsVersion((value) => value + 1);
          setLastAction(`+${gained} 金币 · ${hooked.weightOverride ?? type.weight}`);
          setGameState("scoring");
        } else {
          beginAiming();
        }
      }
      return;
    }

    if (state === "scoring" && elapsed >= config.timing.scoringMs) {
      beginAiming();
    }
  };

  const drawGame = (ctx: CanvasRenderingContext2D, timestamp: number) => {
    ctx.clearRect(0, 0, config.width, config.height);
    drawBackground(ctx);
    drawMiner(ctx, timestamp);
    drawMinerals(ctx, timestamp);
    drawHook(ctx, timestamp);
    drawEffects(ctx, timestamp);
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const level = config.levels[levelIndexRef.current];
    const key = level.backgroundKey ?? (levelIndexRef.current >= 4 ? "gem" : "normal");
    const backgroundImage = imageAssetsRef.current[backgroundAssetKey[key]];
    if (backgroundImage) {
      drawCoverImage(ctx, backgroundImage, 0, 0, config.width, config.height);
      return;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, config.height);
    sky.addColorStop(0, "#16334d");
    sky.addColorStop(0.34, "#172a2d");
    sky.addColorStop(0.35, "#3a281e");
    sky.addColorStop(1, "#21150f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, config.width, config.height);

    ctx.fillStyle = "#102538";
    for (let i = 0; i < 14; i += 1) {
      const x = i * 106 - 20;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 85, 0);
      ctx.lineTo(x + 125, config.stageTop);
      ctx.lineTo(x - 38, config.stageTop);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#5e3820";
    for (const x of [58, 226, 1018, 1190]) {
      ctx.fillRect(x, 54, 24, 214);
      ctx.fillStyle = "#7b4b25";
      ctx.fillRect(x + 7, 54, 7, 214);
      ctx.fillStyle = "#5e3820";
    }
    ctx.fillStyle = "#7b4b25";
    ctx.fillRect(38, 72, 1220, 20);
    ctx.fillRect(38, 244, 1220, 26);

    for (const x of [205, 475, 1110]) drawLantern(ctx, x, 175);

    const dirt = ctx.createLinearGradient(0, config.stageTop, 0, config.height);
    dirt.addColorStop(0, "#4a2d1c");
    dirt.addColorStop(1, "#22140e");
    ctx.fillStyle = dirt;
    ctx.fillRect(0, config.stageTop, config.width, config.height - config.stageTop);

    ctx.fillStyle = "#74a934";
    ctx.fillRect(0, config.stageTop - 17, config.width, 18);
    ctx.fillStyle = "#8a5d31";
    ctx.fillRect(0, config.stageTop, config.width, 20);

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 87) % config.width;
      const y = config.stageTop + 44 + ((i * 53) % 398);
      const r = 6 + ((i * 11) % 17);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.65, (i % 6) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawLantern = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const glow = ctx.createRadialGradient(x, y, 8, x, y, 70);
    glow.addColorStop(0, "rgba(255,205,82,0.5)");
    glow.addColorStop(1, "rgba(255,205,82,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2417";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 48);
    ctx.lineTo(x, y - 25);
    ctx.stroke();
    ctx.fillStyle = "#ffcb45";
    ctx.strokeStyle = "#3a2417";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x - 17, y - 22, 34, 48, 8);
    ctx.fill();
    ctx.stroke();
  };

  const drawMiner = (ctx: CanvasRenderingContext2D, timestamp: number) => {
    const minerSheet = imageAssetsRef.current.minerSheet;
    const drawWidth = 230;
    const drawHeight = 180;
    const hookOrigin = hookOriginForLevelIndex(levelIndexRef.current);

    // Miner positioned above the soil layer, winch (卷扬机) is part of the sprite
    const minerBaseY = hookOrigin.y - 6;
    const winchBaseX = hookOrigin.x;

    const heavyShake =
      gameStateRef.current === "pulling" && isHeavyPull(hookedMineralRef.current) && !boostActiveRef.current
        ? Math.sin(timestamp / 75) * 2
        : 0;

    const drawY = minerBaseY - drawHeight + Math.abs(heavyShake) * 0.35;
    const drawX = winchBaseX - drawWidth * MINER_ROPE_X_RATIO + heavyShake;

    if (minerSheet) {
      const frame = minerFrameForState(
        gameStateRef.current,
        timestamp,
        hookedMineralRef.current,
        boostActiveRef.current,
      );
      const frameCount = 10;
      const frameWidth = minerSheet.width / frameCount;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(
        minerSheet,
        frame * frameWidth,
        0,
        frameWidth,
        minerSheet.height,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
      ctx.restore();
      return;
    }

    // Fallback miner drawing (positioned above soil)
    ctx.save();
    ctx.translate(hookOrigin.x, hookOrigin.y - 86);
    ctx.fillStyle = "#f8c58a";
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffca33";
    ctx.beginPath();
    ctx.roundRect(-48, -45, 96, 34, 16);
    ctx.fill();
    ctx.fillStyle = "#f4a51f";
    ctx.fillRect(-34, -58, 68, 30);
    ctx.fillStyle = "#fff4a5";
    ctx.beginPath();
    ctx.arc(0, -40, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4d2b16";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#3f2417";
    ctx.beginPath();
    ctx.arc(-15, -4, 4, 0, Math.PI * 2);
    ctx.arc(15, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8b481d";
    ctx.beginPath();
    ctx.arc(0, 22, 26, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#2d7fb8";
    ctx.fillRect(-56, 52, 112, 54);
    ctx.fillStyle = "#f8c58a";
    ctx.fillRect(-92, 50, 34, 58);
    ctx.fillRect(58, 50, 34, 58);
    ctx.fillStyle = "#d52424";
    ctx.beginPath();
    ctx.arc(94, 38, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#3a4650";
    ctx.strokeStyle = "#151b20";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(hookOrigin.x - 105, hookOrigin.y - 14, 208, 50, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b06c22";
    for (let i = 0; i < 15; i += 1) {
      ctx.fillRect(hookOrigin.x - 85 + i * 11, hookOrigin.y - 13, 6, 48);
    }
  };

  const drawHook = (ctx: CanvasRenderingContext2D, timestamp: number) => {
    const hook = hookRef.current;
    const hookTop = endpointForHook(hook);
    const hookCenter = pointAlongHook(hook, HOOK_CENTER_OFFSET);
    const grabPoint = grabPointForHook(hook);
    const vector = angleToVector(hook.angle);
    const perpendicular = { x: -vector.y, y: vector.x };
    const state = gameStateRef.current;
    const pulse = 0.7 + Math.sin(timestamp / 120) * 0.3;

    ctx.strokeStyle = "#9c6a34";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hook.originX, hook.originY);
    ctx.lineTo(hookTop.x, hookTop.y);
    ctx.stroke();
    ctx.strokeStyle = "#e0b26a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hook.originX + perpendicular.x * 2, hook.originY + perpendicular.y * 2);
    ctx.lineTo(hookTop.x + perpendicular.x * 2, hookTop.y + perpendicular.y * 2);
    ctx.stroke();

    // Connecting joint / anchor at soil boundary — fixed, does not swing
    const hookJoint = imageAssetsRef.current.hookJoint;
    ctx.save();
    ctx.translate(hook.originX, hook.originY);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    if (hookJoint) {
      // Draw the joint image fixed (no rotation)
      ctx.drawImage(hookJoint, -HOOK_JOINT_SIZE / 2, -HOOK_JOINT_SIZE / 2, HOOK_JOINT_SIZE, HOOK_JOINT_SIZE);
    } else {
      // Ground anchor base plate (wider, sits on the soil surface)
      ctx.fillStyle = "#3d2a16";
      ctx.strokeStyle = "#1a0e04";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-34, 4, 68, 16, 3);
      ctx.fill();
      ctx.stroke();
      // Anchor bolts
      ctx.fillStyle = "#555";
      for (const bx of [-24, 24]) {
        ctx.beginPath();
        ctx.arc(bx, 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Pivot bracket (upright)
      ctx.fillStyle = "#5c4a3a";
      ctx.strokeStyle = "#2a1a0a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-22, -12, 44, 22, 5);
      ctx.fill();
      ctx.stroke();
      // Bracket inner cutout
      ctx.fillStyle = "#1a0e04";
      ctx.beginPath();
      ctx.roundRect(-12, -6, 24, 10, 2);
      ctx.fill();
      // Pivot pin / axle
      ctx.fillStyle = "#3a3a3a";
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -1, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Pin highlight
      ctx.fillStyle = "#888";
      ctx.beginPath();
      ctx.arc(-2, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      // Small guide ring at top of bracket
      ctx.strokeStyle = "#7a6a5a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -8, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const hooked = hookedMineralRef.current;
    if (hooked && (state === "hitSlowMotion" || state === "wordShuffle" || state === "pulling")) {
      ctx.fillStyle = `rgba(255,210,39,${0.22 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(grabPoint.x, grabPoint.y + HOOKED_MINERAL_OFFSET, hooked.radius + 30, 0, Math.PI * 2);
      ctx.fill();
    }

    const equipmentSheet = imageAssetsRef.current.equipmentSheet;
    if (equipmentSheet) {
      ctx.save();
      ctx.translate(hookCenter.x, hookCenter.y);
      ctx.rotate((hook.angle * Math.PI) / 180);
      ctx.shadowColor = "rgba(0,0,0,0.38)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;
      drawSheetSprite(ctx, equipmentSheet, 0, 8, HOOK_SPRITE_SIZE, HOOK_SPRITE_SIZE);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(grabPoint.x, grabPoint.y);
      ctx.rotate((hook.angle * Math.PI) / 180);
      ctx.strokeStyle = "#b9cad3";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 14, 21, 0.15 * Math.PI, 0.92 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = "#64727b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 18);
      ctx.stroke();
      ctx.restore();
    }

  };

  const drawMinerals = (ctx: CanvasRenderingContext2D, timestamp: number) => {
    for (const mineral of mineralsRef.current) {
      if (mineral.collected) continue;
      const type = mineralById(mineral.typeId);
      if (mineral.hooked) {
        ctx.fillStyle = `rgba(255,218,64,${0.22 + Math.sin(timestamp / 85) * 0.08})`;
        ctx.beginPath();
        ctx.arc(mineral.x, mineral.y, mineral.radius + 32, 0, Math.PI * 2);
        ctx.fill();
      }
      drawMineralShape(ctx, mineral, type.color, timestamp);
      if (mineral.hooked) {
        drawLabel(ctx, mineral.label, mineral.x, mineral.y - mineral.radius - 18, true);
        if (type.category === "creature" && gameStateRef.current === "pulling") {
          drawMoleStruggleMeter(ctx, mineral, timestamp);
        }
      }
    }
  };

  const drawMoleStruggleMeter = (ctx: CanvasRenderingContext2D, mineral: MineralInstance, timestamp: number) => {
    const progress = moleStruggleProgressRef.current;
    if (progress <= 0.01) return;
    const width = 112;
    const height = 12;
    const x = clamp(mineral.x - width / 2, 18, config.width - width - 18);
    const y = clamp(mineral.y - mineral.radius - 64, config.stageTop + 10, config.height - 42);
    const danger = progress > 0.7;
    const pulse = danger ? 0.65 + Math.sin(timestamp / 70) * 0.25 : 0.4;

    ctx.save();
    ctx.fillStyle = "rgba(20,14,12,0.78)";
    ctx.strokeStyle = danger ? `rgba(255,74,42,${pulse})` : "rgba(255,220,128,0.72)";
    ctx.lineWidth = danger ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();
    ctx.stroke();

    const fillWidth = Math.max(6, (width - 4) * progress);
    const fill = ctx.createLinearGradient(x + 2, y, x + width - 2, y);
    fill.addColorStop(0, "#ffd45a");
    fill.addColorStop(0.62, "#ff8a2a");
    fill.addColorStop(1, "#ff3434");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, fillWidth, height - 4, 5);
    ctx.fill();

    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.fillStyle = danger ? "#fff2d0" : "#ffffff";
    ctx.strokeText("挣脱", x + width / 2, y - 3);
    ctx.fillText("挣脱", x + width / 2, y - 3);
    ctx.restore();
  };

  const drawMineralShape = (ctx: CanvasRenderingContext2D, mineral: MineralInstance, color: string, timestamp: number) => {
    const type = mineralById(mineral.typeId);
    const sparkle = 0.45 + Math.sin(timestamp / 210 + mineral.id * 1.7) * 0.35;
    if (mineral.typeId === "moleBag") {
      const moleSheet = imageAssetsRef.current.moleSheet;
      if (moleSheet) {
        const walkingFrame = Math.floor(timestamp / 180) % 4;
        const struggleFrame = 4 + (Math.floor(timestamp / 190) % 4);
        const frame = mineral.hooked ? struggleFrame : walkingFrame;
        const struggle = mineral.hooked ? moleStruggleProgressRef.current : 0;
        const bob = mineral.hooked
          ? Math.sin(timestamp / 58) * (3 + struggle * 4)
          : Math.sin(timestamp / 180 + mineral.id) * 3;
        const shake = mineral.hooked ? Math.sin(timestamp / 42) * struggle * 10 : 0;
        const flipX = mineral.motion?.direction === -1;
        ctx.save();
        ctx.translate(mineral.x + shake, mineral.y + bob);
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 8;
        drawSpriteFrame(ctx, moleSheet, frame, 4, 2, mineral.radius * 2.35, mineral.radius * 2.55, flipX, {
          sourceInsetX: 0.04,
          sourceInsetY: 0.025,
        });
        ctx.restore();
        return;
      }
    }

    const resourceKey = resourceAssetKey[mineral.typeId];
    const resourceImage = resourceKey ? imageAssetsRef.current[resourceKey] : null;
    if (resourceImage) {
      const bob = mineral.motion && !mineral.hooked ? Math.sin(timestamp / 180 + mineral.id) * 3 : 0;
      const spriteScale =
        type.category === "creature" ? 3.35 : type.category === "mystery" ? 3.2 : 2.85;
      const spriteSize = mineral.radius * spriteScale;
      ctx.save();
      ctx.translate(mineral.x, mineral.y + bob);
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(resourceImage, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
      if (type.category === "gem" || type.category === "diamond" || type.category === "mystery") {
        ctx.globalAlpha = clamp(sparkle, 0.08, 0.72);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const sx = -mineral.radius * 0.18;
        const sy = -mineral.radius * 0.28;
        ctx.beginPath();
        ctx.moveTo(sx - 10, sy);
        ctx.lineTo(sx + 10, sy);
        ctx.moveTo(sx, sy - 10);
        ctx.lineTo(sx, sy + 10);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const resourcesSheet = imageAssetsRef.current.resourcesSheet;
    const sheetIndex = mineralSpriteIndex[mineral.typeId];
    if (resourcesSheet && sheetIndex !== undefined) {
      const spriteScale =
        mineral.typeId === "explosiveBarrel"
          ? 2.7
          : mineral.typeId === "diamond" || mineral.typeId === "ruby" || mineral.typeId === "amethyst"
            ? 2.25
            : 2.65;
      const spriteSize = mineral.radius * spriteScale;
      ctx.save();
      ctx.translate(mineral.x, mineral.y);
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 8;
      drawSheetSprite(ctx, resourcesSheet, sheetIndex, 7, spriteSize, spriteSize);
      if (type.category === "gold" || type.category === "diamond" || type.category === "gem") {
        ctx.globalAlpha = clamp(sparkle, 0.08, 0.72);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const sx = -mineral.radius * 0.18;
        const sy = -mineral.radius * 0.28;
        ctx.beginPath();
        ctx.moveTo(sx - 10, sy);
        ctx.lineTo(sx + 10, sy);
        ctx.moveTo(sx, sy - 10);
        ctx.lineTo(sx, sy + 10);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (mineral.typeId === "explosiveBarrel") {
      ctx.save();
      ctx.translate(mineral.x, mineral.y);
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = color;
      ctx.strokeStyle = "#35140c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-30, -36, 60, 72, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffcf45";
      ctx.fillRect(-30, -8, 60, 16);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 28px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 0, -1);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(mineral.x, mineral.y);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 8;
    if (mineral.typeId === "rock") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-42, 15);
      ctx.lineTo(-31, -21);
      ctx.lineTo(-6, -37);
      ctx.lineTo(28, -30);
      ctx.lineTo(48, 0);
      ctx.lineTo(34, 33);
      ctx.lineTo(-20, 39);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.moveTo(-20, -18);
      ctx.lineTo(5, -30);
      ctx.lineTo(20, -8);
      ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
    } else if (type.category === "diamond" || type.category === "gem") {
      const radius = mineral.radius * 0.82;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius, -7);
      ctx.lineTo(radius * 0.58, radius * 0.55);
      ctx.lineTo(0, radius);
      ctx.lineTo(-radius * 0.58, radius * 0.55);
      ctx.lineTo(-radius, -7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-radius, -7);
      ctx.lineTo(0, -radius);
      ctx.lineTo(radius, -7);
      ctx.moveTo(0, -radius);
      ctx.lineTo(0, radius);
      ctx.stroke();
    } else if (type.category === "mystery" || type.category === "creature") {
      ctx.fillStyle = color;
      ctx.strokeStyle = "#3d2618";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-mineral.radius * 0.82, -mineral.radius * 0.6, mineral.radius * 1.64, mineral.radius * 1.25, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f8d58a";
      ctx.beginPath();
      ctx.arc(0, -mineral.radius * 0.18, mineral.radius * 0.34, 0, Math.PI * 2);
      ctx.fill();
      if (type.category === "creature") {
        ctx.fillStyle = "#2a160d";
        ctx.beginPath();
        ctx.arc(-mineral.radius * 0.22, -mineral.radius * 0.22, 4, 0, Math.PI * 2);
        ctx.arc(mineral.radius * 0.22, -mineral.radius * 0.22, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const gold = ctx.createRadialGradient(-14, -18, 6, 0, 0, mineral.radius);
      gold.addColorStop(0, "#fff7ab");
      gold.addColorStop(0.35, color);
      gold.addColorStop(1, "#a96705");
      ctx.fillStyle = gold;
      ctx.beginPath();
      for (let i = 0; i < 18; i += 1) {
        const angle = (i / 18) * Math.PI * 2;
        const radius = mineral.radius * (0.82 + (((i * 37) % 23) / 100));
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(-17, -18, mineral.radius * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    if (type.category === "gold" || type.category === "diamond" || type.category === "gem") {
      ctx.save();
      ctx.globalAlpha = clamp(sparkle, 0.08, 0.72);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      const sx = -mineral.radius * 0.18;
      const sy = -mineral.radius * 0.28;
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy);
      ctx.lineTo(sx + 10, sy);
      ctx.moveTo(sx, sy - 10);
      ctx.lineTo(sx, sy + 10);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  const drawThiefRun = (ctx: CanvasRenderingContext2D, timestamp: number) => {
    const run = thiefRunRef.current;
    if (!run) return;

    const progress = clamp((timestamp - run.startedAt) / run.duration, 0, 1);
    const hookOrigin = hookOriginForLevelIndex(levelIndexRef.current);
    const fromLeft = run.side === "left";
    const startX = fromLeft ? -80 : config.width + 80;
    const impactX = hookOrigin.x + (fromLeft ? -120 : 120);
    const exitX = fromLeft ? config.width + 90 : -90;
    const footY = run.laneY;
    let x = startX;
    let y = footY;
    let rotation = 0;
    let alpha = 1;
    let frame = Math.floor(timestamp / 120) % 4;

    if (run.blocked && progress >= THIEF_IMPACT_PROGRESS) {
      const bounce = clamp((progress - THIEF_IMPACT_PROGRESS) / (1 - THIEF_IMPACT_PROGRESS), 0, 1);
      const direction = fromLeft ? -1 : 1;
      x = impactX + direction * bounce * 220;
      y = footY - Math.sin(bounce * Math.PI) * 112 + bounce * 42;
      rotation = direction * bounce * Math.PI * 2.1;
      alpha = 1 - Math.max(0, bounce - 0.78) * 4.5;
      frame = 4 + Math.min(3, Math.floor(bounce * 4));
    } else if (progress < THIEF_IMPACT_PROGRESS) {
      const approach = progress / THIEF_IMPACT_PROGRESS;
      const eased = 1 - Math.pow(1 - approach, 2);
      x = startX + (impactX - startX) * eased;
      y = footY + Math.sin(approach * Math.PI) * 5;
    } else {
      const leave = (progress - THIEF_IMPACT_PROGRESS) / (1 - THIEF_IMPACT_PROGRESS);
      x = impactX + (exitX - impactX) * leave;
      y = footY + Math.sin(leave * Math.PI) * 4;
    }

    const thiefSheet = imageAssetsRef.current.thiefSheet;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(x, y);
    ctx.rotate(rotation);
    if (thiefSheet) {
      drawSpriteFrame(ctx, thiefSheet, frame, 4, 2, THIEF_SPRITE_SIZE, THIEF_SPRITE_SIZE, fromLeft, {
        sourceInsetX: 0.06,
        sourceInsetY: 0.04,
        anchorY: 1,
      });
    } else {
      ctx.fillStyle = "#4b2b68";
      ctx.beginPath();
      ctx.arc(0, -34, 32, 0, Math.PI * 2);
      ctx.fill();
    }

    if (run.impactResolved && progress < 0.82) {
      ctx.font = "900 22px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = run.blocked ? "#8df6ff" : "#ffd24a";
      ctx.strokeStyle = "rgba(0,0,0,0.62)";
      ctx.lineWidth = 5;
      const text = run.blocked ? "挡住!" : run.amount > 0 ? `-${run.amount}` : "";
      if (text) {
        ctx.strokeText(text, 0, -58);
        ctx.fillText(text, 0, -58);
      }
    }
    ctx.restore();
  };

  const drawEffects = (ctx: CanvasRenderingContext2D, timestamp: number) => {
    if (heatShieldActiveRef.current) {
      const hookOrigin = hookOriginForLevelIndex(levelIndexRef.current);
      const pulse = 0.65 + Math.sin(timestamp / 180) * 0.18;
      const centerX = hookOrigin.x;
      const centerY = hookOrigin.y - 86;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(111,244,255,0.75)";
      ctx.shadowBlur = 14 + pulse * 8;
      ctx.strokeStyle = `rgba(130,247,255,${0.38 + pulse * 0.18})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 104 + pulse * 6, 84 + pulse * 4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 8;
      ctx.strokeStyle = "rgba(207,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 86 + pulse * 3, 68 + pulse * 3, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(96,219,255,0.72)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i += 1) {
        const start = timestamp / 850 + i * 2.1;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 112, 90, 0, start, start + 0.55);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawThiefRun(ctx, timestamp);

    effectsRef.current = effectsRef.current.filter((effect) => timestamp - effect.startedAt <= effect.duration);
    for (const effect of effectsRef.current) {
      const rawProgress = clamp((timestamp - effect.startedAt) / effect.duration, 0, 1);
      if (effect.type === "dynamite") {
        const arc = Math.sin(rawProgress * Math.PI) * 90;
        const x = effect.from.x + (effect.to.x - effect.from.x) * rawProgress;
        const y = effect.from.y + (effect.to.y - effect.from.y) * rawProgress - arc;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rawProgress * Math.PI * 3);
        ctx.fillStyle = "#191919";
        ctx.strokeStyle = "#fff3a8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#ffb247";
        ctx.beginPath();
        ctx.moveTo(7, -10);
        ctx.quadraticCurveTo(16, -22, 25, -16);
        ctx.stroke();
        ctx.fillStyle = "#ffef62";
        ctx.beginPath();
        ctx.arc(27, -16, 5 + Math.sin(timestamp / 60) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (effect.type === "explosion") {
        const radius = effect.radius * rawProgress;
        ctx.save();
        ctx.globalAlpha = 1 - rawProgress;
        const burst = ctx.createRadialGradient(effect.x, effect.y, 8, effect.x, effect.y, Math.max(12, radius));
        burst.addColorStop(0, "rgba(255,244,148,0.95)");
        burst.addColorStop(0.35, "rgba(255,128,38,0.8)");
        burst.addColorStop(1, "rgba(128,35,14,0)");
        ctx.fillStyle = burst;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,238,149,0.9)";
        ctx.lineWidth = 5;
        for (let i = 0; i < 10; i += 1) {
          const angle = (i / 10) * Math.PI * 2 + rawProgress;
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * radius * 0.25, effect.y + Math.sin(angle) * radius * 0.25);
          ctx.lineTo(effect.x + Math.cos(angle) * radius, effect.y + Math.sin(angle) * radius);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (effect.type === "clover") {
        ctx.save();
        ctx.globalAlpha = 1 - rawProgress * 0.55;
        ctx.fillStyle = "#66f05d";
        for (let i = 0; i < 8; i += 1) {
          const angle = (i / 8) * Math.PI * 2 + rawProgress * Math.PI * 2;
          const x = 620 + Math.cos(angle) * (70 + rawProgress * 90);
          const y = 145 + Math.sin(angle) * (30 + rawProgress * 42);
          ctx.font = "900 26px Arial";
          ctx.fillText("☘", x, y);
        }
        ctx.restore();
      }

      if (effect.type === "strength") {
        const hook = hookRef.current;
        const endpoint = endpointForHook(hook);
        const grabPoint = grabPointForHook(hook);
        ctx.save();
        ctx.globalAlpha = 1 - rawProgress * 0.35;
        ctx.strokeStyle = "#ffef63";
        ctx.lineWidth = 4;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -rawProgress * 60;
        ctx.beginPath();
        ctx.moveTo(hook.originX, hook.originY);
        ctx.lineTo(endpoint.x, endpoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,92,35,0.35)";
        ctx.beginPath();
        ctx.arc(grabPoint.x, grabPoint.y, 42 + rawProgress * 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  const drawLabel = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, highlighted: boolean) => {
    ctx.save();
    ctx.font = "700 20px Arial";
    const width = Math.min(Math.max(ctx.measureText(text).width + 24, 74), 200);
    ctx.fillStyle = highlighted ? "rgba(24,61,107,0.92)" : "rgba(12,12,12,0.82)";
    ctx.strokeStyle = highlighted ? "#7cc8ff" : "rgba(255,255,255,0.38)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - 18, width, 34, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  const hookedType = hookedMineralRef.current ? mineralById(hookedMineralRef.current.typeId) : null;
  const hookedScore = hookedMineralRef.current ? scoreFor(hookedMineralRef.current) : 0;
  const hookedWeight = hookedMineralRef.current ? hookedMineralRef.current.weightOverride ?? hookedType?.weight : "";
  const gameOver = gameState === "success" || gameState === "failed";
  const showReadingPopup = Boolean(
    hookedMineralRef.current && (gameState === "wordShuffle" || gameState === "pulling"),
  );
  const showManualBoostButton = audioState.testMode;
  const canManualBoost = audioState.testMode && gameState === "pulling";
  return (
    <main className="page-shell">
      <section className="game-frame" aria-label="英语黄金矿工游戏">
        <canvas ref={canvasRef} width={config.width} height={config.height} />

        {loadedAssetCount < totalAssetCount && (
          <div className="loading-overlay">
            <div className="loading-box">
              <h2>🎮 加载中...</h2>
              <div className="loading-bar-track">
                <div
                  className="loading-bar-fill"
                  style={{ width: `${Math.round((loadedAssetCount / totalAssetCount) * 100)}%` }}
                />
              </div>
              <p>{loadedAssetCount} / {totalAssetCount}</p>
            </div>
          </div>
        )}

        <div className="hud">
          <div className="hud-card level-card">
            <span>关卡</span>
            <strong>{currentLevel.id}</strong>
          </div>
          <div className="hud-card">
            <span>时间</span>
            <strong>{timeLeft}</strong>
          </div>
          <div className="hud-card wide">
            <span>目标金币</span>
            <strong>{currentLevel.targetGold}</strong>
          </div>
          <div className="hook-card">
            <span>当前钩子</span>
            <div className="hook-icon">
              <span aria-hidden="true">J</span>
            </div>
            <strong>强化铁钩</strong>
          </div>
          <div className="hud-card wide coin-card">
            <span>金币</span>
            <strong>{gold}</strong>
          </div>
        </div>

        <div className="left-buttons">
          <button className="left-icon-btn" type="button" onClick={togglePause} aria-label={paused ? "继续" : "暂停"}>
            <span aria-hidden="true">{paused ? "▶" : "⏸"}</span>
          </button>
          <button className="left-icon-btn" type="button" onClick={() => setSettingsOpen(true)} aria-label="打开设置">
            <span aria-hidden="true">⚙</span>
          </button>
        </div>

        {showReadingPopup && (
          <aside className="reading-panel" aria-live="polite">
            <h1>大声读出单词</h1>
            <div className="target-word">{targetWord}</div>
            <div className="volume-row">
              <span className="speaker-icon" aria-hidden="true">▸</span>
              <div className="volume-meter" aria-label="音量条">
                <div style={{ width: `${clamp(audioState.smoothedVolume * 100, 0, 100)}%` }} />
              </div>
            </div>
            <p>声音越大，拉得越快！</p>
            <div className="speed-line">
              <span>回收速度:</span>
              <strong>x{(audioState.volumeFactor * (boostActive ? 2 : 1)).toFixed(1)}</strong>
            </div>
            {showManualBoostButton && (
              <button
                className={`manual-boost-button panel-boost ${manualBoostActive ? "active" : ""}`}
                type="button"
                disabled={!canManualBoost}
                onPointerDown={startManualBoost}
                onPointerUp={stopManualBoost}
                onPointerLeave={stopManualBoost}
                onPointerCancel={stopManualBoost}
              >
                {canManualBoost ? "按住加速" : "拉矿时可加速"}
              </button>
            )}
            {!audioState.micAvailable && <div className="mic-warning">麦克风不可用，可在设置中开启测试模式。</div>}
          </aside>
        )}

        <div className="control-bar">
          <button className="drop-button" type="button" onClick={launchHook}>
            <span className="pick-icon" aria-hidden="true">⌞</span>
            <span>放钩</span>
            <small>Space</small>
          </button>

          <div className="item-bar" aria-label="道具栏">
            {config.items.map((item) => {
              const hasItem = audioState.testMode || inventory[item.id] > 0;
              const disabled =
                !hasItem ||
                (item.id === "dynamite" && (gameState !== "pulling" || hookedType?.category !== "rock")) ||
                (item.id === "strengthWater" && boostActive) ||
                (item.id === "clover" && cloverActive) ||
                (item.id === "heatShield" && heatShieldActive);
              return (
                <button
                  className={`item-button ${hasItem ? "has-item" : ""}`}
                  type="button"
                  key={item.id}
                  onClick={() => useInventoryItem(item.id)}
                  disabled={disabled}
                  title={`${item.name}：${item.description}`}
                >
                  <img className="item-art" src={`/assets/game/items/${item.id}.png`} alt="" aria-hidden="true" />
                  <small>{audioState.testMode ? "∞" : inventory[item.id]}</small>
                </button>
              );
            })}
          </div>
        </div>

        {showManualBoostButton && !showReadingPopup && (
          <button
            className={`manual-boost-button floating-boost ${manualBoostActive ? "active" : ""}`}
            type="button"
            disabled={!canManualBoost}
            onPointerDown={startManualBoost}
            onPointerUp={stopManualBoost}
            onPointerLeave={stopManualBoost}
            onPointerCancel={stopManualBoost}
          >
            {canManualBoost ? "按住加速" : "拉矿时可加速"}
          </button>
        )}

        {lastAction && gameState !== "shop" && gameState !== "failed" && gameState !== "success" && (
          <div className="action-toast">{lastAction}</div>
        )}

        {gameState === "levelComplete" && (
          <div className="level-toast">
            <strong>过关！</strong>
            <span>金币 {gold} / {currentLevel.targetGold}</span>
          </div>
        )}

        {gameState === "shop" && (
          <div className="shop-overlay" role="dialog" aria-modal="true" aria-label="道具商店">
            <div className="shop-panel">
              <div className="shop-header">
                <h2>第 {shopLevel.id} 关商店</h2>
                <span>金币 {gold}</span>
              </div>
              <div className="shop-grid">
                {shopLevel.shopItems.map((itemId) => {
                  const item = itemById(itemId);
                  const purchased = shopPurchases[item.id] > 0;
                  const disabled = !purchased && gold < item.price;
                  return (
                    <button
                      className={`shop-item ${purchased ? "purchased" : ""}`}
                      type="button"
                      key={item.id}
                      onClick={() => buyItem(item.id)}
                      disabled={disabled}
                    >
                      <span className="shop-icon" aria-hidden="true">{item.icon}</span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                      <b>{item.price} 金币</b>
                      {purchased && <span className="purchased-badge">✓ 已选</span>}
                    </button>
                  );
                })}
              </div>
              <button className="close-button" type="button" onClick={enterShopLevel}>
                进入第 {shopLevel.id} 关
              </button>
            </div>
          </div>
        )}

        {gameState === "levelIntro" && (
          <div className="intro-overlay">
            <div className="intro-panel">
              <h2>
                第 {currentLevel.id} 关
                <span className="intro-name">{currentLevel.name}</span>
              </h2>
              <div className="intro-info">
                <div className="intro-stat">
                  <span>⏱ 时间</span>
                  <strong>{currentLevel.durationSeconds} 秒</strong>
                </div>
                <div className="intro-stat">
                  <span>🎯 目标</span>
                  <strong>{currentLevel.targetGold} 金币</strong>
                </div>
              </div>
              {currentLevel.id > 1 && (
                <p className="intro-gold">当前金币：{gold}</p>
              )}
              <button className="intro-start-btn" type="button" onClick={startLevel} autoFocus>
                开始游戏
              </button>
              <p className="intro-hint">按空格键或点击按钮开始</p>
            </div>
          </div>
        )}

        {paused && (
          <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="游戏暂停">
            <div className="pause-panel">
              <h2>游戏暂停</h2>
              <button className="pause-resume-btn" type="button" onClick={togglePause}>
                ▶ 继续游戏
              </button>
              <button className="pause-restart-btn" type="button" onClick={handleRestart}>
                ↺ 重新开始
              </button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="result-overlay">
            <div className="result-box">
              <h2>{gameState === "success" ? "最终胜利" : "挑战失败"}</h2>
              <p>
                金币 {gold} / {currentLevel.targetGold}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (gameState === "failed") retryLevel();
                  else resetToLevel(0);
                }}
              >
                {gameState === "failed" ? "重玩本关" : "从第一关再玩"}
              </button>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="设置面板">
            <div className="settings-panel">
              <h2>设置</h2>
              <label className="slider-row">
                <span>选择关卡</span>
                <select
                  value={levelIndex + 1}
                  onChange={(event) => resetToLevel(Number(event.target.value) - 1)}
                >
                  {config.levels.map((level) => (
                    <option value={level.id} key={level.id}>
                      第 {level.id} 关 · {level.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="toggle-row">
                <span>测试模式</span>
                <input
                  type="checkbox"
                  checked={audioState.testMode}
                  onChange={(event) => toggleTestMode(event.target.checked)}
                />
              </label>
              {audioState.testMode && (
                <button
                  className="boost-button"
                  type="button"
                  disabled={!canManualBoost}
                  onPointerDown={startManualBoost}
                  onPointerUp={stopManualBoost}
                  onPointerLeave={stopManualBoost}
                  onPointerCancel={stopManualBoost}
                >
                  <span aria-hidden="true">⚡</span>
                  {canManualBoost ? "按住手动加速拉矿" : "拉矿时可手动加速"}
                </button>
              )}
              <label className="slider-row">
                <span>音量阈值 {audioState.threshold}</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={audioState.threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                />
              </label>
              <p className="settings-note">测试模式开启后，画面会出现手动加速按钮；拉矿时按住按钮或 T 键可以模拟大声朗读。选择关卡会清空金币和背包。</p>
              <button className="close-button" type="button" onClick={() => setSettingsOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        )}

        {hookedType && gameState === "pulling" && hookedType.category !== "explosive" && (
          <div className="loot-toast">
            +{hookedScore} 金币 · {hookedWeight}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
