import { parseVersion, versionGte } from "./helpers";
import { GitHubContentItems } from "./types";

const EDGETX_REPO_SOURCEBASE = "https://api.github.com/repos/EdgeTX/edgetx";

const LUA_REFERENCE_GUIDE_SOURCEBASE =
  "https://api.github.com/repos/EdgeTX/lua-reference-guide";

const LVGL_CONSTANTS_DOWNLOAD_URL = `https://raw.githubusercontent.com/EdgeTX/lua-reference-guide/edgetx_2.11/lua-api-reference/lvgl-for-lua/constants.md`;

/**
 * Fetch all edgetx versions and return only from v2.3
 */
export async function fetchAllEdgeTxVersions(): Promise<string[]> {
  const res = await fetch(EDGETX_REPO_SOURCEBASE + "/branches?per_page=100");

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
  const res = await fetch(
    EDGETX_REPO_SOURCEBASE + `/contents/radio/src/lua?ref=${version}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch source file version: ${version}`);
  }

  const sourceFiles = (await res.json()) as Array<{
    name: string;
    download_url: string;
  }>;

  return sourceFiles.filter(
    (file) => file.name.startsWith("api_") && file.name.endsWith(".cpp"),
  );
}

export async function fetchSourceFile(sourceFileUrl: string): Promise<string> {
  console.log(`Fetching: ${sourceFileUrl}`);
  const res = await fetch(sourceFileUrl);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${sourceFileUrl}: ${res.status} ${res.statusText}`,
    );
  }

  return res.text();
}

export async function fetchAllSources(
  version: string,
): Promise<Map<string, string>> {
  const sourceFiles = await fetchSourceFiles(version);

  const results = new Map<string, string>();

  for (const sourceFile of sourceFiles) {
    try {
      const content = await fetchSourceFile(sourceFile.download_url);
      results.set(sourceFile.name, content);
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
  const res = await fetch(
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

  const resLuaGuide = await fetch(
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

  const resLuaApiRef = await fetch(luaApiRefBlock.url);

  if (!resLuaApiRef.ok) {
    throw new Error("Could not fetch lua api reference contents.");
  }

  const luaApiRefContents = (await resLuaApiRef.json()) as GitHubContentItems;

  const constantFolderBlock = luaApiRefContents.find(({ path }) =>
    path.toLowerCase().includes("/constants"),
  );

  if (!constantFolderBlock) return [];

  const resConstantFolders = await fetch(constantFolderBlock.url);

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
    });
  }

  return constantSources.filter(
    (source) => !source.download_url?.includes("README.md"),
  );
}
