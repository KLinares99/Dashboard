export type Role = "staff" | "client";
export type ClientStatus = "urgent" | "active" | "waiting" | "done" | "parked";
export type ClientType = "retainer" | "project" | "internal";
export type TaskFlag = "urgent" | "blocked";
export type TaskAssignee = "elevate" | "client";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type ClientColor = "blue" | "purple" | "orange" | "teal" | "green" | "pink";

export type Profile = { id: string; email: string; full_name: string | null; role: Role; client_id: string | null };

export type Client = {
  id: string;
  slug: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  color: ClientColor;
  type: ClientType;
  price_cents: number;
  status: ClientStatus;
  summary: string | null;
  headline: string | null;
  next_step: string | null;
  services: string[];
  drive_folder_id: string | null;
  notion_url: string | null;
  archived: boolean;
  created_at: string;
};

export type Task = {
  id: string;
  client_id: string;
  title: string;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  flag: TaskFlag | null;
  due_on: string | null;
  assignee: TaskAssignee;
  position: number;
  created_at: string;
};

export type EventItem = { id: string; client_id: string; on_date: string; label: string; done: boolean; visible_to_client: boolean };
export type Invoice = {
  id: string; client_id: string; label: string; amount_cents: number; status: InvoiceStatus;
  issued_on: string | null; due_on: string | null; paid_on: string | null; pay_url: string | null; paid_cents: number; created_at: string;
};
export type Prospect = { id: string; name: string; detail: string | null; note: string | null; status: ClientStatus };
export type AnalyticsUpload = {
  id: string; client_id: string; source: string; filename: string; storage_path: string;
  row_count: number; date_from: string | null; date_to: string | null; created_at: string;
};
export type Metric = { metric: string; on_date: string; value: number; source: string };

export type DecisionKind = "approve" | "choice" | "text" | "date";
export type DecisionOption = { label: string; detail?: string; recommended?: boolean };
export type DecisionResponse = { approved?: boolean; choice?: string; text?: string; note?: string };
export type Approval = {
  id: string; client_id: string; eyebrow: string | null; title: string; subtitle: string | null; summary: string | null;
  card_color: string; accent_color: string; pdf_path: string | null; pdf_name: string | null;
  status: "open" | "signed"; signed_name: string | null; signed_at: string | null; created_at: string;
};
export type ApprovalItem = {
  id: string; approval_id: string; position: number; label: string; tag: string | null; detail: string | null;
  kind: DecisionKind; options: DecisionOption[]; response: DecisionResponse | null; responded_at: string | null;
};

export type Payment = { id: string; client_id: string; amount_cents: number; paid_on: string; method: string | null; reference: string | null; created_at: string };

/** What is still owed on an invoice (0 for paid, draft or void). */
export const owedOn = (i: Pick<Invoice, "status" | "amount_cents" | "paid_cents">) =>
  i.status === "sent" ? Math.max(0, i.amount_cents - (i.paid_cents ?? 0)) : 0;

export type SocialPost = {
  id: string;
  client_id: string;
  upload_id: string;
  source: string;
  external_id: string;
  published_on: string;
  caption: string | null;
  post_type: string | null;
  permalink: string | null;
  stats: Record<string, number>;
};
