"use client";

/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";

import AccountControl from "@/components/AccountControl";
import LearningRecordDialog from "@/components/LearningRecordDialog";
import PracticeExperience from "@/components/PracticeExperience";
import UiIcon from "@/components/UiIcon";
import { writeDevicePreference as setPreferredDevice } from "@/lib/device-routing";
import { resolveSoftKeyboardViewport } from "@/lib/soft-keyboard";
import { useLearningApp } from "@/lib/use-learning-app";
import { useEffect, useRef, useState } from "react";

import styles from "./MobileWebsite.module.css";

type MobileViewportStyle = CSSProperties & {
  "--mobile-visible-height": string;
  "--mobile-visible-top": string;
};

function isTextEntryElement(element: Element | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

function useSoftKeyboardViewport() {
  const [viewport, setViewport] = useState({ height: 0, top: 0, keyboardOpen: false });
  const baselineHeightRef = useRef(0);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    let settleTimer = 0;

    const update = () => {
      const visibleHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      const visibleTop = Math.max(0, Math.round(visualViewport?.offsetTop ?? 0));
      const textEntryFocused = isTextEntryElement(document.activeElement);

      if (!textEntryFocused) {
        baselineHeightRef.current = Math.max(window.innerHeight, visibleHeight);
      } else if (!baselineHeightRef.current) {
        baselineHeightRef.current = Math.max(window.innerHeight, visibleHeight);
      }

      const nextViewport = resolveSoftKeyboardViewport({
        baselineHeight: baselineHeightRef.current,
        visibleHeight,
        textEntryFocused,
      });
      setViewport((current) =>
        current.height === nextViewport.height &&
        current.top === visibleTop &&
        current.keyboardOpen === nextViewport.keyboardOpen
          ? current
          : {
              height: nextViewport.height,
              top: visibleTop,
              keyboardOpen: nextViewport.keyboardOpen,
            },
      );
    };

    const updateAndSettle = () => {
      update();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(update, 80);
    };

    update();
    visualViewport?.addEventListener("resize", updateAndSettle);
    visualViewport?.addEventListener("scroll", updateAndSettle);
    window.addEventListener("resize", updateAndSettle);
    window.addEventListener("focusin", updateAndSettle);
    window.addEventListener("focusout", updateAndSettle);

    return () => {
      window.clearTimeout(settleTimer);
      visualViewport?.removeEventListener("resize", updateAndSettle);
      visualViewport?.removeEventListener("scroll", updateAndSettle);
      window.removeEventListener("resize", updateAndSettle);
      window.removeEventListener("focusin", updateAndSettle);
      window.removeEventListener("focusout", updateAndSettle);
    };
  }, []);

  return viewport;
}

export default function MobileWebsite() {
  const controller = useLearningApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [learningRecordOpen, setLearningRecordOpen] = useState(false);
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

  const switchToDesktop = () => {
    setPreferredDevice("desktop");
    window.location.assign("/desktop");
  };

  const continueLearning = () => {
    if (!recentCourse || !recentPack) return;
    openCourse(recentCourse);
  };

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
            onClick={() => setSettingsOpen(true)}
          >
            <UiIcon
              name="settings"
              size={19}
            />
            <span>设置</span>
          </button>
        </header>

        <div className={styles.practiceShell}>
          <PracticeExperience
            compact={keyboardOpen}
            statement={enrichedStatement}
            index={statementIndex}
            total={practiceStatements.length}
            preferences={stored.preferences}
            familiarity={stored.statementFamiliarity[statement.id]}
            onPreferencesChange={updatePreferences}
            onFamiliarityChange={updateFamiliarity}
            onPrevious={previousQuestion}
            onNext={nextQuestion}
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
                      <small>{course.statements.length} 条练习</small>
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
