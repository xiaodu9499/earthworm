const { createServer } = require("node:http");
const {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { gunzipSync } = require("node:zlib");
const path = require("node:path");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function startLocalServer({ dataFile, stateFile, webRoot }) {
  const catalog = loadCatalog(dataFile);
  const state = loadState(stateFile);
  const index = createCatalogIndex(catalog);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        await handleApi({ index, request, response, state, stateFile, url });
      } else {
        serveStatic({ request, response, url, webRoot });
      }
    } catch (error) {
      console.error("Standalone request failed", error);
      sendJson(response, 500, { message: "本地服务处理请求失败" });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        close: () => new Promise((done) => server.close(done)),
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function loadCatalog(dataFile) {
  const compressed = readFileSync(dataFile);
  return JSON.parse(gunzipSync(compressed).toString("utf8"));
}

function createCatalogIndex(catalog) {
  const packs = [...catalog.packs].sort((left, right) => left.order - right.order);
  const packsById = new Map();
  const coursesById = new Map();

  for (const pack of packs) {
    pack.courses.sort((left, right) => left.order - right.order);
    packsById.set(pack.id, pack);
    for (const course of pack.courses) {
      course.statements.sort((left, right) => left.order - right.order);
      coursesById.set(course.id, course);
    }
  }

  return { coursesById, packs, packsById };
}

function defaultState() {
  return {
    version: 1,
    profile: {
      avatar: "/logo.png",
      name: "离线模式",
      username: "本地学习者",
    },
    progress: {},
    history: {},
    mastered: [],
    learningActivities: {},
  };
}

function loadState(stateFile) {
  if (!existsSync(stateFile)) return defaultState();

  try {
    return { ...defaultState(), ...JSON.parse(readFileSync(stateFile, "utf8")) };
  } catch {
    const backup = `${stateFile}.corrupt-${Date.now()}`;
    renameSync(stateFile, backup);
    return defaultState();
  }
}

function saveState(stateFile, state) {
  mkdirSync(path.dirname(stateFile), { recursive: true });
  const temporaryFile = `${stateFile}.tmp`;
  writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temporaryFile, stateFile);
}

