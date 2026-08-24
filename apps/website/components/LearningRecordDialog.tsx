"use client";

import type { StoredState } from "@/lib/learning-storage";
import type { Statement } from "@/lib/use-learning-app";

import UiIcon from "@/components/UiIcon";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import styles from "./LearningRecordDialog.module.css";

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

type LearningRecordDialogProps = {
  courseTitle: string;
  statements: Statement[];
  currentIndex: number;
  familiarity: StoredState["statementFamiliarity"];
  onClose: () => void;
  onSelect: (index: number) => void;
};

export default function LearningRecordDialog({
  courseTitle,
  statements,
  currentIndex,
  familiarity,
  onClose,
  onSelect,
}: LearningRecordDialogProps) {
  const currentItemRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      const activeElement = document.activeElement;
      if (
        event.shiftKey &&
        (activeElement === first || !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    const scrollTimer = window.setTimeout(() => {
      currentItemRef.current?.scrollIntoView({ block: "center" });
      currentItemRef.current?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(scrollTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [onClose]);

  const masteredCount = statements.filter((item) => familiarity[item.id] === "mastered").length;
  const unfamiliarCount = statements.filter((item) => familiarity[item.id] === "unfamiliar").length;

  return createPortal(
    <div className={styles.layer}>
      <button
        className={styles.backdrop}
        type="button"
        onClick={onClose}
        aria-label="关闭学习记录"
      />
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-record-title"
      >
        <header className={styles.heading}>
          <div>
            <h2 id="learning-record-title">本课学习记录</h2>
            <p>{courseTitle}</p>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            aria-label="关闭学习记录"
          >
            <UiIcon name="close" />
          </button>
        </header>

        <div
          className={styles.summary}
          aria-label="学习记录概览"
        >
          <span>
            <strong>{Math.min(currentIndex + 1, statements.length)}</strong> / {statements.length}{" "}
            当前题
          </span>
          <span>
            <strong>{masteredCount}</strong> 已掌握
          </span>
          <span>
            <strong>{unfamiliarCount}</strong> 不熟悉
          </span>
        </div>

        <div
          className={styles.list}
          aria-label="本课句子列表"
        >
          {statements.map((item, index) => {
            const isCurrent = index === currentIndex;
            const itemFamiliarity = familiarity[item.id];
            return (
              <button
                key={item.id}
                ref={isCurrent ? currentItemRef : undefined}
                className={`${styles.item} ${isCurrent ? styles.currentItem : ""}`}
                type="button"
                onClick={() => {
                  onSelect(index);
                  onClose();
                }}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span className={styles.itemCopy}>
                  <strong>{item.english}</strong>
                  <small>{item.chinese}</small>
                </span>
                <span className={styles.itemMeta}>
                  {isCurrent && <em>当前</em>}
                  {itemFamiliarity === "mastered" && <em className={styles.mastered}>已掌握</em>}
                  {itemFamiliarity === "unfamiliar" && (
                    <em className={styles.unfamiliar}>不熟悉</em>
                  )}
                  <b>#{item.order || index + 1}</b>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}
