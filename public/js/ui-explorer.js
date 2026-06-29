import {
  appState,
  currentLesson,
  persist,
  notifyStateChange,
  renameLanguage,
  renameUnit,
  renameLesson,
  deleteLanguage,
  deleteUnit,
  deleteLesson,
  addLanguage,
  addUnit,
  addLesson,
  moveLesson,
  getSrsStatusText,
  deleteTerm,
  deleteQuestion
} from "./state-manager.js";
import {
  dom,
  checkedLessonIds,
  switchView,
  renderAll,
  showToast,
  escapeHtml,
  sanitizeQuestionHtml
} from "./ui-shared.js";
import { startQuiz } from "./quiz-engine.js";

export function initExplorer() {
  if (dom.addItemBtn) {
    dom.addItemBtn.addEventListener("click", handleAddItem);
  }
  if (dom.backExplorerBtn) {
    dom.backExplorerBtn.addEventListener("click", handleBackExplorer);
  }
  if (dom.studyLessonFlashcardsBtn) {
    dom.studyLessonFlashcardsBtn.addEventListener("click", () => {
      appState.isMixedStudyMode = false;
      appState.state.activeIndex = 0;
      appState.cardFlipped = false;
      appState.studyTerms = null; // force reload
      persist();
      switchView("flashcards");
      renderAll();
    });
  }
  if (dom.startLessonQuizBtn) {
    dom.startLessonQuizBtn.addEventListener("click", () => {
      const focus = document.querySelector('input[name="quiz-focus"]:checked')?.value || "mixed";
      startQuiz("all", { quizFocus: focus })
        .then(() => {
          switchView("quiz");
        })
        .catch(err => {
          showToast(err.message, "error");
        });
    });
  }

  if (dom.explorerList) {
    // Navigation & rename/delete click delegation
    dom.explorerList.addEventListener("click", event => {
      const navLang = event.target.closest("[data-navigate-lang]");
      if (navLang) {
        appState.state.currentNavigation.languageId = navLang.dataset.navigateLang;
        appState.state.currentNavigation.unitId = null;
        appState.state.currentNavigation.lessonId = null;
        persist();
        notifyStateChange();
        return;
      }

      const navUnit = event.target.closest("[data-navigate-unit]");
      if (navUnit) {
        appState.state.currentNavigation.unitId = navUnit.dataset.navigateUnit;
        appState.state.currentNavigation.lessonId = null;
        persist();
        notifyStateChange();
        return;
      }

      const navLesson = event.target.closest("[data-navigate-lesson]");
      if (navLesson) {
        appState.state.currentNavigation.lessonId = navLesson.dataset.navigateLesson;
        appState.state.activeIndex = 0;
        appState.isMixedStudyMode = false;
        appState.studyTerms = null; // force reload
        persist();
        notifyStateChange();
        return;
      }

      // Rename buttons delegation
      const renameLangBtn = event.target.closest("[data-rename-lang]");
      if (renameLangBtn) {
        const id = renameLangBtn.dataset.renameLang;
        const lang = appState.state.languages.find(l => l.id === id);
        if (lang) {
          const newName = prompt("Rename Language to:", lang.name);
          if (newName && newName.trim() && newName.trim() !== lang.name) {
            renameLanguage(id, newName.trim());
            showToast("Language renamed successfully.", "success");
          }
        }
        return;
      }

      const renameUnitBtn = event.target.closest("[data-rename-unit]");
      if (renameUnitBtn) {
        const id = renameUnitBtn.dataset.renameUnit;
        const langId = appState.state.currentNavigation.languageId;
        const lang = appState.state.languages.find(l => l.id === langId);
        const unit = lang?.units.find(u => u.id === id);
        if (unit) {
          const newName = prompt("Rename Unit to:", unit.name);
          if (newName && newName.trim() && newName.trim() !== unit.name) {
            renameUnit(langId, id, newName.trim());
            showToast("Unit renamed successfully.", "success");
          }
        }
        return;
      }

      const renameLessonBtn = event.target.closest("[data-rename-lesson]");
      if (renameLessonBtn) {
        const id = renameLessonBtn.dataset.renameLesson;
        const nav = appState.state.currentNavigation;
        const lang = appState.state.languages.find(l => l.id === nav.languageId);
        const unit = lang?.units.find(u => u.id === nav.unitId);
        const lesson = unit?.lessons.find(ls => ls.id === id);
        if (lesson) {
          const newName = prompt("Rename Lesson to:", lesson.name);
          if (newName && newName.trim() && newName.trim() !== lesson.name) {
            renameLesson(nav.languageId, nav.unitId, id, newName.trim());
            showToast("Lesson renamed successfully.", "success");
          }
        }
        return;
      }

      // Delete buttons delegation
      const deleteLangBtn = event.target.closest("[data-delete-lang]");
      if (deleteLangBtn) {
        const id = deleteLangBtn.dataset.deleteLang;
        const lang = appState.state.languages.find(l => l.id === id);
        if (lang && confirm(`Delete language "${lang.name}" and all its units and lessons?`)) {
          deleteLanguage(id);
          showToast("Language deleted.", "info");
        }
        return;
      }

      const deleteUnitBtn = event.target.closest("[data-delete-unit]");
      if (deleteUnitBtn) {
        const id = deleteUnitBtn.dataset.deleteUnit;
        const langId = appState.state.currentNavigation.languageId;
        const lang = appState.state.languages.find(l => l.id === langId);
        const unit = lang?.units.find(u => u.id === id);
        if (unit && confirm(`Delete unit "${unit.name}" and all its lessons?`)) {
          deleteUnit(langId, id);
          showToast("Unit deleted.", "info");
        }
        return;
      }

      const deleteLessonBtn = event.target.closest("[data-delete-lesson]");
      if (deleteLessonBtn) {
        const id = deleteLessonBtn.dataset.deleteLesson;
        const nav = appState.state.currentNavigation;
        const lang = appState.state.languages.find(l => l.id === nav.languageId);
        const unit = lang?.units.find(u => u.id === nav.unitId);
        const lesson = unit?.lessons.find(ls => ls.id === id);
        if (lesson && confirm(`Delete lesson "${lesson.name}"?`)) {
          deleteLesson(nav.languageId, nav.unitId, id);
          showToast("Lesson deleted.", "info");
        }
        return;
      }
    });

    // Checkboxes change delegation
    dom.explorerList.addEventListener("change", event => {
      const selectAllUnits = event.target.closest("#select-all-units-checkbox");
      if (selectAllUnits) {
        const langId = appState.state.currentNavigation.languageId;
        const lang = appState.state.languages.find(l => l.id === langId);
        const units = lang ? (lang.units || []) : [];
        const allLessonIds = units.flatMap(u => (u.lessons || []).map(ls => ls.id));
        
        if (selectAllUnits.checked) {
          allLessonIds.forEach(id => {
            if (!checkedLessonIds.includes(id)) {
              checkedLessonIds.push(id);
            }
          });
        } else {
          allLessonIds.forEach(id => {
            const idx = checkedLessonIds.indexOf(id);
            if (idx !== -1) {
              checkedLessonIds.splice(idx, 1);
            }
          });
        }
        notifyStateChange();
        return;
      }

      const selectAllLessons = event.target.closest("#select-all-lessons-checkbox");
      if (selectAllLessons) {
        const langId = appState.state.currentNavigation.languageId;
        const unitId = appState.state.currentNavigation.unitId;
        const lang = appState.state.languages.find(l => l.id === langId);
        const unit = lang ? (lang.units || []).find(u => u.id === unitId) : null;
        const lessons = unit ? (unit.lessons || []) : [];
        const lessonIds = lessons.map(ls => ls.id);
        
        if (selectAllLessons.checked) {
          lessonIds.forEach(id => {
            if (!checkedLessonIds.includes(id)) {
              checkedLessonIds.push(id);
            }
          });
        } else {
          lessonIds.forEach(id => {
            const idx = checkedLessonIds.indexOf(id);
            if (idx !== -1) {
              checkedLessonIds.splice(idx, 1);
            }
          });
        }
        notifyStateChange();
        return;
      }

      const checkUnit = event.target.closest("[data-check-unit]");
      if (checkUnit) {
        const unitId = checkUnit.dataset.checkUnit;
        const langId = appState.state.currentNavigation.languageId;
        const lang = appState.state.languages.find(l => l.id === langId);
        const unit = lang?.units.find(u => u.id === unitId);
        if (unit) {
          const lessonIdsInUnit = (unit.lessons || []).map(ls => ls.id);
          if (checkUnit.checked) {
            lessonIdsInUnit.forEach(id => {
              if (!checkedLessonIds.includes(id)) {
                checkedLessonIds.push(id);
              }
            });
          } else {
            lessonIdsInUnit.forEach(id => {
              const idx = checkedLessonIds.indexOf(id);
              if (idx !== -1) {
                checkedLessonIds.splice(idx, 1);
              }
            });
          }
          notifyStateChange();
        }
        return;
      }

      const checkLesson = event.target.closest("[data-check-lesson]");
      if (checkLesson) {
        const lessonId = checkLesson.dataset.checkLesson;
        if (checkLesson.checked) {
          if (!checkedLessonIds.includes(lessonId)) {
            checkedLessonIds.push(lessonId);
          }
        } else {
          const idx = checkedLessonIds.indexOf(lessonId);
          if (idx !== -1) {
            checkedLessonIds.splice(idx, 1);
          }
        }
        notifyStateChange();
        return;
      }
    });

    // Drag and Drop event delegation for lessons
    dom.explorerList.addEventListener("dragstart", e => {
      const card = e.target.closest("[data-drag-lesson-id]");
      if (card) {
        card.classList.add("opacity-50");
        e.dataTransfer.setData("text/plain", card.dataset.dragLessonId);
        e.dataTransfer.effectAllowed = "move";
      }
    });

    dom.explorerList.addEventListener("dragend", e => {
      const card = e.target.closest("[data-drag-lesson-id]");
      if (card) {
        card.classList.remove("opacity-50");
      }
    });

    dom.explorerList.addEventListener("dragover", e => {
      const zone = e.target.closest("[data-drop-unit-id]");
      if (zone) {
        e.preventDefault();
        zone.classList.add("bg-brand-50", "border-brand-500", "text-brand-700", "dark:bg-brand-950/40", "dark:border-brand-500", "dark:text-brand-400");
      }
    });

    dom.explorerList.addEventListener("dragenter", e => {
      const zone = e.target.closest("[data-drop-unit-id]");
      if (zone) {
        e.preventDefault();
      }
    });

    dom.explorerList.addEventListener("dragleave", e => {
      const zone = e.target.closest("[data-drop-unit-id]");
      if (zone) {
        zone.classList.remove("bg-brand-50", "border-brand-500", "text-brand-700", "dark:bg-brand-950/40", "dark:border-brand-500", "dark:text-brand-400");
      }
    });

    dom.explorerList.addEventListener("drop", e => {
      const zone = e.target.closest("[data-drop-unit-id]");
      if (zone) {
        e.preventDefault();
        zone.classList.remove("bg-brand-50", "border-brand-500", "text-brand-700", "dark:bg-brand-950/40", "dark:border-brand-500", "dark:text-brand-400");
        const lessonId = e.dataTransfer.getData("text/plain");
        const targetUnitId = zone.dataset.dropUnitId;
        const sourceUnitId = appState.state.currentNavigation.unitId;
        const langId = appState.state.currentNavigation.languageId;
        
        if (lessonId && targetUnitId && sourceUnitId && langId) {
          const success = moveLesson(langId, sourceUnitId, targetUnitId, lessonId);
          if (success) {
            showToast("Moved lesson successfully!", "success");
          } else {
            showToast("Failed to move lesson.", "error");
          }
        }
      }
    });
  }
}

