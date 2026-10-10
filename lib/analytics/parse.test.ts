import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ParseError, guessSource, parseAnalyticsCsv, parseDate, parseNumber } from "./parse";

describe("parseDate", () => {
  it.each([
    ["20260926", "2026-09-26"],
    ["2026-09-26", "2026-09-26"],
    ["2026-9-6", "2026-09-06"],
    ["2026-09-26T00:00:00Z", "2026-09-26"],
    ["9/26/2026", "2026-09-26"],
    ["9/26/26", "2026-09-26"],
    ["Sep 26, 2026", "2026-09-26"],
    ["September 26 2026", "2026-09-26"],
    ["10/07/2026 07:01", "2026-10-07"], // Meta "Publish time"
    ["10/7/2026, 7:01 PM", "2026-10-07"],
  ])("%s -> %s", (raw, iso) => expect(parseDate(raw)).toBe(iso));

  it.each(["", "Total", "2026-02-30", "13/01/2026", "12345", null])("rejects %s", (raw) =>
    expect(parseDate(raw)).toBeNull(),
  );
});

describe("parseNumber", () => {
  it.each([
    ["1,234", 1234],
    ["$12.50", 12.5],
    ["4.5%", 4.5],
    ["(12)", -12],
    ["0", 0],
    [" 7 ", 7],
  ])("%s -> %s", (raw, n) => expect(parseNumber(raw)).toBe(n));

  it.each(["", "--", "abc", "1.2.3", null])("rejects %s", (raw) => expect(parseNumber(raw)).toBeNull());
});

describe("parseAnalyticsCsv", () => {
  it("reads a GA4 export with comment lines and YYYYMMDD dates", () => {
    const csv = [
      "# ----------------------------------------",
      "# Relevate - GA4",
      "# Start date: 20260901",
      "# End date: 20260903",
      "# ----------------------------------------",
      "Date,Active users,Sessions,Engagement rate",
      "20260901,10,14,0.5",
      "20260902,12,15,0.6",
      "20260903,8,9,0.4",
      "",
    ].join("\n");
    const r = parseAnalyticsCsv(csv);
    expect(r.dateColumn).toBe("Date");
    expect(r.metrics).toEqual(["Active users", "Sessions", "Engagement rate"]);
    expect(r.dateFrom).toBe("2026-09-01");
    expect(r.dateTo).toBe("2026-09-03");
    expect(r.points).toHaveLength(9);
    expect(r.points.find((p) => p.metric === "Sessions" && p.date === "2026-09-02")?.value).toBe(15);
  });

  it("sums counts and averages rates across a breakdown", () => {
    const csv = [
      "Day,Page,Views,Bounce rate",
      "2026-09-01,/home,100,40%",
      "2026-09-01,/about,50,60%",
      "2026-09-02,/home,80,50%",
    ].join("\n");
    const r = parseAnalyticsCsv(csv);
    const get = (m: string, d: string) => r.points.find((p) => p.metric === m && p.date === d)?.value;
    expect(get("Views", "2026-09-01")).toBe(150);
    expect(get("Bounce rate", "2026-09-01")).toBe(50);
    expect(r.metrics).not.toContain("Page");
  });

  it("skips total rows and reports them", () => {
    const csv = ["Date,Reach", "9/1/2026,1,000", "9/2/2026,\"2,500\"", "Total,3500"].join("\n");
    const r = parseAnalyticsCsv(csv);
    expect(r.skippedRows).toBeGreaterThanOrEqual(1);
    expect(r.points.find((p) => p.date === "2026-09-02")?.value).toBe(2500);
  });

  it("finds a date column that isn't named Date", () => {
    const csv = ["When,Calls,Direction requests", "2026-09-01,3,1", "2026-09-02,4,0"].join("\n");
    expect(parseAnalyticsCsv(csv).dateColumn).toBe("When");
  });

  it("strips a byte-order mark and handles Windows line endings", () => {
    const csv = "﻿Date,Clicks\r\n2026-09-01,5\r\n2026-09-02,6\r\n";
    expect(parseAnalyticsCsv(csv).points).toHaveLength(2);
  });

  it("explains what's wrong with unusable files", () => {
    expect(() => parseAnalyticsCsv("")).toThrow(ParseError);
    expect(() => parseAnalyticsCsv("Page,Views\n/home,10\n/about,4")).toThrow(/date column/);
    expect(() => parseAnalyticsCsv("Date,Page\n2026-09-01,/home\n2026-09-02,/about")).toThrow(/number columns/);
  });
});

describe("guessSource", () => {
  it("spots common exports", () => {
    expect(guessSource("report.csv", "# Google Analytics property\nDate,Sessions")).toBe("ga4");
    expect(guessSource("Facebook-insights.csv", "Date,Reach")).toBe("meta");
    expect(guessSource("x.csv", "Date,Calls,Direction requests")).toBe("gbp");
    expect(guessSource("x.csv", "Date,Widgets")).toBe("generic");
  });
});

describe("Meta per-post export (90 days, Relevate)", () => {
  const r = parseAnalyticsCsv(readFileSync("e2e/fixtures/meta-posts-90d.csv", "utf8"));
  const total = (m: string) => r.points.filter((p) => p.metric === m).reduce((a, p) => a + p.value, 0);

  it("dates each post by its publish time, not the 'Lifetime' column", () => {
    expect(r.dateColumn).toBe("Publish time");
    expect(r.perPost).toBe(true);
    expect([r.dateFrom, r.dateTo]).toEqual(["2026-07-20", "2026-10-07"]);
    expect(r.skippedRows).toBe(0);
  });

  it("keeps captions with hashtag lines intact", () => {
    expect(total("Posts")).toBe(38);
  });

  it("returns each post for the Top posts list", () => {
    expect(r.posts).toHaveLength(38);
    const best = [...r.posts].sort((a, b) => b.stats.Views - a.stats.Views)[0];
    expect(best.externalId).toBe("935204492959095");
    expect(best.date).toBe("2026-08-19");
    expect(best.caption?.split("\n")[0]).toBe("Nadie se libera de deudas sintiéndose juzgado. ");
    expect(best.postType).toBe("Photos");
    expect(best.permalink).toMatch(/^https:\/\/www\.facebook\.com\//);
    expect(best.stats).toMatchObject({ Views: 2471, Reach: 1058, Engagements: 36, "Total clicks": 102 });
  });

  it("returns no posts for a daily report", () => {
    expect(parseAnalyticsCsv("Date,Sessions\n2026-10-01,5\n2026-10-02,7").posts).toEqual([]);
  });

  it("keeps the useful numbers with plain names, and drops IDs, flags, zeros and repeats", () => {
    expect(r.metrics).toEqual(["Posts", "Views", "Reach", "Engagements", "Reactions", "Comments", "Shares",
      "Total clicks", "Other clicks", "Link clicks", "Photo clicks"]);
    expect(total("Views")).toBe(15880);
    expect(total("Reach")).toBe(7419);
    expect(r.points.find((p) => p.date === "2026-10-05" && p.metric === "Views")?.value).toBe(2157);
  });
});
