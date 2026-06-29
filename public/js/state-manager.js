import { loadState, normalizeLoadedSets, saveState } from "./storage.js";

export const appState = {
  state: normalizeLoadedSets(loadState()),
  manualRows: createEmptyManualRows(),
  selectedFileText: "",
  selectedFileMedia: null,
  selectedFileName: "",
  blueprintFiles: [],
  cardFlipped: false,
  isMixedStudyMode: false,
  mixedTerms: null,
  currentUser: null
};

let updateCallback = null;

export function onStateChange(callback) {
  updateCallback = callback;
}

export function notifyStateChange() {
  if (updateCallback) {
    updateCallback();
  }
}

export function persist() {
  if (appState.currentUser) {
    saveState(appState.state, appState.currentUser);
    // Create a copy of the state with Sets serialized to arrays
    const serializableState = {
      ...appState.state,
      learned: [...appState.state.learned],
      mistakes: [...appState.state.mistakes]
    };
    // Background sync to server
    fetch("/api/save-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: appState.currentUser, state: serializableState })
    }).catch(err => console.error("Failed to backup state to server:", err));
  } else {
    saveState(appState.state);
  }
}

export function createEmptyManualRows() {
  return [
    { target: "", english: "", arabic: "" },
    { target: "", english: "", arabic: "" },
    { target: "", english: "", arabic: "" }
  ];
}

// Hierarchical Navigation & Resolution
export function currentLesson() {
  const nav = appState.state.currentNavigation;
  if (!nav || !nav.languageId || !nav.unitId || !nav.lessonId) return null;

  const lang = appState.state.languages.find(l => l.id === nav.languageId);
  if (!lang) return null;

  const unit = lang.units.find(u => u.id === nav.unitId);
  if (!unit) return null;

  return unit.lessons.find(ls => ls.id === nav.lessonId) || null;
}

export function currentTerm() {
  if (appState.isMixedStudyMode && appState.mixedTerms) {
    return appState.mixedTerms[appState.state.activeIndex] || null;
  }
  const lesson = currentLesson();
  if (!lesson || !lesson.terms) return null;
  return lesson.terms[appState.state.activeIndex] || null;
}

export function dueTerms() {
  const now = Date.now();
  const allTerms = (appState.state.languages || []).flatMap(l =>
    (l.units || []).flatMap(u =>
      (u.lessons || []).flatMap(ls => ls.terms || [])
    )
  );
  return allTerms.filter(term => !appState.state.learned.has(term.id) || Number(term.review?.dueAt || 0) <= now);
}

export function masteryPercent() {
  const allTerms = (appState.state.languages || []).flatMap(l =>
    (l.units || []).flatMap(u =>
      (u.lessons || []).flatMap(ls => ls.terms || [])
    )
  );
  if (!allTerms.length) return 0;
  return Math.round((appState.state.learned.size / allTerms.length) * 100);
}

export function latestStreak() {
  return appState.state.quizHistory[0]?.streak || 0;
}

export function countDifficulty() {
  const allTerms = (appState.state.languages || []).flatMap(l =>
    (l.units || []).flatMap(u =>
      (u.lessons || []).flatMap(ls => ls.terms || [])
    )
  );
  return allTerms.reduce(
    (summary, term) => {
      summary[term.difficulty] = (summary[term.difficulty] || 0) + 1;
      return summary;
    },
    { basic: 0, intermediate: 0, advanced: 0 }
  );
}

export function countDifficultyForTerms(terms) {
  return terms.reduce(
    (summary, term) => {
      summary[term.difficulty] = (summary[term.difficulty] || 0) + 1;
      return summary;
    },
    { basic: 0, intermediate: 0, advanced: 0 }
  );
}

export function toggleLearned() {
  const term = currentTerm();
  if (!term) return;

  if (appState.state.learned.has(term.id)) {
    appState.state.learned.delete(term.id);
    if (term.review) {
      term.review.intervalDays = 1;
      term.review.dueAt = Date.now();
    }
  } else {
    appState.state.learned.add(term.id);
    if (term.review) {
      term.review.intervalDays = 1;
      term.review.dueAt = Date.now() + 1 * 24 * 60 * 60 * 1000; // 1 day out
    }
  }
  const newlyUnlocked = checkBadges();
  persist();
  notifyStateChange();
  if (newlyUnlocked.length > 0) {
    window.dispatchEvent(new CustomEvent("xp-gained", {
      detail: {
        amount: 0,
        reason: "badge_unlocked",
        totalXP: appState.state.settings.totalXP || 0,
        level: Math.floor((appState.state.settings.totalXP || 0) / 500) + 1,
        levelUp: false,
        newlyUnlocked
      }
    }));
  }
}

