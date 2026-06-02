# Database Setup (Supabase)

Run these scripts in your Supabase project: **SQL Editor → New query**.

Order matters: `schema` → `fix-rls` (if needed) → `seed-wordcloud`.

---

## 1. Schema (`schema.sql`)

```sql
create extension if not exists "pgcrypto";

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  type text not null check (type in ('word_cloud', 'multiple_choice')),
  choice_options jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  session_id text not null,
  word_submitted text,
  option_selected text,
  created_at timestamptz not null default now(),
  constraint poll_responses_one_vote_per_session unique (poll_id, session_id)
);

create index if not exists poll_responses_poll_id_idx on public.poll_responses(poll_id);
create index if not exists poll_responses_session_id_idx on public.poll_responses(session_id);

alter table public.polls enable row level security;
alter table public.poll_responses enable row level security;

create policy "polls_select_public"
  on public.polls for select using (true);

create policy "poll_responses_select_public"
  on public.poll_responses for select using (true);

create policy "poll_responses_insert_public"
  on public.poll_responses for insert with check (true);

create policy "poll_responses_delete_public"
  on public.poll_responses for delete using (true);

create policy "polls_insert_public"
  on public.polls for insert with check (true);

create policy "polls_delete_public"
  on public.polls for delete using (true);

insert into public.polls (question_text, type, choice_options)
select 'How are you feeling about this sprint?', 'word_cloud', null
where not exists (select 1 from public.polls limit 1);

insert into public.polls (question_text, type, choice_options)
select 'What should we prioritize next?', 'multiple_choice',
  '["Analytics Dashboard","Performance","Mobile Experience","Integrations"]'::jsonb
where (select count(*) from public.polls) < 2;

insert into public.polls (question_text, type, choice_options)
select 'What best describes our team culture?', 'word_cloud', null
where (select count(*) from public.polls) < 3;

alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_responses;
```

---

## 2. Fix RLS (`fix-rls.sql`)

Run if you see: `new row violates row-level security policy`.

```sql
drop policy if exists "polls_insert_public" on public.polls;
create policy "polls_insert_public" on public.polls for insert with check (true);

drop policy if exists "polls_delete_public" on public.polls;
create policy "polls_delete_public" on public.polls for delete using (true);

drop policy if exists "polls_update_public" on public.polls;
create policy "polls_update_public" on public.polls for update using (true);

drop policy if exists "poll_responses_insert_public" on public.poll_responses;
create policy "poll_responses_insert_public" on public.poll_responses for insert with check (true);

drop policy if exists "poll_responses_delete_public" on public.poll_responses;
create policy "poll_responses_delete_public" on public.poll_responses for delete using (true);
```

---

## 3. Seed word clouds (`seed-wordcloud.sql`)

Adds default words to both sample Word Cloud polls with real vote counts.

```sql
with sprint_poll as (
  select id from public.polls
  where type = 'word_cloud'
    and question_text = 'How are you feeling about this sprint?'
  limit 1
),
seed_rows(word_text, session_suffix) as (
  values
    ('excited', '1'), ('excited', '2'), ('excited', '3'), ('excited', '4'),
    ('focused', '1'), ('focused', '2'), ('focused', '3'),
    ('optimistic', '1'), ('optimistic', '2'), ('optimistic', '3'),
    ('busy', '1'), ('busy', '2'),
    ('curious', '1'), ('curious', '2')
)
insert into public.poll_responses (poll_id, session_id, word_submitted, option_selected)
select sprint_poll.id, 'seed-sprint-' || seed_rows.word_text || '-' || seed_rows.session_suffix,
  seed_rows.word_text, null
from sprint_poll cross join seed_rows
on conflict (poll_id, session_id) do nothing;

with culture_poll as (
  select id from public.polls
  where type = 'word_cloud'
    and question_text = 'What best describes our team culture?'
  limit 1
),
seed_rows(word_text, session_suffix) as (
  values
    ('collaborative', '1'), ('collaborative', '2'), ('collaborative', '3'),
    ('collaborative', '4'), ('collaborative', '5'),
    ('supportive', '1'), ('supportive', '2'), ('supportive', '3'), ('supportive', '4'),
    ('creative', '1'), ('creative', '2'), ('creative', '3'),
    ('fast', '1'), ('fast', '2'),
    ('resilient', '1'), ('resilient', '2')
)
insert into public.poll_responses (poll_id, session_id, word_submitted, option_selected)
select culture_poll.id, 'seed-culture-' || seed_rows.word_text || '-' || seed_rows.session_suffix,
  seed_rows.word_text, null
from culture_poll cross join seed_rows
on conflict (poll_id, session_id) do nothing;
```

---

## Tables

| Table | Purpose |
|-------|---------|
| `polls` | Questions (word cloud or multiple choice) |
| `poll_responses` | One row per vote; `session_id` enforces one vote per browser session |

## Realtime

Enable **Database → Replication** for `polls` and `poll_responses` if live updates do not appear.

---

## 4. Harden RLS for production (optional)

The default schema allows anyone to delete polls or responses. Admin actions in this app use the **service role** on the server, so you can lock down public writes:

```sql
drop policy if exists "polls_insert_public" on public.polls;
drop policy if exists "polls_delete_public" on public.polls;
drop policy if exists "poll_responses_delete_public" on public.poll_responses;

-- Votes stay public; only SELECT + INSERT on poll_responses
-- Poll create/delete: use server actions + SUPABASE_SERVICE_ROLE_KEY only
```

Votes remain `insert` + `select` on `poll_responses`; participants cannot delete others’ votes from the client.
