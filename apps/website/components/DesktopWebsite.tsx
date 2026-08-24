"use client";

import type { LearningAppController } from "@/lib/use-learning-app";
import type { CSSProperties } from "react";

import AccountControl from "@/components/AccountControl";
import LearningRecordDialog from "@/components/LearningRecordDialog";
import PracticeExperience from "@/components/PracticeExperience";
import UiIcon from "@/components/UiIcon";
import { writeDevicePreference } from "@/lib/device-routing";
import { useLearningApp } from "@/lib/use-learning-app";
import { useSoftKeyboardViewport } from "@/lib/use-soft-keyboard-viewport";
import { useCallback, useMemo, useState } from "react";

import styles from "./DesktopWebsite.module.css";

type ControllerViewProps = {
  controller: LearningAppController;
};

type PracticeViewportStyle = CSSProperties & {
  "--practice-visible-height": string;
  "--practice-visible-top": string;
};

function describePack(description?: string) {
  const fallback = "系统化句子练习课程。";
  if (!description) return { summary: fallback, sourceUrl: undefined };
  const [summary, source] = description.split(/\s*来源：\s*/, 2);
  const sourceUrl = source?.startsWith("http") ? source : undefined;
  return { summary: summary || fallback, sourceUrl };
}

function LogoMark() {
  return (
    <span
      className={styles.logoMark}
      aria-hidden="true"
    >
      E
    </span>
  );
}

function switchToMobile() {
  writeDevicePreference("mobile");
  window.location.assign("/mobile");
}

function DesktopHeader({
  controller,
  context,
}: {
  controller: LearningAppController;
  context?: string;
}) {
  const goHome = () => controller.selectPack(null);

  return (
    <header className={styles.header}>
      <button
        className={styles.brand}
        type="button"
        onClick={goHome}
        aria-label="返回 Earthworm 首页"
      >
        <LogoMark />
        <span className={styles.brandName}>Earthworm</span>
        <span className={styles.desktopBadge}>PC</span>
      </button>
      <nav
        className={styles.headerNav}
        aria-label="主导航"
      >
        <button
          type="button"
          onClick={goHome}
        >
          课程首页
        </button>
        {controller.activePack && (
          <button
            type="button"
            onClick={controller.closeCourse}
            aria-current={controller.activeCourse ? undefined : "page"}
          >
            {controller.activePack.title}
          </button>
        )}
        {context && <span className={styles.headerContext}>{context}</span>}
      </nav>
      <div className={styles.headerActions}>
        {controller.account.isAdmin && (
          <button
            className={styles.adminEntry}
            type="button"
            onClick={() => window.location.assign("/admin")}
          >
            <UiIcon
              name="list"
              size={16}
            />
            管理后台
          </button>
        )}
        <AccountControl account={controller.account} />
        <button
          className={styles.deviceSwitch}
          type="button"
          onClick={switchToMobile}
        >
          切换手机版
        </button>
      </div>
    </header>
  );
}

