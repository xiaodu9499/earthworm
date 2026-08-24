import { writeFile } from "node:fs/promises";

const SOURCE_REPOSITORY = "wychl/nce";
const SOURCE_REVISION = "a8fa06dda581cbd5cb9000afc92425c49e605428";
const SOURCE_ROOT = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${SOURCE_REVISION}`;
const OUTPUT_URL = new URL("../public/new-concept-authorized.json", import.meta.url);
const EXPECTED_COURSE_COUNTS = [72, 96, 60, 48];
const FETCH_CONCURRENCY = 12;

const packDefinitions = [
  {
    id: "new-concept-authorized-book-1",
    order: 6,
    title: "新概念英语第一册",
    description: "获授权教材课程 · 英语初阶 · 72 个课文单元",
  },
  {
    id: "new-concept-authorized-book-2",
    order: 7,
    title: "新概念英语第二册",
    description: "获授权教材课程 · 实践与进步 · 96 课",
  },
  {
    id: "new-concept-authorized-book-3",
    order: 8,
    title: "新概念英语第三册",
    description: "获授权教材课程 · 培养技能 · 60 课",
  },
  {
    id: "new-concept-authorized-book-4",
    order: 9,
    title: "新概念英语第四册",
    description: "获授权教材课程 · 流利英语 · 48 课",
  },
];

function encodeSourcePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function fetchText(path) {
  const response = await fetch(`${SOURCE_ROOT}/${encodeSourcePath(path)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function mapConcurrent(items, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, items.length) }, () => worker()),
  );
  return results;
}

function parseLessonNumber(slug, fallback) {
  const match = slug.match(/^(\d+)/);
  return match ? Number(match[1]) : fallback;
}

function courseTitle(bookIndex, unit, unitIndex) {
  const lessonNumber = parseLessonNumber(unit.slug, unitIndex + 1);
  if (bookIndex === 0) {
    return `Lessons ${lessonNumber}–${lessonNumber + 1}: ${unit.title}`;
  }
  return `Lesson ${lessonNumber}: ${unit.title}`;
}

function normalizeHeading(value) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function joinEnglish(left, right) {
  if (!left) return right;
  if (/[-–—]$/.test(left) || /^[,.;:!?\])}]/.test(right)) return `${left}${right}`;
  return `${left} ${right}`;
}

function parseStatements(lrc, statementIdPrefix, unitTitle) {
  const fragments = [];

  for (const line of lrc.split(/\r?\n/)) {
    const timedLine = line.match(/^\[\d{2}:\d{2}(?:\.\d+)?\](.*)$/);
    if (!timedLine) continue;

    const separatorIndex = timedLine[1].indexOf("|");
    if (separatorIndex < 0) continue;

    const english = timedLine[1].slice(0, separatorIndex).trim();
    const chinese = timedLine[1].slice(separatorIndex + 1).trim();
    if (
      !english ||
      !chinese ||
      /^(?:Lesson|Passage|Unit)\s+\d+\.?$/i.test(english) ||
      normalizeHeading(english) === normalizeHeading(unitTitle)
    ) {
      continue;
    }

    fragments.push({ chinese, english });
  }

  const merged = [];
  let pending = null;
  for (const fragment of fragments) {
    pending = pending
      ? {
          english: joinEnglish(pending.english, fragment.english),
          chinese: `${pending.chinese}${fragment.chinese}`,
        }
      : { ...fragment };

    if (/[.!?][\"'”’)]*$/.test(pending.english)) {
      merged.push(pending);
      pending = null;
    }
  }
  const trailingIncomplete = pending !== null;
  // A trailing fragment without sentence-ending punctuation is commonly an
  // author credit or a truncated alternate recording. It is not a safe drill.

  const statements = merged.map((statement, index) => {
    const order = index + 1;
    return {
      id: `${statementIdPrefix}-statement-${String(order).padStart(3, "0")}`,
      order,
      ...statement,
    };
  });
  return { statements, trailingIncomplete };
}

const sourceCatalog = JSON.parse(await fetchText("data.json"));
if (!Array.isArray(sourceCatalog.us_books) || sourceCatalog.us_books.length !== 4) {
  throw new Error("Expected four US-edition source books.");
}

const packs = [];
for (const [bookIndex, definition] of packDefinitions.entries()) {
  const sourceBook = sourceCatalog.us_books[bookIndex];
  const ukUnitsByTitle = new Map(
    (sourceCatalog.uk_books?.[bookIndex]?.units ?? []).map((unit) => [
      normalizeHeading(unit.title),
      unit,
    ]),
  );
  const expectedCount = EXPECTED_COURSE_COUNTS[bookIndex];
  if (sourceBook.bookName !== `NCE${bookIndex + 1}` || sourceBook.units.length !== expectedCount) {
    throw new Error(
      `Unexpected source coverage for book ${bookIndex + 1}: ${sourceBook.units.length}/${expectedCount}`,
    );
  }

  const courses = await mapConcurrent(sourceBook.units, async (unit, unitIndex) => {
    const courseNumber = unitIndex + 1;
    const courseId = `${definition.id}-course-${String(courseNumber).padStart(3, "0")}`;
    const candidatePaths = [unit.lrc];
    const ukUnit = ukUnitsByTitle.get(normalizeHeading(unit.title));
    if (ukUnit?.lrc && ukUnit.lrc !== unit.lrc) candidatePaths.push(ukUnit.lrc);

    const candidates = await Promise.all(
      candidatePaths.map(async (path) => ({
        path,
        ...parseStatements(await fetchText(path), courseId, unit.title),
      })),
    );
    const bestCandidate = candidates.sort((left, right) => {
      if (left.trailingIncomplete !== right.trailingIncomplete) {
        return Number(left.trailingIncomplete) - Number(right.trailingIncomplete);
      }
      return right.statements.length - left.statements.length;
    })[0];
    const statements = bestCandidate.statements;
    if (statements.length === 0) {
      throw new Error(`No bilingual statements parsed from ${candidatePaths.join(" or ")}`);
    }

    return {
      id: courseId,
      title: courseTitle(bookIndex, unit, unitIndex),
      description: `${definition.title} · ${statements.length} 条逐句练习`,
      order: courseNumber,
      coursePackId: definition.id,
      statements,
    };
  });

  packs.push({ ...definition, courses });
  process.stdout.write(
    `Imported ${definition.title}: ${courses.length} courses, ${courses.reduce((sum, course) => sum + course.statements.length, 0)} statements.\n`,
  );
}

const allCourses = packs.flatMap((pack) => pack.courses);
const allStatements = allCourses.flatMap((course) => course.statements);
if (allCourses.length !== EXPECTED_COURSE_COUNTS.reduce((sum, count) => sum + count, 0)) {
  throw new Error(`Unexpected total course count: ${allCourses.length}`);
}
if (new Set(allCourses.map((course) => course.id)).size !== allCourses.length) {
  throw new Error("Duplicate course IDs detected.");
}
if (new Set(allStatements.map((statement) => statement.id)).size !== allStatements.length) {
  throw new Error("Duplicate statement IDs detected.");
}

const output = {
  version: 1,
  authorization: "教材使用授权由站点所有者持有",
  source: {
    repository: `https://github.com/${SOURCE_REPOSITORY}`,
    revision: SOURCE_REVISION,
    format: "bilingual LRC",
  },
  packs,
};

await writeFile(OUTPUT_URL, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(
  `Generated ${packs.length} packs, ${allCourses.length} courses, ${allStatements.length} statements.\n`,
);
