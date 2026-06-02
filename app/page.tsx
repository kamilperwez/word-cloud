"use client";

import { Lock, Maximize2, Moon, SendHorizonal, Sun, Trash2, Unlock, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createPollAction,
  deletePollAction,
  deleteWordResponsesAction,
} from "@/app/actions/polls";
import { submitChoiceVote, submitWordVote } from "@/lib/submit-vote";
import { PollSidebar } from "@/components/PollSidebar";
import { WordCloudPanel } from "@/components/WordCloudPanel";
import { usePollData } from "@/hooks/usePollData";
import { getOrCreateSessionId } from "@/lib/session";
import type { PollType } from "@/lib/types/polls";

const THEME_KEY = "teams-polls-theme-v1";
const ADMIN_PASSWORD = "kamilsuyash";
const VOTED_MESSAGE = "You have already voted in this poll.";

export default function Home() {
  const {
    questions,
    sessionVotedPollIds,
    isLoading,
    isConfigured,
    error: loadError,
    refresh,
  } = usePollData();

  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [wordInput, setWordInput] = useState("");
  const [adminInput, setAdminInput] = useState("");
  const [adminPasscode, setAdminPasscode] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [voteNotice, setVoteNotice] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "light") setIsDarkTheme(false);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(THEME_KEY, isDarkTheme ? "dark" : "light");
  }, [isDarkTheme, isHydrated]);

  useEffect(() => {
    if (!questions.length) return;
    if (!activeQuestionId || !questions.some((q) => q.id === activeQuestionId)) {
      setActiveQuestionId(questions[0]?.id ?? "");
    }
  }, [activeQuestionId, questions]);

  const activeQuestion = useMemo(
    () => questions.find((question) => question.id === activeQuestionId) ?? questions[0],
    [activeQuestionId, questions],
  );

  const hasSessionVoted = activeQuestion
    ? sessionVotedPollIds.has(activeQuestion.id)
    : false;

  const showVotedNotice = hasSessionVoted || voteNotice === VOTED_MESSAGE;

  const handleAddWord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeQuestion || activeQuestion.type !== "wordcloud") return;
    if (hasSessionVoted) {
      setVoteNotice(VOTED_MESSAGE);
      return;
    }

    const result = await submitWordVote(
      activeQuestion.id,
      wordInput,
      getOrCreateSessionId(),
    );

    if (result.error) {
      setVoteNotice(
        result.error === "You have already voted in this poll."
          ? VOTED_MESSAGE
          : result.error,
      );
      return;
    }

    setVoteNotice(null);
    setWordInput("");
    await refresh();
  };

  const handleCreateQuestion = async (
    questionText: string,
    type: PollType,
    optionTexts: string[],
  ) => {
    if (!isAdmin || !adminPasscode) return;

    const result = await createPollAction({
      adminPasscode,
      question: questionText,
      type,
      optionTexts,
    });

    if (result.error) {
      setVoteNotice(result.error);
      return;
    }

    if (result.pollId) setActiveQuestionId(result.pollId);
    await refresh();
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!isAdmin || !adminPasscode) return;

    const result = await deletePollAction({ adminPasscode, pollId: id });
    if (result.error) {
      setVoteNotice(result.error);
      return;
    }
    await refresh();
  };

  const handleDeleteWord = async (word: string) => {
    if (!isAdmin || !adminPasscode || !activeQuestion || activeQuestion.type !== "wordcloud") {
      return;
    }

    const result = await deleteWordResponsesAction({
      adminPasscode,
      pollId: activeQuestion.id,
      word,
    });

    if (result.error) {
      setVoteNotice(result.error);
      return;
    }
    await refresh();
  };

  const handleVoteOption = async (optionId: string) => {
    if (!activeQuestion || activeQuestion.type !== "multiple-choice") return;
    if (hasSessionVoted) {
      setVoteNotice(VOTED_MESSAGE);
      return;
    }

    const option = activeQuestion.options.find((item) => item.id === optionId);
    if (!option) return;

    const result = await submitChoiceVote(
      activeQuestion.id,
      option.text,
      getOrCreateSessionId(),
    );

    if (result.error) {
      setVoteNotice(
        result.error === "You have already voted in this poll."
          ? VOTED_MESSAGE
          : result.error,
      );
      return;
    }

    setSelectedOptions((prev) => ({ ...prev, [activeQuestion.id]: optionId }));
    setVoteNotice(null);
    await refresh();
  };

  const totalVotes =
    activeQuestion?.type === "multiple-choice"
      ? activeQuestion.options.reduce((acc, option) => acc + option.votes, 0)
      : 0;

  if (!isHydrated || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Loading polls...
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen px-4 py-6 md:px-6 ${
        isDarkTheme
          ? "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100"
          : "bg-slate-100 text-slate-900"
      }`}
    >
      {!isConfigured && (
        <div className="mx-auto mb-4 max-w-7xl rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Supabase is not configured. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code>, add your keys, run <code>supabase/schema.sql</code>, then
          restart the dev server.
        </div>
      )}

      {loadError && isConfigured && (
        <div className="mx-auto mb-4 max-w-7xl rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {loadError}
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div
            className={`rounded-2xl p-4 ${
              isDarkTheme
                ? "border border-white/10 bg-slate-900/70"
                : "border border-slate-300 bg-white shadow-sm"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                className={`text-sm font-semibold uppercase tracking-wide ${
                  isDarkTheme ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Admin Mode
              </h2>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  <Unlock className="h-3.5 w-3.5" /> Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                  <Lock className="h-3.5 w-3.5" /> Locked
                </span>
              )}
            </div>
            {!isAdmin ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (adminInput === ADMIN_PASSWORD) {
                    setIsAdmin(true);
                    setAdminPasscode(adminInput);
                    setAdminInput("");
                  }
                }}
                className="space-y-2"
              >
                <input
                  type="password"
                  value={adminInput}
                  onChange={(event) => setAdminInput(event.target.value)}
                  placeholder="Enter admin passcode"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-400/60 transition focus:ring-2 ${
                    isDarkTheme
                      ? "border-white/10 bg-slate-950/70 text-slate-100"
                      : "border-slate-300 bg-slate-50 text-slate-900"
                  }`}
                />
                <button
                  type="submit"
                  className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isDarkTheme
                      ? "bg-slate-100 text-slate-900 hover:bg-white"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                >
                  Unlock Admin Controls
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAdmin(false);
                  setAdminPasscode("");
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  isDarkTheme
                    ? "border-white/15 text-slate-200 hover:bg-white/10"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Lock Admin Mode
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsDarkTheme((prev) => !prev)}
              className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                isDarkTheme
                  ? "border-white/15 text-slate-200 hover:bg-white/10"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Switch to {isDarkTheme ? "Light" : "Dark"} Theme
            </button>
          </div>

          <PollSidebar
            questions={questions}
            activeQuestionId={activeQuestionId}
            isAdmin={isAdmin}
            isDark={isDarkTheme}
            onSelectQuestion={setActiveQuestionId}
            onCreateQuestion={handleCreateQuestion}
            onDeleteQuestion={handleDeleteQuestion}
          />
        </div>

        <section
          className={`rounded-2xl p-4 md:p-6 ${
            isDarkTheme
              ? "border border-white/10 bg-slate-900/70"
              : "border border-slate-300 bg-white shadow-sm"
          }`}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p
                className={`text-xs uppercase tracking-wide ${
                  isDarkTheme ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Active Poll
              </p>
              <h1 className="mt-1 text-xl font-semibold md:text-2xl">
                {activeQuestion?.question ?? "No polls yet"}
              </h1>
            </div>

            <button
              type="button"
              disabled={!activeQuestion}
              onClick={() => setIsFullscreen(true)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isDarkTheme
                  ? "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Maximize2 className="h-4 w-4" />
              Maximize To Screen
            </button>
          </div>

          {showVotedNotice && (
            <p
              className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
                isDarkTheme
                  ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              {VOTED_MESSAGE}
            </p>
          )}

          {voteNotice && voteNotice !== VOTED_MESSAGE && (
            <p className="mb-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {voteNotice}
            </p>
          )}

          {activeQuestion?.type === "wordcloud" && (
            <>
              <form
                onSubmit={handleAddWord}
                className="mb-4 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  value={wordInput}
                  onChange={(event) => setWordInput(event.target.value)}
                  disabled={hasSessionVoted}
                  placeholder="Submit a word..."
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ring-indigo-400/60 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDarkTheme
                      ? "border-white/10 bg-slate-950/70 text-slate-100"
                      : "border-slate-300 bg-slate-50 text-slate-900"
                  }`}
                />
                <button
                  type="submit"
                  disabled={hasSessionVoted}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
                >
                  <SendHorizonal className="h-4 w-4" />
                  Submit Word
                </button>
              </form>

              <WordCloudPanel
                words={activeQuestion.words}
                isDark={isDarkTheme}
                isAdmin={isAdmin}
                onDeleteWord={(word) => void handleDeleteWord(word)}
              />
            </>
          )}

          {activeQuestion?.type === "multiple-choice" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {activeQuestion.options.map((option) => {
                  const selected = selectedOptions[activeQuestion.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={hasSessionVoted}
                      onClick={() => void handleVoteOption(option.id)}
                      className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        selected
                          ? isDarkTheme
                            ? "border-indigo-400 bg-indigo-500/20"
                            : "border-indigo-400 bg-indigo-50"
                          : isDarkTheme
                            ? "border-white/10 bg-slate-950/50 hover:border-white/20"
                            : "border-slate-300 bg-slate-50 hover:border-slate-400"
                      }`}
                    >
                      <p className="font-medium">{option.text}</p>
                    </button>
                  );
                })}
              </div>

              <div
                className={`space-y-3 rounded-xl border p-4 ${
                  isDarkTheme
                    ? "border-white/10 bg-slate-950/40"
                    : "border-slate-300 bg-slate-50"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    isDarkTheme ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  Results ({totalVotes} votes)
                </p>
                {activeQuestion.options.map((option) => {
                  const percent =
                    totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                  return (
                    <div key={option.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{option.text}</span>
                        <span className="text-slate-500">{percent}%</span>
                      </div>
                      <div
                        className={`h-2 rounded-full ${
                          isDarkTheme ? "bg-slate-700" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {isFullscreen && activeQuestion && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 p-4 text-white md:p-8">
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-800/90 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
            Exit Fullscreen
          </button>

          <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col justify-center gap-4 pt-10">
            <h2 className="shrink-0 text-center text-lg font-semibold sm:text-xl md:text-3xl">
              {activeQuestion.question}
            </h2>
            {activeQuestion.type === "wordcloud" ? (
              <WordCloudPanel
                words={activeQuestion.words}
                className="min-h-0 w-full flex-1"
                heightMode="fullscreen"
                isDark
              />
            ) : (
              <div className="mx-auto w-full max-w-4xl space-y-4 rounded-2xl border border-white/20 bg-slate-800/60 p-6">
                {activeQuestion.options.map((option) => {
                  const overlayTotal = activeQuestion.options.reduce(
                    (acc, item) => acc + item.votes,
                    0,
                  );
                  const percent =
                    overlayTotal > 0 ? Math.round((option.votes / overlayTotal) * 100) : 0;
                  return (
                    <div key={option.id} className="space-y-2">
                      <div className="flex justify-between">
                        <span>{option.text}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="h-4 rounded-full bg-slate-700">
                        <div
                          className="h-4 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