export function renderBreadcrumbs() {
  if (!dom.breadcrumbsContainer) return;
  const nav = appState.state.currentNavigation;
  const parts = [];

  const isRoot = !nav.languageId;
  if (isRoot) {
    parts.push(`<span class="text-zinc-550 dark:text-zinc-400 font-bold">Home</span>`);
  } else {
    parts.push(`<a href="#" class="text-brand-600 dark:text-brand-400 hover:underline cursor-pointer font-bold" data-nav-type="root">Home</a>`);
  }

  if (nav.languageId) {
    const lang = appState.state.languages.find(l => l.id === nav.languageId);
    if (lang) {
      parts.push(`<span class="text-zinc-350 dark:text-zinc-700">/</span>`);
      const isLangActive = !nav.unitId;
      if (isLangActive) {
        parts.push(`<span class="text-zinc-650 dark:text-zinc-400 font-bold">${escapeHtml(lang.name)}</span>`);
      } else {
        parts.push(`<a href="#" class="text-brand-600 dark:text-brand-400 hover:underline cursor-pointer font-bold" data-nav-type="lang" data-id="${lang.id}">${escapeHtml(lang.name)}</a>`);
      }
    }
  }

  if (nav.unitId && nav.languageId) {
    const lang = appState.state.languages.find(l => l.id === nav.languageId);
    const unit = lang?.units.find(u => u.id === nav.unitId);
    if (unit) {
      parts.push(`<span class="text-zinc-350 dark:text-zinc-700">/</span>`);
      const isUnitActive = !nav.lessonId;
      if (isUnitActive) {
        parts.push(`<span class="text-zinc-650 dark:text-zinc-400 font-bold">${escapeHtml(unit.name)}</span>`);
      } else {
        parts.push(`<a href="#" class="text-brand-600 dark:text-brand-400 hover:underline cursor-pointer font-bold" data-nav-type="unit" data-id="${unit.id}">${escapeHtml(unit.name)}</a>`);
      }
    }
  }

  if (nav.lessonId && nav.unitId && nav.languageId) {
    const lang = appState.state.languages.find(l => l.id === nav.languageId);
    const unit = lang?.units.find(u => u.id === nav.unitId);
    const lesson = unit?.lessons.find(ls => ls.id === nav.lessonId);
    if (lesson) {
      parts.push(`<span class="text-zinc-350 dark:text-zinc-700">/</span>`);
      parts.push(`<span class="text-zinc-650 dark:text-zinc-400 font-bold">${escapeHtml(lesson.name)}</span>`);
    }
  }

  dom.breadcrumbsContainer.innerHTML = parts.join(" ");

  dom.breadcrumbsContainer.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const type = link.dataset.navType;
      if (type === "root") {
        appState.state.currentNavigation = { languageId: null, unitId: null, lessonId: null };
      } else if (type === "lang") {
        appState.state.currentNavigation.unitId = null;
        appState.state.currentNavigation.lessonId = null;
      } else if (type === "unit") {
        appState.state.currentNavigation.lessonId = null;
      }
      persist();
      notifyStateChange();
    });
  });
}

