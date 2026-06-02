"use client";

import { easeBackOut, easeCubicOut } from "d3-ease";
import { select } from "d3-selection";
import "d3-transition";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { speechBubblePath } from "@/lib/word-cloud-bubbles";
import {
  computeResponsiveCloudHeight,
  layoutBloomCloud,
  type LayoutWord,
} from "@/lib/word-cloud-layout";

/** Bubble fill pairs [top/lighter, bottom/richer] — same neon variety as before. */
export const WORD_GRADIENTS: [string, string][] = [
  ["#5eead4", "#0d9488"],
  ["#f9a8d4", "#db2777"],
  ["#bef264", "#65a30d"],
  ["#c4b5fd", "#7c3aed"],
  ["#fde047", "#ea580c"],
  ["#67e8f9", "#0284c7"],
  ["#fda4af", "#e11d48"],
  ["#a5b4fc", "#4f46e5"],
  ["#fcd34d", "#d97706"],
  ["#6ee7b7", "#059669"],
  ["#f0abfc", "#c026d3"],
  ["#7dd3fc", "#2563eb"],
  ["#fdba74", "#c2410c"],
  ["#86efac", "#16a34a"],
  ["#e9d5ff", "#9333ea"],
  ["#99f6e4", "#0f766e"],
  ["#fecaca", "#dc2626"],
  ["#bfdbfe", "#1d4ed8"],
  ["#fef08a", "#ca8a04"],
  ["#a7f3d0", "#047857"],
];

const LIGHT_GRADIENTS: [string, string][] = [
  ["#2dd4bf", "#0f766e"],
  ["#f472b6", "#be185d"],
  ["#a3e635", "#4d7c0f"],
  ["#a78bfa", "#6d28d9"],
  ["#fb923c", "#c2410c"],
  ["#38bdf8", "#0369a1"],
];

interface CloudWordInput {
  text: string;
  value: number;
  count?: number;
}

interface CloudProps {
  words: CloudWordInput[];
  width: number;
  height: number;
  isDark?: boolean;
  hoveredWord: string | null;
  onHoverWord: (text: string | null) => void;
}

