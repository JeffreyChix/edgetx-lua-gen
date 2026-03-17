import {
  fetcher,
  parseVersion,
  readAndParseManifest,
  versionGte,
} from "./helpers";
import { GitHubContentItem, GitHubContentItems } from "./types";

const EDGETX_REPO_SOURCEBASE = "https://api.github.com/repos/EdgeTX/edgetx";

const LUA_REFERENCE_GUIDE_SOURCEBASE =
  "https://api.github.com/repos/EdgeTX/lua-reference-guide";

const LVGL_CONSTANTS_DOWNLOAD_URL = `https://raw.githubusercontent.com/EdgeTX/lua-reference-guide/edgetx_2.11/lua-api-reference/lvgl-for-lua/constants.md`;

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

  const sourceFiles = (await res.json()) as GitHubContentItems;

  return sourceFiles.filter(
    (file) => file.name.startsWith("api_") && file.name.endsWith(".cpp"),
  );
}

function hasSourceChanged(
  sourceFiles: GitHubContentItems,
  version: string,
): boolean {
  const manifest = readAndParseManifest();
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

type AllSources = Map<string, { content: string } & GitHubContentItem>;

export async function fetchAllSources(version: string): Promise<AllSources> {
  const sourceFiles = await fetchSourceFiles(version);

  const results: AllSources = new Map();

  const isDev = process.env.NODE_ENV === "development";
  const trigger = process.env.TRIGGER;
  const forceRegenerate =
    isDev || trigger === "push" || trigger === "workflow_dispatch";

  if (!forceRegenerate && !hasSourceChanged(sourceFiles, version)) {
    return results;
  }

  for (const sourceFile of sourceFiles) {
    try {
      const content = await fetchSourceFile(sourceFile.download_url);
      results.set(sourceFile.name, { content, ...sourceFile });
      console.log(`  OK: ${content.length} bytes`);
    } catch (err) {
      console.error(`  SKIP: ${(err as Error).message}`);
    }
  }

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

  const luaGuideContents = (await resLuaGuide.json()) as GitHubContentItems;

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

  const luaApiRefContents = (await resLuaApiRef.json()) as GitHubContentItems;

  const constantFolderBlock = luaApiRefContents.find(({ path }) =>
    path.toLowerCase().includes("/constants"),
  );

  if (!constantFolderBlock) return [];

  const resConstantFolders = await fetcher(constantFolderBlock.url);

  if (!resConstantFolders.ok) {
    throw new Error("Could not fetch constant source folders.");
  }

  const constantSources =
    (await resConstantFolders.json()) as GitHubContentItems;

  if (versionGte(version, "2.11")) {
    // api_colorlcd_lvgl.cpp introduced in 2.11
    // add lvgl constant definitions markdown file to the sources
    constantSources.push({
      download_url: LVGL_CONSTANTS_DOWNLOAD_URL,
      name: "constants.md",
      path: "lua-api-reference/lvgl-for-lua/constants.md",
      url: "",
      sha: "",
    });
  }

  return constantSources.filter(
    (source) => !source.download_url.includes("README.md"),
  );
}