export function renderExplorer() {
  const nav = appState.state.currentNavigation;
  const isLessonSelected = !!(nav.languageId && nav.unitId && nav.lessonId);

  // Toggle Visibility between Explorer list and Vocabulary terms list
  if (isLessonSelected) {
    if (dom.explorerView) dom.explorerView.classList.add("hidden");
    if (dom.vocabView) dom.vocabView.classList.remove("hidden");
    if (dom.backExplorerBtn) dom.backExplorerBtn.classList.remove("hidden");
    renderWordList();
    return;
  } else {
    if (dom.explorerView) dom.explorerView.classList.remove("hidden");
    if (dom.vocabView) dom.vocabView.classList.add("hidden");
    
    const hasBack = !!nav.languageId;
    if (dom.backExplorerBtn) {
      dom.backExplorerBtn.classList.toggle("hidden", !hasBack);
    }
  }

  if (!dom.explorerTitle || !dom.explorerList) return;

  // Level 1: Languages
  if (!nav.languageId) {
    dom.explorerTitle.textContent = "Languages";
    const items = appState.state.languages || [];
    dom.explorerList.innerHTML = items.map(lang => {
      const unitCount = lang.units?.length || 0;
      const lessonCount = lang.units?.reduce((acc, u) => acc + (u.lessons?.length || 0), 0) || 0;
      const wordCount = lang.units?.reduce((acc, u) => acc + (u.lessons?.reduce((acc2, ls) => acc2 + (ls.terms?.length || 0), 0) || 0), 0) || 0;
      return `
        <div class="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group">
          <div class="flex-1 min-w-0 cursor-pointer" data-navigate-lang="${lang.id}">
            <strong class="block text-sm font-semibold truncate text-zinc-800 dark:text-zinc-200">${escapeHtml(lang.name)}</strong>
            <span class="text-[11px] text-zinc-400">${unitCount} units • ${lessonCount} lessons • ${wordCount} words</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="text-zinc-400 hover:text-brand-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-rename-lang="${lang.id}" title="Rename language">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button type="button" class="text-zinc-400 hover:text-rose-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-delete-lang="${lang.id}">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("") || `<div class="text-center py-10 text-zinc-400 text-sm">No languages created yet. Click "+ Add Item" below to create one.</div>`;
  }
  // Level 2: Units
  else if (!nav.unitId) {
    dom.explorerTitle.textContent = "Units";
    const lang = appState.state.languages.find(l => l.id === nav.languageId);
    const items = lang ? (lang.units || []) : [];
    const allUnitLessons = items.flatMap(u => u.lessons || []);
    const isAllUnitsChecked = allUnitLessons.length > 0 && allUnitLessons.every(ls => checkedLessonIds.includes(ls.id));

    const selectAllHtml = items.length > 0 ? `
      <div class="flex items-center gap-3 p-3 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group mb-2">
        <input type="checkbox" class="w-4.5 h-4.5 text-brand-600 bg-white border-zinc-300 rounded focus:ring-brand-500 cursor-pointer" id="select-all-units-checkbox" ${isAllUnitsChecked ? 'checked' : ''} />
        <label for="select-all-units-checkbox" class="flex-1 text-xs font-bold text-zinc-550 dark:text-zinc-400 cursor-pointer uppercase tracking-wider">Select All Units</label>
      </div>
    ` : "";

    dom.explorerList.innerHTML = selectAllHtml + items.map(unit => {
      const lessonCount = unit.lessons?.length || 0;
      const wordCount = unit.lessons?.reduce((acc, ls) => acc + (ls.terms?.length || 0), 0) || 0;
      const unitLessons = unit.lessons || [];
      const isChecked = unitLessons.length > 0 && unitLessons.every(ls => checkedLessonIds.includes(ls.id));
      return `
        <div class="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group">
          <input type="checkbox" class="w-4.5 h-4.5 text-brand-600 bg-white border-zinc-300 rounded focus:ring-brand-500 cursor-pointer" data-check-unit="${unit.id}" ${isChecked ? 'checked' : ''} />
          <div class="flex-1 min-w-0 cursor-pointer" data-navigate-unit="${unit.id}">
            <strong class="block text-sm font-semibold truncate text-zinc-800 dark:text-zinc-200">${escapeHtml(unit.name)}</strong>
            <span class="text-[11px] text-zinc-400">${lessonCount} lessons • ${wordCount} words</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="text-zinc-400 hover:text-brand-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-rename-unit="${unit.id}" title="Rename unit">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button type="button" class="text-zinc-400 hover:text-rose-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-delete-unit="${unit.id}">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("") || `<div class="text-center py-10 text-zinc-400 text-sm">No units in this language. Click "+ Add Item" below to create one.</div>`;
  }
  // Level 3: Lessons
  else {
    dom.explorerTitle.textContent = "Lessons";
    const lang = appState.state.languages.find(l => l.id === nav.languageId);
    const unit = lang ? (lang.units || []).find(u => u.id === nav.unitId) : null;
    const items = unit ? (unit.lessons || []) : [];
    const isAllLessonsChecked = items.length > 0 && items.every(ls => checkedLessonIds.includes(ls.id));

    const selectAllHtml = items.length > 0 ? `
      <div class="flex items-center gap-3 p-3 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group mb-2">
        <input type="checkbox" class="w-4.5 h-4.5 text-brand-600 bg-white border-zinc-300 rounded focus:ring-brand-500 cursor-pointer" id="select-all-lessons-checkbox" ${isAllLessonsChecked ? 'checked' : ''} />
        <label for="select-all-lessons-checkbox" class="flex-1 text-xs font-bold text-zinc-550 dark:text-zinc-400 cursor-pointer uppercase tracking-wider">Select All Lessons</label>
      </div>
    ` : "";

    const lessonsListHtml = items.map(lesson => {
      const wordCount = lesson.terms?.length || 0;
      const isChecked = checkedLessonIds.includes(lesson.id);
      return `
        <div class="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group cursor-grab active:cursor-grabbing"
             draggable="true"
             data-drag-lesson-id="${lesson.id}">
          <input type="checkbox" class="w-4.5 h-4.5 text-brand-600 bg-white border-zinc-300 rounded focus:ring-brand-500 cursor-pointer" data-check-lesson="${lesson.id}" ${isChecked ? 'checked' : ''} />
          <div class="flex-1 min-w-0 cursor-pointer" data-navigate-lesson="${lesson.id}">
            <strong class="block text-sm font-semibold truncate text-zinc-800 dark:text-zinc-200">${escapeHtml(lesson.name)}</strong>
            <span class="text-[11px] text-zinc-400">${wordCount} words</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="text-zinc-400 hover:text-brand-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-rename-lesson="${lesson.id}" title="Rename lesson">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button type="button" class="text-zinc-400 hover:text-rose-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-delete-lesson="${lesson.id}">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Render other units of the current language as drag drop targets
    const otherUnits = lang ? (lang.units || []).filter(u => u.id !== nav.unitId) : [];
    const otherUnitsHtml = otherUnits.length > 0 ? `
      <div class="mt-4 border-t border-zinc-100 dark:border-zinc-850 pt-3">
        <span class="text-[10px] font-bold text-zinc-450 dark:text-zinc-555 uppercase tracking-wider block mb-2">📁 Move lesson to another unit (Drag and Drop)</span>
        <div class="flex flex-wrap gap-2">
          ${otherUnits.map(u => `
            <div class="drop-zone-unit text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-dashed border-zinc-350 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-650 dark:text-zinc-400 transition-all flex items-center gap-1 cursor-pointer"
                 data-drop-unit-id="${u.id}">
              <span>📥</span>
              <span class="max-w-[100px] truncate">${escapeHtml(u.name)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    ` : "";

    dom.explorerList.innerHTML = selectAllHtml + (lessonsListHtml || `<div class="text-center py-10 text-zinc-400 text-sm">No lessons in this unit. Click "+ Add Item" below to create one.</div>`) + otherUnitsHtml;
  }

  updateMixedQuizButton();
}

export function renderWordList() {
  const lesson = currentLesson();
  if (!dom.wordList) return;

  const isQuizView = (appState.activeView === "quiz");

  if (isQuizView) {
    // QUESTIONS LIST VIEW
    const questions = lesson ? (lesson.questions || []) : [];
    if (dom.termCount) {
      dom.termCount.textContent = `${questions.length} questions`;
    }
    if (dom.deleteAllWords) {
      dom.deleteAllWords.disabled = !questions.length;
    }

    // Update title and subtitle if DOM elements are present
    const vocabTitleEl = document.querySelector("#vocab-view h2");
    if (vocabTitleEl) {
      vocabTitleEl.textContent = "Questions List";
    }
    const vocabSummaryEl = document.getElementById("vocab-summary");
    if (vocabSummaryEl) {
      vocabSummaryEl.textContent = "Questions inside lesson";
    }

    if (dom.statQuestions) {
      dom.statQuestions.textContent = questions.length;
    }
    if (dom.statLearned && lesson) {
      const terms = lesson.terms || [];
      const learnedCount = terms.filter(t => appState.state.learned.has(t.id)).length;
      dom.statLearned.textContent = learnedCount;
    }
    if (dom.statDue && lesson) {
      const terms = lesson.terms || [];
      const now = Date.now();
      const dueCount = terms.filter(t => !appState.state.learned.has(t.id) || Number(t.review?.dueAt || 0) <= now).length;
      dom.statDue.textContent = dueCount;
    }

    if (!questions.length) {
      dom.wordList.innerHTML = `<div class="text-center py-10 text-zinc-400 text-sm">No questions in this lesson yet. Generate a study set to create some.</div>`;
      return;
    }

    const typeLabels = {
      context: "Context Completion",
      synonym: "Synonym",
      antonym: "Antonym",
      definition: "Definition",
      fine_distinction: "Fine Distinction",
      indigo_context: "STEM Context",
      stem_context: "STEM Context",
      paraphrase: "Paraphrasing",
      contextual_translation: "Contextual Translation"
    };

    dom.wordList.innerHTML = questions
      .map((q, idx) => {
        const typeLabel = typeLabels[q.type] || q.typeLabel || q.type;
        return `
          <div class="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex flex-col gap-2 relative group" data-question-id="${q.id}">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0 pr-8">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span class="text-xs font-bold text-brand-600 dark:text-brand-400">Q${idx + 1}</span>
                  <span class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400 uppercase tracking-wider">${escapeHtml(typeLabel)}</span>
                  ${q.word ? `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-zinc-200/50 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 font-extrabold">Word: <strong class="text-brand-600 dark:text-brand-400 font-extrabold">${escapeHtml(q.word)}</strong></span>` : ""}
                </div>
                <p class="text-xs font-medium text-zinc-700 dark:text-zinc-200 leading-snug mb-2">${sanitizeQuestionHtml(q.prompt)}</p>
                <div class="grid grid-cols-1 gap-1.5 mt-2">
                  ${q.choices.map((choice, cIdx) => {
                    const isCorrect = cIdx === q.answerIndex;
                    const borderClass = isCorrect 
                      ? "border-emerald-250 bg-emerald-500/10 text-emerald-700 dark:border-emerald-950/30 dark:bg-emerald-950/20 dark:text-emerald-450 font-semibold" 
                      : "border-zinc-250 dark:border-zinc-800/80 text-zinc-500 dark:text-zinc-400";
                    return `
                      <div class="px-2.5 py-1 text-[10px] rounded-lg border ${borderClass} truncate flex items-center gap-1.5">
                        <span class="text-[9px] font-bold uppercase ${isCorrect ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-450'}">${String.fromCharCode(65 + cIdx)}.</span>
                        <span class="truncate">${escapeHtml(choice)}</span>
                        ${isCorrect ? '<span class="text-emerald-600 dark:text-emerald-400 font-extrabold ml-auto">✓</span>' : ""}
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
              <button type="button" class="text-zinc-400 hover:text-rose-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity self-start" data-delete-question="${q.id}">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    dom.wordList.querySelectorAll("[data-delete-question]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.stopPropagation();
        const questionId = btn.dataset.deleteQuestion;
        if (confirm("Are you sure you want to delete this question?")) {
          deleteQuestion(questionId);
          showToast("Question deleted.", "success");
        }
      });
    });

  } else {
    // VOCABULARY LIST VIEW (DEFAULT)
    const terms = lesson ? (lesson.terms || []) : [];
    if (dom.termCount) {
      dom.termCount.textContent = `${terms.length} words`;
    }
    if (dom.deleteAllWords) {
      dom.deleteAllWords.disabled = !terms.length;
    }

    // Update title and subtitle if DOM elements are present
    const vocabTitleEl = document.querySelector("#vocab-view h2");
    if (vocabTitleEl) {
      vocabTitleEl.textContent = "Vocabulary List";
    }
    const vocabSummaryEl = document.getElementById("vocab-summary");
    if (vocabSummaryEl) {
      vocabSummaryEl.textContent = "Words inside lesson";
    }

    if (dom.statQuestions) {
      const qCount = lesson ? (lesson.questions?.length || 0) : 0;
      dom.statQuestions.textContent = qCount;
    }
    if (dom.statLearned) {
      const learnedCount = terms.filter(t => appState.state.learned.has(t.id)).length;
      dom.statLearned.textContent = learnedCount;
    }
    if (dom.statDue) {
      const now = Date.now();
      const dueCount = terms.filter(t => !appState.state.learned.has(t.id) || Number(t.review?.dueAt || 0) <= now).length;
      dom.statDue.textContent = dueCount;
    }

    if (!terms.length) {
      dom.wordList.innerHTML = `<div class="text-center py-10 text-zinc-400 text-sm">No words in this lesson yet. Generate a study set or add rows manually.</div>`;
      return;
    }

    dom.wordList.innerHTML = terms
      .map((term, index) => {
        const isLearned = appState.state.learned.has(term.id);
        const difficultyColor =
          term.difficulty === "basic"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
            : term.difficulty === "intermediate"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
            : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400";
        
        const statusText = getSrsStatusText(term);
        const isHighlighted = appState.highlightedTermId === term.id;
        
        const leechBadge = term.isLeech
          ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-150 text-red-800 dark:bg-red-950/40 dark:text-red-400">🔥 Leech</span>`
          : "";

        return `
          <div class="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex flex-col gap-2 relative group cursor-pointer ${isHighlighted ? 'ring-2 ring-brand-500 border-transparent bg-brand-50/10 dark:bg-brand-950/20' : ''} ${term.isLeech ? 'border-red-300 dark:border-red-950/80 bg-red-500/5' : ''}" data-select-term-index="${index}" data-term-id="${term.id}">
            <div class="flex items-start justify-between">
              <div class="min-w-0 pr-8">
                <strong class="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1">
                  ${escapeHtml(term.word)}
                  ${term.isLeech ? '<span class="text-red-500 text-xs">🔥</span>' : ''}
                </strong>
                <span class="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">${escapeHtml(term.partOfSpeech || "n/a")}</span>
              </div>
              <div class="flex items-center gap-1.5">
                ${leechBadge}
                <span class="px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${difficultyColor}">${escapeHtml(term.difficulty)}</span>
                <button type="button" class="text-zinc-400 hover:text-rose-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-delete-term="${term.id}">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <p class="text-xs text-zinc-650 dark:text-zinc-400 line-clamp-2">${escapeHtml(term.definition)}</p>
            ${term.arabic ? `<p class="text-xs text-brand-605 dark:text-brand-405 font-bold text-right" dir="rtl">${escapeHtml(term.arabic)}</p>` : ""}
            <div class="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-850 pt-2 mt-1">
              <span class="px-1.5 py-0.5 text-[9px] font-semibold rounded ${statusText.style}">${statusText.text}</span>
              <span class="text-[10px] ${isLearned ? 'text-emerald-600 dark:text-emerald-450 font-bold' : 'text-zinc-400'}">${isLearned ? '✓ Mastered' : 'Not Mastered'}</span>
            </div>
          </div>
        `;
      })
      .join("");

    dom.wordList.querySelectorAll("[data-select-term-index]").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("[data-delete-term]")) return;
        const index = Number(card.dataset.selectTermIndex);
        appState.state.activeIndex = index;
        appState.cardFlipped = false;
        appState.studyTerms = null; // force reload
        persist();
        switchView("flashcards");
        renderAll();
      });
    });

    dom.wordList.querySelectorAll("[data-delete-term]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.stopPropagation();
        const termId = btn.dataset.deleteTerm;
        const term = terms.find(t => t.id === termId);
        if (term && confirm(`Delete the term "${term.word}"?`)) {
          deleteTerm(termId);
          showToast("Term deleted.", "info");
        }
      });
    });

    if (appState.highlightedTermId) {
      const cardEl = dom.wordList.querySelector(`[data-term-id="${appState.highlightedTermId}"]`);
      if (cardEl) {
        setTimeout(() => {
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            cardEl.classList.remove("ring-2", "ring-brand-500", "border-transparent", "bg-brand-50/10", "dark:bg-brand-950/20");
            appState.highlightedTermId = null;
          }, 2500);
        }, 100);
      }
    }
  }
}

