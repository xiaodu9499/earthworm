"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import styles from "./ResetPasswordForm.module.css";

type PageState = "checking" | "ready" | "saving" | "success" | "invalid";

function passwordError(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "weak_password") {
    return "密码不符合安全要求，请至少使用 8 位字符。";
  }
  if (error instanceof Error && /expired|invalid|session/i.test(error.message)) {
    return "重置链接已失效，请返回登录页面重新发送邮件。";
  }
  return error instanceof Error ? error.message : "密码修改失败，请稍后重试。";
}

export default function ResetPasswordForm() {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [pageState, setPageState] = useState<PageState>(client ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState(
    client ? "正在验证密码重置链接…" : "密码重置服务尚未配置。",
  );

  useEffect(() => {
    if (!client) return;
    let active = true;

    const markReady = () => {
      if (!active) return;
      setPageState("ready");
      setMessage("链接验证成功，请设置一个至少 8 位的新密码。");
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) markReady();
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setPageState("invalid");
        setMessage("重置链接无效或已过期，请返回登录页面重新发送邮件。");
        return;
      }
      markReady();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const submit = async () => {
    if (!client || pageState !== "ready") return;
    if (password.length < 8) {
      setMessage("新密码至少需要 8 位字符。");
      return;
    }
    if (password !== confirmation) {
      setMessage("两次输入的密码不一致。");
      return;
    }

    setPageState("saving");
    setMessage("正在安全保存新密码…");
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setPageState("ready");
      setMessage(passwordError(error));
      return;
    }

    setPassword("");
    setConfirmation("");
    setPageState("success");
    setMessage("密码已经更新，可以返回学习页面继续登录。");
  };

  return (
    <main className={styles.page}>
      <section
        className={styles.card}
        aria-labelledby="reset-password-title"
      >
        <Link
          className={styles.brand}
          href="/"
        >
          <Image
            src="/logo.png"
            alt=""
            width={38}
            height={38}
            priority
          />
          <span>Earthworm</span>
          <small>Web</small>
        </Link>
        <h1 id="reset-password-title">设置新密码</h1>
        <p className={styles.lead}>只会修改登录密码，你的课程进度和不熟悉单词标记不会受到影响。</p>

        {(pageState === "ready" || pageState === "saving") && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label>
              <span>新密码</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 位字符"
                disabled={pageState === "saving"}
                required
              />
            </label>
            <label>
              <span>再次输入新密码</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="再次确认新密码"
                disabled={pageState === "saving"}
                required
              />
            </label>
            <button
              type="submit"
              disabled={pageState === "saving"}
            >
              {pageState === "saving" ? "正在保存…" : "保存新密码"}
            </button>
          </form>
        )}

        <div
          className={`${styles.status} ${pageState === "success" ? styles.success : ""}`}
          role="status"
        >
          {message}
        </div>

        <Link
          className={styles.backLink}
          href="/"
        >
          返回 Earthworm 学习页面
        </Link>
      </section>
    </main>
  );
}
