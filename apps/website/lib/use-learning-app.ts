"use client";

import type {
  Familiarity,
  PracticeCompletion,
  PracticePreferences,
  PracticeStatement,
} from "@/components/PracticeExperience";
import type { StoredState } from "@/lib/learning-storage";
import type { LearningAccountController } from "@/lib/use-learning-account";

import { buildLearningLexicon, enrichStatement } from "@/lib/learning-data";
import {
  createDefaultStoredState,
  LEGACY_STORAGE_KEY,
  parseStoredState,
  resetCourseProgress,
  serializeStoredState,
  STORAGE_KEY,
  toggleFamiliarity,
} from "@/lib/learning-storage";
import { useLearningAccount } from "@/lib/use-learning-account";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Statement = {
  id: string;
  order: number;
  chinese: string;
  english: string;
  soundmark?: string;
  image?: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  order: number;
  coursePackId: string;
  statements: Statement[];
};

export type CoursePack = {
  id: string;
  title: string;
  description: string;
  courses: Course[];
};

export type Catalog = { packs: CoursePack[] };

export type CourseStats = {
  savedIndex: number;
  percentage: number;
  masteredCount: number;
  unfamiliarCount: number;
  started: boolean;
};

export type LearningView = "home" | "courses" | "practice" | "review-empty";

export type LearningAppController = {
  catalog: Catalog | null;
  catalogError: boolean;
  visiblePacks: CoursePack[];
  activePack: CoursePack | undefined;
  activeCourse: Course | undefined;
  statement: Statement | undefined;
  enrichedStatement: PracticeStatement | null;
  practiceStatements: Statement[];
  statementIndex: number;
  reviewStatementIds: string[] | null;
  stored: StoredState;
  query: string;
  totalCourses: number;
  totalStatements: number;
  recentCourse: Course | undefined;
  recentPack: CoursePack | undefined;
  view: LearningView;
  account: LearningAccountController;
  setQuery: (query: string) => void;
  selectPack: (packId: string | null) => void;
  openCourse: (course: Course, reviewOnly?: boolean) => void;
  closeCourse: () => void;
  resetProgress: () => void;
  previousQuestion: () => void;
  nextQuestion: () => void;
  jumpToQuestion: (index: number) => void;
  updateFamiliarity: (next: Familiarity) => void;
  completeStatement: (completion?: PracticeCompletion) => void;
  updatePreferences: (preferences: PracticePreferences) => void;
  getCourseStats: (course: Course) => CourseStats;
};

type RouteState = {
  packId: string | null;
  courseId: string | null;
  reviewOnly: boolean;
};

