import fs from "fs";

import { fetcher, parseVersion, versionGte } from "./helpers";

const EDGETX_REPO_SOURCEBASE = "https://api.github.com/repos/EdgeTX/edgetx";

const LUA_REFERENCE_GUIDE_SOURCEBASE =
  "https://api.github.com/repos/EdgeTX/lua-reference-guide";

const REMOTE_MANIFEST_URL =
  "https://raw.githubusercontent.com/JeffreyChix/edgetx-stubs/main/manifest.json";

// Versions 2.3+
export async function fetchAllEdgeTxVersions(): Promise<string[]> {
  const res = await fetcher(EDGETX_REPO_SOURCEBASE + "/branches?per_page=100");

  if (!res.ok) {
    throw new Error("Could not fetch all branches.");
  }

  const branches = (await res.json()) as Array<{ name: string }>;

  const versions = branches
    .map((b) => b.name)
    .filter((name) => /^\d+\.\d+$/.test(name))
    .filter((name) => versionGte(name, "2.3"))
    .sort((a: string, b: string) => {
      const [aMaj, aMin] = parseVersion(a);
      const [bMaj, bMin] = parseVersion(b);
      return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
    });

  return [...versions, "main"];
}

async function fetchSourceFiles(version: string) {
  const res = await fetcher(
    EDGETX_REPO_SOURCEBASE + `/contents/radio/src/lua?ref=${version}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch source file version: ${version}`);
  }

  const sourceFiles = (await res.json()) as Sources;

  return sourceFiles.filter(
    (file) =>
      file.name.startsWith("api_") &&
      file.name.endsWith(".cpp") &&
      !file.name.includes("lvgl"),
  );
}

async function fetchLvglSources(version: string) {
  if (version === "main" || !versionGte(version, "2.11")) {
    return [];
  }

  const res = await fetcher(
    LUA_REFERENCE_GUIDE_SOURCEBASE +
      `/contents/lua-api-reference/lvgl-for-lua?ref=edgetx_${version}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch LVGL sources for version ${version}`);
  }

  let sources = (await res.json()) as Sources;

  return sources.filter(
    (s) =>
      s.name.startsWith("lvgl") ||
      s.name === "constants.md" ||
      s.name === "api.md",
  );
}

async function hasSourceChanged(
  sourceFiles: Sources,
  version: string,
): Promise<boolean> {
  const data = await fetchSourceFile(REMOTE_MANIFEST_URL);
  const manifest = JSON.parse(data) as Manifest;

  if (!manifest) return true; // no manifest, always generate

  const manifestVersion = manifest.versions[version];
  if (!manifestVersion) return true; // new version, always generate

  return sourceFiles.some(
    (file) => file.sha !== manifestVersion.sources[file.path],
  );
}

export async function fetchSourceFile(sourceFileUrl: string): Promise<string> {
  console.log(`Fetching: ${sourceFileUrl}`);
  const res = await fetcher(sourceFileUrl);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${sourceFileUrl}: ${res.status} ${res.statusText}`,
    );
  }

  return res.text();
}

async function fetchSources(
  sources: Sources,
  target: SourceTarget,
): Promise<void> {
  await Promise.all(
    sources.map(async (source) => {
      try {
        const content = await fetchSourceFile(source.download_url);
        target.set(source.name, { content, ...source });
      } catch (err) {
        console.error(`  SKIP: ${(err as Error).message}`);
      }
    }),
  );
}

export async function fetchAllSources(version: string): Promise<AllSources> {
  const [mainSources, lvglSources] = await Promise.all([
    fetchSourceFiles(version),
    fetchLvglSources(version),
  ]);

  const results: AllSources = {
    mainSources: new Map(),
    lvglSources: new Map(),
  };

  const isDev = process.env.NODE_ENV === "development";
  const trigger = process.env.TRIGGER;
  const forceRegenerate =
    isDev || trigger === "push" || trigger === "workflow_dispatch";

  const isSourceChanged = await hasSourceChanged(
    mainSources.concat(lvglSources),
    version,
  );

  if (!forceRegenerate && !isSourceChanged) {
    return results;
  }

  await Promise.all([
    fetchSources(mainSources, results.mainSources),
    fetchSources(lvglSources, results.lvglSources),
  ]);

  return results;
}

// --------------------------------------
// constants
// --------------------------------------

async function getLuaRefGuideVersionName(version: string) {
  const res = await fetcher(
    LUA_REFERENCE_GUIDE_SOURCEBASE + "/branches?per_page=100",
  );

  if (!res.ok) {
    throw new Error("Could not fetch all branches.");
  }

  const branches = (await res.json()) as Array<{ name: string }>;

  return branches.find((b) => b.name.includes(version))?.name;
}

export async function fetchConstantMarkdownSources(version: string) {
  const versionName = (await getLuaRefGuideVersionName(version)) ?? "main";

  const resLuaGuide = await fetcher(
    LUA_REFERENCE_GUIDE_SOURCEBASE + `/contents?ref=${versionName}`,
  );

  if (!resLuaGuide.ok) {
    throw new Error("Could not fetch lua reference guide contents.");
  }

  const luaGuideContents = (await resLuaGuide.json()) as Sources;

  const luaApiRefBlock = luaGuideContents.find(
    ({ name }) =>
      name.toLowerCase().replace(/_/g, "-").includes("lua-api-reference") &&
      !name.endsWith(".md"),
  );

  if (!luaApiRefBlock) return [];

  const resLuaApiRef = await fetcher(luaApiRefBlock.url);

  if (!resLuaApiRef.ok) {
    throw new Error("Could not fetch lua api reference contents.");
  }

  const luaApiRefContents = (await resLuaApiRef.json()) as Sources;

  const constantFolderBlock = luaApiRefContents.find(({ path }) =>
    path.toLowerCase().includes("/constants"),
  );

  if (!constantFolderBlock) return [];

  const resConstantFolders = await fetcher(constantFolderBlock.url);

  if (!resConstantFolders.ok) {
    throw new Error("Could not fetch constant source folders.");
  }

  const constantSources = (await resConstantFolders.json()) as Sources;

  return constantSources.filter(
    (source) => !source.download_url.includes("README.md"),
  );
}
