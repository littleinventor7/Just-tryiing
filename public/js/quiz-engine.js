import { regenerateQuiz } from "./api.js";
import { appState, persist, updateReview, checkAndUpdateStreak, notifyStateChange, currentLesson, addXp } from "./state-manager.js";

export let quizSession = null;
let timerHandle = null;

// Callbacks to notify UI of quiz updates
let onQuizStart = null;
let onQuizQuestion = null;
let onQuizAnswer = null;
let onQuizFinish = null;
let onTimerTick = null;

export function registerQuizCallbacks(callbacks) {
  if (callbacks.onStart) onQuizStart = callbacks.onStart;
  if (callbacks.onQuestion) onQuizQuestion = callbacks.onQuestion;
  if (callbacks.onAnswer) onQuizAnswer = callbacks.onAnswer;
  if (callbacks.onFinish) onQuizFinish = callbacks.onFinish;
  if (callbacks.onTimerTick) onTimerTick = callbacks.onTimerTick;
}

export async function startQuiz(mode, options = {}) {
  const lesson = currentLesson();
  if (!lesson) {
    throw new Error("Please select or create a lesson first.");
  }

  await ensureQuestions(options.quizFocus || "mixed");

  const pool =
    mode === "mistakes"
      ? lesson.questions.filter(question => appState.state.mistakes.has(question.termId))
      : lesson.questions;

  if (!pool.length) {
    throw new Error(mode === "mistakes" ? "No mistakes to retry yet." : "Generate a study set before starting.");
  }

  quizSession = {
    questions: shuffle(pool),
    current: 0,
    answers: [],
    startedAt: Date.now(),
    streak: 0,
    bestStreak: 0,
    answered: false
  };

  if (onQuizStart) onQuizStart();
  startTimer();
  if (onQuizQuestion) onQuizQuestion();
}

export function startMixedQuiz(lessonIds, mode, options = {}) {
  if (!lessonIds || !lessonIds.length) {
    throw new Error("Select at least one lesson or unit.");
  }

  // Find all selected lessons in the hierarchy
  const selectedLessons = [];
  appState.state.languages.forEach(l => {
    l.units.forEach(u => {
      u.lessons.forEach(ls => {
        if (lessonIds.includes(ls.id)) {
          selectedLessons.push(ls);
        }
      });
    });
  });

  // Collect questions from these lessons
  let pool = selectedLessons.flatMap(ls => ls.questions || []);

  if (mode === "mistakes") {
    pool = pool.filter(question => appState.state.mistakes.has(question.termId));
  }

  if (!pool.length) {
    throw new Error(mode === "mistakes" ? "No mistakes in selected lessons to retry." : "Selected lessons have no questions generated yet.");
  }

  quizSession = {
    questions: shuffle(pool),
    current: 0,
    answers: [],
    startedAt: Date.now(),
    streak: 0,
    bestStreak: 0,
    answered: false,
    isMixed: true,
    lessonIds: lessonIds
  };

  if (onQuizStart) onQuizStart();
  startTimer();
  if (onQuizQuestion) onQuizQuestion();
}

export function getCurrentQuestion() {
  if (!quizSession) return null;
  return quizSession.questions[quizSession.current] || null;
}

export function answerQuestion(choiceIndex) {
  if (!quizSession || quizSession.answered) return null;
  const question = getCurrentQuestion();
  if (!question) return null;

  const isCorrect = choiceIndex === question.answerIndex;
  quizSession.answered = true;

  quizSession.answers.push({
    questionId: question.id,
    termId: question.termId,
    correct: isCorrect,
    selected: choiceIndex
  });

  if (isCorrect) {
    quizSession.streak += 1;
    quizSession.bestStreak = Math.max(quizSession.bestStreak, quizSession.streak);
    appState.state.mistakes.delete(question.termId);
    addXp(10, "quiz_correct");
  } else {
    quizSession.streak = 0;
    appState.state.mistakes.add(question.termId);
  }

  updateReview(question.termId, isCorrect);
  checkAndUpdateStreak(true);
  persist();

  if (onQuizAnswer) {
    onQuizAnswer(choiceIndex, isCorrect, question);
  }
  notifyStateChange();
}

export function advanceQuestion() {
  if (!quizSession) return;
  quizSession.current += 1;
  quizSession.answered = false;

  if (quizSession.current >= quizSession.questions.length) {
    finishQuiz();
    return;
  }

  if (onQuizQuestion) onQuizQuestion();
}

export function finishQuiz() {
  stopTimer();
  const total = quizSession.answers.length;
  const correct = quizSession.answers.filter(answer => answer.correct).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;

  appState.state.quizHistory.unshift({
    id: `quiz-${Date.now()}`,
    date: new Date().toISOString(),
    correct,
    total,
    percent,
    streak: quizSession.bestStreak
  });
  appState.state.quizHistory = appState.state.quizHistory.slice(0, 10);
  
  // Award 50 XP for completing a lesson's quiz
  addXp(50, "quiz_complete");
  
  persist();

  if (onQuizFinish) {
    onQuizFinish(percent, correct, total);
  }
  quizSession = null;
  notifyStateChange();
}

export function startTimer() {
  stopTimer();
  if (!appState.state.settings.timerMode) return;

  timerHandle = window.setInterval(() => {
    if (!quizSession) return;
    const elapsed = Math.floor((Date.now() - quizSession.startedAt) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    if (onTimerTick) {
      onTimerTick(`${minutes}:${seconds}`);
    }
  }, 500);
}

export function stopTimer() {
  if (timerHandle) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
}

async function ensureQuestions(quizFocus) {
  const lesson = currentLesson();
  if (!lesson) return;
  if (lesson.questions.length || !lesson.terms.length) return;
  const quiz = await regenerateQuiz(lesson.terms, 2, quizFocus);
  lesson.questions = quiz.questions;
  persist();
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
