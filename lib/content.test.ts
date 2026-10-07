import { describe, expect, it } from "vitest";
import { buildPosts, groupByMonth, parsePostName } from "./content";
import { monthOf } from "./drive-types";

const F = "application/vnd.google-apps.folder";
let n = 0;
const folder = (name: string) => ({ id: `fold${++n}xxxxxxxx`, name, mimeType: F, modifiedTime: "2026-10-07T00:00:00Z" });
const file = (name: string, mimeType = "image/png") => ({ id: `file${++n}xxxxxxxx`, name, mimeType, modifiedTime: "2026-10-07T00:00:00Z" });

describe("parsePostName", () => {
  it.each([
    ["10.14.26 - Carousel (What You Won't Say Out Loud)", "2026-10-14", "carousel", "What You Won't Say Out Loud"],
    ["10.12.26 - Static (The Foundation Is Free).png", "2026-10-12", "static", "The Foundation Is Free"],
    ["10-05 Who Is Still In The Chair.png", "2026-10-05", null, "Who Is Still In The Chair"],
    ["10.02.26", "2026-10-02", null, ""],
    ["Reel 01 - 0ct 2", null, null, "Reel 01 - 0ct 2"],
  ])("%s", (raw, date, type, title) => {
    expect(parsePostName(raw, 2026)).toEqual({ date, type, title });
  });
});

describe("monthOf", () => {
  it("reads type folders named for a month", () => {
    expect(monthOf("October Carousels")).toEqual({ month: 10, year: null });
    expect(monthOf("Octubre 2026")).toEqual({ month: 10, year: 2026 });
    expect(monthOf("2026-09")).toEqual({ month: 9, year: 2026 });
    expect(monthOf("Brand kit")).toBeNull();
  });
});

describe("Rob's October folder", () => {
  // Mirrors the real Drive layout.
  const statics = folder("October Statics");
  const reels = folder("October Reels");
  const carousels = folder("October Carousels");
  const pdf = file("Forged - Course Approval.pdf", "application/pdf");
  const car1 = folder("10.14.26 - Carousel (What You Won't Say Out Loud)");
  const car2 = folder("10.18.26 - Carousel (The Workbook Was The Map)");
  const reel1 = folder("10.02.26");
  const reel1inner = folder("Reel 01 - 0ct 2");
  const st1 = file("10.12.26 - Static (The Foundation Is Free).png");
  const st2 = file("10-05 Who Is Still In The Chair.png");
  const slides = ["10.14.26 - Slide 05.png", "10.14.26 - Slide 01 Cover.png", "10.14.26 - Slide 03.png", "10.14.26 - Slide 02.png"].map((x) => file(x));
  const caption = file("10.14.26 - Carousel (What You Won't Say Out Loud) - Caption & Notes.txt", "text/plain");
  const cover = file("Reel-07-cover-1080x1920.png");
  const video = file("Reel 01.mp4", "video/mp4");
  const children = new Map<string, ReturnType<typeof file>[]>([
    [statics.id, [st1, st2]],
    [reels.id, [reel1]],
    [carousels.id, [car1, car2]],
    [car1.id, [...slides, caption]],
    [car2.id, [file("10.18.26 - Slide 01.png")]],
    [reel1.id, [reel1inner, cover, file("Reel 07 The Workbook.srt", "application/octet-stream")]],
    [reel1inner.id, [video]],
  ]);

  it("groups the three October folders into one month and leaves the PDF aside", () => {
    const { groups, other } = groupByMonth([statics, reels, carousels, pdf], "2026-10-07");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ year: 2026, month: 10 });
    expect(groups[0].folders).toHaveLength(3);
    expect(other).toEqual([pdf]);
  });

  it("turns folders into posts in date order", () => {
    const posts = buildPosts([statics, reels, carousels], children, 2026);
    expect(posts.map((p) => [p.date, p.type, p.title])).toEqual([
      ["2026-10-02", "reel", "Reel"],
      ["2026-10-05", "static", "Who Is Still In The Chair"],
      ["2026-10-12", "static", "The Foundation Is Free"],
      ["2026-10-14", "carousel", "What You Won't Say Out Loud"],
      ["2026-10-18", "carousel", "The Workbook Was The Map"],
    ]);
  });

  it("orders carousel slides naturally, uses the cover, and finds the caption", () => {
    const c = buildPosts([carousels], children, 2026)[0];
    expect(c.media.map((m) => m.name)).toEqual([
      "10.14.26 - Slide 01 Cover.png", "10.14.26 - Slide 02.png", "10.14.26 - Slide 03.png", "10.14.26 - Slide 05.png",
    ]);
    expect(c.cover?.name).toBe("10.14.26 - Slide 01 Cover.png");
    expect(c.captionFile?.mimeType).toBe("text/plain");
  });

  it("finds a reel's video one folder down and its cover image", () => {
    const r = buildPosts([reels], children, 2026)[0];
    expect(r.media.map((m) => m.name)).toEqual(["Reel 01.mp4"]);
    expect(r.cover?.name).toBe("Reel-07-cover-1080x1920.png");
  });
});
