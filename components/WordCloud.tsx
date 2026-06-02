"use client";

import cloud from "d3-cloud";
import { easeCubicOut } from "d3-ease";
import { select } from "d3-selection";
import "d3-transition";
import { useEffect, useMemo, useRef, useState } from "react";

const PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#fb7185",
  "#f59e0b",
  "#34d399",
  "#60a5fa",
  "#f472b6",
  "#facc15",
  "#4ade80",
  "#38bdf8",
];

const MIN_SIZE = 18;
const MAX_SIZE = 96;

interface CloudWordInput {
  text: string;
  value: number;
  count?: number;
}

interface CloudProps {
  words: CloudWordInput[];
  className?: string;
  heightMode?: "normal" | "fullscreen";
  isDark?: boolean;
}

interface LayoutWord {
  text: string;
  value: number;
  size?: number;
  x?: number;
  y?: number;
  rotate?: number;
}

export function WordCloud({
  words,
  className = "",
  heightMode = "normal",
  isDark = true,
}: CloudProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 520 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height =
        heightMode === "fullscreen"
          ? Math.max(420, Math.floor(window.innerHeight * 0.85))
          : width < 640
            ? 320
            : 520;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [heightMode]);

  const maxValue = useMemo(
    () => words.reduce((acc, item) => Math.max(acc, item.value), 1),
    [words],
  );

  const minValue = useMemo(
    () => words.reduce((acc, item) => Math.min(acc, item.value), Number.MAX_SAFE_INTEGER),
    [words],
  );

  const computeFontSize = (word: LayoutWord, emphasize = false) => {
    const rawValue = word.value || 1;
    const normalized =
      maxValue === minValue ? 1 : (rawValue - minValue) / (maxValue - minValue);
    const boosted = Math.pow(Math.max(0, normalized), 0.65);
    const baseSize = Math.round(MIN_SIZE + boosted * (MAX_SIZE - MIN_SIZE));
    const target = emphasize ? Math.round(baseSize * 1.16) : baseSize;
    return target;
  };

  const computeColor = (word: LayoutWord, index: number) => {
    const hash = [...word.text].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const base = PALETTE[(hash + index) % PALETTE.length];
    if (!hovered || hovered === word.text) return base;
    return `${base}88`;
  };

  const computeRotate = (word: LayoutWord) => {
    const hash = [...word.text].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const base = hash % 3;
    if (base === 0) return 0;
    return base === 1 ? -20 : 20;
  };

  const wordsSignature = useMemo(
    () => words.map((w) => `${w.text}:${w.value}`).join("|"),
    [words],
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root || words.length === 0) return;

    const { width, height } = dimensions;
    const selection = select(root);
    selection.selectAll("*").remove();

    const layoutWords: LayoutWord[] = words.map((word) => ({ ...word }));

    const layout = cloud<LayoutWord>()
      .size([width, height])
      .words(layoutWords)
      .padding((word) => {
        const normalized =
          maxValue === minValue ? 1 : (word.value - minValue) / (maxValue - minValue);
        return normalized > 0.7 ? 5 : 3;
      })
      .rotate((word) => computeRotate(word))
      .font("Inter, system-ui, sans-serif")
      .fontSize((word) => computeFontSize(word))
      .random(() => 0.5)
      .on("end", (placedWords) => {
        const svg = selection
          .append("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("viewBox", `0 0 ${width} ${height}`)
          .attr("role", "img")
          .attr("aria-label", "Word cloud visualization");

        const group = svg
          .append("g")
          .attr("transform", `translate(${width / 2},${height / 2})`);

        const texts = group
          .selectAll("text")
          .data(placedWords)
          .enter()
          .append("text")
          .attr("data-word", (word) => word.text ?? "")
          .text((word) => word.text ?? "")
          .attr("text-anchor", "middle")
          .attr("opacity", 0)
          .attr(
            "transform",
            (word) =>
              `translate(${word.x ?? 0},${word.y ?? 0}) rotate(${word.rotate ?? 0}) scale(0.85)`,
          )
          .style("font-family", "Inter, system-ui, sans-serif")
          .style("font-size", (word) => `${word.size ?? MIN_SIZE}px`)
          .style("font-weight", "500")
          .style("font-style", "normal")
          .style("fill", (word, index) => computeColor(word, index))
          .style("cursor", "pointer")
          .style(
            "transition",
            "opacity 300ms ease, transform 300ms ease, fill 300ms ease, font-size 500ms ease",
          )
          .on("mouseenter", (_, word) => {
            setHovered(word.text ?? null);
          })
          .on("mouseleave", () => {
            setHovered(null);
          });

        texts
          .transition()
          .duration(500)
          .ease(easeCubicOut)
          .attr("opacity", 1)
          .attr(
            "transform",
            (word) => `translate(${word.x ?? 0},${word.y ?? 0}) rotate(${word.rotate ?? 0}) scale(1)`,
          );

        setLayoutTick((tick) => tick + 1);
      });

    layout.start();

    return () => {
      selection.selectAll("*").remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout on data/size only
  }, [wordsSignature, dimensions, maxValue, minValue]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    select(root)
      .selectAll<SVGTextElement, LayoutWord>("text")
      .transition()
      .duration(300)
      .ease(easeCubicOut)
      .style("font-weight", (word) => (hovered === word.text ? "700" : "500"))
      .style("font-style", (word) => (hovered === word.text ? "italic" : "normal"))
      .style("fill", (word, index) => computeColor(word, index))
      .style("font-size", (word) => {
        const emphasize = hovered === word.text;
        const size = computeFontSize(word, emphasize);
        return `${size}px`;
      });
  }, [hovered, layoutTick, maxValue, minValue]);

  return (
    <div
      ref={containerRef}
      className={`min-h-[320px] w-full overflow-hidden rounded-2xl p-2 transition-all duration-500 md:min-h-[520px] md:p-4 [&_text]:ease-out ${
        isDark ? "border border-white/10 bg-black/30" : "border border-slate-300 bg-slate-50"
      } ${className}`}
      style={
        {
          ["--cloud-transition" as string]:
            "opacity 300ms ease, transform 300ms ease, fill 300ms ease, font-size 500ms ease",
        } as React.CSSProperties
      }
    />
  );
}
