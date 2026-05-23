create table if not exists pages (
  id text primary key,
  image_url text not null,
  parent_id text references pages(id),
  parent_click jsonb,
  initial_query text,
  style text not null,
  created_at timestamptz not null
);

create table if not exists share_links (
  share_id text primary key,
  page_ids text[] not null,
  created_at timestamptz not null
);

create index if not exists pages_parent_id_idx on pages(parent_id);
