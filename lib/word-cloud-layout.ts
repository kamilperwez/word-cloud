import {
  bubbleBoundsFromMetrics,
  computeBubbleMetrics,
  type BubbleMetrics,
} from "@/lib/word-cloud-bubbles";

export interface LayoutWord {
  text: string;
  value: number;
  count?: number;
  size?: number;
  x?: number;
  y?: number;
  rotate?: number;
  fontFamily?: string;
  colorIndex?: number;
  bubble?: BubbleMetrics;
  zIndex?: number;
}

const FONT_DISPLAY = '"Segoe UI", system-ui, sans-serif';

function bubbleBox(
  word: LayoutWord,
  fontWeight: (w: LayoutWord) => number,
  rankIndex: number,
) {
  if (!word.bubble) {
    word.bubble = computeBubbleMetrics(
      word.text ?? "",
      word.size ?? 16,
      fontWeight(word),
      rankIndex,
    );
  }
  return bubbleBoundsFromMetrics(word.x ?? 0, word.y ?? 0, word.bubble);
}

function cloudBounds(
  words: LayoutWord[],
  fontWeight: (w: LayoutWord) => number,
) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;

  words.forEach((word, index) => {
    const box = bubbleBox(word, fontWeight, index);
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
    top = Math.min(top, box.top);
    bottom = Math.max(bottom, box.bottom);
  });

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
  };
}

type Bounds = { left: number; right: number; top: number; bottom: number };

function getOverlap(
  boxA: Bounds,
  boxB: Bounds,
  gap: number,
): { overlapX: number; overlapY: number } | null {
  const overlapX =
    Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left) + gap;
  const overlapY =
    Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top) + gap;
  if (overlapX <= 0 || overlapY <= 0) return null;
  return { overlapX, overlapY };
}

/** Push overlapping bubbles apart; positive gap = padding between bubbles. */
function separateOverlaps(
  words: LayoutWord[],
  fontWeight: (w: LayoutWord) => number,
  gap = 4,
) {
  const mobility = (rank: number) => (rank === 0 ? 0.25 : 0.5);

  for (let pass = 0; pass < 160; pass += 1) {
    let moved = false;

    for (let i = 0; i < words.length; i += 1) {
      for (let j = i + 1; j < words.length; j += 1) {
        const a = words[i];
        const b = words[j];
        const boxA = bubbleBox(a, fontWeight, i);
        const boxB = bubbleBox(b, fontWeight, j);
        const overlap = getOverlap(boxA, boxB, gap);
        if (!overlap) continue;

        const cxA = (boxA.left + boxA.right) / 2;
        const cyA = (boxA.top + boxA.bottom) / 2;
        const cxB = (boxB.left + boxB.right) / 2;
        const cyB = (boxB.top + boxB.bottom) / 2;

        const moveA = mobility(i);
        const moveB = mobility(j);
        const totalMove = moveA + moveB;

        if (overlap.overlapX <= overlap.overlapY) {
          const dir = cxB >= cxA ? 1 : -1;
          const shift = overlap.overlapX / 2;
          a.x = (a.x ?? 0) - dir * shift * (moveA / totalMove);
          b.x = (b.x ?? 0) + dir * shift * (moveB / totalMove);
        } else {
          const dir = cyB >= cyA ? 1 : -1;
          const shift = overlap.overlapY / 2;
          a.y = (a.y ?? 0) - dir * shift * (moveA / totalMove);
          b.y = (b.y ?? 0) + dir * shift * (moveB / totalMove);
        }

        a.bubble = undefined;
        b.bubble = undefined;
        moved = true;
      }
    }

    if (!moved) break;
  }
}

function computeSpiralSpread(
  placed: LayoutWord[],
  viewportWidth: number,
  viewportHeight: number,
): number {
  const n = placed.length;
  const shortSide = Math.min(viewportWidth, viewportHeight);

  let sumDiameter = 0;
  for (const word of placed) {
    const bubble = word.bubble!;
    sumDiameter += Math.max(bubble.totalW, bubble.totalH);
  }
  const avgDiameter = sumDiameter / n;
  const density = n <= 4 ? 0.72 : n <= 10 ? 0.82 : n <= 18 ? 0.9 : 0.96;

  return Math.max(shortSide * 0.26, avgDiameter * Math.sqrt(n) * density);
}

/** Pull the cluster inward while keeping the minimum gap between bubbles. */
function compactCloud(
  words: LayoutWord[],
  fontWeight: (w: LayoutWord) => number,
  gap: number,
) {
  for (let pass = 0; pass < 32; pass += 1) {
    let moved = false;
    for (const word of words) {
      const x = word.x ?? 0;
      const y = word.y ?? 0;
      const dist = Math.hypot(x, y);
      if (dist < 4) continue;
      word.x = x * 0.96;
      word.y = y * 0.96;
      word.bubble = undefined;
      moved = true;
    }
    if (!moved) break;
    separateOverlaps(words, fontWeight, gap);
  }
}

