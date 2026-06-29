import {
  appState,
  latestStreak,
  dueTerms,
  masteryPercent,
  countDifficulty,
  persist,
  notifyStateChange
} from "./state-manager.js";
import {
  dom,
  switchView,
  renderAll,
  showToast,
  showLoading,
  hideLoading,
  escapeHtml
} from "./ui-shared.js";
import { simplifyTerm } from "./api.js";

export function initInsights() {
  // Insights is read-only rendering, but hard words buttons bind dynamically in renderHardWordsSection.
}

export function renderInsights() {
  if (!dom.insightsGrid) return;
  const allTerms = appState.state.languages.flatMap(l =>
    l.units.flatMap(u =>
      u.lessons.flatMap(ls => ls.terms || [])
    )
  );
  
  const total = allTerms.length;
  const learned = appState.state.learned.size;
  const ratio = total ? Math.round((learned / total) * 100) : 0;
  const diffCounts = countDifficulty();
  
  // Count Leech words
  const leechesCount = allTerms.filter(t => t.isLeech).length;

  dom.insightsGrid.innerHTML = `
    <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <h3 class="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Total Vocabulary</h3>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-extrabold text-zinc-800 dark:text-zinc-250">${total}</span>
        <span class="text-xs text-zinc-400">words loaded</span>
      </div>
    </div>
    
    <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <h3 class="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Mastery Progress</h3>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-extrabold text-indigo-650 dark:text-indigo-400">${ratio}%</span>
        <span class="text-xs text-zinc-400">${learned} of ${total} mastered</span>
      </div>
      <div class="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
        <div class="bg-indigo-500 h-full" style="width: ${ratio}%"></div>
      </div>
    </div>

    <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <h3 class="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Study Streak</h3>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-extrabold text-amber-500">${appState.state.streakCount}</span>
        <span class="text-xs text-zinc-400">days streak</span>
      </div>
    </div>

    <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <h3 class="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Leech Words (🔥)</h3>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-extrabold text-red-500">${leechesCount}</span>
        <span class="text-xs text-zinc-400">hard words</span>
      </div>
    </div>

    <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm md:col-span-3 lg:col-span-4">
      <h3 class="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">Difficulty Breakdown</h3>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <span class="block text-xl font-bold text-emerald-600 dark:text-emerald-400">${diffCounts.basic}</span>
          <span class="text-xs text-zinc-400">Basic</span>
        </div>
        <div>
          <span class="block text-xl font-bold text-amber-500">${diffCounts.intermediate}</span>
          <span class="text-xs text-zinc-400">Intermediate</span>
        </div>
        <div>
          <span class="block text-xl font-bold text-rose-605 dark:text-rose-450">${diffCounts.advanced}</span>
          <span class="text-xs text-zinc-400">Advanced</span>
        </div>
      </div>
    </div>
  `;

  renderFolderStats();
  renderHardWordsSection();

  const subtitle = document.getElementById("hard-words-subtitle");
  if (subtitle) {
    const threshold = appState.state.settings?.srsLeechThreshold ?? 5;
    subtitle.textContent = `Words you have made mistakes on ${threshold} or more times. Click on them to study or use AI to simplify them.`;
  }
}

export function renderStreakDisplay() {
  const streakDisplay = document.getElementById("streak-display");
  if (streakDisplay) {
    const streak = appState.state.streakCount || 0;
    streakDisplay.textContent = `Streak: ${streak} days 🔥`;
    streakDisplay.className = streak > 0
      ? "text-xs font-bold px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg flex items-center gap-1 cursor-default animate-pulse"
      : "text-xs font-semibold px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-450 rounded-lg flex items-center gap-1 cursor-default";
  }
}