function HomeView({ controller }: ControllerViewProps) {
  const { catalog, recentCourse, recentPack } = controller;
  const recentStats = recentCourse ? controller.getCourseStats(recentCourse) : null;
  const recentIndex = recentStats?.savedIndex ?? 0;
  const recentPercentage = recentStats?.percentage ?? 0;

  return (
    <main className={styles.page}>
      <DesktopHeader controller={controller} />

      <section className={styles.homeHero}>
        <div className={styles.heroCopy}>
          <h1>
            把英语，
            <br />
            练成一种反射。
          </h1>
          <p>从中文提示出发，逐词敲出英文。用键盘保持节奏，用即时发音建立句子的声音记忆。</p>
          <div
            className={styles.summaryStats}
            aria-label="课程数据概览"
          >
            <div>
              <strong>{catalog?.packs.length ?? "—"}</strong>
              <span>课程包</span>
            </div>
            <div>
              <strong>{controller.totalCourses || "—"}</strong>
              <span>节课程</span>
            </div>
            <div>
              <strong>
                {controller.totalStatements ? controller.totalStatements.toLocaleString() : "—"}
              </strong>
              <span>条练习</span>
            </div>
          </div>
        </div>

        {recentCourse && recentPack ? (
          <article className={styles.continueCard}>
            <div className={styles.continueHeading}>
              <span>继续学习</span>
              <small>{recentPercentage}%</small>
            </div>
            <p>{recentPack.title}</p>
            <h2>{recentCourse.title}</h2>
            <div
              className={styles.continueProgress}
              aria-label={`课程进度 ${recentPercentage}%`}
            >
              <span style={{ width: `${recentPercentage}%` }} />
            </div>
            <div className={styles.continueMeta}>
              <span>
                上次学到第 {Math.min(recentIndex + 1, recentCourse.statements.length)} /{" "}
                {recentCourse.statements.length} 句
              </span>
              <button
                type="button"
                onClick={() => {
                  controller.openCourse(recentCourse);
                }}
              >
                继续练习 →
              </button>
            </div>
          </article>
        ) : (
          <article className={styles.startCard}>
            <LogoMark />
            <span>第一组练习只需要几分钟</span>
            <h2>
              听一句，写一句。
              <br />
              现在就开始。
            </h2>
            <button
              type="button"
              disabled={!controller.visiblePacks[0]}
              onClick={() =>
                controller.visiblePacks[0] && controller.selectPack(controller.visiblePacks[0].id)
              }
            >
              浏览第一套课程 →
            </button>
          </article>
        )}
      </section>

      <section
        className={styles.librarySection}
        aria-labelledby="desktop-library-title"
      >
        <div className={styles.sectionLead}>
          <div>
            <h2 id="desktop-library-title">选择课程包</h2>
          </div>
          <label className={styles.searchBox}>
            <UiIcon
              name="search"
              size={18}
            />
            <span className={styles.srOnly}>搜索课程包</span>
            <input
              type="search"
              value={controller.query}
              onChange={(event) => controller.setQuery(event.target.value)}
              placeholder="搜索 PTE、IELTS、零基础…"
            />
            {controller.query && (
              <button
                type="button"
                onClick={() => controller.setQuery("")}
                aria-label="清除搜索"
              >
                <UiIcon
                  name="close"
                  size={15}
                />
              </button>
            )}
          </label>
        </div>

        {!catalog ? (
          <div className={styles.emptyState}>课程数据正在装入…</div>
        ) : catalog.packs.length === 0 ? (
          <div className={styles.emptyState}>课程数据加载失败，请刷新页面重试。</div>
        ) : controller.visiblePacks.length === 0 ? (
          <div className={styles.emptyState}>没有找到与“{controller.query}”匹配的课程包。</div>
        ) : (
          <div className={styles.packGrid}>
            {controller.visiblePacks.map((pack, packIndex) => {
              const statementCount = pack.courses.reduce(
                (sum, course) => sum + course.statements.length,
                0,
              );
              const isRecentPack = recentPack?.id === pack.id;
              const { summary } = describePack(pack.description);
              return (
                <button
                  className={`${styles.packCard} ${isRecentPack ? styles.recentPack : ""}`}
                  key={pack.id}
                  type="button"
                  onClick={() => controller.selectPack(pack.id)}
                >
                  <span className={styles.packNumber}>
                    {String(packIndex + 1).padStart(2, "0")}
                  </span>
                  {isRecentPack && <span className={styles.recentLabel}>最近学习</span>}
                  <LogoMark />
                  <h3>{pack.title}</h3>
                  <p>{summary}</p>
                  <footer>
                    <span>
                      {pack.courses.length} 节课 · {statementCount.toLocaleString()} 句
                    </span>
                    <strong>查看课程 →</strong>
                  </footer>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        Earthworm Website · PC 专用界面 · 登录后可跨设备同步
      </footer>
    </main>
  );
}

function CourseListView({ controller }: ControllerViewProps) {
  const { activePack, recentCourse, stored } = controller;
  const [courseQuery, setCourseQuery] = useState("");
  const [unfinishedOnly, setUnfinishedOnly] = useState(false);

  const courses = useMemo(() => {
    if (!activePack) return [];
    const normalizedQuery = courseQuery.trim().toLocaleLowerCase();
    return activePack.courses
      .filter((course) => {
        const matchesSearch =
          !normalizedQuery ||
          `${course.title} ${course.description}`.toLocaleLowerCase().includes(normalizedQuery);
        const isUnfinished = controller.getCourseStats(course).percentage < 100;
        return matchesSearch && (!unfinishedOnly || isUnfinished);
      })
      .slice()
      .sort((first, second) => {
        if (first.id === recentCourse?.id) return -1;
        if (second.id === recentCourse?.id) return 1;
        return first.order - second.order;
      });
  }, [activePack, controller, courseQuery, recentCourse?.id, unfinishedOnly]);

  if (!activePack) return null;

  const recentCourseInPack =
    recentCourse?.coursePackId === activePack.id ? recentCourse : undefined;
  const packDescription = describePack(activePack.description);

  return (
    <main className={styles.page}>
      <DesktopHeader
        controller={controller}
        context="课程目录"
      />
      <section className={styles.coursePage}>
        <button
          className={styles.backButton}
          type="button"
          onClick={() => controller.selectPack(null)}
        >
          <UiIcon
            name="arrow-left"
            size={16}
          />
          返回课程包
        </button>

        <div className={styles.courseHeading}>
          <div>
            <h1>{activePack.title}</h1>
            <p>
              <span>{packDescription.summary}</span>
              {packDescription.sourceUrl && (
                <a
                  href={packDescription.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看课程来源 ↗
                </a>
              )}
            </p>
          </div>
          <div className={styles.courseCount}>
            <strong>{activePack.courses.length}</strong>
            <span>节课程</span>
          </div>
        </div>

        {recentCourseInPack && (
          <aside className={styles.recentCourseBanner}>
            <div>
              <span>上次学习</span>
              <strong>{recentCourseInPack.title}</strong>
              <small>
                第 {(stored.progress[recentCourseInPack.id] ?? 0) + 1} /{" "}
                {recentCourseInPack.statements.length} 句
              </small>
            </div>
            <button
              type="button"
              onClick={() => controller.openCourse(recentCourseInPack)}
            >
              继续这节课 →
            </button>
          </aside>
        )}

        <div className={styles.courseTools}>
          <label className={styles.searchBox}>
            <UiIcon
              name="search"
              size={18}
            />
            <span className={styles.srOnly}>搜索本课程包</span>
            <input
              type="search"
              value={courseQuery}
              onChange={(event) => setCourseQuery(event.target.value)}
              placeholder="搜索课程名称…"
            />
            {courseQuery && (
              <button
                type="button"
                onClick={() => setCourseQuery("")}
                aria-label="清除课程搜索"
              >
                <UiIcon
                  name="close"
                  size={15}
                />
              </button>
            )}
          </label>
          <label className={styles.filterToggle}>
            <input
              type="checkbox"
              checked={unfinishedOnly}
              onChange={(event) => setUnfinishedOnly(event.target.checked)}
            />
            只看未完成
          </label>
          <span className={styles.resultCount}>{courses.length} 节</span>
        </div>

        {courses.length ? (
          <div className={styles.courseGrid}>
            {courses.map((course) => {
              const courseStats = controller.getCourseStats(course);
              const {
                started: hasProgress,
                percentage: progress,
                masteredCount,
                unfamiliarCount,
              } = courseStats;
              const isRecent = recentCourse?.id === course.id;
              return (
                <article
                  className={`${styles.courseCard} ${isRecent ? styles.recentCourseCard : ""}`}
                  key={course.id}
                >
                  <div className={styles.courseCardTop}>
                    <div>
                      {isRecent && <span className={styles.recentLabel}>最近学习</span>}
                      <h2>{course.title}</h2>
                      <p>{course.description || `${course.statements.length} 条句子练习`}</p>
                    </div>
                    <strong>{progress}%</strong>
                  </div>
                  <div
                    className={styles.courseProgress}
                    aria-label={`学习进度 ${progress}%`}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className={styles.courseFacts}>
                    <span>{course.statements.length} 句</span>
                    {masteredCount > 0 && (
                      <span className={styles.masteredFact}>✓ {masteredCount} 已掌握</span>
                    )}
                    {unfamiliarCount > 0 && (
                      <span className={styles.unfamiliarFact}>● {unfamiliarCount} 不熟悉</span>
                    )}
                  </div>
                  <div className={styles.courseActions}>
                    {unfamiliarCount > 0 && (
                      <button
                        type="button"
                        onClick={() => controller.openCourse(course, true)}
                      >
                        复习不熟悉
                      </button>
                    )}
                    <button
                      className={styles.startButton}
                      type="button"
                      onClick={() => controller.openCourse(course)}
                    >
                      {hasProgress ? "继续学习" : "开始学习"} →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>当前筛选条件下没有课程。</div>
        )}
      </section>
      <footer className={styles.footer}>未登录时保存在本机 · 登录后自动同步学习进度</footer>
    </main>
  );
}

function PracticeView({ controller }: ControllerViewProps) {
  const [learningRecordOpen, setLearningRecordOpen] = useState(false);
  const closeLearningRecord = useCallback(() => setLearningRecordOpen(false), []);
  const { height: visibleHeight, top: visibleTop, keyboardOpen } = useSoftKeyboardViewport();
  const {
    activePack,
    activeCourse,
    statement,
    enrichedStatement,
    practiceStatements,
    statementIndex,
    reviewStatementIds,
    stored,
    openCourse,
    closeCourse,
  } = controller;
  const practiceViewportStyle = visibleHeight
    ? ({
        "--practice-visible-height": `${visibleHeight}px`,
        "--practice-visible-top": `${visibleTop}px`,
      } as PracticeViewportStyle)
    : undefined;
  const activeCourseIndex = activePack?.courses.findIndex(
    (course) => course.id === activeCourse?.id,
  );
  const nextCourse =
    activeCourseIndex !== undefined && activeCourseIndex >= 0
      ? activePack?.courses[activeCourseIndex + 1]
      : undefined;
  const handleCourseComplete = useCallback(() => {
    if (reviewStatementIds || !nextCourse) {
      closeCourse();
      return;
    }
    openCourse(nextCourse);
  }, [closeCourse, nextCourse, openCourse, reviewStatementIds]);

  if (!activePack || !activeCourse) return null;

  const resetCourseProgress = () => {
    const confirmed = window.confirm(
      `确定重置“${activeCourse.title}”的学习进度吗？不熟悉和已掌握标记会保留。`,
    );
    if (confirmed) controller.resetProgress();
  };

  if (reviewStatementIds && reviewStatementIds.length === 0) {
    return (
      <main className={`${styles.page} ${styles.practicePage}`}>
        <DesktopHeader
          controller={controller}
          context={`${activePack.title} / ${activeCourse.title}`}
        />
        <section className={styles.reviewEmpty}>
          <h1>没有待复习的句子</h1>
          <p>这节课暂时没有标记为“不熟悉”的内容。</p>
          <button
            type="button"
            onClick={controller.closeCourse}
          >
            返回课程目录
          </button>
        </section>
      </main>
    );
  }

  if (!statement || !enrichedStatement) {
    return (
      <main className={`${styles.page} ${styles.practicePage}`}>
        <DesktopHeader
          controller={controller}
          context={activeCourse.title}
        />
        <div className={styles.emptyState}>练习内容正在准备…</div>
      </main>
    );
  }

  return (
    <main
      className={`${styles.page} ${styles.practicePage} ${keyboardOpen ? styles.practiceKeyboardOpen : ""}`}
      data-keyboard-open={keyboardOpen ? "true" : "false"}
      style={practiceViewportStyle}
    >
      <DesktopHeader
        controller={controller}
        context={`${reviewStatementIds ? "不熟悉复习 · " : ""}${activeCourse.title}`}
      />
      <div className={styles.practiceUtility}>
        <button
          type="button"
          onClick={controller.closeCourse}
        >
          <UiIcon
            name="arrow-left"
            size={16}
          />
          课程目录
        </button>
        <div className={styles.practiceUtilityActions}>
          <button
            className={styles.recordLink}
            type="button"
            onClick={() => setLearningRecordOpen(true)}
          >
            学习记录
          </button>
          <button
            className={styles.resetLink}
            type="button"
            onClick={resetCourseProgress}
          >
            重置进度
          </button>
        </div>
      </div>
      <PracticeExperience
        compact={keyboardOpen}
        statement={enrichedStatement}
        index={statementIndex}
        total={practiceStatements.length}
        preferences={stored.preferences}
        familiarity={stored.statementFamiliarity[statement.id]}
        onPreferencesChange={controller.updatePreferences}
        onFamiliarityChange={controller.updateFamiliarity}
        onPrevious={controller.previousQuestion}
        onNext={controller.nextQuestion}
        onCourseComplete={handleCourseComplete}
        courseCompleteLabel={reviewStatementIds || !nextCourse ? "返回课程目录" : "开始下一课"}
        nextCourseTitle={nextCourse?.title}
        onComplete={controller.completeStatement}
        canPrevious={statementIndex > 0}
        canNext={statementIndex < practiceStatements.length - 1}
      />
      {learningRecordOpen && (
        <LearningRecordDialog
          courseTitle={activeCourse.title}
          statements={practiceStatements}
          currentIndex={statementIndex}
          familiarity={stored.statementFamiliarity}
          onClose={closeLearningRecord}
          onSelect={controller.jumpToQuestion}
        />
      )}
    </main>
  );
}

export default function DesktopWebsite() {
  const controller = useLearningApp();

  if (controller.view === "practice" || controller.view === "review-empty") {
    return <PracticeView controller={controller} />;
  }
  if (controller.view === "courses") {
    return <CourseListView controller={controller} />;
  }
  return <HomeView controller={controller} />;
}