export function fitCloudInsideViewport(
  words: LayoutWord[],
  viewportWidth: number,
  viewportHeight: number,
  fontWeight: (w: LayoutWord) => number,
  margin = 24,
) {
  if (words.length === 0) return;

  const maxW = viewportWidth - margin * 2;
  const maxH = viewportHeight - margin * 2;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    words.forEach((word, index) => {
      word.bubble = computeBubbleMetrics(
        word.text ?? "",
        word.size ?? 16,
        fontWeight(word),
        index,
      );
    });

    const bounds = cloudBounds(words, fontWeight);
    const scale = Math.min(maxW / bounds.width, maxH / bounds.height, 1);

    if (scale >= 0.992) {
      for (const word of words) {
        word.x = (word.x ?? 0) - bounds.cx;
        word.y = (word.y ?? 0) - bounds.cy;
        word.bubble = undefined;
      }
      return;
    }

    for (const word of words) {
      word.x = ((word.x ?? 0) - bounds.cx) * scale;
      word.y = ((word.y ?? 0) - bounds.cy) * scale;
      if (word.size) word.size = Math.max(11, Math.round(word.size * scale));
      word.bubble = undefined;
    }
  }
}

/** Golden-angle cluster with speech-bubble sizing — all words placed. */
export function layoutBloomCloud(
  words: { text: string; value: number; count?: number }[],
  viewportWidth: number,
  viewportHeight: number,
  fontSizeForWord: (word: LayoutWord) => number,
  fontWeight: (word: LayoutWord) => number,
): LayoutWord[] {
  const sorted = [...words]
    .map((word, colorIndex) => ({ ...word, colorIndex }))
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text));

  const n = sorted.length;
  if (n === 0) return [];

  const placed: LayoutWord[] = sorted.map((word, index) => ({
    ...word,
    fontFamily: FONT_DISPLAY,
    rotate: 0,
    size: 0,
    x: 0,
    y: 0,
    zIndex: index,
  }));

  for (const word of placed) {
    word.size = fontSizeForWord(word);
    word.bubble = computeBubbleMetrics(
      word.text ?? "",
      word.size ?? 16,
      fontWeight(word),
      word.zIndex ?? 0,
    );
  }

  if (n === 1) {
    fitCloudInsideViewport(placed, viewportWidth, viewportHeight, fontWeight);
    placed[0].bubble = computeBubbleMetrics(
      placed[0].text ?? "",
      placed[0].size ?? 16,
      fontWeight(placed[0]),
      0,
    );
    return placed;
  }

  const spread = computeSpiralSpread(placed, viewportWidth, viewportHeight);
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const layoutGap = 4;

  placed[0].x = 0;
  placed[0].y = 0;

  for (let i = 1; i < n; i += 1) {
    const word = placed[i];
    const t = i + 0.5;
    const angle = t * GOLDEN - Math.PI / 2;
    const radius = spread * Math.sqrt(t / n);
    word.x = Math.cos(angle) * radius;
    word.y = Math.sin(angle) * radius * 0.92;
  }

  separateOverlaps(placed, fontWeight, layoutGap);
  fitCloudInsideViewport(placed, viewportWidth, viewportHeight, fontWeight);
  separateOverlaps(placed, fontWeight, layoutGap);
  compactCloud(placed, fontWeight, layoutGap);

  const bounds = cloudBounds(placed, fontWeight);
  for (const word of placed) {
    word.x = (word.x ?? 0) - bounds.cx;
    word.y = (word.y ?? 0) - bounds.cy;
    word.bubble = undefined;
  }

  placed.forEach((word, index) => {
    word.zIndex = index;
    word.bubble = computeBubbleMetrics(
      word.text ?? "",
      word.size ?? 16,
      fontWeight(word),
      index,
    );
  });

  return placed;
}

export function computeResponsiveCloudHeight(
  width: number,
  wordCount: number,
  heightMode: "normal" | "fullscreen",
  containerHeight: number,
): number {
  if (heightMode === "fullscreen") {
    return Math.max(340, Math.floor(window.innerHeight * 0.75));
  }

  if (containerHeight >= 220) {
    return Math.floor(containerHeight);
  }

  const byWidth =
    width < 400 ? width * 0.95 : width < 640 ? width * 0.8 : width * 0.65;
  const byWords = 300 + Math.min(wordCount, 35) * 6;
  return Math.floor(Math.max(300, Math.min(byWidth, byWords, 540)));
}