function readRouteState(): RouteState {
  if (typeof window === "undefined") {
    return { packId: null, courseId: null, reviewOnly: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    packId: params.get("pack"),
    courseId: params.get("course"),
    reviewOnly: params.get("review") === "unfamiliar",
  };
}

function pushRoute(packId: string | null, courseId: string | null, reviewOnly = false) {
  if (typeof window === "undefined") return;
  const nextUrl = new URL(window.location.href);
  nextUrl.search = "";
  if (packId) nextUrl.searchParams.set("pack", packId);
  if (courseId) nextUrl.searchParams.set("course", courseId);
  if (reviewOnly) nextUrl.searchParams.set("review", "unfamiliar");
  window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

export function useLearningApp(): LearningAppController {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stored, setStored] = useState<StoredState>(() => createDefaultStoredState());
  const [storageReady, setStorageReady] = useState(false);
  const [statementIndex, setStatementIndex] = useState(0);
  const [reviewOnly, setReviewOnly] = useState(false);
  const initializedCourseRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/course-data.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`课程数据加载失败：${response.status}`);
        const data = (await response.json()) as Catalog;
        setCatalog(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogError(true);
        setCatalog({ packs: [] });
      });

    const hydrationTimer = window.setTimeout(() => {
      const nextState = parseStoredState(
        window.localStorage.getItem(STORAGE_KEY),
        window.localStorage.getItem(LEGACY_STORAGE_KEY),
      );
      setStored(nextState);
      setStorageReady(true);
      window.localStorage.setItem(STORAGE_KEY, serializeStoredState(nextState));
    }, 0);

    const applyLocation = () => {
      const route = readRouteState();
      setActivePackId(route.packId);
      setActiveCourseId(route.courseId);
      setReviewOnly(route.reviewOnly);
      initializedCourseRef.current = null;
    };
    applyLocation();
    window.addEventListener("popstate", applyLocation);

    return () => {
      controller.abort();
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("popstate", applyLocation);
    };
  }, []);

  const persist = useCallback((nextState: StoredState) => {
    setStored(nextState);
    window.localStorage.setItem(STORAGE_KEY, serializeStoredState(nextState));
  }, []);

  const account = useLearningAccount({
    stored,
    storageReady,
    onCloudState: persist,
  });

  const activePack = useMemo(() => {
    if (!catalog) return undefined;
    const direct = catalog.packs.find((pack) => pack.id === activePackId);
    if (direct) return direct;
    if (!activeCourseId) return undefined;
    return catalog.packs.find((pack) =>
      pack.courses.some((course) => course.id === activeCourseId),
    );
  }, [activeCourseId, activePackId, catalog]);

  const activeCourse = useMemo(
    () => activePack?.courses.find((course) => course.id === activeCourseId),
    [activeCourseId, activePack],
  );

  const learningLexicon = useMemo(() => {
    const beginnerPack = catalog?.packs.find((pack) => pack.title.includes("星荣零基础"));
    if (!beginnerPack) return {};
    return buildLearningLexicon(beginnerPack.courses.flatMap((course) => course.statements));
  }, [catalog]);

  const reviewStatementIds = useMemo(() => {
    if (!reviewOnly || !activeCourse) return null;
    return activeCourse.statements
      .filter((item) => stored.statementFamiliarity[item.id] === "unfamiliar")
      .map((item) => item.id);
  }, [activeCourse, reviewOnly, stored.statementFamiliarity]);

  const practiceStatements = useMemo(() => {
    if (!activeCourse) return [];
    if (!reviewStatementIds) return activeCourse.statements;
    const reviewIds = new Set(reviewStatementIds);
    return activeCourse.statements.filter((item) => reviewIds.has(item.id));
  }, [activeCourse, reviewStatementIds]);

  useEffect(() => {
    if (!activeCourse || !storageReady) return;
    const initializationKey = `${activeCourse.id}:${reviewOnly ? "review" : "learn"}`;
    if (initializedCourseRef.current === initializationKey) return;
    const savedIndex = reviewOnly
      ? 0
      : Math.min(stored.progress[activeCourse.id] ?? 0, activeCourse.statements.length - 1);
    setStatementIndex(Math.max(savedIndex, 0));
    initializedCourseRef.current = initializationKey;
  }, [activeCourse, reviewOnly, storageReady, stored.progress]);

  const statement = practiceStatements[statementIndex];
  const enrichedStatement = useMemo<PracticeStatement | null>(() => {
    if (!statement) return null;
    return { ...statement, ...enrichStatement(statement, learningLexicon) };
  }, [learningLexicon, statement]);

  const totalCourses = catalog?.packs.reduce((sum, pack) => sum + pack.courses.length, 0) ?? 0;
  const totalStatements =
    catalog?.packs.reduce(
      (packSum, pack) =>
        packSum +
        pack.courses.reduce((courseSum, course) => courseSum + course.statements.length, 0),
      0,
    ) ?? 0;

  const visiblePacks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!catalog || !normalizedQuery) return catalog?.packs ?? [];
    return catalog.packs.filter((pack) => {
      const packText = `${pack.title} ${pack.description}`.toLowerCase();
      const courseText = pack.courses
        .map((course) => `${course.title} ${course.description}`)
        .join(" ")
        .toLowerCase();
      return `${packText} ${courseText}`.includes(normalizedQuery);
    });
  }, [catalog, query]);

  const recentPack = useMemo(() => {
    if (!catalog || !stored.recentCourseId) return undefined;
    return catalog.packs.find((pack) =>
      pack.courses.some((course) => course.id === stored.recentCourseId),
    );
  }, [catalog, stored.recentCourseId]);
  const recentCourse = useMemo(
    () => recentPack?.courses.find((course) => course.id === stored.recentCourseId),
    [recentPack, stored.recentCourseId],
  );

  const getCourseStats = useCallback(
    (course: Course): CourseStats => {
      const savedIndex = Math.min(
        Math.max(stored.progress[course.id] ?? 0, 0),
        Math.max(course.statements.length - 1, 0),
      );
      const started = course.id in stored.progress || stored.recentCourseId === course.id;
      const percentage =
        started && course.statements.length
          ? Math.round(((savedIndex + 1) / course.statements.length) * 100)
          : 0;
      const masteredCount = course.statements.filter(
        (item) => stored.statementFamiliarity[item.id] === "mastered",
      ).length;
      const unfamiliarCount = course.statements.filter(
        (item) => stored.statementFamiliarity[item.id] === "unfamiliar",
      ).length;
      return { savedIndex, percentage, masteredCount, unfamiliarCount, started };
    },
    [stored],
  );

  const selectPack = useCallback((packId: string | null) => {
    setActivePackId(packId);
    setActiveCourseId(null);
    setReviewOnly(false);
    setStatementIndex(0);
    initializedCourseRef.current = null;
    pushRoute(packId, null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openCourse = useCallback(
    (course: Course, shouldReviewOnly = false) => {
      const savedIndex = shouldReviewOnly
        ? 0
        : Math.min(stored.progress[course.id] ?? 0, course.statements.length - 1);
      setActivePackId(course.coursePackId);
      setActiveCourseId(course.id);
      setReviewOnly(shouldReviewOnly);
      setStatementIndex(Math.max(savedIndex, 0));
      initializedCourseRef.current = `${course.id}:${shouldReviewOnly ? "review" : "learn"}`;
      persist({
        ...stored,
        recentCourseId: course.id,
        ...(shouldReviewOnly ? { reviewMode: "unfamiliar" as const } : { reviewMode: undefined }),
      });
      pushRoute(course.coursePackId, course.id, shouldReviewOnly);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [persist, stored],
  );

  const closeCourse = useCallback(() => {
    setActiveCourseId(null);
    setReviewOnly(false);
    setStatementIndex(0);
    initializedCourseRef.current = null;
    pushRoute(activePack?.id ?? null, null);
  }, [activePack?.id]);

  const saveProgress = useCallback(
    (nextIndex: number) => {
      if (!activeCourse || reviewOnly) return;
      persist({
        ...stored,
        progress: { ...stored.progress, [activeCourse.id]: nextIndex },
        recentCourseId: activeCourse.id,
      });
    },
    [activeCourse, persist, reviewOnly, stored],
  );

  const nextQuestion = useCallback(() => {
    if (!practiceStatements.length) return;
    const nextIndex = Math.min(statementIndex + 1, practiceStatements.length - 1);
    setStatementIndex(nextIndex);
    saveProgress(nextIndex);
  }, [practiceStatements.length, saveProgress, statementIndex]);

  const previousQuestion = useCallback(() => {
    const nextIndex = Math.max(statementIndex - 1, 0);
    setStatementIndex(nextIndex);
    saveProgress(nextIndex);
  }, [saveProgress, statementIndex]);

  const jumpToQuestion = useCallback(
    (index: number) => {
      if (!practiceStatements.length) return;
      const nextIndex = Math.min(Math.max(index, 0), practiceStatements.length - 1);
      setStatementIndex(nextIndex);
      saveProgress(nextIndex);
    },
    [practiceStatements.length, saveProgress],
  );

  const updateFamiliarity = useCallback(
    (next: Familiarity) => {
      if (!statement) return;
      persist(toggleFamiliarity(stored, statement.id, next));
    },
    [persist, statement, stored],
  );

  const completeStatement = useCallback(
    (completion?: PracticeCompletion) => {
      void completion;
      saveProgress(statementIndex);
    },
    [saveProgress, statementIndex],
  );

  const updatePreferences = useCallback(
    (preferences: PracticePreferences) => {
      persist({ ...stored, preferences });
    },
    [persist, stored],
  );

  const resetProgress = useCallback(() => {
    if (!activeCourse) return;
    if (!window.confirm(`确定重置“${activeCourse.title}”的学习位置吗？掌握和不熟悉标记会保留。`))
      return;
    persist(resetCourseProgress(stored, activeCourse.id));
    setStatementIndex(0);
  }, [activeCourse, persist, stored]);

  const view: LearningView =
    activePack && activeCourse
      ? reviewStatementIds?.length === 0
        ? "review-empty"
        : enrichedStatement
          ? "practice"
          : "courses"
      : activePack
        ? "courses"
        : "home";

  return {
    catalog,
    catalogError,
    visiblePacks,
    activePack,
    activeCourse,
    statement,
    enrichedStatement,
    practiceStatements,
    statementIndex,
    reviewStatementIds,
    stored,
    query,
    totalCourses,
    totalStatements,
    recentCourse,
    recentPack,
    view,
    account,
    setQuery,
    selectPack,
    openCourse,
    closeCourse,
    resetProgress,
    previousQuestion,
    nextQuestion,
    jumpToQuestion,
    updateFamiliarity,
    completeStatement,
    updatePreferences,
    getCourseStats,
  };
}
