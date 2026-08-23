import type { StoredState } from "@/lib/learning-storage";

import { createDefaultStoredState, normalizeStoredState } from "@/lib/learning-storage";

export type CloudLearningProgressRow = {
  user_id: string;
  state: unknown;
  updated_at: string;
};

function hasLearningActivity(state: StoredState) {
  return Boolean(
    state.recentCourseId ||
      Object.keys(state.progress).length ||
      Object.keys(state.statementFamiliarity).length,
  );
}

/**
 * Merges a device cache into the cloud snapshot without moving any course
 * backwards. On first sign-in the current device wins label conflicts because
 * it is the state the learner can see and has just chosen to migrate.
 */
export function mergeLearningProgress(deviceValue: unknown, cloudValue: unknown): StoredState {
  const device = normalizeStoredState(deviceValue);
  const cloud = normalizeStoredState(cloudValue);
  const progress = { ...cloud.progress };

  for (const [courseId, deviceIndex] of Object.entries(device.progress)) {
    progress[courseId] = Math.max(deviceIndex, progress[courseId] ?? 0);
  }

  const deviceHasActivity = hasLearningActivity(device);
  const merged = createDefaultStoredState();
  merged.progress = progress;
  merged.statementFamiliarity = {
    ...cloud.statementFamiliarity,
    ...device.statementFamiliarity,
  };
  merged.preferences = deviceHasActivity ? device.preferences : cloud.preferences;

  const recentCourseId = device.recentCourseId ?? cloud.recentCourseId;
  const reviewMode = device.reviewMode ?? cloud.reviewMode;
  return {
    ...merged,
    ...(recentCourseId ? { recentCourseId } : {}),
    ...(reviewMode ? { reviewMode } : {}),
  };
}
