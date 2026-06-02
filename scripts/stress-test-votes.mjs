/**
 * Stress test: N unique users each submit one word-cloud vote (one INSERT each).
 *
 * Usage:
 *   node scripts/stress-test-votes.mjs
 *   STRESS_USERS=150 STRESS_CLEANUP=1 node scripts/stress-test-votes.mjs
 *   STRESS_POLL_ID=<uuid> node scripts/stress-test-votes.mjs
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const USER_COUNT = Number(process.env.STRESS_USERS ?? "150");
const CLEANUP = process.env.STRESS_CLEANUP === "1";
const POLL_ID_OVERRIDE = process.env.STRESS_POLL_ID;
const SESSION_PREFIX = "stress-test-";

const WORD_POOL = [
  "excited",
  "focused",
  "optimistic",
  "busy",
  "curious",
  "tired",
  "motivated",
  "stressed",
  "calm",
  "proud",
  "grateful",
  "blocked",
  "energized",
  "overwhelmed",
  "ready",
  "hopeful",
  "anxious",
  "confident",
  "inspired",
  "neutral",
];

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
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
    // .env.local optional if vars already exported
  }
}

loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and anon/service key in .env.local or environment.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolvePollId() {
  if (POLL_ID_OVERRIDE) return POLL_ID_OVERRIDE;

  const { data, error } = await supabase
    .from("polls")
    .select("id, question_text, type")
    .eq("type", "word_cloud")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to load poll: ${error.message}`);
  if (!data?.length) throw new Error("No word_cloud poll found. Run DATABASE.md seed first.");
  return data[0].id;
}

async function cleanupStressSessions(pollId) {
  const { error, count } = await supabase
    .from("poll_responses")
    .delete({ count: "exact" })
    .eq("poll_id", pollId)
    .like("session_id", `${SESSION_PREFIX}%`);

  if (error) throw new Error(`Cleanup failed: ${error.message}`);
  return count ?? 0;
}

function pickWord(index) {
  return WORD_POOL[index % WORD_POOL.length];
}

async function insertVote(pollId, sessionId, word) {
  const started = performance.now();
  const { error } = await supabase.from("poll_responses").insert({
    poll_id: pollId,
    session_id: sessionId,
    word_submitted: word,
    option_selected: null,
  });
  const ms = performance.now() - started;
  return { error, ms };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  console.log(`\nWord Cloud vote stress test (${USER_COUNT} dummy users, 1 vote each)\n`);

  const pollId = await resolvePollId();
  const { data: pollMeta } = await supabase
    .from("polls")
    .select("question_text, type")
    .eq("id", pollId)
    .single();

  console.log(`Poll: ${pollMeta?.question_text ?? pollId}`);
  console.log(`Poll ID: ${pollId}\n`);

  const preCleaned = await cleanupStressSessions(pollId);
  if (preCleaned > 0) {
    console.log(`Removed ${preCleaned} prior stress-test rows.\n`);
  }

  const users = Array.from({ length: USER_COUNT }, (_, i) => ({
    sessionId: `${SESSION_PREFIX}${randomUUID()}`,
    word: pickWord(i),
  }));

  const wallStart = performance.now();
  const results = await Promise.all(
    users.map(({ sessionId, word }) =>
      insertVote(pollId, sessionId, word).then((result) => ({
        sessionId,
        word,
        ...result,
      })),
    ),
  );
  const wallMs = performance.now() - wallStart;

  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const latencies = ok.map((r) => r.ms).sort((a, b) => a - b);

  const byCode = new Map();
  for (const row of failed) {
    const code = row.error?.code ?? row.error?.message ?? "unknown";
    byCode.set(code, (byCode.get(code) ?? 0) + 1);
  }

  console.log("--- Results ---");
  console.log(`Success:     ${ok.length} / ${USER_COUNT}`);
  console.log(`Failed:      ${failed.length}`);
  console.log(`Wall time:   ${wallMs.toFixed(0)} ms`);
  console.log(`Throughput:  ${((ok.length / wallMs) * 1000).toFixed(1)} votes/sec`);

  if (latencies.length) {
    console.log(`Latency p50: ${percentile(latencies, 50).toFixed(0)} ms`);
    console.log(`Latency p95: ${percentile(latencies, 95).toFixed(0)} ms`);
    console.log(`Latency p99: ${percentile(latencies, 99).toFixed(0)} ms`);
    console.log(`Latency max: ${latencies[latencies.length - 1].toFixed(0)} ms`);
  }

  if (byCode.size) {
    console.log("\nFailure breakdown:");
    for (const [code, count] of byCode) {
      console.log(`  ${code}: ${count}`);
    }
    const sample = failed[0];
    if (sample?.error?.message) {
      console.log(`  Example: ${sample.error.message}`);
    }
  }

  const { count: responseCount, error: countError } = await supabase
    .from("poll_responses")
    .select("id", { count: "exact", head: true })
    .eq("poll_id", pollId)
    .like("session_id", `${SESSION_PREFIX}%`);

  if (!countError) {
    console.log(`\nStress rows in DB for this poll: ${responseCount ?? 0}`);
  }

  if (CLEANUP) {
    const removed = await cleanupStressSessions(pollId);
    console.log(`Cleanup removed ${removed} stress-test rows.`);
  } else {
    console.log(
      `\nTip: re-run with STRESS_CLEANUP=1 to delete stress-test-* session rows from this poll.`,
    );
  }

  console.log("");
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
