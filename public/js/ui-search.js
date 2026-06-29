import { appState, persist, notifyStateChange } from "./state-manager.js";
import { dom, switchView, showToast, escapeHtml } from "./ui-shared.js";

export function initSearch() {
  if (dom.globalSearchInput) {
    dom.globalSearchInput.addEventListener("input", handleGlobalSearch);
  }
  if (dom.clearSearchBtn) {
    dom.clearSearchBtn.addEventListener("click", clearSearch);
  }

  // Dashboard search elements
  const dashSearchInput = document.getElementById("dashboard-search-input");
  const dashClearBtn = document.getElementById("clear-dashboard-search-btn");

  if (dashSearchInput) {
    dashSearchInput.addEventListener("input", handleDashboardSearch);
  }
  if (dashClearBtn) {
    dashClearBtn.addEventListener("click", clearDashboardSearch);
  }
}

// 1. Sidebar Global Search
export function handleGlobalSearch() {
  if (!dom.globalSearchInput) return;
  const query = dom.globalSearchInput.value.trim().toLowerCase();
  
  if (query.length < 2) {
    if (dom.clearSearchBtn) dom.clearSearchBtn.classList.add("hidden");
    if (dom.searchResultsView) dom.searchResultsView.classList.add("hidden");
    
    const nav = appState.state.currentNavigation;
    if (nav.lessonId) {
      if (dom.vocabView) dom.vocabView.classList.remove("hidden");
      if (dom.explorerView) dom.explorerView.classList.add("hidden");
    } else {
      if (dom.explorerView) dom.explorerView.classList.remove("hidden");
      if (dom.vocabView) dom.vocabView.classList.add("hidden");
    }
    return;
  }
  
  if (dom.clearSearchBtn) dom.clearSearchBtn.classList.remove("hidden");
  if (dom.explorerView) dom.explorerView.classList.add("hidden");
  if (dom.vocabView) dom.vocabView.classList.add("hidden");
  if (dom.searchResultsView) dom.searchResultsView.classList.remove("hidden");
  
  const results = performSearch(query);
  renderSearchResults(results);
}

export function clearSearch() {
  if (dom.globalSearchInput) {
    dom.globalSearchInput.value = "";
  }
  handleGlobalSearch();
}

function renderSearchResults(results) {
  if (!dom.searchResultsList) return;
  if (dom.searchResultsCount) {
    dom.searchResultsCount.textContent = `${results.length} found`;
  }
  
  if (!results.length) {
    dom.searchResultsList.innerHTML = `<div class="text-center py-10 text-zinc-450 text-sm">No matching terms found.</div>`;
    return;
  }
  
  dom.searchResultsList.innerHTML = results.map(res => {
    const term = res.term;
    const pathText = `${escapeHtml(res.lang.name)} > ${escapeHtml(res.unit.name)} > ${escapeHtml(res.lesson.name)}`;
    
    return `
      <div class="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex flex-col gap-1.5 cursor-pointer" 
           data-search-result-term-id="${term.id}" 
           data-search-result-lang-id="${res.lang.id}" 
           data-search-result-unit-id="${res.unit.id}" 
           data-search-result-lesson-id="${res.lesson.id}">
        <div class="flex items-start justify-between">
          <strong class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">${escapeHtml(term.word)}</strong>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">${escapeHtml(term.difficulty)}</span>
        </div>
        <p class="text-xs text-zinc-650 dark:text-zinc-400 line-clamp-1">${escapeHtml(term.definition)}</p>
        ${term.arabic ? `<p class="text-xs text-brand-605 dark:text-brand-405 font-bold text-right" dir="rtl">${escapeHtml(term.arabic)}</p>` : ""}
        <div class="text-[10px] text-zinc-400 mt-1 border-t border-zinc-100 dark:border-zinc-850 pt-1.5 truncate">
          📁 ${pathText}
        </div>
      </div>
    `;
  }).join("");
  
  dom.searchResultsList.querySelectorAll("[data-search-result-term-id]").forEach(card => {
    card.addEventListener("click", () => {
      navigateToSearchResult(card.dataset);
      clearSearch();
    });
  });
}

