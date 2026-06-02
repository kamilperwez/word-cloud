const FONT = '"Segoe UI", system-ui, sans-serif';

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(
  text: string,
  fontSize: number,
  fontWeight: number,
  fontFamily: string,
): number {
  if (typeof document === "undefined") return text.length * fontSize * 0.52;
  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return text.length * fontSize * 0.52;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

export type TailDir = "bottom" | "top" | "left" | "right";

export interface BubbleMetrics {
  bubbleW: number;
  bubbleH: number;
  tailSize: number;
  tailDir: TailDir;
  displayText: string;
  fontSize: number;
  totalW: number;
  totalH: number;
}

const TAILS: TailDir[] = ["bottom", "right", "top", "left"];

export function tailForIndex(index: number, text: string): TailDir {
  const hash = [...text].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return TAILS[(index + hash) % TAILS.length];
}

export function computeBubbleMetrics(
  text: string,
  fontSize: number,
  fontWeight: number,
  rankIndex: number,
): BubbleMetrics {
  const raw = text ?? "";
  const prominent = rankIndex <= 2 || fontWeight >= 700;
  const displayText = prominent && raw.length <= 14 ? raw.toUpperCase() : raw;

  const textW = measureTextWidth(displayText, fontSize, fontWeight, FONT);
  const padX = Math.max(14, fontSize * 0.5);
  const padY = Math.max(10, fontSize * 0.38);
  const tailSize = Math.max(8, fontSize * 0.32);
  const bubbleW = textW + padX * 2;
  const bubbleH = fontSize * 1.2 + padY * 2;
  const tailDir = tailForIndex(rankIndex, raw);

  let totalW = bubbleW;
  let totalH = bubbleH;
  if (tailDir === "left" || tailDir === "right") totalW += tailSize;
  else totalH += tailSize;

  return {
    bubbleW,
    bubbleH,
    tailSize,
    tailDir,
    displayText,
    fontSize,
    totalW,
    totalH,
  };
}

/** SVG path for a speech bubble centered at 0,0 (body + tail). */
export function speechBubblePath(
  bubbleW: number,
  bubbleH: number,
  tailSize: number,
  tailDir: TailDir,
): string {
  const hw = bubbleW / 2;
  const hh = bubbleH / 2;
  const r = Math.min(18, hw * 0.35, hh * 0.4);

  switch (tailDir) {
    case "bottom": {
      const tipY = hh + tailSize;
      const spread = Math.min(hw * 0.22, 14);
      return [
        `M ${-hw + r} ${-hh}`,
        `L ${hw - r} ${-hh}`,
        `Q ${hw} ${-hh} ${hw} ${-hh + r}`,
        `L ${hw} ${hh - r}`,
        `Q ${hw} ${hh} ${hw - r} ${hh}`,
        `L ${spread} ${hh}`,
        `L 0 ${tipY}`,
        `L ${-spread} ${hh}`,
        `L ${-hw + r} ${hh}`,
        `Q ${-hw} ${hh} ${-hw} ${hh - r}`,
        `L ${-hw} ${-hh + r}`,
        `Q ${-hw} ${-hh} ${-hw + r} ${-hh}`,
        "Z",
      ].join(" ");
    }
    case "top": {
      const tipY = -hh - tailSize;
      const spread = Math.min(hw * 0.22, 14);
      return [
        `M ${-hw + r} ${-hh}`,
        `L ${-spread} ${-hh}`,
        `L 0 ${tipY}`,
        `L ${spread} ${-hh}`,
        `L ${hw - r} ${-hh}`,
        `Q ${hw} ${-hh} ${hw} ${-hh + r}`,
        `L ${hw} ${hh - r}`,
        `Q ${hw} ${hh} ${hw - r} ${hh}`,
        `L ${-hw + r} ${hh}`,
        `Q ${-hw} ${hh} ${-hw} ${hh - r}`,
        `L ${-hw} ${-hh + r}`,
        `Q ${-hw} ${-hh} ${-hw + r} ${-hh}`,
        "Z",
      ].join(" ");
    }
    case "right": {
      const tipX = hw + tailSize;
      const spread = Math.min(hh * 0.22, 12);
      return [
        `M ${-hw + r} ${-hh}`,
        `L ${hw - r} ${-hh}`,
        `Q ${hw} ${-hh} ${hw} ${-hh + r}`,
        `L ${hw} ${-spread}`,
        `L ${tipX} 0`,
        `L ${hw} ${spread}`,
        `L ${hw} ${hh - r}`,
        `Q ${hw} ${hh} ${hw - r} ${hh}`,
        `L ${-hw + r} ${hh}`,
        `Q ${-hw} ${hh} ${-hw} ${hh - r}`,
        `L ${-hw} ${-hh + r}`,
        `Q ${-hw} ${-hh} ${-hw + r} ${-hh}`,
        "Z",
      ].join(" ");
    }
    case "left": {
      const tipX = -hw - tailSize;
      const spread = Math.min(hh * 0.22, 12);
      return [
        `M ${-hw + r} ${-hh}`,
        `L ${hw - r} ${-hh}`,
        `Q ${hw} ${-hh} ${hw} ${-hh + r}`,
        `L ${hw} ${hh - r}`,
        `Q ${hw} ${hh} ${hw - r} ${hh}`,
        `L ${-hw + r} ${hh}`,
        `Q ${-hw} ${hh} ${-hw} ${spread}`,
        `L ${tipX} 0`,
        `L ${-hw} ${-spread}`,
        `L ${-hw} ${-hh + r}`,
        `Q ${-hw} ${-hh} ${-hw + r} ${-hh}`,
        "Z",
      ].join(" ");
    }
  }
}

export function bubbleBoundsFromMetrics(
  x: number,
  y: number,
  metrics: BubbleMetrics,
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: x - metrics.totalW / 2,
    right: x + metrics.totalW / 2,
    top: y - metrics.totalH / 2,
    bottom: y + metrics.totalH / 2,
  };
}
