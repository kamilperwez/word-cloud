"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { buildPollQuestions } from "@/lib/aggregate";
import { debounce } from "@/lib/debounce";
import { getOrCreateSessionId } from "@/lib/session";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DbPoll, DbPollResponse, PollQuestion } from "@/lib/types/polls";

const POLL_COLUMNS = "id, question_text, type, choice_options, created_at";
const RESPONSE_COLUMNS = "poll_id, session_id, word_submitted, option_selected";
const REALTIME_REFRESH_MS = 400;

const MISSING_ENV_MESSAGE =
  "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local";

interface PollDataState {
  questions: PollQuestion[];
  sessionVotedPollIds: Set<string>;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markSessionVoted: (pollId: string) => void;
}

export function usePollData(): PollDataState {
  const configured = isSupabaseConfigured();
  const [questions, setQuestions] = useState<PollQuestion[]>([]);
  const [sessionVotedPollIds, setSessionVotedPollIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(configured);
  const [error, setError] = useState<string | null>(configured ? null : MISSING_ENV_MESSAGE);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const markSessionVoted = useCallback((pollId: string) => {
    setSessionVotedPollIds((prev) => {
      if (prev.has(pollId)) return prev;
      const next = new Set(prev);
      next.add(pollId);
      return next;
    });
  }, []);

  const loadPollData = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      setError("Supabase environment variables are missing.");
      return;
    }

    const sessionId = getOrCreateSessionId();

    const [
      { data: polls, error: pollsError },
      { data: responses, error: responsesError },
      { data: sessionVotes, error: sessionVotesError },
    ] = await Promise.all([
      supabase.from("polls").select(POLL_COLUMNS).order("created_at", { ascending: false }),
      supabase.from("poll_responses").select(RESPONSE_COLUMNS),
      supabase.from("poll_responses").select("poll_id").eq("session_id", sessionId),
    ]);

    if (pollsError || responsesError || sessionVotesError) {
      setError(
        pollsError?.message ??
          responsesError?.message ??
          sessionVotesError?.message ??
          "Failed to load polls.",
      );
      setIsLoading(false);
      return;
    }

    const typedPolls = (polls ?? []) as DbPoll[];
    const typedResponses = (responses ?? []) as DbPollResponse[];
    const voted = new Set((sessionVotes ?? []).map((row) => row.poll_id as string));

    setQuestions(buildPollQuestions(typedPolls, typedResponses));
    setSessionVotedPollIds(voted);
    setError(null);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const run = loadPollData().finally(() => {
      refreshInFlight.current = null;
    });
    refreshInFlight.current = run;
    return run;
  }, [loadPollData]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!configured) return;

    void refresh();

    const supabase = createClient();
    if (!supabase) return;

    const scheduleRealtimeRefresh = debounce(() => {
      void refreshRef.current();
    }, REALTIME_REFRESH_MS);

    const channel = supabase
      .channel("poll-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "polls" },
        () => {
          scheduleRealtimeRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_responses" },
        () => {
          scheduleRealtimeRefresh();
        },
      )
      .subscribe();

    return () => {
      scheduleRealtimeRefresh.cancel();
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
    markSessionVoted,
  };
}
