export const LEGACY_STORAGE_KEY = "earthworm-website-state-v1";
export const STORAGE_KEY = "earthworm-website-state-v2";

export type LearningMode = "word-input" | "reorder";
export type Familiarity = "unfamiliar" | "mastered";
export type ReviewMode = "unfamiliar";

export type LearningPreferences = {
  autoSpeak: boolean;
  typingSound: boolean;
  feedbackSound: boolean;
  mode: LearningMode;
};

export type StoredState = {
  version: 2;
  progress: Record<string, number>;
  statementFamiliarity: Record<string, Familiarity>;
  recentCourseId?: string;
  preferences: LearningPreferences;
  reviewMode?: ReviewMode;
};

export type LegacyStoredState = {
  progress?: unknown;
  mastered?: unknown;
  recentCourseId?: unknown;
};

export const DEFAULT_PREFERENCES: LearningPreferences = {
  autoSpeak: true,
  typingSound: true,
  feedbackSound: true,
  mode: "word-input",
};

export function createDefaultStoredState(): StoredState {
  return {
    version: 2,
    progress: {},
    statementFamiliarity: {},
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

export const DEFAULT_STORED_STATE: StoredState = createDefaultStoredState();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeProgress(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  const progress: Record<string, number> = {};
  for (const [courseId, rawIndex] of Object.entries(value)) {
    if (!courseId || typeof rawIndex !== "number" || !Number.isFinite(rawIndex)) continue;
    progress[courseId] = Math.max(0, Math.floor(rawIndex));
  }
  return progress;
}

function normalizeStatementFamiliarity(value: unknown): Record<string, Familiarity> {
  if (!isRecord(value)) return {};

  const familiarity: Record<string, Familiarity> = {};
  for (const [statementId, rawFamiliarity] of Object.entries(value)) {
    if (statementId && (rawFamiliarity === "unfamiliar" || rawFamiliarity === "mastered")) {
      familiarity[statementId] = rawFamiliarity;
    }
  }
  return familiarity;
}

function normalizeRecentCourseId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizePreferences(value: unknown): LearningPreferences {
  if (!isRecord(value)) return { ...DEFAULT_PREFERENCES };

  return {
    autoSpeak:
      typeof value.autoSpeak === "boolean" ? value.autoSpeak : DEFAULT_PREFERENCES.autoSpeak,
    typingSound:
      typeof value.typingSound === "boolean" ? value.typingSound : DEFAULT_PREFERENCES.typingSound,
    feedbackSound:
      typeof value.feedbackSound === "boolean"
        ? value.feedbackSound
        : DEFAULT_PREFERENCES.feedbackSound,
    mode:
      value.mode === "reorder" || value.mode === "word-input"
        ? value.mode
        : DEFAULT_PREFERENCES.mode,
  };
}

function normalizeReviewMode(value: unknown): ReviewMode | undefined {
  return value === "unfamiliar" ? value : undefined;
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Converts a legacy v1 state into v2. Every legacy mastered statement becomes
 * `mastered`; duplicate and invalid statement ids are ignored.
 */
export function migrateLegacyState(value: unknown): StoredState {
  if (!isRecord(value)) return createDefaultStoredState();

  const statementFamiliarity: Record<string, Familiarity> = {};
  if (Array.isArray(value.mastered)) {
    for (const statementId of value.mastered) {
      if (typeof statementId === "string" && statementId) {
        statementFamiliarity[statementId] = "mastered";
      }
    }
  }

  const recentCourseId = normalizeRecentCourseId(value.recentCourseId);
  return {
    version: 2,
    progress: normalizeProgress(value.progress),
    statementFamiliarity,
    ...(recentCourseId ? { recentCourseId } : {}),
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

/** Safely normalizes a parsed v2 value. Invalid fields fall back independently. */
export function normalizeStoredState(value: unknown): StoredState {
  if (!isRecord(value)) return createDefaultStoredState();

  const recentCourseId = normalizeRecentCourseId(value.recentCourseId);
  const reviewMode = normalizeReviewMode(value.reviewMode);
  return {
    version: 2,
    progress: normalizeProgress(value.progress),
    statementFamiliarity: normalizeStatementFamiliarity(value.statementFamiliarity),
    ...(recentCourseId ? { recentCourseId } : {}),
    preferences: normalizePreferences(value.preferences),
    ...(reviewMode ? { reviewMode } : {}),
  };
}

/**
 * Parses saved state without accessing `window` or `localStorage`. When no
 * usable v2 value exists, the optional legacy v1 value is migrated instead.
 */
export function parseStoredState(
  rawV2: string | null | undefined,
  rawV1?: string | null | undefined,
): StoredState {
  const parsedV2 = parseJson(rawV2);
  if (isRecord(parsedV2) && parsedV2.version === 2) {
    return normalizeStoredState(parsedV2);
  }

  return migrateLegacyState(parseJson(rawV1));
}

/** Serializes a normalized v2 state, dropping invalid or unknown fields. */
export function serializeStoredState(state: StoredState): string {
  return JSON.stringify(normalizeStoredState(state));
}

/**
 * Toggles one familiarity value. Assigning either state automatically replaces
 * the other, so a statement can never be both unfamiliar and mastered.
 */
export function toggleFamiliarity(
  state: StoredState,
  statementId: string,
  familiarity: Familiarity,
): StoredState {
  if (!statementId) return state;

  const statementFamiliarity = { ...state.statementFamiliarity };
  if (statementFamiliarity[statementId] === familiarity) {
    delete statementFamiliarity[statementId];
  } else {
    statementFamiliarity[statementId] = familiarity;
  }

  return { ...state, statementFamiliarity };
}

/** Removes a course's saved position while preserving its learning labels. */
export function resetCourseProgress(state: StoredState, courseId: string): StoredState {
  if (!courseId || !(courseId in state.progress)) return state;

  const progress = { ...state.progress };
  delete progress[courseId];
  return { ...state, progress };
}
