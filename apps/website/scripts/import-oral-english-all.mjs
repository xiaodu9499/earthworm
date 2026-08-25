import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { gunzipSync, gzipSync } from "node:zlib";

const OUTPUT_DIRECTORY_URL = new URL("../public/oral-english-all/", import.meta.url);
const INDEX_URL = new URL("../public/oral-english-all-index.json", import.meta.url);
const SNAPSHOT_URL = new URL("./data/oral-english-all.tsv.gz", import.meta.url);
const SOURCE_EXPORT_DATE = "2026-08-22";
const SOURCE_BASE = "https://downloads.tatoeba.org/exports/per_language";
const EXPECTED_LINK_COUNT = 77_977;
const EXPECTED_PAIR_COUNT = 77_779;
const STATEMENTS_PER_COURSE = 100;
const STATEMENTS_PER_VOLUME = 10_000;
const CACHE_DIR = process.env.TATOEBA_CACHE_DIR;

const sources = {
  links: {
    filename: "cmn-eng_links.tsv.bz2",
    url: `${SOURCE_BASE}/cmn/cmn-eng_links.tsv.bz2`,
    sha256: "db2dd253517aa185572abcab393987aee3eeb382029b05f0eb8ba99d13d9a762",
  },
  chinese: {
    filename: "cmn_sentences.tsv.bz2",
    url: `${SOURCE_BASE}/cmn/cmn_sentences.tsv.bz2`,
    sha256: "44c1b34e0a68fd0e64127e5afe169071e96bdf916373f10196170fa5e1393b18",
  },
  english: {
    filename: "eng_sentences.tsv.bz2",
    url: `${SOURCE_BASE}/eng/eng_sentences.tsv.bz2`,
    sha256: "3cd74d608ffd2900b7bcd6a2c4cb9f59694f31a02591c15145d9597f2abbfc96",
  },
};

function normalizeText(value) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function download(source, destination) {
  const cached = CACHE_DIR ? join(CACHE_DIR, source.filename) : null;
  if (cached && (await exists(cached))) {
    await pipeline(createReadStream(cached), createWriteStream(destination));
  } else {
    const response = await fetch(source.url);
    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to download ${source.url}: ${response.status} ${response.statusText}`,
      );
    }
    await pipeline(response.body, createWriteStream(destination));
  }
  const actualHash = await sha256(destination);
  if (actualHash !== source.sha256) {
    throw new Error(
      `Source changed for ${source.filename}: expected ${source.sha256}, got ${actualHash}`,
    );
  }
}

async function readBzipLines(path, onLine) {
  const child = spawn("bzip2", ["-dc", path], { stdio: ["ignore", "pipe", "inherit"] });
  const exitPromise = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) onLine(line);
  const exitCode = await exitPromise;
  if (exitCode !== 0)
    throw new Error(`bzip2 failed for ${basename(path)} with exit code ${exitCode}`);
}

async function buildSnapshot() {
  const workingDirectory = await mkdtemp(join(tmpdir(), "earthworm-oral-all-"));
  try {
    const paths = Object.fromEntries(
      await Promise.all(
        Object.entries(sources).map(async ([key, source]) => {
          const path = join(workingDirectory, source.filename);
          await download(source, path);
          return [key, path];
        }),
      ),
    );

    const links = [];
    const chineseIds = new Set();
    const englishIds = new Set();
    await readBzipLines(paths.links, (line) => {
      const [chineseId, englishId] = line.split("\t");
      if (!chineseId || !englishId) return;
      links.push({ chineseId, englishId });
      chineseIds.add(chineseId);
      englishIds.add(englishId);
    });
    if (links.length !== EXPECTED_LINK_COUNT) {
      throw new Error(`Expected ${EXPECTED_LINK_COUNT} source links, received ${links.length}.`);
    }

    const chineseSentences = new Map();
    await readBzipLines(paths.chinese, (line) => {
      const [id, language, ...textParts] = line.split("\t");
      if (language === "cmn" && chineseIds.has(id))
        chineseSentences.set(id, normalizeText(textParts.join("\t")));
    });
    const englishSentences = new Map();
    await readBzipLines(paths.english, (line) => {
      const [id, language, ...textParts] = line.split("\t");
      if (language === "eng" && englishIds.has(id))
        englishSentences.set(id, normalizeText(textParts.join("\t")));
    });

    const rows = [];
    for (const { chineseId, englishId } of links) {
      const chinese = chineseSentences.get(chineseId);
      const english = englishSentences.get(englishId);
      if (!chinese || !english) continue;
      rows.push([chineseId, englishId, chinese, english].join("\t"));
    }
    if (rows.length !== EXPECTED_PAIR_COUNT) {
      throw new Error(`Expected ${EXPECTED_PAIR_COUNT} linked pairs, received ${rows.length}.`);
    }
    await mkdir(new URL("./data/", import.meta.url), { recursive: true });
    const header = [
      `# Tatoeba complete parseable Mandarin Chinese-English link snapshot ${SOURCE_EXPORT_DATE}`,
      "# License: CC BY 2.0 FR — https://creativecommons.org/licenses/by/2.0/fr/",
      "# Source: https://tatoeba.org/ and https://downloads.tatoeba.org/exports/",
      `# ${EXPECTED_LINK_COUNT} links in source export; ${EXPECTED_PAIR_COUNT} pairs have both sentence records`,
      "# Columns: Chinese sentence ID, English sentence ID, Chinese, English",
    ];
    await writeFile(SNAPSHOT_URL, gzipSync(`${[...header, ...rows].join("\n")}\n`, { level: 9 }));
    process.stdout.write(`Captured all ${rows.length} linked bilingual pairs.\n`);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

function buildCourse(volumeId, courseIndex, rows, globalStart) {
  const courseNumber = courseIndex + 1;
  const courseId = `${volumeId}-course-${String(courseNumber).padStart(3, "0")}`;
  const statements = rows.map((row, statementIndex) => ({
    id: `${courseId}-statement-${String(statementIndex + 1).padStart(3, "0")}`,
    order: statementIndex + 1,
    chinese: row.chinese,
    english: row.english,
    sourceSentenceIds: { chinese: Number(row.chineseId), english: Number(row.englishId) },
  }));
  return {
    id: courseId,
    title: `第 ${String(courseNumber).padStart(3, "0")} 课`,
    description: `全量中英直译语料 · 第 ${globalStart + 1}–${globalStart + rows.length} 句`,
    order: courseNumber,
    coursePackId: volumeId,
    statementCount: statements.length,
    statements,
  };
}

function sourceMetadata() {
  return {
    name: "Tatoeba",
    exportDate: SOURCE_EXPORT_DATE,
    sourceLinkCount: EXPECTED_LINK_COUNT,
    importedPairCount: EXPECTED_PAIR_COUNT,
    homepage: "https://tatoeba.org/",
    license: "CC BY 2.0 FR",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/fr/",
    note: "中英直译关系全量开放语料，不是商业出版物《英语口语8000句》的复制或改编。",
  };
}

if (!(await exists(SNAPSHOT_URL))) await buildSnapshot();
const snapshot = gunzipSync(await readFile(SNAPSHOT_URL)).toString("utf8");
const rows = snapshot
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [chineseId, englishId, chinese, english] = line.split("\t");
    return { chineseId, englishId, chinese, english };
  });
