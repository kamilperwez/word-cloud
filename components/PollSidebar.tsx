"use client";

import { Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type PollType = "wordcloud" | "multiple-choice";

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface PollQuestion {
  id: string;
  question: string;
  type: PollType;
  words?: { text: string; value: number }[];
  options?: PollOption[];
}

interface PollSidebarProps {
  questions: PollQuestion[];
  activeQuestionId: string;
  isAdmin: boolean;
  isDark: boolean;
  onSelectQuestion: (id: string) => void;
  onCreateQuestion: (question: string, type: PollType, optionTexts: string[]) => void;
  onDeleteQuestion: (id: string) => void;
}

export function PollSidebar({
  questions,
  activeQuestionId,
  isAdmin,
  isDark,
  onSelectQuestion,
  onCreateQuestion,
  onDeleteQuestion,
}: PollSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftType, setDraftType] = useState<PollType>("wordcloud");
  const [draftOptions, setDraftOptions] = useState("Option A, Option B");
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeQuestionId, questions.length]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draftQuestion.trim();
    if (!trimmed) return;

    const options = draftOptions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (draftType === "multiple-choice" && options.length < 2) return;

    onCreateQuestion(trimmed, draftType, options);
    setDraftQuestion("");
    setDraftType("wordcloud");
    setDraftOptions("Option A, Option B");
    setIsCreating(false);
  };

  return (
    <aside
      className={`flex w-full flex-col rounded-2xl p-4 backdrop-blur lg:max-h-[calc(100vh-5rem)] ${
        isDark
          ? "border border-white/10 bg-slate-900/70"
          : "border border-slate-300 bg-white shadow-sm"
      }`}
    >
      <h2
        className={`mb-3 shrink-0 text-sm font-semibold uppercase tracking-wide ${
          isDark ? "text-slate-300" : "text-slate-600"
        }`}
      >
        Poll Questions
      </h2>

      <div className={`mb-3 shrink-0 ${isDark ? "border-white/10" : "border-slate-200"}`}>
        {!isAdmin && (
          <p className={`mb-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Admin mode is required to create or delete polls.
          </p>
        )}
        {!isCreating ? (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={!isAdmin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 px-3 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Question
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              value={draftQuestion}
              onChange={(event) => setDraftQuestion(event.target.value)}
              placeholder="Ask a new poll question..."
              autoFocus
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ring-cyan-400/60 transition focus:ring-2 ${
                isDark
                  ? "border-white/10 bg-slate-950/70 text-slate-100"
                  : "border-slate-300 bg-slate-50 text-slate-900"
              }`}
            />
            <select
              value={draftType}
              onChange={(event) => setDraftType(event.target.value as PollType)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ring-cyan-400/60 transition focus:ring-2 ${
                isDark
                  ? "border-white/10 bg-slate-950/70 text-slate-100"
                  : "border-slate-300 bg-slate-50 text-slate-900"
              }`}
            >
              <option value="wordcloud">Word Cloud</option>
              <option value="multiple-choice">Multiple Choice</option>
            </select>
            {draftType === "multiple-choice" && (
              <input
                value={draftOptions}
                onChange={(event) => setDraftOptions(event.target.value)}
                placeholder="Comma-separated options (2-4)"
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ring-cyan-400/60 transition focus:ring-2 ${
                  isDark
                    ? "border-white/10 bg-slate-950/70 text-slate-100"
                    : "border-slate-300 bg-slate-50 text-slate-900"
                }`}
              />
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setDraftQuestion("");
                }}
                className={`rounded-lg border px-3 py-2 transition ${
                  isDark
                    ? "border-white/15 text-slate-300 hover:bg-white/10"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
                aria-label="Cancel new question"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="min-h-0 max-h-[min(50vh,420px)] space-y-2 overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
        {questions.map((item) => {
          const isActive = item.id === activeQuestionId;
          return (
            <button
              key={item.id}
              ref={isActive ? activeItemRef : undefined}
              type="button"
              onClick={() => onSelectQuestion(item.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                isActive
                  ? isDark
                    ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200"
                    : "border-indigo-400 bg-indigo-50 text-indigo-900"
                  : isDark
                    ? "border-white/10 bg-slate-950/40 text-slate-200 hover:border-fuchsia-400/50 hover:bg-fuchsia-500/10"
                    : "border-slate-300 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 font-medium">{item.question}</p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteQuestion(item.id);
                    }}
                    className={`rounded p-1 transition ${
                      isDark
                        ? "text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                        : "text-slate-500 hover:bg-red-100 hover:text-red-700"
                    }`}
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  {item.type === "wordcloud"
                    ? `${item.words?.length ?? 0} words`
                    : `${item.options?.length ?? 0} options`}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    item.type === "wordcloud"
                      ? "bg-fuchsia-500/20 text-fuchsia-200"
                      : "bg-cyan-500/20 text-cyan-200"
                  }`}
                >
                  {item.type === "wordcloud" ? "Word Cloud" : "Multiple Choice"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