export function handleAddItem() {
  const nav = appState.state.currentNavigation;
  if (!nav.languageId) {
    const name = prompt("Enter Language Name:");
    if (name && name.trim()) {
      addLanguage(name.trim());
      showToast(`Language "${name.trim()}" added.`, "success");
    }
  } else if (!nav.unitId) {
    const name = prompt("Enter Unit Name:");
    if (name && name.trim()) {
      addUnit(nav.languageId, name.trim());
      showToast(`Unit "${name.trim()}" added.`, "success");
    }
  } else if (!nav.lessonId) {
    const name = prompt("Enter Lesson Name:");
    if (name && name.trim()) {
      addLesson(nav.languageId, nav.unitId, name.trim());
      showToast(`Lesson "${name.trim()}" added.`, "success");
    }
  }
}

export function handleBackExplorer() {
  const nav = appState.state.currentNavigation;
  if (nav.lessonId) {
    nav.lessonId = null;
  } else if (nav.unitId) {
    nav.unitId = null;
  } else if (nav.languageId) {
    nav.languageId = null;
  }
  persist();
  notifyStateChange();
}

export function ensureActiveLesson() {
  const nav = appState.state.currentNavigation;
  if (nav.languageId && nav.unitId && nav.lessonId) {
    const lang = appState.state.languages.find(l => l.id === nav.languageId);
    const unit = lang?.units.find(u => u.id === nav.unitId);
    const lesson = unit?.lessons.find(ls => ls.id === nav.lessonId);
    if (!lesson) {
      nav.lessonId = null;
      appState.state.activeIndex = 0;
      persist();
    }
  }
}