if (rows.length !== EXPECTED_PAIR_COUNT) {
  throw new Error(`Expected ${EXPECTED_PAIR_COUNT} snapshot rows, received ${rows.length}.`);
}

await rm(OUTPUT_DIRECTORY_URL, { recursive: true, force: true });
await mkdir(OUTPUT_DIRECTORY_URL, { recursive: true });
const packCount = Math.ceil(rows.length / STATEMENTS_PER_VOLUME);
const indexPacks = [];
let totalCourses = 0;
for (let volumeIndex = 0; volumeIndex < packCount; volumeIndex += 1) {
  const volumeNumber = volumeIndex + 1;
  const volumeId = `oral-english-all-volume-${String(volumeNumber).padStart(2, "0")}`;
  const volumeRows = rows.slice(
    volumeIndex * STATEMENTS_PER_VOLUME,
    (volumeIndex + 1) * STATEMENTS_PER_VOLUME,
  );
  const courses = [];
  for (
    let courseIndex = 0;
    courseIndex < Math.ceil(volumeRows.length / STATEMENTS_PER_COURSE);
    courseIndex += 1
  ) {
    const courseRows = volumeRows.slice(
      courseIndex * STATEMENTS_PER_COURSE,
      (courseIndex + 1) * STATEMENTS_PER_COURSE,
    );
    courses.push(
      buildCourse(
        volumeId,
        courseIndex,
        courseRows,
        volumeIndex * STATEMENTS_PER_VOLUME + courseIndex * STATEMENTS_PER_COURSE,
      ),
    );
  }
  totalCourses += courses.length;
  const pack = {
    id: volumeId,
    order: 14 + volumeIndex,
    title: `英语口语开放语料 · 第 ${volumeNumber} 卷`,
    description: `Tatoeba 中英直译关系全量版 · ${volumeRows.length.toLocaleString("en-US")} 句 · CC BY 2.0 FR`,
    isFree: true,
    cover: "/logo.png",
    creatorId: "tatoeba-community",
    shareLevel: "public",
    dataUrl: `/oral-english-all/volume-${String(volumeNumber).padStart(2, "0")}.json`,
    courses,
  };
  await writeFile(
    new URL(`volume-${String(volumeNumber).padStart(2, "0")}.json`, OUTPUT_DIRECTORY_URL),
    `${JSON.stringify({ version: 2, source: sourceMetadata(), packs: [pack] }, null, 2)}\n`,
    "utf8",
  );
  indexPacks.push({
    ...pack,
    courses: pack.courses.map((course) => ({ ...course, statements: [] })),
  });
}

await writeFile(
  INDEX_URL,
  `${JSON.stringify({ version: 2, source: sourceMetadata(), packs: indexPacks }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Generated ${indexPacks.length} lazy-loaded volumes, ${totalCourses} courses and ${rows.length} statements.\n`,
);
