/**
 * Seed N demo votes with realistic word frequency (common words repeat).
 * Keeps rows in DB so you can check word-cloud layout in the app.
 *
 * Usage:
 *   npm run seed-demo
 *   SEED_POLL_ID=<uuid> SEED_USERS=150 npm run seed-demo
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const USER_COUNT = Number(process.env.SEED_USERS ?? "150");
const POLL_ID_OVERRIDE = process.env.SEED_POLL_ID;
const SESSION_PREFIX = "demo-user-";

/** [word, how many users pick it] — must sum to SEED_USERS or we scale */
/** Totals 150 votes — popular words dominate like a real room */
const WORD_WEIGHTS = [
  ["biryani", 27],
  ["dosa", 19],
  ["butter chicken", 18],
  ["samosa", 14],
  ["paneer tikka", 12],
  ["idli", 10],
  ["chole bhature", 9],
  ["pav bhaji", 8],
  ["dal makhani", 7],
  ["masala dosa", 6],
  ["tandoori", 5],
  ["vada pav", 4],
  ["pani puri", 3],
  ["rajma chawal", 3],
  ["dhokla", 2],
  ["uttapam", 2],
  ["korma", 1],
];

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function buildWordAssignments(targetCount) {
  const planned = WORD_WEIGHTS.reduce((sum, [, n]) => sum + n, 0);
  const words = [];

  if (planned === targetCount) {
    for (const [word, count] of WORD_WEIGHTS) {
      for (let i = 0; i < count; i++) words.push(word);
    }
  } else {
    for (const [word, count] of WORD_WEIGHTS) {
      const scaled = Math.max(1, Math.round((count / planned) * targetCount));
      for (let i = 0; i < scaled; i++) words.push(word);
    }
    while (words.length < targetCount) words.push(WORD_WEIGHTS[0][0]);
    while (words.length > targetCount) words.pop();
  }

  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  return words;
}

loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase URL/key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolvePollId() {
  if (POLL_ID_OVERRIDE) return POLL_ID_OVERRIDE;

  const { data, error } = await supabase
    .from("polls")
    .select("id, question_text")
    .eq("type", "word_cloud")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No word_cloud poll found.");
  return data[0];
}

async function removePriorDemoVotes(pollId) {
  const { error, count } = await supabase
    .from("poll_responses")
    .delete({ count: "exact" })
    .eq("poll_id", pollId)
    .like("session_id", `${SESSION_PREFIX}%`);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function main() {
  const poll = await resolvePollId();
  const pollId = typeof poll === "string" ? poll : poll.id;
  const question = typeof poll === "string" ? pollId : poll.question_text;

  console.log(`\nSeeding ${USER_COUNT} demo votes (kept in DB for layout check)\n`);
  console.log(`Poll: ${question}`);
  console.log(`Poll ID: ${pollId}\n`);

  const removed = await removePriorDemoVotes(pollId);
  if (removed > 0) console.log(`Replaced ${removed} previous demo-user-* votes.\n`);

  const words = buildWordAssignments(USER_COUNT);
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);

  const rows = words.map((word) => ({
    poll_id: pollId,
    session_id: `${SESSION_PREFIX}${randomUUID()}`,
    word_submitted: word,
    option_selected: null,
  }));

  const batchSize = 50;
  let inserted = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("poll_responses").insert(chunk);
    if (error) {
      errors.push(error.message);
      for (const row of chunk) {
        const { error: oneError } = await supabase.from("poll_responses").insert(row);
        if (oneError) errors.push(oneError.message);
        else inserted += 1;
      }
    } else {
      inserted += chunk.length;
    }
  }

  console.log(`Inserted: ${inserted} / ${USER_COUNT}`);
  if (errors.length) {
    console.log(`Errors (${errors.length}):`, [...new Set(errors)].slice(0, 3).join("; "));
  }

  console.log("\nWord frequency (top terms):");
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([word, n]) => console.log(`  ${word.padEnd(16)} ${n}`));

  console.log("\nOpen the app and select this poll to review the layout.");
  console.log(`Remove later: delete from poll_responses where session_id like '${SESSION_PREFIX}%'\n`);

  process.exit(inserted < USER_COUNT ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