export function deleteCurrentTerm() {
  const term = currentTerm();
  if (term) {
    deleteTerm(term.id);
  }
}

export function deleteTerm(termId) {
  let found = false;
  for (const lang of appState.state.languages) {
    for (const unit of lang.units) {
      for (const lesson of unit.lessons) {
        const index = lesson.terms.findIndex(item => item.id === termId);
        if (index !== -1) {
          lesson.terms.splice(index, 1);
          lesson.questions = lesson.questions.filter(q => q.termId !== termId);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) break;
  }

  appState.state.learned.delete(termId);
  appState.state.mistakes.delete(termId);

  if (appState.isMixedStudyMode && appState.mixedTerms) {
    appState.mixedTerms = appState.mixedTerms.filter(t => t.id !== termId);
    if (appState.state.activeIndex >= appState.mixedTerms.length) {
      appState.state.activeIndex = Math.max(0, appState.mixedTerms.length - 1);
    }
  } else {
    const lesson = currentLesson();
    if (lesson && appState.state.activeIndex >= (lesson.terms?.length || 0)) {
      appState.state.activeIndex = Math.max(0, (lesson.terms?.length || 0) - 1);
    }
  }

  persist();
  notifyStateChange();
}

export function deleteQuestion(questionId) {
  let found = false;
  for (const lang of appState.state.languages) {
    for (const unit of lang.units) {
      for (const lesson of unit.lessons) {
        const index = (lesson.questions || []).findIndex(q => q.id === questionId);
        if (index !== -1) {
          lesson.questions.splice(index, 1);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) break;
  }
  persist();
  notifyStateChange();
}

export function deleteAllWords() {
  appState.state.languages.forEach(l => {
    l.units.forEach(u => {
      u.lessons.forEach(ls => {
        ls.terms = [];
        ls.questions = [];
      });
    });
  });
  appState.state.learned.clear();
  appState.state.mistakes.clear();
  appState.state.quizHistory = [];
  appState.state.activeIndex = 0;
  persist();
  notifyStateChange();
}

export function updateReview(termId, correct, rating = null) {
  let term = null;
  for (const lang of appState.state.languages) {
    for (const unit of lang.units) {
      for (const lesson of unit.lessons) {
        term = lesson.terms.find(item => item.id === termId);
        if (term) break;
      }
      if (term) break;
    }
    if (term) break;
  }
  if (!term) return;

  const settings = appState.state.settings || {};
  const startingEase = Number(settings.srsStartingEase ?? 2.4);
  const goodBonus = Number(settings.srsGoodBonus ?? 0.08);
  const easyBonus = Number(settings.srsEasyBonus ?? 0.15);
  const easyMultiplier = Number(settings.srsEasyMultiplier ?? 2.0);
  const againPenalty = Number(settings.srsAgainPenalty ?? 0.22);
  const againIntervalHours = Number(settings.srsAgainIntervalHours ?? 20);
  const leechThreshold = Number(settings.srsLeechThreshold ?? 5);

  const review = term.review || { intervalDays: 1, ease: startingEase, dueAt: Date.now() };
  
  // Resolve rating: if not provided, fall back to boolean correct
  const resolvedRating = rating || (correct ? "good" : "again");

  if (resolvedRating === "again") {
    review.ease = Math.max(1.3, review.ease - againPenalty);
    review.intervalDays = 1;
    review.dueAt = Date.now() + againIntervalHours * 60 * 60 * 1000;
    
    // Leech Detection
    term.mistakeCount = (term.mistakeCount || 0) + 1;
    if (term.mistakeCount >= leechThreshold) {
      term.isLeech = true;
    }
  } else if (resolvedRating === "easy") {
    review.ease = Math.min(3.1, review.ease + easyBonus);
    review.intervalDays = Math.max(2, Math.round(review.intervalDays * review.ease * easyMultiplier));
    review.dueAt = Date.now() + review.intervalDays * 24 * 60 * 60 * 1000;
    appState.state.learned.add(term.id);
  } else {
    // rating === "good" or standard correct
    review.ease = Math.min(3.1, review.ease + goodBonus);
    review.intervalDays = Math.max(1, Math.round(review.intervalDays * review.ease));
    review.dueAt = Date.now() + review.intervalDays * 24 * 60 * 60 * 1000;
    appState.state.learned.add(term.id);
  }

  term.review = review;
  
  // Flashcard study updates streak
  checkAndUpdateStreak(true);
  
  const newlyUnlocked = checkBadges();
  persist();
  if (newlyUnlocked.length > 0) {
    window.dispatchEvent(new CustomEvent("xp-gained", {
      detail: {
        amount: 0,
        reason: "badge_unlocked",
        totalXP: appState.state.settings.totalXP || 0,
        level: Math.floor((appState.state.settings.totalXP || 0) / 500) + 1,
        levelUp: false,
        newlyUnlocked
      }
    }));
  }
}

export function resetLeechStatus(termId) {
  let term = null;
  for (const lang of appState.state.languages) {
    for (const unit of lang.units) {
      for (const lesson of unit.lessons) {
        term = lesson.terms.find(item => item.id === termId);
        if (term) break;
      }
      if (term) break;
    }
    if (term) break;
  }
  if (term) {
    term.mistakeCount = 0;
    term.isLeech = false;
    persist();
    notifyStateChange();
    return true;
  }
  return false;
}

export function updateTermSimplified(termId, simplifiedData) {
  let term = null;
  for (const lang of appState.state.languages) {
    for (const unit of lang.units) {
      for (const lesson of unit.lessons) {
        term = lesson.terms.find(item => item.id === termId);
        if (term) break;
      }
      if (term) break;
    }
    if (term) break;
  }
  if (term) {
    term.definition = simplifiedData.definition;
    term.example = simplifiedData.example;
    term.mnemonic = simplifiedData.mnemonic;
    persist();
    notifyStateChange();
    return true;
  }
  return false;
}

export function checkAndUpdateStreak(isStudyingAction = false) {
  const localToday = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  const lastDate = appState.state.lastStudyDate;

  if (!lastDate) {
    if (isStudyingAction) {
      appState.state.streakCount = 1;
      appState.state.lastStudyDate = localToday;
      persist();
      addXp(100, "daily_streak");
    }
    return;
  }

  if (lastDate === localToday) {
    return;
  }

  const lastTime = new Date(lastDate).getTime();
  const todayTime = new Date(localToday).getTime();
  const diffDays = Math.round((todayTime - lastTime) / (24 * 60 * 60 * 1000));

  if (diffDays === 1) {
    if (isStudyingAction) {
      appState.state.streakCount += 1;
      appState.state.lastStudyDate = localToday;
      persist();
      addXp(100, "daily_streak");
    }
  } else if (diffDays > 1) {
    appState.state.streakCount = isStudyingAction ? 1 : 0;
    appState.state.lastStudyDate = isStudyingAction ? localToday : null;
    persist();
    if (isStudyingAction) {
      addXp(100, "daily_streak");
    }
  }
}

export function getSrsStatusText(term) {
  if (!appState.state.learned.has(term.id)) {
    return { text: "New (Not Studied)", style: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" };
  }
  
  const now = Date.now();
  const dueAt = Number(term.review?.dueAt || 0);
  const diffMs = dueAt - now;
  
  if (diffMs <= 0) {
    return { text: "Review Due Now", style: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 animate-pulse" };
  }
  
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return { text: `Review in ${diffMinutes}m`, style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" };
  }
  
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return { text: `Review in ${diffHours}h`, style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" };
  }
  
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return { text: `Review in ${diffDays}d`, style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" };
}

// Hierarchy State Mutations
export function addLanguage(name) {
  const id = "lang_" + Date.now();
  appState.state.languages.push({
    id,
    name,
    units: []
  });
  persist();
  notifyStateChange();
  return id;
}

export function addUnit(languageId, name) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  if (!lang) return null;
  const id = "unit_" + Date.now();
  lang.units.push({
    id,
    name,
    lessons: []
  });
  persist();
  notifyStateChange();
  return id;
}

export function addLesson(languageId, unitId, name) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  if (!lang) return null;
  const unit = lang.units.find(u => u.id === unitId);
  if (!unit) return null;
  const id = "lesson_" + Date.now();
  unit.lessons.push({
    id,
    name,
    terms: [],
    questions: []
  });
  persist();
  notifyStateChange();
  return id;
}

export function deleteLanguage(languageId) {
  const index = appState.state.languages.findIndex(l => l.id === languageId);
  if (index === -1) return;
  
  const lang = appState.state.languages[index];
  lang.units.forEach(u => {
    u.lessons.forEach(ls => {
      ls.terms.forEach(t => {
        appState.state.learned.delete(t.id);
        appState.state.mistakes.delete(t.id);
      });
    });
  });

  appState.state.languages.splice(index, 1);
  
  if (appState.state.currentNavigation.languageId === languageId) {
    appState.state.currentNavigation = { languageId: null, unitId: null, lessonId: null };
    appState.state.activeIndex = 0;
  }
  persist();
  notifyStateChange();
}

export function deleteUnit(languageId, unitId) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  if (!lang) return;
  const index = lang.units.findIndex(u => u.id === unitId);
  if (index === -1) return;

  const unit = lang.units[index];
  unit.lessons.forEach(ls => {
    ls.terms.forEach(t => {
      appState.state.learned.delete(t.id);
      appState.state.mistakes.delete(t.id);
    });
  });

  lang.units.splice(index, 1);

  if (appState.state.currentNavigation.unitId === unitId) {
    appState.state.currentNavigation.unitId = null;
    appState.state.currentNavigation.lessonId = null;
    appState.state.activeIndex = 0;
  }
  persist();
  notifyStateChange();
}

export function deleteLesson(languageId, unitId, lessonId) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  if (!lang) return;
  const unit = lang.units.find(u => u.id === unitId);
  if (!unit) return;
  const index = unit.lessons.findIndex(ls => ls.id === lessonId);
  if (index === -1) return;

  const lesson = unit.lessons[index];
  lesson.terms.forEach(t => {
    appState.state.learned.delete(t.id);
    appState.state.mistakes.delete(t.id);
  });

  unit.lessons.splice(index, 1);

  if (appState.state.currentNavigation.lessonId === lessonId) {
    appState.state.currentNavigation.lessonId = null;
    appState.state.activeIndex = 0;
  }
  persist();
  notifyStateChange();
}

export function renameLanguage(languageId, newName) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  if (lang) {
    lang.name = newName;
    persist();
    notifyStateChange();
  }
}

export function renameUnit(languageId, unitId, newName) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  const unit = lang?.units.find(u => u.id === unitId);
  if (unit) {
    unit.name = newName;
    persist();
    notifyStateChange();
  }
}

export function renameLesson(languageId, unitId, lessonId, newName) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  const unit = lang?.units.find(u => u.id === unitId);
  const lesson = unit?.lessons.find(ls => ls.id === lessonId);
  if (lesson) {
    lesson.name = newName;
    persist();
    notifyStateChange();
  }
}

