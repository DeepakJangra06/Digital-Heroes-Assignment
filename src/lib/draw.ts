import { DrawLogic, type Score } from "@prisma/client";

function randomUniqueNumbers(count: number, min: number, max: number) {
  const values = new Set<number>();
  while (values.size < count) {
    values.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  return [...values].sort((a, b) => a - b);
}

export function createWinningNumbers(logicType: DrawLogic, scores: Score[]) {
  if (logicType === DrawLogic.RANDOM || scores.length === 0) {
    return randomUniqueNumbers(5, 1, 45);
  }

  const freq = new Map<number, number>();
  for (const score of scores) {
    freq.set(score.value, (freq.get(score.value) ?? 0) + 1);
  }

  const weighted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const selected = new Set<number>(weighted.slice(0, 5));

  if (selected.size < 5) {
    for (const value of randomUniqueNumbers(20, 1, 45)) {
      selected.add(value);
      if (selected.size === 5) break;
    }
  }

  return [...selected].sort((a, b) => a - b);
}

export function getMatchCount(userScores: number[], drawNumbers: number[]) {
  const set = new Set(drawNumbers);
  return userScores.filter((score) => set.has(score)).length;
}
