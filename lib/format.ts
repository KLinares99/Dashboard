export const money = (cents: number, opts: { cents?: boolean } = {}) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });

/** Parse "YYYY-MM-DD" as a local calendar date (no timezone drift). */
export const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

export const todayISO = (tz = "America/New_York") =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const fmtDate = (iso: string, o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  day(iso).toLocaleDateString("en-US", o);

export const daysBetween = (fromISO: string, toISO: string) =>
  Math.round((day(toISO).getTime() - day(fromISO).getTime()) / 86_400_000);

export const addDays = (iso: string, n: number) => {
  const d = day(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const STATUS_LABEL = { urgent: "Needs action", active: "On track", waiting: "Waiting", done: "Done", parked: "Parked" } as const;
export const TYPE_LABEL = { retainer: "Monthly retainer", project: "One-time project", internal: "Own brand" } as const;
export const INVOICE_LABEL = { draft: "Draft", sent: "Unpaid", paid: "Paid", void: "Void" } as const;

export const priceLabel = (c: { type: string; price_cents: number }) =>
  c.type === "internal" ? "Own brand" : money(c.price_cents) + (c.type === "retainer" ? " / mo" : "");

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
