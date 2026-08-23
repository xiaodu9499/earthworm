#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const DB_CONTAINER = process.env.EARTHWORM_DB_CONTAINER || "earthworm-db-1";
const DB_NAME = process.env.EARTHWORM_DB_NAME || "earthworm";
const DB_USER = process.env.EARTHWORM_DB_USER || "postgres";

const SOURCES = {
  easyLanguage: {
    url: "https://github.com/Huhua-Xiao/easy-language.git",
    commit: "5c6032b51e63d5b633db6331b056c2d29ad03e17",
    localDir: process.env.EARTHWORM_EASY_LANGUAGE_DIR,
  },
  pteWfd: {
    url: "https://github.com/zcl0621/earthworm-wfd.git",
    commit: "b9a40db1d73042ae08edd34ab5a3d8008ba37ba2",
    localDir: process.env.EARTHWORM_PTE_WFD_DIR,
  },
};

const workDir = mkdtempSync(join(tmpdir(), "earthworm-community-courses-"));

try {
  const easyLanguageDir = resolveSource("easy-language", SOURCES.easyLanguage);
  const pteWfdDir = resolveSource("earthworm-wfd", SOURCES.pteWfd);

  const packs = [
    makeFilePack({
      id: "community-pte-wfd",
      order: 2,
      title: "PTE WFD 拆解练习",
      description: "社区分享的 PTE Write From Dictation 拆解练习，共 23 课。",
      sourceUrl: "https://github.com/zcl0621/earthworm-wfd",
      directory: join(pteWfdDir, "packages/wfd-courses/data/courses"),
      courseTitle: (index) => `第 ${String(index + 1).padStart(2, "0")} 课`,
    }),
    makeFilePack({
      id: "community-ielts-green-book",
      order: 3,
      title: "IELTS 绿皮书词句练习",
      description: "社区整理的 IELTS 词汇与例句练习，共 23 课。",
      sourceUrl: "https://github.com/Huhua-Xiao/easy-language",
      directory: join(easyLanguageDir, "packages/ielts-courses/data/courses"),
      courseTitle: (index) => `第 ${String(index + 1).padStart(2, "0")} 课`,
    }),
    makeChunkedPack({
      id: "community-ielts-listening-words",
      order: 4,
      title: "IELTS 高频听力词汇",
      description: "社区整理的 IELTS 高频听力词汇；为便于练习，每课最多 50 条。",
      sourceUrl: "https://github.com/Huhua-Xiao/easy-language",
      file: join(
        easyLanguageDir,
        "packages/ielts-listening-words-courses/data/courses/listen_high_freq_words.json",
      ),
      chunkSize: 50,
    }),
    makeChunkedPack({
      id: "community-ielts-sentences",
      order: 5,
      title: "IELTS 句子翻译练习",
      description: "社区整理的 IELTS 中英文句子翻译练习；每课 35 条。",
      sourceUrl: "https://github.com/Huhua-Xiao/easy-language",
      file: join(
        easyLanguageDir,
        "packages/ielts-sentences-courses/data/courses/100_sentences.json",
      ),
      chunkSize: 35,
    }),
  ];

  const statementCount = packs.reduce(
    (packTotal, pack) =>
      packTotal +
      pack.courses.reduce((courseTotal, course) => courseTotal + course.items.length, 0),
    0,
  );
  const courseCount = packs.reduce((total, pack) => total + pack.courses.length, 0);

  console.log(
    `Prepared ${packs.length} packs, ${courseCount} courses, ${statementCount} statements.`,
  );
  for (const pack of packs) {
    const count = pack.courses.reduce((total, course) => total + course.items.length, 0);
    console.log(`- ${pack.title}: ${pack.courses.length} courses, ${count} statements`);
  }

  const sql = buildSql(packs);
  runPsql(sql);

  const verification = execFileSync(
    "docker",
    [
      "exec",
      DB_CONTAINER,
      "psql",
      "-U",
      DB_USER,
      "-d",
      DB_NAME,
      "-P",
      "pager=off",
      "-c",
      `SELECT cp.title, count(DISTINCT c.id) AS courses, count(s.id) AS statements
       FROM course_packs cp
       LEFT JOIN courses c ON c.course_pack_id = cp.id
       LEFT JOIN statements s ON s.course_id = c.id
       WHERE cp.id LIKE 'community-%'
       GROUP BY cp.id, cp.title, cp.\"order\"
       ORDER BY cp.\"order\";`,
    ],
    { encoding: "utf8" },
  );
  console.log(verification.trim());
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

function resolveSource(name, source) {
  if (source.localDir) {
    return source.localDir;
  }

  const target = join(workDir, name);
  execFileSync("git", ["init", "-q", target], { stdio: "inherit" });
  execFileSync("git", ["-C", target, "remote", "add", "origin", source.url], {
    stdio: "inherit",
  });
  execFileSync("git", ["-C", target, "fetch", "-q", "--depth", "1", "origin", source.commit], {
    stdio: "inherit",
  });
  execFileSync("git", ["-C", target, "checkout", "-q", "--detach", "FETCH_HEAD"], {
    stdio: "inherit",
  });
  return target;
}

function makeFilePack(config) {
  const files = readdirSync(config.directory)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  return {
    ...config,
    courses: files.map((file, index) => ({
      title: config.courseTitle(index, basename(file, ".json")),
      items: normalizeItems(readJson(join(config.directory, file))),
    })),
  };
}

function makeChunkedPack(config) {
  const items = normalizeItems(readJson(config.file));
  const courses = [];
  for (let index = 0; index < items.length; index += config.chunkSize) {
    courses.push({
      title: `第 ${String(courses.length + 1).padStart(2, "0")} 课`,
      items: items.slice(index, index + config.chunkSize),
    });
  }
  return { ...config, courses };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function normalizeItems(items) {
  return items
    .map((item) => ({
      chinese: String(item.chinese ?? "").trim(),
      english: String(item.english ?? "").trim(),
      soundmark: String(item.soundmark ?? "").trim(),
    }))
    .filter((item) => item.chinese && item.english);
}

function buildSql(packs) {
  const statements = ["BEGIN;", "SET client_min_messages TO WARNING;"];

  for (const pack of packs) {
    statements.push(`
INSERT INTO course_packs
  (id, \"order\", title, description, is_free, cover, creator_id, share_level)
VALUES
  (${sqlString(pack.id)}, ${pack.order}, ${sqlString(pack.title)}, ${sqlString(
    `${pack.description} 来源：${pack.sourceUrl}`,
  )}, TRUE, '/logo.png', 'community-import', 'public')
ON CONFLICT (id) DO UPDATE SET
  \"order\" = EXCLUDED.\"order\",
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_free = EXCLUDED.is_free,
  cover = EXCLUDED.cover,
  share_level = EXCLUDED.share_level,
  updated_at = NOW();`);

    const courseRows = pack.courses.map((course, index) => {
      const courseId = `${pack.id}-course-${String(index + 1).padStart(3, "0")}`;
      course.id = courseId;
      return `(${sqlString(courseId)}, ${sqlString(course.title)}, '', '', ${index + 1}, ${sqlString(
        pack.id,
      )})`;
    });
    statements.push(`
INSERT INTO courses (id, title, description, video, \"order\", course_pack_id)
VALUES
${courseRows.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  video = EXCLUDED.video,
  \"order\" = EXCLUDED.\"order\",
  course_pack_id = EXCLUDED.course_pack_id,
  updated_at = NOW();`);

    const statementRows = [];
    for (const course of pack.courses) {
      course.items.forEach((item, index) => {
        const statementId = `${course.id}-statement-${String(index + 1).padStart(4, "0")}`;
        statementRows.push(
          `(${sqlString(statementId)}, ${index + 1}, ${sqlString(item.chinese)}, ${sqlString(
            item.english,
          )}, ${sqlString(item.soundmark)}, ${sqlString(course.id)})`,
        );
      });
    }

    for (let index = 0; index < statementRows.length; index += 300) {
      statements.push(`
INSERT INTO statements (id, \"order\", chinese, english, soundmark, course_id)
VALUES
${statementRows.slice(index, index + 300).join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  \"order\" = EXCLUDED.\"order\",
  chinese = EXCLUDED.chinese,
  english = EXCLUDED.english,
  soundmark = EXCLUDED.soundmark,
  course_id = EXCLUDED.course_id,
  updated_at = NOW();`);
    }
  }

  statements.push("COMMIT;");
  return statements.join("\n");
}

function sqlString(value) {
  return `'${String(value).replaceAll("\0", "").replaceAll("'", "''")}'`;
}

function runPsql(sql) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      DB_USER,
      "-d",
      DB_NAME,
    ],
    {
      input: sql,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
}
