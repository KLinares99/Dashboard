import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("google-auth-library", () => ({
  JWT: class { async getAccessToken() { return { token: "test-token" }; } },
}));

// A fake Drive:  root(client A) > october > reel.mp4 ;  otherRoot(client B) > secret.png
const TREE: Record<string, { name: string; parents?: string[]; mimeType: string }> = {
  rootAAAAAAAAAA: { name: "Client A", mimeType: "application/vnd.google-apps.folder" },
  octoberAAAAAAA: { name: "October", parents: ["rootAAAAAAAAAA"], mimeType: "application/vnd.google-apps.folder" },
  reelAAAAAAAAAA: { name: "reel.mp4", parents: ["octoberAAAAAAA"], mimeType: "video/mp4" },
  otherRootBBBBB: { name: "Client B", mimeType: "application/vnd.google-apps.folder" },
  secretBBBBBBBB: { name: "secret.png", parents: ["otherRootBBBBB"], mimeType: "image/png" },
};

beforeEach(() => {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "sa@test.iam", private_key: "x" });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const id = url.pathname.split("/files/")[1];
    if (id) {
      const f = TREE[id];
      return f ? new Response(JSON.stringify({ id, ...f })) : new Response("{}", { status: 404 });
    }
    const parent = url.searchParams.get("q")?.match(/'([^']+)' in parents/)?.[1];
    const files = Object.entries(TREE).filter(([, f]) => f.parents?.[0] === parent).map(([id, f]) => ({ id, ...f, modifiedTime: "2026-09-01T00:00:00Z" }));
    return new Response(JSON.stringify({ files }));
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("isInside", async () => {
  const { isInside } = await import("./drive");
  it("allows the folder itself and anything below it", async () => {
    expect(await isInside("rootAAAAAAAAAA", "rootAAAAAAAAAA")).toBe(true);
    expect(await isInside("octoberAAAAAAA", "rootAAAAAAAAAA")).toBe(true);
    expect(await isInside("reelAAAAAAAAAA", "rootAAAAAAAAAA")).toBe(true);
  });
  it("refuses another client's files", async () => {
    expect(await isInside("secretBBBBBBBB", "rootAAAAAAAAAA")).toBe(false);
    expect(await isInside("otherRootBBBBB", "rootAAAAAAAAAA")).toBe(false);
  });
  it("refuses malformed ids without calling Drive", async () => {
    await expect(isInside("../../etc", "rootAAAAAAAAAA")).rejects.toThrow("Invalid file");
  });
});

describe("listFolder", async () => {
  const { listFolder, kind } = await import("./drive");
  it("lists direct children", async () => {
    const files = await listFolder("rootAAAAAAAAAA");
    expect(files.map((f) => f.name)).toEqual(["October"]);
    expect(kind(files[0].mimeType)).toBe("folder");
  });
  it("rejects ids that could break the query", async () => {
    await expect(listFolder("x' or '1'='1")).rejects.toThrow("Invalid folder");
  });
});

