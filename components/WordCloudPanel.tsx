"use client";

import { Cloud, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { gradientForIndex, WordCloud } from "@/components/WordCloud";

interface CloudWord {
  text: string;
  value: number;
  count?: number;
}

interface WordCloudPanelProps {
  words: CloudWord[];
  isDark: boolean;
  heightMode?: "normal" | "fullscreen";
  className?: string;
  isAdmin?: boolean;
  onDeleteWord?: (word: string) => void;
}

export function WordCloudPanel({
  words,
  isDark,
  heightMode = "normal",
  className = "",
  isAdmin = false,
  onDeleteWord,
}: WordCloudPanelProps) {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...words].sort(
        (a, b) => b.value - a.value || a.text.localeCompare(b.text),
      ),
    [words],
  );

  const totalVotes = useMemo(
    () => words.reduce((sum, w) => sum + (w.count ?? 0), 0),
    [words],
  );

  const isFullscreen = heightMode === "fullscreen";

  return (
    <section
      className={`relative overflow-hidden rounded-2xl ${
        isFullscreen ? "flex min-h-0 flex-1 flex-col" : ""
      } ${className}`}
      aria-label="Word cloud results"
    >
      {/* Ambient stage background */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDark
            ? "bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(99,102,241,0.35),transparent_55%),radial-gradient(ellipse_90%_70%_at_100%_100%,rgba(236,72,153,0.2),transparent_50%),radial-gradient(ellipse_80%_60%_at_0%_80%,rgba(34,211,238,0.18),transparent_50%),linear-gradient(165deg,#0c0a1a_0%,#050508_45%,#0a0612_100%)]"
            : "bg-[radial-gradient(ellipse_100%_70%_at_50%_-10%,rgba(199,210,254,0.9),transparent_50%),radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(253,186,116,0.35),transparent_45%),linear-gradient(180deg,#faf8ff_0%,#f1f5f9_100%)]"
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-0 opacity-[0.35] ${
          isDark
            ? "[background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px]"
            : "[background-image:radial-gradient(rgba(99,102,241,0.12)_1px,transparent_1px)] [background-size:20px_20px]"
        }`}
      />
      <div
        className={`pointer-events-none absolute -left-20 top-1/4 h-56 w-56 rounded-full blur-3xl ${
          isDark ? "bg-cyan-500/20" : "bg-indigo-300/40"
        }`}
      />
      <div
        className={`pointer-events-none absolute -right-16 bottom-1/4 h-48 w-48 rounded-full blur-3xl ${
          isDark ? "bg-fuchsia-500/25" : "bg-amber-200/50"
        }`}
      />

      <div
        className={`relative flex flex-col ${
          isFullscreen ? "min-h-0 flex-1 p-4 md:p-6" : "p-4 sm:p-5"
        }`}
      >
        {!isFullscreen && (
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isDark
                    ? "bg-white/10 text-cyan-300"
                    : "bg-indigo-100 text-indigo-600"
                }`}
              >
                <Cloud className="h-4 w-4" />
              </span>
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-widest ${
                    isDark ? "text-cyan-200/80" : "text-indigo-600"
                  }`}
                >
                  Live word cloud
                </p>
                <p
                  className={`text-sm ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {words.length} unique · {totalVotes} votes
                </p>
              </div>
            </div>
          </header>
        )}

        <div
          className={`relative flex min-h-0 flex-col overflow-hidden rounded-xl border backdrop-blur-sm ${
            isDark
              ? "border-white/10 bg-slate-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "border-slate-200/90 bg-[#eef1f6] shadow-[inset_0_2px_12px_rgba(255,255,255,0.8)]"
          } ${isFullscreen ? "min-h-0 flex-1" : "min-h-[280px] sm:min-h-[360px]"}`}
        >
          {words.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                  isDark
                    ? "bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 text-cyan-300"
                    : "bg-indigo-100 text-indigo-500"
                }`}
              >
                <Sparkles className="h-8 w-8" />
              </div>
              <div>
                <p
                  className={`text-lg font-semibold ${
                    isDark ? "text-white" : "text-slate-800"
                  }`}
                >
                  Waiting for words
                </p>
                <p
                  className={`mt-1 max-w-xs text-sm ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Submit a word above — it will bloom here in full color as votes
                  roll in.
                </p>
              </div>
            </div>
          ) : (
            <WordCloud
              words={words}
              isDark={isDark}
              heightMode={heightMode}
              hoveredWord={hoveredWord}
              onHoverWord={setHoveredWord}
              className="min-h-0 flex-1"
            />
          )}
        </div>

        {sorted.length > 0 && !isFullscreen && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Word list">
            {sorted.map((word, index) => {
              const active = hoveredWord === word.text;
              const grad = gradientForIndex(index, isDark);

              return (
                <li key={word.text}>
                  <div
                    role="button"
                    tabIndex={0}
                    onMouseEnter={() => setHoveredWord(word.text)}
                    onMouseLeave={() => setHoveredWord(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setHoveredWord(word.text);
                    }}
                    className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? isDark
                          ? "border-white/30 bg-white/15 text-white shadow-lg"
                          : "border-indigo-300 bg-indigo-50 text-indigo-900 shadow-md"
                        : isDark
                          ? "border-white/10 bg-black/30 text-slate-200 hover:border-white/20 hover:bg-white/10"
                          : "border-slate-200/80 bg-white/70 text-slate-700 hover:border-indigo-200 hover:bg-white"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: `linear-gradient(180deg, ${grad[0]}, ${grad[1]})`,
                      }}
                    />
                    <span>{word.text}</span>
                    <span
                      className={
                        isDark ? "text-slate-500" : "text-slate-400"
                      }
                    >
                      {word.count ?? 0}
                    </span>
                    {isAdmin && onDeleteWord && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWord(word.text);
                        }}
                        className="ml-0.5 rounded p-0.5 opacity-60 transition hover:bg-red-500/20 hover:text-red-400 hover:opacity-100"
                        aria-label={`Delete ${word.text}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
