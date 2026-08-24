"use client";

import type { Catalog } from "@/lib/use-learning-app";

import UiIcon from "@/components/UiIcon";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./AdminDashboard.module.css";

type AdminSummary = {
  totalUsers: number;
  syncedUsers: number;
  activeLast7Days: number;
  totalUnfamiliar: number;
  totalMastered: number;
  listedUsers: number;
};

type AdminUser = {
  userId: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  progressUpdatedAt: string | null;
  lastActiveAt: string;
  courseProgress: Record<string, number>;
  recentCourseId: string | null;
  unfamiliarCount: number;
  masteredCount: number;
  hasSyncedProgress: boolean;
};

type AdminDashboardPayload = {
  summary: AdminSummary;
  users: AdminUser[];
};

type CourseInfo = {
  title: string;
  statementCount: number;
};

type ViewState = "loading" | "ready" | "signed-out" | "forbidden" | "error";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizePayload(value: unknown): AdminDashboardPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<AdminDashboardPayload>;
  if (!candidate.summary || !Array.isArray(candidate.users)) return null;
  return candidate as AdminDashboardPayload;
}

export default function AdminDashboard() {
  const [state, setState] = useState<ViewState>("loading");
  const [payload, setPayload] = useState<AdminDashboardPayload | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setState("error");
      return;
    }

    setRefreshing(true);
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (userError || !user) {
      setPayload(null);
      setState("signed-out");
      setRefreshing(false);
      return;
    }

    const { data, error } = await client.rpc("get_learning_admin_dashboard");
    if (error) {
      setPayload(null);
      setState(error.code === "42501" ? "forbidden" : "error");
      setRefreshing(false);
      return;
    }

    const nextPayload = normalizePayload(data);
    setPayload(nextPayload);
    setState(nextPayload ? "ready" : "error");
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/course-data.json")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as Catalog;
      })
      .then((nextCatalog) => {
        if (active && nextCatalog) setCatalog(nextCatalog);
      })
      .catch(() => undefined);
    const dashboardTimer = window.setTimeout(() => void loadDashboard(), 0);
    return () => {
      active = false;
      window.clearTimeout(dashboardTimer);
    };
  }, [loadDashboard]);

  const courseIndex = useMemo(() => {
    const index = new Map<string, CourseInfo>();
    for (const pack of catalog?.packs ?? []) {
      for (const course of pack.courses) {
        index.set(course.id, { title: course.title, statementCount: course.statements.length });
      }
    }
    return index;
  }, [catalog]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a
          className={styles.brand}
          href="/desktop"
          aria-label="返回 Earthworm PC 端"
        >
          <span aria-hidden="true">E</span>
          <strong>Earthworm</strong>
          <small>ADMIN</small>
        </a>
        <a
          className={styles.backLink}
          href="/desktop"
        >
          <UiIcon
            name="arrow-left"
            size={16}
          />
          返回学习页面
        </a>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>LEARNING OPERATIONS</span>
          <h1>学习管理后台</h1>
          <p>查看账号规模、最近活跃情况、课程进度和学习标记。此页面只提供只读统计。</p>
        </div>
        {state === "ready" && (
          <button
            className={styles.refreshButton}
            type="button"
            disabled={refreshing}
            onClick={() => void loadDashboard()}
          >
            {refreshing ? "正在刷新…" : "刷新数据"}
          </button>
        )}
      </section>

      {state === "loading" ? (
        <StatusPanel
          title="正在核验管理员权限"
          detail="请稍候，正在安全读取学习统计。"
        />
      ) : state === "signed-out" ? (
        <StatusPanel
          title="请先登录管理员账号"
          detail="返回 PC 学习页面，使用管理员邮箱登录后再进入管理后台。"
          action={{ href: "/desktop", label: "返回登录" }}
        />
      ) : state === "forbidden" ? (
        <StatusPanel
          title="当前账号没有管理权限"
          detail="管理数据没有加载。请切换到已授权的管理员账号。"
          action={{ href: "/desktop", label: "返回学习页面" }}
        />
      ) : state === "error" || !payload ? (
        <StatusPanel
          title="管理数据暂时无法加载"
          detail="登录状态或网络可能已经变化，请稍后重试。"
          action={{ href: "/admin", label: "重新加载" }}
        />
      ) : (
        <>
          <section
            className={styles.summaryGrid}
            aria-label="用户数据概览"
          >
            <SummaryCard
              value={payload.summary.totalUsers}
              label="注册用户"
              note={`${payload.summary.syncedUsers} 位已同步学习进度`}
            />
            <SummaryCard
              value={payload.summary.activeLast7Days}
              label="近 7 日活跃"
              note="登录或同步过学习记录"
            />
            <SummaryCard
              value={payload.summary.totalUnfamiliar}
              label="不熟悉标记"
              note="所有用户当前标记总数"
            />
            <SummaryCard
              value={payload.summary.totalMastered}
              label="已掌握标记"
              note="所有用户当前标记总数"
            />
          </section>

          <section className={styles.usersSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>用户学习进度</h2>
                <p>
                  按最近活动排序，当前显示 {payload.summary.listedUsers} /{" "}
                  {payload.summary.totalUsers} 位用户。
                </p>
              </div>
            </div>

            {payload.users.length === 0 ? (
              <div className={styles.empty}>目前还没有注册用户。</div>
            ) : (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">用户</th>
                      <th scope="col">最近课程</th>
                      <th scope="col">学习进度</th>
                      <th scope="col">学习标记</th>
                      <th scope="col">最近活动</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.users.map((user) => {
                      const recentCourse = user.recentCourseId
                        ? courseIndex.get(user.recentCourseId)
                        : undefined;
                      const recentIndex = user.recentCourseId
                        ? user.courseProgress[user.recentCourseId]
                        : undefined;
                      const recentCompleted =
                        recentCourse && typeof recentIndex === "number"
                          ? Math.min(
                              Math.max(Math.floor(recentIndex) + 1, 0),
                              recentCourse.statementCount,
                            )
                          : 0;
                      const recentPercentage =
                        recentCourse && recentCourse.statementCount
                          ? Math.round((recentCompleted / recentCourse.statementCount) * 100)
                          : 0;
                      const startedCourses = Object.keys(user.courseProgress).length;

                      return (
                        <tr key={user.userId}>
                          <td>
                            <strong>{user.email ?? "未设置邮箱"}</strong>
                            <span>注册于 {formatDate(user.createdAt)}</span>
                          </td>
                          <td>
                            <strong>{recentCourse?.title ?? "尚未开始课程"}</strong>
                            <span>{startedCourses} 节课程有记录</span>
                          </td>
                          <td>
                            <div className={styles.progressCopy}>
                              <strong>{recentCourse ? `${recentPercentage}%` : "—"}</strong>
                              <span>
                                {recentCourse
                                  ? `${recentCompleted} / ${recentCourse.statementCount} 句`
                                  : "暂无进度"}
                              </span>
                            </div>
                            <div
                              className={styles.progressTrack}
                              aria-label={`最近课程进度 ${recentPercentage}%`}
                            >
                              <span style={{ width: `${recentPercentage}%` }} />
                            </div>
                          </td>
                          <td>
                            <div className={styles.markers}>
                              <span className={styles.unfamiliar}>
                                不熟悉 {user.unfamiliarCount}
                              </span>
                              <span className={styles.mastered}>已掌握 {user.masteredCount}</span>
                            </div>
                          </td>
                          <td>
                            <strong>{formatDate(user.lastActiveAt)}</strong>
                            <span>
                              {user.hasSyncedProgress
                                ? `进度同步 ${formatDate(user.progressUpdatedAt)}`
                                : `最近登录 ${formatDate(user.lastSignInAt)}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function SummaryCard({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <article className={styles.summaryCard}>
      <strong>{value.toLocaleString("zh-CN")}</strong>
      <h2>{label}</h2>
      <p>{note}</p>
    </article>
  );
}

function StatusPanel({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { href: string; label: string };
}) {
  return (
    <section className={styles.statusPanel}>
      <span aria-hidden="true">E</span>
      <h2>{title}</h2>
      <p>{detail}</p>
      {action && <a href={action.href}>{action.label}</a>}
    </section>
  );
}
