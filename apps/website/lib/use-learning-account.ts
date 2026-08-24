"use client";

import type { StoredState } from "@/lib/learning-storage";
import type { User } from "@supabase/supabase-js";

import { mergeLearningProgress } from "@/lib/cloud-progress";
import { normalizeStoredState, serializeStoredState } from "@/lib/learning-storage";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ProgressSyncStatus = "local" | "syncing" | "synced" | "offline" | "error";
export type PasswordSignInResult = "signed-in" | "created";

export type LearningAccountController = {
  configured: boolean;
  authReady: boolean;
  user: { id: string; email: string } | null;
  isAdmin: boolean;
  syncStatus: ProgressSyncStatus;
  error: string | null;
  signInOrCreate: (email: string, password: string) => Promise<PasswordSignInResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

type UseLearningAccountOptions = {
  stored: StoredState;
  storageReady: boolean;
  onCloudState: (state: StoredState) => void;
};

function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "";
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    const code = errorCode(error);
    if (/rate limit/i.test(error.message)) return "请求过于频繁，请稍后再试。";
    if (code === "weak_password") return "密码不符合安全要求，请至少使用 8 位字符。";
    if (code === "email_not_confirmed")
      return "当前账号仍要求邮箱确认，请联系管理员关闭邮箱确认后再登录。";
    if (code === "invalid_credentials" || code === "user_already_exists")
      return "邮箱或密码不正确，请检查后重试。";
    if (/fetch|network/i.test(error.message)) return "网络暂时不可用，学习记录仍会保存在本机。";
    return error.message;
  }
  return "操作没有完成，请稍后重试。";
}

export function useLearningAccount({
  stored,
  storageReady,
  onCloudState,
}: UseLearningAccountOptions): LearningAccountController {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [authReady, setAuthReady] = useState(!client);
  const [user, setUser] = useState<User | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<ProgressSyncStatus>("local");
  const [error, setError] = useState<string | null>(null);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const storedRef = useRef(stored);
  const activeSyncUserRef = useRef<string | null>(null);
  const lastSyncedStateRef = useRef("");

  useEffect(() => {
    storedRef.current = stored;
  }, [stored]);

  useEffect(() => {
    if (!client) return;
    let active = true;

    void client.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (!session?.user) {
        setAdminUserId(null);
        setSyncStatus("local");
      }
      setAuthReady(true);
      setError(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!client || !authReady || !user) return;

    let active = true;
    void (async () => {
      try {
        const { data, error: adminError } = await client.rpc("is_learning_admin");
        if (!active) return;
        setAdminUserId(!adminError && data === true ? user.id : null);
      } catch {
        if (active) setAdminUserId(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, client, user]);

  useEffect(() => {
    if (!client || !storageReady || !user) {
      activeSyncUserRef.current = null;
      return;
    }

    let cancelled = false;
    const synchronize = async () => {
      if (!navigator.onLine) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus("syncing");
      setError(null);
      const { data, error: loadError } = await client
        .from("learning_progress")
        .select("state")
        .eq("user_id", user.id)
        .maybeSingle();
      if (loadError) throw loadError;

      const merged = data
        ? mergeLearningProgress(storedRef.current, data.state)
        : normalizeStoredState(storedRef.current);
      const serialized = serializeStoredState(merged);
      onCloudState(merged);

      const { error: saveError } = await client.from("learning_progress").upsert(
        {
          user_id: user.id,
          state: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (saveError) throw saveError;
      if (cancelled) return;

      activeSyncUserRef.current = user.id;
      lastSyncedStateRef.current = serialized;
      setSyncStatus("synced");
    };

    void synchronize().catch((syncError: unknown) => {
      if (cancelled) return;
      activeSyncUserRef.current = null;
      setError(readableError(syncError));
      setSyncStatus(navigator.onLine ? "error" : "offline");
    });

    return () => {
      cancelled = true;
    };
  }, [client, onCloudState, reconnectVersion, storageReady, user]);

  useEffect(() => {
    if (!client || !user || activeSyncUserRef.current !== user.id) return;
    const serialized = serializeStoredState(stored);
    if (serialized === lastSyncedStateRef.current) return;

    const saveTimer = window.setTimeout(() => {
      if (!navigator.onLine) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus("syncing");
      void (async () => {
        try {
          const { error: saveError } = await client.from("learning_progress").upsert(
            {
              user_id: user.id,
              state: normalizeStoredState(stored),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          if (saveError) throw saveError;
          lastSyncedStateRef.current = serialized;
          setError(null);
          setSyncStatus("synced");
        } catch (saveError: unknown) {
          setError(readableError(saveError));
          setSyncStatus(navigator.onLine ? "error" : "offline");
        }
      })();
    }, 650);

    return () => window.clearTimeout(saveTimer);
  }, [client, stored, user]);

  useEffect(() => {
    const handleOnline = () => {
      if (user) {
        setSyncStatus("syncing");
        setReconnectVersion((version) => version + 1);
      }
    };
    const handleOffline = () => {
      if (user) setSyncStatus("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  const signInOrCreate = useCallback(
    async (email: string, password: string): Promise<PasswordSignInResult> => {
      if (!client) throw new Error("云同步服务尚未配置。");
      setError(null);
      const credentials = {
        email: email.trim().toLowerCase(),
        password,
      };

      const { data: signInData, error: signInError } =
        await client.auth.signInWithPassword(credentials);
      if (!signInError) {
        setUser(signInData.user);
        return "signed-in";
      }

      // Supabase intentionally uses the same error for an unknown account and a
      // wrong password. Trying sign-up here gives first-time users the requested
      // one-step flow without exposing whether an email address already exists.
      if (errorCode(signInError) !== "invalid_credentials") {
        const message = readableError(signInError);
        setError(message);
        throw new Error(message);
      }

      const { data: signUpData, error: signUpError } = await client.auth.signUp(credentials);
      if (signUpError) {
        const message = readableError(signUpError);
        setError(message);
        throw new Error(message);
      }

      if (!signUpData.session || !signUpData.user) {
        const message = "未能直接登录：请检查密码，或联系管理员确认已关闭邮箱确认。";
        setError(message);
        throw new Error(message);
      }

      setUser(signUpData.user);
      return "created";
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      const message = readableError(signOutError);
      setError(message);
      throw new Error(message);
    }
    activeSyncUserRef.current = null;
    lastSyncedStateRef.current = "";
    setAdminUserId(null);
    setUser(null);
    setSyncStatus("local");
  }, [client]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      if (!client) throw new Error("云同步服务尚未配置。");
      setError(null);

      const { error: resetError } = await client.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (resetError) {
        const message = readableError(resetError);
        setError(message);
        throw new Error(message);
      }
    },
    [client],
  );

  return {
    configured: Boolean(client),
    authReady,
    user: user?.email ? { id: user.id, email: user.email } : null,
    isAdmin: Boolean(user && adminUserId === user.id),
    syncStatus,
    error,
    signInOrCreate,
    requestPasswordReset,
    signOut,
    clearError: () => setError(null),
  };
}
