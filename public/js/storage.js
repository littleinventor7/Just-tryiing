const STORAGE_KEY = "smart-flashcards-state-v1";

export function loadState(username) {
  try {
    const key = username ? `smart-flashcards-state-user-${username}` : STORAGE_KEY;
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    const state = {
      languages: Array.isArray(stored.languages) ? stored.languages : [],
      learned: Array.isArray(stored.learned) ? stored.learned : [],
      mistakes: Array.isArray(stored.mistakes) ? stored.mistakes : [],
      quizHistory: Array.isArray(stored.quizHistory) ? stored.quizHistory : [],
      activeIndex: Number.isInteger(stored.activeIndex) ? stored.activeIndex : 0,
      settings: {
        theme: stored.settings?.theme || "light",
        timerMode: Boolean(stored.settings?.timerMode),
        dailyGoal: Number(stored.settings?.dailyGoal || 12),
        srsStartingEase: Number(stored.settings?.srsStartingEase ?? 2.4),
        srsGoodBonus: Number(stored.settings?.srsGoodBonus ?? 0.08),
        srsEasyBonus: Number(stored.settings?.srsEasyBonus ?? 0.15),
        srsEasyMultiplier: Number(stored.settings?.srsEasyMultiplier ?? 2.0),
        srsAgainPenalty: Number(stored.settings?.srsAgainPenalty ?? 0.22),
        srsAgainIntervalHours: Number(stored.settings?.srsAgainIntervalHours ?? 20),
        srsLeechThreshold: Number(stored.settings?.srsLeechThreshold ?? 5),
        engineMode: stored.settings?.engineMode || "ai",
        apiBaseUrl: stored.settings?.apiBaseUrl || "https://ai.hackclub.com/proxy/v1",
        apiModel: stored.settings?.apiModel || "openai/gpt-5.5",
        totalXP: Number.isInteger(stored.settings?.totalXP) ? stored.settings.totalXP : 0,
        hideStats: Boolean(stored.settings?.hideStats),
        hideExplorer: Boolean(stored.settings?.hideExplorer),
        hideHistory: Boolean(stored.settings?.hideHistory)
      },
      currentNavigation: stored.currentNavigation || {
        languageId: null,
        unitId: null,
        lessonId: null
      },
      streakCount: Number.isInteger(stored.streakCount) ? stored.streakCount : 0,
      lastStudyDate: typeof stored.lastStudyDate === "string" ? stored.lastStudyDate : null,
      badges: Array.isArray(stored.badges) ? stored.badges : []
    };

    // Auto-migrate legacy flat database if terms exist
    const legacyTerms = Array.isArray(stored.terms) ? stored.terms : [];
    if (legacyTerms.length > 0 && state.languages.length === 0) {
      const legacyQuestions = Array.isArray(stored.questions) ? stored.questions : [];
      const legacySourceName = stored.sourceName || "General Lesson";

      const defaultLesson = {
        id: "lesson_general",
        name: legacySourceName,
        terms: legacyTerms,
        questions: legacyQuestions
      };

      const defaultUnit = {
        id: "unit_general",
        name: "General Unit",
        lessons: [defaultLesson]
      };

      const defaultLanguage = {
        id: "lang_general",
        name: "General Language",
        units: [defaultUnit]
      };

      state.languages.push(defaultLanguage);
      state.currentNavigation = {
        languageId: "lang_general",
        unitId: "unit_general",
        lessonId: "lesson_general"
      };
    }

    return state;
  } catch {
    return createEmptyState();
  }
}

export function saveState(state, username) {
  const payload = {
    languages: state.languages,
    learned: [...state.learned],
    mistakes: [...state.mistakes],
    quizHistory: state.quizHistory,
    activeIndex: state.activeIndex,
    settings: state.settings,
    currentNavigation: state.currentNavigation,
    streakCount: state.streakCount || 0,
    lastStudyDate: state.lastStudyDate || null,
    badges: state.badges || []
  };
  const key = username ? `smart-flashcards-state-user-${username}` : STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(payload));
}

export function createEmptyState() {
  return {
    languages: [],
    learned: [],
    mistakes: [],
    quizHistory: [],
    activeIndex: 0,
    settings: {
      theme: "light",
      timerMode: false,
      dailyGoal: 12,
      srsStartingEase: 2.4,
      srsGoodBonus: 0.08,
      srsEasyBonus: 0.15,
      srsEasyMultiplier: 2.0,
      srsAgainPenalty: 0.22,
      srsAgainIntervalHours: 20,
      srsLeechThreshold: 5,
      engineMode: "ai",
      apiBaseUrl: "https://ai.hackclub.com/proxy/v1",
      apiModel: "openai/gpt-5.5",
      totalXP: 0
    },
    currentNavigation: {
      languageId: null,
      unitId: null,
      lessonId: null
    },
    streakCount: 0,
    lastStudyDate: null,
    badges: []
  };
}

export function normalizeLoadedSets(state) {
  state.learned = new Set(state.learned || []);
  state.mistakes = new Set(state.mistakes || []);
  return state;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