// 2. Dashboard Global Search
export function handleDashboardSearch() {
  const dashSearchInput = document.getElementById("dashboard-search-input");
  const dashClearBtn = document.getElementById("clear-dashboard-search-btn");
  const dashResultsView = document.getElementById("dashboard-search-results");

  if (!dashSearchInput) return;
  const query = dashSearchInput.value.trim().toLowerCase();

  if (query.length < 2) {
    if (dashClearBtn) dashClearBtn.classList.add("hidden");
    if (dashResultsView) dashResultsView.classList.add("hidden");
    return;
  }

  if (dashClearBtn) dashClearBtn.classList.remove("hidden");
  if (dashResultsView) dashResultsView.classList.remove("hidden");

  const results = performSearch(query);
  renderDashboardSearchResults(results);
}

export function clearDashboardSearch() {
  const dashSearchInput = document.getElementById("dashboard-search-input");
  if (dashSearchInput) {
    dashSearchInput.value = "";
  }
  handleDashboardSearch();
}

function renderDashboardSearchResults(results) {
  const dashCount = document.getElementById("dashboard-search-results-count");
  const dashList = document.getElementById("dashboard-search-results-list");
  if (!dashList) return;

  if (dashCount) {
    dashCount.textContent = `${results.length} found`;
  }

  if (!results.length) {
    dashList.innerHTML = `<div class="col-span-full text-center py-6 text-zinc-450 text-sm">No matching terms found.</div>`;
    return;
  }

  dashList.innerHTML = results.map(res => {
    const term = res.term;
    const pathText = `${escapeHtml(res.lang.name)} > ${escapeHtml(res.unit.name)} > ${escapeHtml(res.lesson.name)}`;
    
    return `
      <div class="p-3 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex flex-col gap-1.5 cursor-pointer" 
           data-search-result-term-id="${term.id}" 
           data-search-result-lang-id="${res.lang.id}" 
           data-search-result-unit-id="${res.unit.id}" 
           data-search-result-lesson-id="${res.lesson.id}">
        <div class="flex items-start justify-between">
          <strong class="text-sm font-semibold text-zinc-850 dark:text-zinc-250 truncate">${escapeHtml(term.word)}</strong>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">${escapeHtml(term.difficulty)}</span>
        </div>
        <p class="text-xs text-zinc-650 dark:text-zinc-400 line-clamp-1">${escapeHtml(term.definition)}</p>
        ${term.arabic ? `<p class="text-xs text-brand-605 dark:text-brand-405 font-bold text-right" dir="rtl">${escapeHtml(term.arabic)}</p>` : ""}
        <div class="text-[10px] text-zinc-400 mt-1 border-t border-zinc-100 dark:border-zinc-850 pt-1.5 truncate">
          📁 ${pathText}
        </div>
      </div>
    `;
  }).join("");

  dashList.querySelectorAll("[data-search-result-term-id]").forEach(card => {
    card.addEventListener("click", () => {
      navigateToSearchResult(card.dataset);
      clearDashboardSearch();
    });
  });
}

// 3. Shared Helpers
function performSearch(query) {
  const results = [];
  appState.state.languages.forEach(lang => {
    lang.units.forEach(unit => {
      unit.lessons.forEach(lesson => {
        (lesson.terms || []).forEach(term => {
          const matchWord = term.word.toLowerCase().includes(query);
          const matchDef = term.definition.toLowerCase().includes(query);
          const matchAr = term.arabic && term.arabic.toLowerCase().includes(query);
          if (matchWord || matchDef || matchAr) {
            results.push({
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
  return results;
}

function navigateToSearchResult(dataset) {
  const termId = dataset.searchResultTermId;
  const langId = dataset.searchResultLangId;
  const unitId = dataset.searchResultUnitId;
  const lessonId = dataset.searchResultLessonId;
  
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
}