export function WordCloudCanvas({
  words,
  width,
  height,
  isDark = true,
  hoveredWord,
  onHoverWord,
}: CloudProps) {
  const uid = useId().replace(/:/g, "");
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  const maxValue = useMemo(
    () => words.reduce((acc, item) => Math.max(acc, item.value), 1),
    [words],
  );

  const minValue = useMemo(
    () =>
      words.reduce(
        (acc, item) => Math.min(acc, item.value),
        Number.MAX_SAFE_INTEGER,
      ),
    [words],
  );

  const sizeRange = useMemo(() => {
    const short = Math.min(width, height);
    const n = Math.max(words.length, 1);
    const maxSize = Math.min(
      Math.floor(short * 0.22),
      n <= 4
        ? Math.floor(short * 0.2)
        : n <= 10
          ? Math.floor(short * 0.16)
          : n <= 18
            ? Math.floor(short * 0.13)
            : Math.floor(short * 0.11),
    );
    const minSize = Math.max(
      11,
      Math.floor(maxSize * (n <= 5 ? 0.52 : n <= 12 ? 0.42 : 0.36)),
    );
    return { maxSize, minSize, n };
  }, [width, height, words.length]);

  const fontSizeForWord = useCallback(
    (word: LayoutWord) => {
      const raw = word.value || 1;
      const norm =
        maxValue === minValue ? 1 : (raw - minValue) / (maxValue - minValue);
      const exp = sizeRange.n <= 6 ? 0.68 : 0.52;
      const t = Math.pow(Math.max(0, norm), exp);
      return Math.round(sizeRange.minSize + t * (sizeRange.maxSize - sizeRange.minSize));
    },
    [maxValue, minValue, sizeRange],
  );

  const weightForWord = useCallback(
    (word: LayoutWord) => {
      const raw = word.value || 1;
      const norm =
        maxValue === minValue ? 1 : (raw - minValue) / (maxValue - minValue);
      if (norm >= 0.65) return 800;
      if (norm >= 0.35) return 700;
      return 600;
    },
    [maxValue, minValue],
  );

  const wordsSignature = useMemo(
    () => words.map((w) => `${w.text}:${w.value}`).join("|"),
    [words],
  );

  const palette = isDark ? WORD_GRADIENTS : LIGHT_GRADIENTS;

  useEffect(() => {
    const host = svgHostRef.current;
    if (!host || words.length === 0 || width < 1 || height < 1) return;

    const root = select(host);
    root.selectAll("*").remove();

    const placed = layoutBloomCloud(
      words,
      width,
      height,
      fontSizeForWord,
      weightForWord,
    );

    const drawOrder = [...placed].sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );

    const svg = root
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img")
      .attr("aria-label", "Word cloud");

    const defs = svg.append("defs");

    drawOrder.forEach((word, index) => {
      const colorIdx = word.colorIndex ?? index;
      const [top, bottom] = palette[colorIdx % palette.length];

      const grad = defs
        .append("linearGradient")
        .attr("id", `${uid}-bg-${index}`)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", top);
      grad.append("stop").attr("offset", "100%").attr("stop-color", bottom);

      const shadow = defs
        .append("filter")
        .attr("id", `${uid}-sh-${index}`)
        .attr("x", "-30%")
        .attr("y", "-30%")
        .attr("width", "160%")
        .attr("height", "160%");
      shadow
        .append("feDropShadow")
        .attr("dx", 0)
        .attr("dy", 3)
        .attr("stdDeviation", 4)
        .attr("flood-color", isDark ? "#000000" : "#64748b")
        .attr("flood-opacity", isDark ? 0.45 : 0.28);
    });

    const group = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const bubbles = group
      .selectAll("g.word-bubble")
      .data(drawOrder)
      .enter()
      .append("g")
      .attr("class", "word-bubble")
      .attr("opacity", 0)
      .attr("transform", (word) => {
        const s = 0.5;
        return `translate(${word.x ?? 0},${word.y ?? 0}) scale(${s})`;
      })
      .style("cursor", "pointer")
      .on("mouseenter", function (_, word) {
        onHoverWord(word.text ?? null);
        select(this).raise();
      })
      .on("mouseleave", () => onHoverWord(null));

    bubbles
      .append("path")
      .attr("d", (word) => {
        const b = word.bubble!;
        return speechBubblePath(b.bubbleW, b.bubbleH, b.tailSize, b.tailDir);
      })
      .attr("fill", (_, index) => `url(#${uid}-bg-${index})`)
      .attr("filter", (_, index) => `url(#${uid}-sh-${index})`)
      .attr("stroke", isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.65)")
      .attr("stroke-width", 1.2);

    bubbles
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#ffffff")
      .attr("font-family", '"Segoe UI", system-ui, sans-serif')
      .attr("font-weight", (word) => weightForWord(word))
      .attr("font-size", (word) => word.bubble?.fontSize ?? 14)
      .attr(
        "style",
        "paint-order: stroke; stroke: rgba(0,0,0,0.15); stroke-width: 0.5px;",
      )
      .text((word) => word.bubble?.displayText ?? word.text ?? "");

    bubbles
      .transition()
      .duration(isDark ? 550 : 380)
      .delay((_, i) => i * 40)
      .ease(isDark ? easeBackOut : easeCubicOut)
      .attr("opacity", 1)
      .attr("transform", (word) => `translate(${word.x ?? 0},${word.y ?? 0}) scale(1)`);

    setLayoutTick((t) => t + 1);

    return () => {
      root.selectAll("*").remove();
    };
  }, [
    wordsSignature,
    width,
    height,
    isDark,
    fontSizeForWord,
    weightForWord,
    words,
    uid,
    onHoverWord,
    palette,
  ]);

  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;

    select(host)
      .selectAll<SVGGElement, LayoutWord>("g.word-bubble")
      .transition()
      .duration(200)
      .ease(easeCubicOut)
      .attr("opacity", (word) => {
        if (!hoveredWord) return 1;
        return hoveredWord === word.text ? 1 : 0.35;
      })
      .attr("transform", (word) => {
        const scale = hoveredWord === word.text ? 1.08 : 1;
        return `translate(${word.x ?? 0},${word.y ?? 0}) scale(${scale})`;
      });
  }, [hoveredWord, layoutTick]);

  return <div ref={svgHostRef} className="relative h-full w-full" />;
}

interface WordCloudProps {
  words: CloudWordInput[];
  className?: string;
  heightMode?: "normal" | "fullscreen";
  isDark?: boolean;
  hoveredWord?: string | null;
  onHoverWord?: (text: string | null) => void;
}

export function WordCloud({
  words,
  className = "",
  heightMode = "normal",
  isDark = true,
  hoveredWord: externalHovered,
  onHoverWord: externalOnHover,
}: WordCloudProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [internalHovered, setInternalHovered] = useState<string | null>(null);

  const hoveredWord = externalHovered ?? internalHovered;
  const onHoverWord = externalOnHover ?? setInternalHovered;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height: ch } = entries[0].contentRect;
      const w = Math.max(260, Math.floor(width));
      const h = computeResponsiveCloudHeight(
        w,
        words.length,
        heightMode,
        Math.floor(ch),
      );
      setDimensions({ width: w, height: h });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [heightMode, words.length]);

  const heightClass =
    heightMode === "fullscreen"
      ? "min-h-0 h-full flex-1"
      : "min-h-[min(75vw,340px)] w-full flex-1 sm:min-h-[380px]";

  return (
    <div
      ref={containerRef}
      className={`relative ${heightClass} ${className}`}
      style={
        heightMode === "fullscreen"
          ? { height: "100%" }
          : { minHeight: dimensions.height }
      }
    >
      {words.length > 0 ? (
        <WordCloudCanvas
          words={words}
          width={dimensions.width}
          height={dimensions.height}
          isDark={isDark}
          hoveredWord={hoveredWord}
          onHoverWord={onHoverWord}
        />
      ) : null}
    </div>
  );
}

export function gradientForIndex(
  index: number,
  isDark: boolean,
): [string, string] {
  const palette = isDark ? WORD_GRADIENTS : LIGHT_GRADIENTS;
  return palette[index % palette.length];
}
