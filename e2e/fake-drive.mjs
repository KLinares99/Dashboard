// A tiny stand-in for the Google Drive API, holding Rob's real October layout.
// Run: node e2e/fake-drive.mjs   (listens on :4555)
// Then start the app with DRIVE_API_BASE=http://127.0.0.1:4555/drive/v3 DRIVE_TEST_TOKEN=test
import http from "node:http";

const F = "application/vnd.google-apps.folder";
const files = new Map();
let n = 0;
const add = (name, mimeType, parent, extra = {}) => {
  const id = `fake${String(++n).padStart(4, "0")}xxxxxxxxxxxx`;
  files.set(id, { id, name, mimeType, parents: parent ? [parent] : [], modifiedTime: "2026-10-07T01:00:00Z", ...extra });
  return id;
};
const img = (name, parent, color) => add(name, "image/png", parent, { color, thumbnailLink: "" });

export const ROOT = add("Client Portal", F, null);
const statics = add("October Statics", F, ROOT);
const reels = add("October Reels", F, ROOT);
const carousels = add("October Carousels", F, ROOT);
add("Forged - Course Approval.pdf", "application/pdf", ROOT);
const sept = add("September Statics", F, ROOT);
img("09.28.26 - Static (Before The Workbook).png", sept, "#6b4e2e");

const palette = ["#14213d", "#c9a04a", "#2f55d4", "#7a1f1f", "#1d5f4a", "#3b2f63", "#a04a1f"];
[["10-05 Who Is Still In The Chair.png", 0], ["10-07 This Was The First Thing.png", 1], ["10.12.26 - Static (The Foundation Is Free).png", 2],
 ["10.19.26 - Static (You Don't Have To Be Okay To Start).png", 3], ["10.26.26 - Static (Isolation Is Where Warriors Fall).png", 4]]
  .forEach(([name, c]) => img(name, statics, palette[c]));

[["10.14.26 - Carousel (What You Won't Say Out Loud)", 7], ["10.18.26 - Carousel (The Workbook Was The Map)", 6], ["10.21.26 - Carousel (For The Ones Who Run In)", 5],
 ["10.25.26 - Carousel (Three Things We Can Tell You)", 6], ["10.28.26 - Carousel (Lace Up Before The Call)", 5]].forEach(([name, count], k) => {
  const c = add(name, F, carousels);
  const d = name.slice(0, 8);
  for (let i = 1; i <= count; i++) img(`${d} - Slide ${String(i).padStart(2, "0")}${i === 1 ? " Cover" : i === count ? " Close" : ""}.png`, c, palette[(k + i) % palette.length]);
  add(`${name} - Caption & Notes.txt`, "text/plain", c, { text: `Caption for "${name.replace(/^.*\((.*)\)$/, "$1")}"\n\nYou don't have to carry it alone. Week ${k + 1} of the Warriors walk.\n\n#WarriorsProject #MensMinistry` });
});
for (const [date, label] of [["10.02.26", "Reel 01 - 0ct 2"], ["10.09.26", "Reel 02 - Oct 9"]]) {
  const r = add(date, F, reels);
  img(`Reel-${date}-cover-1080x1920.png`, r, "#111827");
  add(`${label}.srt`, "application/octet-stream", r);
  const inner = add(label, F, r);
  add(`${label}.mp4`, "video/mp4", inner);
}
for (const f of files.values()) if (f.thumbnailLink === "") f.thumbnailLink = `http://127.0.0.1:4555/thumb/${f.id}=s220`;

const svg = (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="${f.color ?? "#333"}"/><text x="60" y="880" fill="#fff" font-family="Georgia" font-size="46">${f.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 34)}</text></svg>`;

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.headers.authorization !== "Bearer test" && !url.pathname.startsWith("/thumb/")) { res.writeHead(401).end(); return; }
  const thumb = url.pathname.match(/^\/thumb\/([^=]+)=s\d+$/);
  if (thumb) { const f = files.get(thumb[1]); res.writeHead(f ? 200 : 404, { "content-type": "image/svg+xml" }).end(f ? svg(f) : ""); return; }
  const one = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (one) {
    const f = files.get(one[1]);
    if (!f) { res.writeHead(404).end("{}"); return; }
    if (url.searchParams.get("alt") === "media") {
      if (f.mimeType === "text/plain") res.writeHead(200, { "content-type": "text/plain" }).end(f.text ?? "");
      else if (f.mimeType.startsWith("image/")) res.writeHead(200, { "content-type": "image/svg+xml" }).end(svg(f));
      else res.writeHead(200, { "content-type": f.mimeType }).end("fake");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(f));
    return;
  }
  if (url.pathname === "/drive/v3/files") {
    const ids = [...(url.searchParams.get("q") ?? "").matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
    const list = [...files.values()].filter((f) => f.parents.some((p) => ids.includes(p)));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ files: list }));
    return;
  }
  res.writeHead(404).end();
}).listen(4555, () => console.log(`fake drive ready, root ${ROOT}`));
