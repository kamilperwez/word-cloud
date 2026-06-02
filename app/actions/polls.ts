"use server";

import { createAdminClient } from "@/lib/supabase/server";
import type { DbPollType, PollType } from "@/lib/types/polls";

function verifyAdmin(passcode: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "kamilsuyash";
  return passcode === expected;
}

function uiTypeToDb(type: PollType): DbPollType {
  return type === "wordcloud" ? "word_cloud" : "multiple_choice";
}

export async function createPollAction(input: {
  adminPasscode: string;
  question: string;
  type: PollType;
  optionTexts: string[];
}) {
  if (!verifyAdmin(input.adminPasscode)) {
    return { error: "Invalid admin passcode." };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const choiceOptions =
    input.type === "multiple-choice"
      ? input.optionTexts.map((item) => item.trim()).filter(Boolean).slice(0, 4)
      : null;

  if (input.type === "multiple-choice" && (choiceOptions?.length ?? 0) < 2) {
    return { error: "Multiple choice polls need at least 2 options." };
  }

  const { data, error } = await supabase
    .from("polls")
    .insert({
      question_text: input.question.trim(),
      type: uiTypeToDb(input.type),
      choice_options: choiceOptions,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { pollId: data.id as string };
}

export async function deletePollAction(input: {
  adminPasscode: string;
  pollId: string;
}) {
  if (!verifyAdmin(input.adminPasscode)) {
    return { error: "Invalid admin passcode." };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const { error } = await supabase.from("polls").delete().eq("id", input.pollId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteWordResponsesAction(input: {
  adminPasscode: string;
  pollId: string;
  word: string;
}) {
  if (!verifyAdmin(input.adminPasscode)) {
    return { error: "Invalid admin passcode." };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const { error } = await supabase
    .from("poll_responses")
    .delete()
    .eq("poll_id", input.pollId)
    .eq("word_submitted", input.word.trim().toLowerCase());

  if (error) return { error: error.message };
  return { ok: true };
}

export async function submitWordAction(input: {
  pollId: string;
  word: string;
  sessionId: string;
}) {
  const normalized = input.word.trim().toLowerCase();
  if (!normalized) return { error: "Word cannot be empty." };

  const supabase = createAdminClient();
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const { error } = await supabase.from("poll_responses").insert({
    poll_id: input.pollId,
    session_id: input.sessionId,
    word_submitted: normalized,
    option_selected: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You have already voted in this poll." };
    }
    return { error: error.message };
  }

  return { ok: true };
}

export async function submitChoiceAction(input: {
  pollId: string;
  optionText: string;
  sessionId: string;
}) {
  const option = input.optionText.trim();
  if (!option) return { error: "Option cannot be empty." };

  const supabase = createAdminClient();
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const { error } = await supabase.from("poll_responses").insert({
    poll_id: input.pollId,
    session_id: input.sessionId,
    word_submitted: null,
    option_selected: option,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You have already voted in this poll." };
    }
    return { error: error.message };
  }

  return { ok: true };
}
