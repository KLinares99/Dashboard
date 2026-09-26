import { describe, expect, it } from "vitest";
import { niceTicks, summarize, toSeries } from "./series";

const rows = (metric: string, vals: [string, number][]) => vals.map(([d, v]) => ({ metric, on_date: d, value: v, source: "ga4" }));

describe("summarize", () => {
  it("sums counts over the window and compares with the window before", () => {
    const [s] = toSeries(rows("Sessions", [["2026-09-01", 5], ["2026-09-02", 5], ["2026-09-03", 10], ["2026-09-04", 20]]));
    const r = summarize(s, "2026-09-04", 2);
    expect(r.value).toBe(30);
    expect(r.prev).toBe(10);
    expect(r.change).toBe(2);
  });
  it("averages rates", () => {
    const [s] = toSeries(rows("Engagement rate", [["2026-09-01", 0.4], ["2026-09-02", 0.6]]));
    expect(s.isRate).toBe(true);
    expect(summarize(s, "2026-09-02", 2).value).toBeCloseTo(0.5);
  });
  it("has no comparison when the earlier window is empty", () => {
    const [s] = toSeries(rows("Sessions", [["2026-09-04", 20]]));
    expect(summarize(s, "2026-09-04", 30).change).toBeNull();
  });
});

describe("niceTicks", () => {
  it("covers the max with round steps", () => {
    expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceTicks(640)).toEqual([0, 200, 400, 600, 800]);
    expect(niceTicks(1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