export function renderHistory() {
  if (!dom.historyList) return;
  dom.historyList.innerHTML = appState.state.quizHistory
    .map(attempt => {
      const formattedDate = new Date(attempt.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      return `
        <div class="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-xl flex items-center justify-between text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900">
          <div class="min-w-0 pr-4">
            <span class="font-bold text-zinc-800 dark:text-zinc-200 block truncate">${formattedDate}</span>
            <span class="text-[10px] text-zinc-400">${attempt.correct} correct of ${attempt.total}</span>
          </div>
          <span class="font-mono font-extrabold text-brand-600 dark:text-brand-400">${attempt.percent}%</span>
        </div>
      `;
    })
    .join("") || `<div class="text-center py-6 text-zinc-400 text-sm">No recent quiz attempts.</div>`;
}

export function renderFolderStats() {
  const container = document.getElementById("folder-stats-container");
  if (!container) return;

  const languages = appState.state.languages || [];
  if (!languages.length) {
    container.innerHTML = `<div class="text-zinc-400 text-sm text-center py-4">No languages or units added yet. Create a study set to begin.</div>`;
    return;
  }

  container.innerHTML = languages.map(lang => {
    // Calculate language mastery
    const langTerms = lang.units.flatMap(u => u.lessons.flatMap(ls => ls.terms || []));
    const langTotal = langTerms.length;
    const langLearned = langTerms.filter(t => appState.state.learned.has(t.id)).length;
    const langPercent = langTotal ? Math.round((langLearned / langTotal) * 100) : 0;
    
    // Calculate color based on percentage
    const langColor = langPercent >= 80 ? "bg-emerald-500" : langPercent >= 50 ? "bg-indigo-500" : "bg-amber-500";

    const unitsHtml = lang.units.map(unit => {
      const unitTerms = unit.lessons.flatMap(ls => ls.terms || []);
      const unitTotal = unitTerms.length;
      const unitLearned = unitTerms.filter(t => appState.state.learned.has(t.id)).length;
      const unitPercent = unitTotal ? Math.round((unitLearned / unitTotal) * 100) : 0;
      
      const unitColor = unitPercent >= 80 ? "bg-emerald-500" : unitPercent >= 50 ? "bg-indigo-500" : "bg-amber-500";

      return `
        <div class="pl-4 border-l-2 border-zinc-150 dark:border-zinc-800 space-y-2 mt-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-zinc-650 dark:text-zinc-400">📁 ${escapeHtml(unit.name)}</span>
            <span class="font-mono text-zinc-400 font-bold">${unitLearned}/${unitTotal} words (${unitPercent}%)</span>
          </div>
          <div class="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div class="${unitColor} h-full transition-all duration-500" style="width: ${unitPercent}%"></div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 space-y-3">
        <div class="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800/60 pb-2">
          <span class="font-extrabold text-sm text-zinc-850 dark:text-zinc-250">🗣️ ${escapeHtml(lang.name)}</span>
          <span class="font-mono text-xs text-brand-600 dark:text-brand-400 font-black">${langLearned}/${langTotal} words (${langPercent}%)</span>
        </div>
        <div class="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div class="${langColor} h-full transition-all duration-500" style="width: ${langPercent}%"></div>
        </div>
        <div class="space-y-3 pt-1">
          ${unitsHtml || `<div class="text-xs text-zinc-450 dark:text-zinc-550 pl-4">No units in this language yet.</div>`}
        </div>
      </div>
    `;
  }).join("");
}

export function renderHardWordsSection() {
  const countSpan = document.getElementById("dashboard-hard-words-count");
  const listContainer = document.getElementById("dashboard-hard-words-list");
  const section = document.getElementById("dashboard-hard-words-section");
  if (!listContainer || !section) return;

  // Find all Leech terms across all folders
  const leechedResults = [];
  appState.state.languages.forEach(lang => {
    lang.units.forEach(unit => {
      unit.lessons.forEach(lesson => {
        (lesson.terms || []).forEach(term => {
          if (term.isLeech) {
            leechedResults.push({
              term,
              lang,
              unit,
              lesson
            });
          }
        });
      });
    });
  });

  if (countSpan) {
    countSpan.textContent = `${leechedResults.length} words`;
  }

  if (!leechedResults.length) {
    listContainer.innerHTML = `
      <div class="col-span-full text-center py-6 text-zinc-450 text-sm">
        🎉 No hard words currently! You are doing great.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = leechedResults.map(res => {
    const term = res.term;
    const pathText = `${escapeHtml(res.lang.name)} > ${escapeHtml(res.unit.name)} > ${escapeHtml(res.lesson.name)}`;
    
    return `
      <div class="p-3.5 bg-red-500/5 dark:bg-red-550/10 border border-red-200 dark:border-red-950/60 rounded-xl flex flex-col gap-2 relative group hover:shadow-sm transition-all"
           data-hard-term-id="${term.id}"
           data-hard-lang-id="${res.lang.id}"
           data-hard-unit-id="${res.unit.id}"
           data-hard-lesson-id="${res.lesson.id}">
        
        <div class="flex items-start justify-between cursor-pointer animate-pulse" data-jump-to-card="true">
          <div class="min-w-0 pr-6">
            <strong class="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5">
              ${escapeHtml(term.word)} <span class="text-red-500 text-xs">🔥</span>
            </strong>
            <span class="text-[9px] font-bold text-red-550 dark:text-red-400 uppercase tracking-wider">Mistakes: ${term.mistakeCount !== undefined ? term.mistakeCount : (appState.state.settings?.srsLeechThreshold ?? 5)}</span>
          </div>
          <span class="px-2 py-0.5 text-[9px] font-bold rounded-full uppercase bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Leech</span>
        </div>

        <p class="text-xs text-zinc-650 dark:text-zinc-400 line-clamp-2 cursor-pointer" data-jump-to-card="true">${escapeHtml(term.definition)}</p>
        ${term.arabic ? `<p class="text-xs text-brand-605 dark:text-brand-405 font-bold text-right" dir="rtl">${escapeHtml(term.arabic)}</p>` : ""}
        
        <div class="text-[9px] text-zinc-400 border-t border-zinc-150 dark:border-zinc-850 pt-2 truncate cursor-pointer" data-jump-to-card="true">
          📁 ${pathText}
        </div>

        <div class="flex gap-1.5 mt-1 border-t border-zinc-100 dark:border-zinc-850 pt-2 flex-wrap sm:flex-nowrap">
          <button type="button" class="flex-1 py-1 px-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[10px] text-zinc-750 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded font-bold transition-all" data-dash-reset-leech="${term.id}">Reset</button>
          <button type="button" class="flex-[2] py-1 px-2 bg-brand-600 hover:bg-brand-700 text-white text-[10px] rounded font-bold transition-all flex items-center justify-center gap-1" data-dash-simplify-leech="${term.id}">
            <span>🤖</span> Get AI Help
          </button>
        </div>
      </div>
    `;
  }).join("");

  // Bind clicks
  listContainer.querySelectorAll("[data-hard-term-id]").forEach(card => {
    const termId = card.dataset.hardTermId;
    const langId = card.dataset.hardLangId;
    const unitId = card.dataset.hardUnitId;
    const lessonId = card.dataset.hardLessonId;

    // Click on card body jumps to term
    card.querySelectorAll("[data-jump-to-card]").forEach(el => {
      el.addEventListener("click", () => {
        appState.state.currentNavigation.languageId = langId;
        appState.state.currentNavigation.unitId = unitId;
        appState.state.currentNavigation.lessonId = lessonId;
        appState.isMixedStudyMode = false;
        appState.studyTerms = null; // force reload studyTerms
        
        const lang = appState.state.languages.find(l => l.id === langId);
        const unit = lang?.units.find(u => u.id === unitId);
        const lesson = unit?.lessons.find(ls => ls.id === lessonId);
        if (lesson && lesson.terms) {
          const index = lesson.terms.findIndex(t => t.id === termId);
          if (index !== -1) {
            appState.state.activeIndex = index;
          }
        }
        appState.highlightedTermId = termId;
        persist();
        notifyStateChange();
        switchView("import");
        showToast("Navigated to term lesson.", "success");
      });
    });

    // Reset button click
    const resetBtn = card.querySelector(`[data-dash-reset-leech="${termId}"]`);
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        import("./state-manager.js").then(sm => {
          sm.resetLeechStatus(termId);
          // Sync session studyTerms if active
          const sessionTerm = appState.studyTerms?.find(t => t.id === termId);
          if (sessionTerm) {
            sessionTerm.isLeech = false;
            sessionTerm.mistakeCount = 0;
          }
          showToast("Word mistakes reset and removed from hard words.", "success");
          renderAll();
        });
      });
    }

    // Simplify button click
    const simplifyBtn = card.querySelector(`[data-dash-simplify-leech="${termId}"]`);
    if (simplifyBtn) {
      simplifyBtn.addEventListener("click", () => {
        const isAi = (appState.state?.settings?.engineMode || "ai") === "ai";
        if (!isAi) {
          showToast("AI simplification requires AI Engine to be active. Enable it in Settings.", "error");
          return;
        }
        import("./state-manager.js").then(sm => {
          const lang = appState.state.languages.find(l => l.id === langId);
          const unit = lang?.units.find(u => u.id === unitId);
          const lesson = unit?.lessons.find(ls => ls.id === lessonId);
          const term = lesson?.terms.find(t => t.id === termId);
          if (term) {
            showLoading("Simplifying Word with AI", "Calling Gemini to simplify definition, example, and generate mnemonic...");
            simplifyTerm(term)
              .then(data => {
                sm.updateTermSimplified(termId, data);
                
                // Sync session studyTerms if active
                const sessionTerm = appState.studyTerms?.find(t => t.id === termId);
                if (sessionTerm) {
                  sessionTerm.definition = data.definition;
                  sessionTerm.example = data.example;
                  sessionTerm.mnemonic = data.mnemonic;
                }
                
                hideLoading();
                showToast("Word successfully simplified by AI!", "success");
                renderAll();
              })
              .catch(err => {
                hideLoading();
                showToast(err.message, "error");
              });
          }
        });
      });
    }
  });
}