export function moveLesson(languageId, sourceUnitId, targetUnitId, lessonId) {
  const lang = appState.state.languages.find(l => l.id === languageId);
  if (!lang) return false;

  const sourceUnit = lang.units.find(u => u.id === sourceUnitId);
  const targetUnit = lang.units.find(u => u.id === targetUnitId);
  if (!sourceUnit || !targetUnit) return false;

  const lessonIndex = sourceUnit.lessons.findIndex(ls => ls.id === lessonId);
  if (lessonIndex === -1) return false;

  const [lesson] = sourceUnit.lessons.splice(lessonIndex, 1);
  targetUnit.lessons.push(lesson);

  // If the moved lesson was active, update navigation unitId
  if (appState.state.currentNavigation.lessonId === lessonId) {
    appState.state.currentNavigation.unitId = targetUnitId;
  }

  persist();
  notifyStateChange();
  return true;
}


export function getOrCreateFolderStructure(langName, unitName, lessonName) {
  let langId = null;
  let unitId = null;
  let lessonId = null;

  // 1. Language
  if (langName) {
    let lang = appState.state.languages.find(l => l.name.toLowerCase().trim() === langName.toLowerCase().trim());
    if (!lang) {
      langId = addLanguage(langName);
    } else {
      langId = lang.id;
    }
  } else {
    const nav = appState.state.currentNavigation;
    if (nav.languageId) {
      langId = nav.languageId;
    } else {
      let lang = appState.state.languages.find(l => l.id === "lang_general" || l.name.toLowerCase().trim() === "general language");
      if (!lang) {
        langId = addLanguage("General Language");
        const newLang = appState.state.languages.find(l => l.id === langId);
        if (newLang) newLang.id = "lang_general";
        langId = "lang_general";
        persist();
      } else {
        langId = lang.id;
      }
    }
  }

  // 2. Unit
  const langObj = appState.state.languages.find(l => l.id === langId);
  if (unitName) {
    let unit = langObj.units.find(u => u.name.toLowerCase().trim() === unitName.toLowerCase().trim());
    if (!unit) {
      unitId = addUnit(langId, unitName);
    } else {
      unitId = unit.id;
    }
  } else {
    const nav = appState.state.currentNavigation;
    if (nav.languageId === langId && nav.unitId) {
      unitId = nav.unitId;
    } else {
      let unit = langObj.units.find(u => u.id === "unit_general" || u.name.toLowerCase().trim() === "general unit");
      if (!unit) {
        unitId = addUnit(langId, "General Unit");
        const newUnit = langObj.units.find(u => u.id === unitId);
        if (newUnit) newUnit.id = "unit_general";
        unitId = "unit_general";
        persist();
      } else {
        unitId = unit.id;
      }
    }
  }

  // 3. Lesson
  const unitObj = langObj.units.find(u => u.id === unitId);
  if (lessonName) {
    let lesson = unitObj.lessons.find(ls => ls.name.toLowerCase().trim() === lessonName.toLowerCase().trim());
    if (!lesson) {
      lessonId = addLesson(langId, unitId, lessonName);
    } else {
      lessonId = lesson.id;
    }
  } else {
    const nav = appState.state.currentNavigation;
    if (nav.languageId === langId && nav.unitId === unitId && nav.lessonId) {
      lessonId = nav.lessonId;
    } else {
      const fallbackName = appState.selectedFileName || "General Lesson";
      let lesson = unitObj.lessons.find(ls => ls.id === "lesson_general" || ls.name.toLowerCase().trim() === fallbackName.toLowerCase().trim());
      if (!lesson) {
        lessonId = addLesson(langId, unitId, fallbackName);
        const newLesson = unitObj.lessons.find(ls => ls.id === lessonId);
        if (newLesson) newLesson.id = "lesson_general";
        lessonId = "lesson_general";
        persist();
      } else {
        lessonId = lesson.id;
      }
    }
  }

  appState.state.currentNavigation = {
    languageId: langId,
    unitId: unitId,
    lessonId: lessonId
  };
  persist();
  notifyStateChange();

  return unitObj.lessons.find(ls => ls.id === lessonId);
}

