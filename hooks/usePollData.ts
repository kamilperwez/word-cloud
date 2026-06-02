"use client";

import { useCallback, useEffect, useState } from "react";

import { buildPollQuestions, getVotedPollIdsForSession } from "@/lib/aggregate";
import { getOrCreateSessionId } from "@/lib/session";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DbPoll, DbPollResponse, PollQuestion } from "@/lib/types/polls";

interface PollDataState {
  questions: PollQuestion[];
  sessionVotedPollIds: Set<string>;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePollData(): PollDataState {
  const [questions, setQuestions] = useState<PollQuestion[]>([]);
  const [sessionVotedPollIds, setSessionVotedPollIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      setError("Supabase environment variables are missing.");
      return;
    }

    const sessionId = getOrCreateSessionId();

    const [{ data: polls, error: pollsError }, { data: responses, error: responsesError }] =
      await Promise.all([
        supabase.from("polls").select("*").order("created_at", { ascending: true }),
        supabase.from("poll_responses").select("*"),
      ]);

    if (pollsError || responsesError) {
      setError(pollsError?.message ?? responsesError?.message ?? "Failed to load polls.");
      setIsLoading(false);
      return;
    }

    const typedPolls = (polls ?? []) as DbPoll[];
    const typedResponses = (responses ?? []) as DbPollResponse[];

    setQuestions(buildPollQuestions(typedPolls, typedResponses));
    setSessionVotedPollIds(getVotedPollIdsForSession(typedResponses, sessionId));
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      setError("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");
      return;
    }

    void refresh();

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel("poll-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "polls" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_responses" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [configured, refresh]);

  return {
    questions,
    sessionVotedPollIds,
    isLoading,
    isConfigured: configured,
    error,
    refresh,
  };
}
