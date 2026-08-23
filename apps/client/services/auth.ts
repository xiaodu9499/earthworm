import { useLogto } from "@logto/vue";
import { useRuntimeConfig } from "nuxt/app";

let logto: ReturnType<typeof useLogto>;
let runtimeConfig: ReturnType<typeof useRuntimeConfig>;
let standaloneMode = false;

export async function setupAuth() {
  logto = useLogto();
  runtimeConfig = useRuntimeConfig();
}

export function setupStandaloneAuth(config: ReturnType<typeof useRuntimeConfig>) {
  standaloneMode = true;
  runtimeConfig = config;
}

export async function signIn(callback?: string) {
  if (standaloneMode) return;
  callback && setSignInCallback(callback);
  return logto.signIn(runtimeConfig.public.signInRedirectURI);
}

export function signOut() {
  if (standaloneMode) return Promise.resolve();
  return logto.signOut(runtimeConfig.public.signOutRedirectURI);
}

export function isAuthenticated() {
  return standaloneMode || logto.isAuthenticated.value;
}

export async function getToken() {
  if (standaloneMode) return "local-user";
  const accessToken = await logto.getAccessToken(runtimeConfig.public.backendEndpoint);

  return accessToken;
}

export function fetchUserInfo() {
  if (standaloneMode) {
    return Promise.resolve({
      sub: "local-user",
      name: "本地学习者",
      username: "本地学习者",
      picture: "/logo.png",
    });
  }
  return logto.fetchUserInfo();
}

export function isStandalone() {
  return standaloneMode;
}

export function getSignInCallback() {
  let callback = sessionStorage.getItem("callback");
  if (callback) {
    sessionStorage.removeItem("callback");
    return callback;
  } else {
    return "/";
  }
}

function setSignInCallback(callback: string) {
  sessionStorage.setItem("callback", callback);
}