// --- GAMIFICATION SYSTEM ---
export function addXp(amount, reason = "activity") {
  if (!appState.state.settings) {
    appState.state.settings = {};
  }
  const oldXp = appState.state.settings.totalXP || 0;
  const newXp = oldXp + amount;
  
  const oldLevel = Math.floor(oldXp / 500) + 1;
  const newLevel = Math.floor(newXp / 500) + 1;
  
  appState.state.settings.totalXP = newXp;
  
  const levelUp = newLevel > oldLevel;
  const newlyUnlocked = checkBadges();
  
  persist();
  notifyStateChange();
  
  if (amount > 0) {
    window.dispatchEvent(new CustomEvent("xp-gained", {
      detail: {
        amount,
        reason,
        totalXP: newXp,
        level: newLevel,
        levelUp,
        newlyUnlocked
      }
    }));
  }
}

export function checkBadges() {
  if (!appState.state.badges) {
    appState.state.badges = [];
  }
  const newlyUnlocked = [];
  
  // 1. Early Bird: Studied before 8:00 AM
  if (!appState.state.badges.includes("early_bird")) {
    const hours = new Date().getHours();
    if (hours < 8) {
      appState.state.badges.push("early_bird");
      newlyUnlocked.push("early_bird");
    }
  }
  
  // 2. Vocabulary Master: Completed 100 or more words
  if (!appState.state.badges.includes("vocab_master")) {
    if ((appState.state.learned?.size || 0) >= 100) {
      appState.state.badges.push("vocab_master");
      newlyUnlocked.push("vocab_master");
    }
  }
  
  // 3. Streak King: Reached a 7-day study streak
  if (!appState.state.badges.includes("streak_king")) {
    if ((appState.state.streakCount || 0) >= 7) {
      appState.state.badges.push("streak_king");
      newlyUnlocked.push("streak_king");
    }
  }
  
  return newlyUnlocked;
}