export function updateMixedQuizButton() {
  const countSpan = document.getElementById("selected-mixed-count");
  const mixedBtn = document.getElementById("start-mixed-quiz-btn");
  const mixedFlashBtn = document.getElementById("start-mixed-flashcards-btn");
  if (!countSpan || !mixedBtn || !mixedFlashBtn) return;

  // Cleanup deleted lesson ids from checkedLessonIds
  const allExistingLessonIds = appState.state.languages.flatMap(l =>
    l.units.flatMap(u =>
      u.lessons.map(ls => ls.id)
    )
  );
  
  // Use splice to mutate array in-place so ES modules live bindings remain active
  const filtered = checkedLessonIds.filter(id => allExistingLessonIds.includes(id));
  checkedLessonIds.splice(0, checkedLessonIds.length, ...filtered);

  if (checkedLessonIds.length > 0) {
    countSpan.textContent = `${checkedLessonIds.length} selected`;
    countSpan.classList.remove("hidden");

    let totalWords = 0;
    appState.state.languages.forEach(l => {
      l.units.forEach(u => {
        u.lessons.forEach(ls => {
          if (checkedLessonIds.includes(ls.id)) {
            totalWords += (ls.terms || []).length;
          }
        });
      });
    });

    mixedBtn.textContent = `Start Mixed Quiz (${totalWords} words)`;
    mixedBtn.classList.remove("hidden");

    mixedFlashBtn.textContent = `Study Mixed Flashcards (${totalWords} words)`;
    mixedFlashBtn.classList.remove("hidden");
  } else {
    countSpan.classList.add("hidden");
    mixedBtn.classList.add("hidden");
    mixedFlashBtn.classList.add("hidden");
  }
}
