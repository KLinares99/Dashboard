-- Individual social posts from per-post exports (Meta's "Post ID" / "Permalink" files),
-- for the Top posts list. Each post keeps its latest lifetime numbers: uploading a
-- newer export updates the same post instead of adding it twice.

create table public.social_posts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  upload_id    uuid not null references public.analytics_uploads (id) on delete cascade,
  source       text not null,
  external_id  text not null,          -- Meta's Post ID
  published_on date not null,
  caption      text,
  post_type    text,                   -- "Photos", "Reels", ...
  permalink    text check (permalink is null or permalink like 'https://%'),
  stats        jsonb not null default '{}',   -- {"Views": 2157, "Reach": 939, ...}
  unique (client_id, external_id)       -- a post is one post, whichever source it was filed under
);
create index social_posts_client_idx on public.social_posts (client_id, published_on desc);

alter table public.social_posts enable row level security;
create policy staff_all on public.social_posts for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy client_read on public.social_posts for select to authenticated using (client_id = public.my_client_id());