async function handleApi({ index, request, response, state, stateFile, url }) {
  const method = request.method || "GET";
  const apiPath = decodeURIComponent(url.pathname.slice(4));
  const segments = apiPath.split("/").filter(Boolean);

  if (method === "GET" && apiPath === "/course-pack") {
    return sendJson(
      response,
      200,
      index.packs.map(({ courses: _courses, ...pack }) => pack),
    );
  }

  if (segments[0] === "course-pack" && segments.length === 2 && method === "GET") {
    const pack = index.packsById.get(segments[1]);
    if (!pack) return notFound(response);
    return sendJson(response, 200, serializePack(pack, state));
  }

  if (
    segments[0] === "course-pack" &&
    segments[2] === "courses" &&
    segments.length === 4 &&
    method === "GET"
  ) {
    const [packId, courseId] = [segments[1], segments[3]];
    const course = index.coursesById.get(courseId);
    if (!course || course.coursePackId !== packId) return notFound(response);
    return sendJson(response, 200, serializeCourse(course, state));
  }

  if (
    segments[0] === "course-pack" &&
    segments[2] === "courses" &&
    segments[4] === "complete" &&
    segments.length === 5 &&
    method === "POST"
  ) {
    const [packId, courseId] = [segments[1], segments[3]];
    const pack = index.packsById.get(packId);
    const course = index.coursesById.get(courseId);
    if (!pack || !course || course.coursePackId !== packId) return notFound(response);

    const history = state.history[courseId] || { completionCount: 0 };
    state.history[courseId] = {
      completionCount: history.completionCount + 1,
      coursePackId: packId,
      updatedAt: new Date().toISOString(),
    };

    const courseIndex = pack.courses.findIndex((item) => item.id === courseId);
    const nextCourse = pack.courses[courseIndex + 1];
    if (nextCourse) {
      state.progress[nextCourse.id] ||= {
        courseId: nextCourse.id,
        coursePackId: packId,
        statementIndex: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    saveState(stateFile, state);
    return sendJson(response, 200, {
      nextCourse: nextCourse ? serializeCourseSummary(nextCourse, state) : null,
    });
  }

  if (apiPath === "/user-course-progress" && method === "PUT") {
    const body = await readJsonBody(request);
    const course = index.coursesById.get(body.courseId);
    if (!course || course.coursePackId !== body.coursePackId) return notFound(response);
    const statementIndex = Math.max(
      0,
      Math.min(Number(body.statementIndex) || 0, Math.max(course.statements.length - 1, 0)),
    );
    state.progress[course.id] = {
      courseId: course.id,
      coursePackId: course.coursePackId,
      statementIndex,
      updatedAt: new Date().toISOString(),
    };
    saveState(stateFile, state);
    return sendJson(response, 200, { courseId: course.id });
  }

  if (apiPath === "/user-course-progress/recent-course-packs" && method === "GET") {
    const recent = Object.values(state.progress)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .filter(
        (progress, position, list) =>
          list.findIndex((item) => item.coursePackId === progress.coursePackId) === position,
      )
      .map((progress, indexPosition) => {
        const pack = index.packsById.get(progress.coursePackId);
        return {
          id: indexPosition + 1,
          coursePackId: pack.id,
          courseId: progress.courseId,
          title: pack.title,
          description: pack.description,
          cover: pack.cover,
          isFree: true,
        };
      });
    return sendJson(response, 200, recent);
  }

  if (segments[0] === "course-history" && segments.length === 2 && method === "GET") {
    const history = Object.entries(state.history)
      .filter(([, item]) => item.coursePackId === segments[1])
      .map(([courseId, item]) => ({ courseId, completionCount: item.completionCount }));
    return sendJson(response, 200, history);
  }

  if (apiPath === "/mastered-elements" && method === "GET") {
    return sendJson(response, 200, state.mastered);
  }

  if (apiPath === "/mastered-elements" && method === "POST") {
    const body = await readJsonBody(request);
    const item = {
      id: `local-mastered-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: body.content,
      masteredAt: new Date().toISOString(),
    };
    state.mastered.unshift(item);
    saveState(stateFile, state);
    return sendJson(response, 201, item);
  }

  if (segments[0] === "mastered-elements" && segments.length === 2 && method === "DELETE") {
    const previousLength = state.mastered.length;
    state.mastered = state.mastered.filter((item) => item.id !== segments[1]);
    saveState(stateFile, state);
    return sendJson(response, 200, state.mastered.length !== previousLength);
  }

  if (segments[0] === "rank" && segments[1] === "progress" && method === "GET") {
    const count = Object.values(state.history).reduce(
      (total, item) => total + item.completionCount,
      0,
    );
    const self = { username: state.profile.username, count, rank: 1 };
    return sendJson(response, 200, { list: [self], self, period: segments[2] || "weekly" });
  }

  if (apiPath === "/user" && method === "GET") {
    return sendJson(response, 200, {
      ...state.profile,
      membership: { details: null, isMember: false },
    });
  }

  if (apiPath === "/user/setup" && method === "POST") {
    const body = await readJsonBody(request);
    state.profile.username = String(body.username || state.profile.username);
    state.profile.avatar = String(body.avatar || state.profile.avatar);
    saveState(stateFile, state);
    return sendJson(response, 200, {
      username: state.profile.username,
      avatar: state.profile.avatar,
    });
  }

  if (apiPath === "/user-learning-activities/total" && method === "GET") {
    const total = Object.values(state.learningActivities).reduce(
      (sum, duration) => sum + Number(duration || 0),
      0,
    );
    return sendJson(response, 200, total);
  }

  if (apiPath === "/user-learning-activities" && method === "GET") {
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const activities = Object.entries(state.learningActivities)
      .filter(([date]) => (!startDate || date >= startDate) && (!endDate || date <= endDate))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, duration]) => ({ date, duration }));
    return sendJson(response, 200, activities);
  }

  if (apiPath === "/user-learning-activities" && method === "POST") {
    const body = await readJsonBody(request);
    const date = String(body.date || new Date().toISOString().slice(0, 10));
    state.learningActivities[date] =
      Number(state.learningActivities[date] || 0) + Math.max(0, Number(body.duration) || 0);
    saveState(stateFile, state);
    return sendJson(response, 200, true);
  }

  if (apiPath === "/tool/dailySentence" && method === "GET") {
    return sendJson(response, 200, {
      zh: "今天的每一次练习，都在让表达变得更自然。",
      en: "Every practice today makes your expression more natural.",
    });
  }

  return notFound(response);
}

function serializePack(pack, state) {
  return {
    ...pack,
    courses: pack.courses.map((course) => serializeCourseSummary(course, state)),
  };
}

function serializeCourseSummary(course, state) {
  const { statements: _statements, ...summary } = course;
  return {
    ...summary,
    completionCount: state.history[course.id]?.completionCount || 0,
    statementIndex: state.progress[course.id]?.statementIndex || 0,
  };
}

function serializeCourse(course, state) {
  return {
    ...course,
    completionCount: state.history[course.id]?.completionCount || 0,
    statementIndex: state.progress[course.id]?.statementIndex || 0,
    statements: course.statements.map((statement) => ({ ...statement, isMastered: false })),
  };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function notFound(response) {
  return sendJson(response, 404, { message: "未找到本地资源" });
}

function serveStatic({ request, response, url, webRoot }) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const requestedFile = path.resolve(webRoot, `.${pathname}`);
  const rootPrefix = `${path.resolve(webRoot)}${path.sep}`;
  const safeFile = requestedFile.startsWith(rootPrefix) ? requestedFile : "";
  const file =
    safeFile && existsSync(safeFile) && statSync(safeFile).isFile()
      ? safeFile
      : path.join(webRoot, "200.html");

  if (!existsSync(file)) {
    response.writeHead(404);
    response.end("Standalone web assets are missing");
    return;
  }

  const body = readFileSync(file);
  response.writeHead(200, {
    "Cache-Control": pathname.startsWith("/_nuxt/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "Content-Length": body.length,
    "Content-Type": MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
  });
  if (request.method === "HEAD") response.end();
  else response.end(body);
}

module.exports = { startLocalServer };
