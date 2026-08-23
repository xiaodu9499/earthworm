import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(desktopRoot, "../..");
const outputRoot = path.join(desktopRoot, "standalone");
const dataOutput = path.join(outputRoot, "data/course-data.json.gz");
const webOutput = path.join(outputRoot, "web");
const clientOutput = path.join(repositoryRoot, "apps/client/.output/public");

const databaseContainer = process.env.EARTHWORM_DB_CONTAINER || "earthworm-db-1";
const databaseName = process.env.EARTHWORM_DB_NAME || "earthworm";
const databaseUser = process.env.EARTHWORM_DB_USER || "postgres";

const exportSql = `
SELECT json_build_object(
  'version', 1,
  'packs', COALESCE((
    SELECT json_agg(pack_payload)
    FROM (
      SELECT json_build_object(
        'id', cp.id,
        'order', cp."order",
        'title', cp.title,
        'description', COALESCE(cp.description, ''),
        'isFree', COALESCE(cp.is_free, TRUE),
        'cover', '/logo.png',
        'creatorId', 'local-user',
        'shareLevel', 'public',
        'courses', COALESCE((
          SELECT json_agg(course_payload)
          FROM (
            SELECT json_build_object(
              'id', c.id,
              'title', c.title,
              'description', COALESCE(c.description, ''),
              'video', COALESCE(c.video, ''),
              'order', c."order",
              'coursePackId', c.course_pack_id,
              'statements', COALESCE((
                SELECT json_agg(json_build_object(
                  'id', s.id,
                  'order', s."order",
                  'chinese', s.chinese,
                  'english', s.english,
                  'soundmark', s.soundmark
                ) ORDER BY s."order")
                FROM statements s
                WHERE s.course_id = c.id
              ), '[]'::json)
            ) AS course_payload
            FROM courses c
            WHERE c.course_pack_id = cp.id
            ORDER BY c."order"
          ) ordered_courses
        ), '[]'::json)
      ) AS pack_payload
      FROM course_packs cp
      WHERE cp.share_level = 'public'
      ORDER BY cp."order"
    ) ordered_packs
  ), '[]'::json)
)::text;
`;

console.log("Exporting local course catalog...");
const catalogText = execFileSync(
  "docker",
  [
    "exec",
    databaseContainer,
    "psql",
    "-U",
    databaseUser,
    "-d",
    databaseName,
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
    "-c",
    exportSql,
  ],
  { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 },
).trim();

const catalog = JSON.parse(catalogText);
const courseCount = catalog.packs.reduce((total, pack) => total + pack.courses.length, 0);
const statementCount = catalog.packs.reduce(
  (packTotal, pack) =>
    packTotal +
    pack.courses.reduce((courseTotal, course) => courseTotal + course.statements.length, 0),
  0,
);

mkdirSync(path.dirname(dataOutput), { recursive: true });
writeFileSync(dataOutput, gzipSync(Buffer.from(JSON.stringify(catalog)), { level: 9 }));
console.log(
  `Catalog exported: ${catalog.packs.length} packs, ${courseCount} courses, ${statementCount} statements.`,
);

console.log("Generating standalone Nuxt client...");
execFileSync("pnpm", ["-F", "client", "exec", "nuxi", "generate"], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    API_BASE: "/api",
    BACKEND_ENDPOINT: "",
    EARTHWORM_STANDALONE: "true",
    HELP_DOCS_URL: "",
    LOGTO_APP_ID: "",
    LOGTO_ENDPOINT: "",
    LOGTO_SIGN_IN_REDIRECT_URI: "",
    LOGTO_SIGN_OUT_REDIRECT_URI: "",
    NODE_ENV: "production",
  },
  stdio: "inherit",
});

rmSync(webOutput, { force: true, recursive: true });
mkdirSync(webOutput, { recursive: true });
cpSync(clientOutput, webOutput, { recursive: true });
console.log(`Standalone assets prepared in ${outputRoot}`);
