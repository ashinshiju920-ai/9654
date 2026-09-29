import type { Question, QuizSize } from "./types";

export const quizSizes = [20, 50, 100] as const satisfies readonly QuizSize[];

export function selectQuestionsForAttempt(questions: Question[], size: QuizSize): Question[] {
  if (questions.length < size) {
    throw new Error(`Cannot create a ${size}-question quiz from ${questions.length} questions.`);
  }

  return shuffle(questions).slice(0, size);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}
