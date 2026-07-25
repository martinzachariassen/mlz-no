// Applies .github/settings.yml to the repo's GitHub "About" metadata —
// description, homepage, topics. Run by .github/workflows/repo-settings.yml,
// but it is an ordinary Bun script: `bun .github/scripts/sync-repo-settings.ts
// --dry-run` works locally against any token that can read the repo.
//
// Two properties matter more than brevity here. It is *idempotent* — it diffs
// before it writes, so a run that changes nothing makes no API call and says
// so. And it *validates before it writes*, because GitHub rejects an invalid
// topic by dropping the whole request: a typo would otherwise look like a
// silent no-op rather than a failure.

const API = "https://api.github.com";

// GitHub's documented ceilings. Exceeding any of them is a 422 from the API;
// catching it here turns a confusing rejection into a pointed error message.
const MAX_DESCRIPTION = 350;
const MAX_TOPICS = 20;
const MAX_TOPIC_LENGTH = 50;
const TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

type RepoSettings = {
  description: string;
  homepage: string;
  topics: string[];
};

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
}

// The YAML is hand-edited and untyped, so everything it produces is checked
// before it reaches the API.
function parseSettings(raw: unknown): RepoSettings {
  if (typeof raw !== "object" || raw === null) {
    fail("settings.yml did not parse to an object");
  }

  const repository = (raw as Record<string, unknown>).repository;
  if (typeof repository !== "object" || repository === null) {
    fail("settings.yml is missing a `repository:` block");
  }

  const { description, homepage, topics } = repository as Record<
    string,
    unknown
  >;

  if (typeof description !== "string" || description.trim() === "") {
    fail("`repository.description` must be a non-empty string");
  }
  if (description.length > MAX_DESCRIPTION) {
    fail(
      `description is ${description.length} characters; GitHub allows ` +
        `${MAX_DESCRIPTION}`,
    );
  }

  if (typeof homepage !== "string" || homepage.trim() === "") {
    fail("`repository.homepage` must be a non-empty string");
  }

  if (!Array.isArray(topics)) {
    fail("`repository.topics` must be a list");
  }
  if (topics.length > MAX_TOPICS) {
    fail(`${topics.length} topics listed; GitHub allows ${MAX_TOPICS}`);
  }

  for (const topic of topics) {
    if (typeof topic !== "string") {
      fail(`topic ${JSON.stringify(topic)} is not a string`);
    }
    if (topic.length > MAX_TOPIC_LENGTH) {
      fail(`topic "${topic}" exceeds ${MAX_TOPIC_LENGTH} characters`);
    }
    // GitHub silently lowercases some invalid input and rejects the rest, so
    // require the canonical form up front rather than guessing which it is.
    if (!TOPIC_PATTERN.test(topic)) {
      fail(
        `topic "${topic}" is invalid — use lowercase letters, digits, and ` +
          `hyphens, starting with a letter or digit`,
      );
    }
  }

  const duplicates = topics.filter((t, i) => topics.indexOf(t) !== i);
  if (duplicates.length > 0) {
    fail(`duplicate topics: ${[...new Set(duplicates)].join(", ")}`);
  }

  // The YAML fold (`>-`) joins wrapped lines with spaces but keeps the source
  // indentation's runs of whitespace. The About box renders whatever it is
  // given, so collapse to single spaces rather than shipping the wrapping.
  return {
    description: description.trim().replace(/\s+/g, " "),
    homepage: homepage.trim(),
    topics: topics as string[],
  };
}

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "mlz-no-repo-settings",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    // A token without `Administration: write` reads the repo happily and then
    // 403s (or 404s, when GitHub hides the resource) on the write. That is the
    // single most likely failure here, so name it instead of dumping the body.
    const hint =
      response.status === 403 || response.status === 404
        ? "\nhint: writing repo metadata needs a token with " +
          "`Administration: read and write`. The Actions GITHUB_TOKEN " +
          "cannot be granted that scope — see the README."
        : "";
    fail(`${method} ${path} -> ${response.status}\n${detail}${hint}`);
  }

  return response.status === 204 ? null : await response.json();
}

const dryRun = process.argv.includes("--dry-run");
const token = requireEnv("GITHUB_TOKEN");
const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
if (!owner || !repo) fail("GITHUB_REPOSITORY must be in `owner/repo` form");

const file = new URL("../settings.yml", import.meta.url);
const desired = parseSettings(Bun.YAML.parse(await Bun.file(file).text()));

const current = (await api("GET", `/repos/${owner}/${repo}`, token)) as {
  description: string | null;
  homepage: string | null;
  topics?: string[];
};

// The API returns topics in its own order, so compare them as a set — an
// ordering difference is not a change worth a write.
const sorted = (topics: string[]) => [...topics].sort().join(",");

const descriptionChanged = current.description !== desired.description;
const homepageChanged = current.homepage !== desired.homepage;
const aboutChanged = descriptionChanged || homepageChanged;
const topicsChanged = sorted(current.topics ?? []) !== sorted(desired.topics);

if (!aboutChanged && !topicsChanged) {
  console.log(`${owner}/${repo}: already in sync, nothing to do`);
  process.exit(0);
}

function diff(label: string, before: string, after: string): void {
  console.log(`${label}:`);
  console.log(`  - ${before || "(none)"}`);
  console.log(`  + ${after}`);
}

if (descriptionChanged) {
  diff("description", current.description ?? "", desired.description);
}
if (homepageChanged) {
  diff("homepage", current.homepage ?? "", desired.homepage);
}

if (topicsChanged) {
  const before = new Set(current.topics ?? []);
  const after = new Set(desired.topics);
  const removed = [...before].filter((t) => !after.has(t));
  const added = [...after].filter((t) => !before.has(t));
  console.log("topics:");
  for (const topic of removed) console.log(`  - ${topic}`);
  for (const topic of added) console.log(`  + ${topic}`);
}

if (dryRun) {
  console.log("\ndry run — no changes applied");
  process.exit(0);
}

if (aboutChanged) {
  await api("PATCH", `/repos/${owner}/${repo}`, token, {
    description: desired.description,
    homepage: desired.homepage,
  });
}

// A separate endpoint from the rest of the repo's settings, and it replaces the
// full list rather than merging — so `topics` in the YAML is the complete set.
if (topicsChanged) {
  await api("PUT", `/repos/${owner}/${repo}/topics`, token, {
    names: desired.topics,
  });
}

console.log(`\n${owner}/${repo}: settings applied`);
