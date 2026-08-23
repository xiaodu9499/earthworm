"use client";

import type { LearningAccountController } from "@/lib/use-learning-account";

import UiIcon from "@/components/UiIcon";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./AccountControl.module.css";

const syncLabels = {
  local: "仅本机",
  syncing: "同步中",
  synced: "已同步",
  offline: "离线保存",
  error: "同步异常",
} as const;

export default function AccountControl({
  account,
  compact = false,
}: {
  account: LearningAccountController;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const clearError = account.clearError;

  const close = useCallback(() => {
    setOpen(false);
    setBusy(false);
    setNotice(null);
    setResetMode(false);
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = triggerRef.current;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus({ preventScroll: true });
    };
  }, [close, open]);

  const requestPasswordReset = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await account.requestPasswordReset(email);
      setNotice("如果该邮箱已有账号，密码重置邮件会在几分钟内送达；请同时检查垃圾邮件。");
    } catch {
      // The account controller exposes the user-facing error.
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (!email.trim() || password.length < 8) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await account.signInOrCreate(email, password);
      setPassword("");
      setNotice(
        result === "created"
          ? "账号已创建并登录，正在保存本机学习进度。"
          : "登录成功，正在合并本机学习进度。",
      );
    } catch {
      // The account controller exposes the user-facing error.
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await account.signOut();
      setNotice("已退出账号，本机学习记录仍然保留。");
    } catch {
      // The account controller exposes the user-facing error.
    } finally {
      setBusy(false);
    }
  };

  const triggerLabel = account.user
    ? syncLabels[account.syncStatus]
    : compact
      ? "登录"
      : "登录同步";

  return (
    <>
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${compact ? styles.compactTrigger : ""}`}
        type="button"
        onClick={() => {
          setOpen(true);
          setNotice(null);
          account.clearError();
        }}
      >
        <span
          className={`${styles.statusDot} ${account.user ? styles.signedInDot : ""} ${account.syncStatus === "error" ? styles.errorDot : ""}`}
          aria-hidden="true"
        />
        <span>{triggerLabel}</span>
      </button>

      {open &&
        createPortal(
          <div
            className={styles.layer}
            role="presentation"
          >
            <button
              className={styles.backdrop}
              type="button"
              onClick={close}
              aria-label="关闭登录窗口"
            />
            <section
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-title"
            >
              <button
                className={styles.closeButton}
                type="button"
                onClick={close}
                aria-label="关闭"
              >
                <UiIcon name="close" />
              </button>
              <h2 id="account-title">{account.user ? "学习进度云同步" : "登录并保存学习进度"}</h2>

              {!account.configured ? (
                <div className={styles.unavailable}>
                  <strong>云同步正在配置</strong>
                  <span>目前仍会安全保存在这台设备，服务接通后即可登录迁移。</span>
                </div>
              ) : !account.authReady ? (
                <div className={styles.loading}>正在检查登录状态…</div>
              ) : account.user ? (
                <div className={styles.accountCard}>
                  <span
                    className={styles.avatar}
                    aria-hidden="true"
                  >
                    {account.user.email.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{account.user.email}</strong>
                    <small>
                      {syncLabels[account.syncStatus]} · 课程进度和不熟悉/已掌握标记均已保留
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    disabled={busy}
                  >
                    退出
                  </button>
                </div>
              ) : (
                <>
                  <p>
                    {resetMode
                      ? "输入账号邮箱，我们会发送一封密码重置邮件。邮件链接会回到本站设置新密码。"
                      : "使用邮箱和密码登录；邮箱首次使用时会自动创建账号，不需要单独注册。登录后会自动同步课程进度和单词标记。"}
                  </p>
                  <form
                    className={styles.form}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void (resetMode ? requestPasswordReset() : signIn());
                    }}
                  >
                    <label>
                      <span>邮箱地址</span>
                      <input
                        ref={emailRef}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={busy}
                        placeholder="name@example.com"
                        required
                      />
                    </label>
                    {!resetMode && (
                      <label>
                        <span>密码</span>
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="至少 8 位字符"
                          minLength={8}
                          required
                        />
                      </label>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                    >
                      {busy
                        ? resetMode
                          ? "发送中…"
                          : "登录中…"
                        : resetMode
                          ? "发送密码重置邮件"
                          : "登录 / 首次自动注册"}
                    </button>
                    <button
                      className={styles.textButton}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setResetMode((current) => !current);
                        setNotice(null);
                        account.clearError();
                      }}
                    >
                      {resetMode ? "返回邮箱密码登录" : "忘记密码？"}
                    </button>
                  </form>
                </>
              )}

              {(notice || account.error) && (
                <div
                  className={`${styles.notice} ${account.error ? styles.errorNotice : ""}`}
                  role="status"
                >
                  {account.error ?? notice}
                </div>
              )}

              <div className={styles.safetyNote}>
                <span aria-hidden="true">✓</span>
                <p>
                  <strong>已有进度和标记不会丢失</strong>
                  <small>
                    首次登录会把本机题号、不熟悉和已掌握标记一起合并到账号。请妥善保存密码。
                  </small>
                </p>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
