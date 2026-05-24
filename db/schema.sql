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

create table if not exists users (
  id text primary key,
  login_identifier text not null unique,
  login_type text not null check (login_type in ('phone', 'email')),
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists users_login_identifier_idx on users(login_identifier);
create index if not exists users_role_idx on users(role);

create table if not exists verification_codes (
  id text primary key,
  login_identifier text not null,
  login_type text not null check (login_type in ('phone', 'email')),
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null
);

create index if not exists verification_codes_login_identifier_idx on verification_codes(login_identifier);
create index if not exists verification_codes_expires_at_idx on verification_codes(expires_at);

create table if not exists membership_plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  validity_days integer not null check (validity_days > 0),
  grant_credits integer not null default 0 check (grant_credits >= 0),
  discount_rate numeric(5, 4) not null default 1 check (discount_rate > 0 and discount_rate <= 1),
  task_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists user_memberships (
  id text primary key,
  user_id text not null references users(id),
  plan_id text not null references membership_plans(id),
  status text not null check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null
);

create index if not exists user_memberships_user_id_idx on user_memberships(user_id);

create table if not exists credit_accounts (
  user_id text primary key references users(id),
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null
);

create table if not exists credit_ledger_entries (
  id text primary key,
  user_id text not null references users(id),
  type text not null check (type in ('credit_pack_purchase', 'membership_grant', 'generation_reserve', 'generation_confirm', 'generation_refund', 'admin_adjustment')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  reference_type text,
  reference_id text,
  reason text,
  created_at timestamptz not null
);

create index if not exists credit_ledger_entries_user_id_idx on credit_ledger_entries(user_id);
create index if not exists credit_ledger_entries_reference_idx on credit_ledger_entries(reference_type, reference_id);

create table if not exists orders (
  id text primary key,
  user_id text not null references users(id),
  order_type text not null check (order_type in ('membership', 'credit_pack')),
  status text not null check (status in ('pending', 'paid', 'cancelled', 'failed')),
  amount_cents integer not null check (amount_cents >= 0),
  provider text not null default 'zpay',
  provider_trade_no text,
  product_id text not null,
  paid_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists orders_user_id_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);
create unique index if not exists orders_provider_trade_no_unique_idx on orders(provider, provider_trade_no) where provider_trade_no is not null;

create table if not exists model_channels (
  id text primary key,
  name text not null,
  provider text not null,
  base_url text not null,
  api_key_encrypted text not null,
  model_name text not null,
  weight integer not null default 1 check (weight > 0),
  timeout_ms integer not null default 120000 check (timeout_ms > 0),
  is_enabled boolean not null default true,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists model_channels_enabled_idx on model_channels(is_enabled);

create table if not exists generation_tasks (
  id text primary key,
  user_id text not null references users(id),
  status text not null check (status in ('pending', 'running', 'succeeded', 'failed', 'refunded')),
  task_type text not null check (task_type in ('root_page', 'drill_down')),
  topic text,
  parent_page_id text references pages(id),
  style text not null,
  estimated_credits integer not null check (estimated_credits >= 0),
  charged_credits integer not null default 0 check (charged_credits >= 0),
  result_page_id text references pages(id),
  failure_reason text,
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  constraint generation_tasks_shape_check check (
    (task_type = 'root_page' and topic is not null and parent_page_id is null)
    or
    (task_type = 'drill_down' and topic is null and parent_page_id is not null)
  )
);

create index if not exists generation_tasks_user_id_idx on generation_tasks(user_id);
create index if not exists generation_tasks_status_idx on generation_tasks(status);
create index if not exists generation_tasks_created_at_idx on generation_tasks(created_at);

create table if not exists channel_attempts (
  id text primary key,
  task_id text not null references generation_tasks(id),
  channel_id text not null references model_channels(id),
  status text not null check (status in ('running', 'succeeded', 'failed', 'timed_out')),
  error_summary text,
  latency_ms integer,
  is_final boolean not null default false,
  started_at timestamptz not null,
  finished_at timestamptz
);

create index if not exists channel_attempts_task_id_idx on channel_attempts(task_id);
create index if not exists channel_attempts_channel_id_idx on channel_attempts(channel_id);

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null
);

create table if not exists credit_packs (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  credits integer not null check (credits > 0),
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists credit_packs_active_idx on credit_packs(is_active);

alter table orders add column if not exists fulfilled_at timestamptz;

create table if not exists payment_events (
  id text primary key,
  order_id text references orders(id),
  provider text not null,
  provider_trade_no text,
  event_type text not null check (event_type in ('notify', 'manual_correction')),
  payload jsonb not null,
  is_valid boolean not null,
  created_at timestamptz not null
);

create index if not exists payment_events_order_id_idx on payment_events(order_id);
create index if not exists payment_events_provider_trade_no_idx on payment_events(provider_trade_no);
