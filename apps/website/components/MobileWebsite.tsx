"use client";

/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";

import AccountControl from "@/components/AccountControl";
import LearningRecordDialog from "@/components/LearningRecordDialog";
import PracticeExperience from "@/components/PracticeExperience";
import UiIcon from "@/components/UiIcon";
import { writeDevicePreference as setPreferredDevice } from "@/lib/device-routing";
import { useLearningApp } from "@/lib/use-learning-app";
import { useSoftKeyboardViewport } from "@/lib/use-soft-keyboard-viewport";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./MobileWebsite.module.css";

type MobileViewportStyle = CSSProperties & {
  "--mobile-visible-height": string;
  "--mobile-visible-top": string;
};

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="19"
      viewBox="0 0 24 24"
      width="19"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {active ? (
        <>
          <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
          <path d="m9 9-5-5M15 9l5-5M9 15l-5 5M15 15l5 5" />
        </>
      ) : (
        <>
          <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
          <path d="m3 3 6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" />
        </>
      )}
    </svg>
  );
}

export default function MobileWebsite() {
  const controller = useLearningApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [learningRecordOpen, setLearningRecordOpen] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const fullscreenRequestTimerRef = useRef(0);
  const fullscreenRequestPendingRef = useRef(false);
  const fullscreenSupportedRef = useRef(false);
  const practiceShellRef = useRef<HTMLDivElement>(null);
  const { height: visibleHeight, top: visibleTop, keyboardOpen } = useSoftKeyboardViewport();
  const {
    catalog,
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
    setQuery,
    selectPack,
    openCourse,
    closeCourse,
    resetProgress,
    previousQuestion,
    nextQuestion,
    updateFamiliarity,
    completeStatement,
    updatePreferences,
    getCourseStats,
  } = controller;
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

  const switchToDesktop = () => {
    setPreferredDevice("desktop");
    window.location.assign("/desktop");
  };

  const continueLearning = () => {
    if (!recentCourse || !recentPack) return;
    openCourse(recentCourse);
  };

  const showFullscreenError = () => {
    window.clearTimeout(fullscreenRequestTimerRef.current);
    fullscreenRequestPendingRef.current = false;
    setFullscreenNotice("浏览器未允许进入全屏，请从浏览器菜单选择全屏或添加到主屏幕。");
  };

  const toggleFullscreen = () => {
    setFullscreenNotice(null);

    if (document.fullscreenElement) {
      fullscreenRequestPendingRef.current = false;
      document.exitFullscreen().catch(showFullscreenError);
      return;
    }

    if (fullscreenSupportedRef.current && document.documentElement.requestFullscreen) {
      fullscreenRequestPendingRef.current = true;
      setFullscreenNotice("正在进入全屏…");
      document.documentElement.requestFullscreen().catch(showFullscreenError);
      window.clearTimeout(fullscreenRequestTimerRef.current);
      fullscreenRequestTimerRef.current = window.setTimeout(() => {
        if (!document.fullscreenElement) showFullscreenError();
      }, 1200);
      return;
    }

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setFullscreenNotice(
      isStandalone
        ? "当前已是独立显示模式。"
        : "当前浏览器不支持网页全屏，可从浏览器菜单将网站添加到主屏幕。",
    );
  };

  useEffect(() => {
    const syncFullscreenState = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreenActive(active);
      if (active) {
        window.clearTimeout(fullscreenRequestTimerRef.current);
        fullscreenRequestPendingRef.current = false;
        setFullscreenNotice(null);
      }
    };
    const handleFullscreenError = () => {
      window.clearTimeout(fullscreenRequestTimerRef.current);
      fullscreenRequestPendingRef.current = false;
      setFullscreenNotice("浏览器未允许进入全屏，请从浏览器菜单选择全屏或添加到主屏幕。");
    };

    fullscreenSupportedRef.current =
      document.fullscreenEnabled === true &&
      typeof document.documentElement.requestFullscreen === "function";
    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("fullscreenerror", handleFullscreenError);
    return () => {
      window.clearTimeout(fullscreenRequestTimerRef.current);
      fullscreenRequestPendingRef.current = false;
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("fullscreenerror", handleFullscreenError);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (view !== "practice") return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [view]);

  useEffect(() => {
    if (!keyboardOpen) return;
    const practiceRegion =
      practiceShellRef.current?.querySelector<HTMLElement>('[aria-label="英语句子练习"]');
    if (!practiceRegion) return;

    const resetPracticeScroll = () => {
      if (practiceRegion.scrollTop !== 0) practiceRegion.scrollTop = 0;
    };
    const frame = window.requestAnimationFrame(resetPracticeScroll);
    const settleTimer = window.setTimeout(resetPracticeScroll, 160);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [keyboardOpen, statementIndex]);

  const shellHeader = (
    <header className={styles.header}>
      <button
        className={styles.brand}
        type="button"
        onClick={() => selectPack(null)}
        aria-label="返回 Earthworm 首页"
      >
        <img
          src="/logo.png"
          alt=""
          width={34}
          height={34}
        />
        <span>Earthworm</span>
        <small>H5</small>
      </button>
      <div className={styles.headerActions}>
        <AccountControl
          account={controller.account}
          compact
        />
        <button
          className={styles.desktopSwitch}
          type="button"
          onClick={switchToDesktop}
        >
          <span className={styles.desktopSwitchFull}>电脑版</span>
          <span className={styles.desktopSwitchShort}>PC</span>
        </button>
      </div>
    </header>
  );

  if (view === "practice" && activePack && activeCourse && enrichedStatement && statement) {
    const viewportStyle = visibleHeight
      ? ({
          "--mobile-visible-height": `${visibleHeight}px`,
          "--mobile-visible-top": `${visibleTop}px`,
        } as MobileViewportStyle)
      : undefined;

    return (
      <main
        className={`${styles.practiceRoot} ${keyboardOpen ? styles.keyboardOpen : ""}`}
        data-keyboard-open={keyboardOpen ? "true" : "false"}
        style={viewportStyle}
      >
        <header className={styles.practiceHeader}>
          <button
            className={styles.iconButton}
            type="button"
            onClick={closeCourse}
          >
            <UiIcon
              name="chevron-left"
              size={19}
            />
            <span>目录</span>
          </button>
          <div className={styles.practiceTitle}>
            <span>{reviewStatementIds ? "不熟悉复习" : activePack.title}</span>
            <strong>{activeCourse.title}</strong>
          </div>
          <button
            className={styles.iconButton}
            type="button"
            onClick={() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
              setLearningRecordOpen(true);
            }}
          >
            <UiIcon
              name="list"
              size={19}
            />
            <span>记录</span>
          </button>
          <button
            className={styles.iconButton}
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreenActive ? "退出全屏" : "进入全屏"}
            aria-pressed={fullscreenActive}
          >
            <FullscreenIcon active={fullscreenActive} />
            <span>{fullscreenActive ? "退出" : "全屏"}</span>
          </button>
          <button
            className={styles.iconButton}
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <UiIcon
              name="settings"
              size={19}
            />
            <span>设置</span>
          </button>
        </header>

        {fullscreenNotice && (
          <div
            className={styles.fullscreenNotice}
            role="status"
          >
            {fullscreenNotice}
          </div>
        )}

        <div
          className={styles.practiceShell}
          ref={practiceShellRef}
        >
          <PracticeExperience
            compact={keyboardOpen}
            autoFocusInput
            statement={enrichedStatement}
            index={statementIndex}
            total={practiceStatements.length}
            preferences={stored.preferences}
            familiarity={stored.statementFamiliarity[statement.id]}
            onPreferencesChange={updatePreferences}
            onFamiliarityChange={updateFamiliarity}
            onPrevious={previousQuestion}
            onNext={nextQuestion}
            onCourseComplete={handleCourseComplete}
            courseCompleteLabel={reviewStatementIds || !nextCourse ? "返回课程目录" : "开始下一课"}
            nextCourseTitle={nextCourse?.title}
            onComplete={completeStatement}
            canPrevious={statementIndex > 0}
            canNext={statementIndex < practiceStatements.length - 1}
          />
        </div>

        {learningRecordOpen && (
          <LearningRecordDialog
            courseTitle={activeCourse.title}
            statements={practiceStatements}
            currentIndex={statementIndex}
            familiarity={stored.statementFamiliarity}
            onClose={() => setLearningRecordOpen(false)}
            onSelect={controller.jumpToQuestion}
          />
        )}

        {settingsOpen && (
          <div
            className={styles.settingsLayer}
            role="presentation"
          >
            <button
              className={styles.settingsBackdrop}
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="关闭设置"
            />
            <section
              className={styles.settingsSheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-settings-title"
            >
              <div className={styles.sheetHeading}>
                <div>
                  <h2 id="mobile-settings-title">练习设置</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="关闭设置"
                >
                  <UiIcon name="close" />
                </button>
              </div>

              <div className={styles.settingRows}>
                <label>
                  <span>
                    <strong>进入与完成后朗读</strong>
                    <small>自动朗读完整英文句子</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={stored.preferences.autoSpeak}
                    onChange={(event) =>
                      updatePreferences({
                        ...stored.preferences,
                        autoSpeak: event.target.checked,
                      })
                    }
                  />
                </label>
                <label>
                  <span>
                    <strong>打字音效</strong>
                    <small>输入时播放轻提示音</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={stored.preferences.typingSound}
                    onChange={(event) =>
                      updatePreferences({
                        ...stored.preferences,
                        typingSound: event.target.checked,
                      })
                    }
                  />
                </label>
                <label>
                  <span>
                    <strong>答题反馈音效</strong>
                    <small>正确与错误反馈</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={stored.preferences.feedbackSound}
                    onChange={(event) =>
                      updatePreferences({
                        ...stored.preferences,
                        feedbackSound: event.target.checked,
                      })
                    }
                  />
                </label>
              </div>
              <div className={styles.accountSetting}>
                <span>
                  <strong>账号与进度</strong>
                  <small>登录后在手机和电脑间自动同步</small>
                </span>
                <AccountControl
                  account={controller.account}
                  compact
                />
              </div>

              <button
                className={styles.resetAction}
                type="button"
                onClick={resetProgress}
              >
                重置本课学习位置
              </button>
              <button
                className={styles.switchAction}
                type="button"
                onClick={switchToDesktop}
              >
                切换电脑版
              </button>
            </section>
          </div>
        )}
      </main>
    );
  }

  if (view === "review-empty" && activePack && activeCourse) {
    return (
      <main className={styles.mobileRoot}>
        {shellHeader}
        <section className={styles.emptyState}>
          <h1>没有待复习的句子</h1>
          <p>这节课暂时没有标记为“不熟悉”的内容。</p>
          <button
            type="button"
            onClick={closeCourse}
          >
            返回课程目录
          </button>
        </section>
      </main>
    );
  }

  if (view === "courses" && activePack) {
    return (
      <main className={styles.mobileRoot}>
        {shellHeader}
        <section className={styles.coursePage}>
          <button
            className={styles.backButton}
            type="button"
            onClick={() => selectPack(null)}
          >
            <UiIcon
              name="arrow-left"
              size={16}
            />
            返回课程包
          </button>
          <div className={styles.courseHeading}>
            <h1>{activePack.title}</h1>
            <span>{activePack.description}</span>
          </div>

          {controller.packLoadError ? (
            <div className={styles.loading}>课程正文加载失败，请刷新页面后重试。</div>
          ) : controller.packLoading ? (
            <div className={styles.loading}>正在按需加载本卷课程正文…</div>
          ) : (
            <div className={styles.courseList}>
              {activePack.courses.map((course, index) => {
                const { percentage, masteredCount, unfamiliarCount } = getCourseStats(course);
                return (
                  <article
                    className={styles.courseRow}
                    key={course.id}
                  >
                    <button
                      className={styles.courseMainAction}
                      type="button"
                      onClick={() => openCourse(course)}
                    >
                      <span className={styles.courseNumber}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className={styles.courseCopy}>
                        <strong>{course.title}</strong>
                        <small>{course.statementCount ?? course.statements.length} 条练习</small>
                      </span>
                      <span className={styles.rowArrow}>›</span>
                    </button>

                    {(percentage > 0 || masteredCount > 0 || unfamiliarCount > 0) && (
                      <div className={styles.courseMeta}>
                        <div
                          className={styles.miniProgress}
                          aria-label={`学习进度 ${percentage}%`}
                        >
                          <span style={{ width: `${percentage}%` }} />
                        </div>
                        <div className={styles.statusLine}>
                          {percentage > 0 && <span>已学 {percentage}%</span>}
                          {masteredCount > 0 && (
                            <span className={styles.mastered}>✓ {masteredCount}</span>
                          )}
                          {unfamiliarCount > 0 && (
                            <span className={styles.unfamiliar}>● {unfamiliarCount}</span>
                          )}
                        </div>
                        {unfamiliarCount > 0 && (
                          <button
                            className={styles.reviewButton}
                            type="button"
                            onClick={() => openCourse(course, true)}
                          >
                            复习不熟悉
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <MobileFooter onSwitchDesktop={switchToDesktop} />
      </main>
    );
  }

  return (
    <main className={styles.mobileRoot}>
      {shellHeader}
      <section className={styles.home}>
        <div className={styles.hero}>
          <h1>把英语，练成一种反射。</h1>
          <span>逐词输入、自动朗读和句子解析，随时拿起手机练几句。</span>
        </div>

        {recentCourse &&
          recentPack &&
          (() => {
            const recentStats = getCourseStats(recentCourse);
            return (
              <button
                className={styles.continueCard}
                type="button"
                onClick={continueLearning}
              >
                <span className={styles.continueLabel}>继续学习</span>
                <strong>{recentCourse.title}</strong>
                <small>{recentPack.title}</small>
                <div className={styles.continueProgress}>
                  <span style={{ width: `${recentStats.percentage}%` }} />
                </div>
                <span className={styles.continueAction}>
                  从第 {recentStats.savedIndex + 1} 句继续 <b>→</b>
                </span>
              </button>
            );
          })()}

        <div
          className={styles.summary}
          aria-label="课程数据概览"
        >
          <div>
            <strong>{catalog?.packs.length ?? "—"}</strong>
            <span>课程包</span>
          </div>
          <div>
            <strong>{totalCourses || "—"}</strong>
            <span>节课程</span>
          </div>
          <div>
            <strong>{totalStatements ? totalStatements.toLocaleString() : "—"}</strong>
            <span>条练习</span>
          </div>
        </div>

        <section className={styles.library}>
          <div className={styles.libraryHeading}>
            <div>
              <h2>选择课程包</h2>
            </div>
            <label className={styles.search}>
              <UiIcon
                name="search"
                size={19}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索课程…"
                aria-label="搜索课程包"
              />
            </label>
          </div>

          {!catalog ? (
            <div className={styles.loading}>课程数据正在装入…</div>
          ) : catalog.packs.length === 0 ? (
            <div className={styles.loading}>课程数据加载失败，请刷新后重试。</div>
          ) : visiblePacks.length === 0 ? (
            <div className={styles.loading}>没有找到匹配的课程包。</div>
          ) : (
            <div className={styles.packList}>
              {visiblePacks.map((pack, index) => (
                <button
                  className={styles.packRow}
                  key={pack.id}
                  type="button"
                  onClick={() => selectPack(pack.id)}
                >
                  <span className={styles.packIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <img
                    src="/logo.png"
                    alt=""
                    width={42}
                    height={42}
                  />
                  <span className={styles.packCopy}>
                    <strong>{pack.title}</strong>
                    <small>{pack.description}</small>
                    <em>{pack.courses.length} 节课</em>
                  </span>
                  <span className={styles.rowArrow}>›</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </section>
      <MobileFooter onSwitchDesktop={switchToDesktop} />
    </main>
  );
}

function MobileFooter({ onSwitchDesktop }: { onSwitchDesktop: () => void }) {
  return (
    <footer className={styles.footer}>
      <span>未登录保存在本机 · 登录后跨设备同步</span>
      <button
        type="button"
        onClick={onSwitchDesktop}
      >
        切换电脑版
      </button>
    </footer>
  );
}
