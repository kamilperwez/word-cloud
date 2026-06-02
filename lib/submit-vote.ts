import { createClient } from "@/lib/supabase/client";

const VOTED_MESSAGE = "You have already voted in this poll.";

export async function submitWordVote(pollId: string, word: string, sessionId: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const normalized = word.trim().toLowerCase();
  if (!normalized) return { error: "Word cannot be empty." };

  const { error } = await supabase.from("poll_responses").insert({
    poll_id: pollId,
    session_id: sessionId,
    word_submitted: normalized,
    option_selected: null,
  });

  if (error) {
    if (error.code === "23505") return { error: VOTED_MESSAGE };
    return { error: error.message };
  }

  return { ok: true as const };
}

export async function submitChoiceVote(
  pollId: string,
  optionText: string,
  sessionId: string,
) {
  const supabase = createClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const option = optionText.trim();
  if (!option) return { error: "Option cannot be empty." };

  const { error } = await supabase.from("poll_responses").insert({
    poll_id: pollId,
    session_id: sessionId,
    word_submitted: null,
    option_selected: option,
  });

  if (error) {
    if (error.code === "23505") return { error: VOTED_MESSAGE };
    return { error: error.message };
  }

  return { ok: true as const };
}
