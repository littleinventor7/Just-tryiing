import {
  extractPdfFile,
  processVocabulary,
  regenerateQuiz,
  generateWithGemini,
  extractWordsFromImageWithGemini,
  askLessonAssistant,
  detectSubject
} from "./api.js";
import { extractFileContent, fileToBase64 } from "./fileReaders.js";
import { downloadJson, loadState, saveState, createEmptyState, normalizeLoadedSets } from "./storage.js";
import { buildTermsFromRows, normalizeRow, parseDelimitedRows } from "./tableTerms.js";
import {
  appState,
  onStateChange,
  persist,
  currentTerm,
  dueTerms,
  masteryPercent,
  latestStreak,
  countDifficulty,
  countDifficultyForTerms,
  toggleLearned,
  deleteCurrentTerm,
  deleteTerm,
  deleteAllWords,
  checkAndUpdateStreak,
  getSrsStatusText,
  createEmptyManualRows,
  addLanguage,
  addUnit,
  addLesson,
  deleteLanguage,
  deleteUnit,
  deleteLesson,
  currentLesson,
  notifyStateChange,
  renameLanguage,
  renameUnit,
  renameLesson,
  getOrCreateFolderStructure
} from "./state-manager.js";
import {
  quizSession,
  startQuiz,
  startMixedQuiz,
  answerQuestion,
  advanceQuestion,
  finishQuiz,
  registerQuizCallbacks,
  getCurrentQuestion
} from "./quiz-engine.js";

// Import Component Renderers and Initializers
import { initExplorer, renderBreadcrumbs, renderExplorer, renderWordList } from "./ui-explorer.js";
import { initFlashcards, renderFlashcard } from "./ui-flashcards.js";
import { initSearch } from "./ui-search.js";
import { initInsights, renderInsights, renderStreakDisplay, renderHistory } from "./ui-insights.js";

import {
  dom,
  checkedLessonIds,
  registerRenderAll,
  showToast,
  showLoading,
  hideLoading,
  switchView,
  applyTheme,
  applySidebarsVisibility,
  toCamel,
  escapeHtml,
  sanitizeQuestionHtml,
  clamp,
  shuffle
} from "./ui-shared.js";

let pendingSubject = null;
let pendingFocusType = null;

const subjectFocusOptions = {
  "English": ["Vocabulary", "Grammar", "Mixed"],
  "German": ["Vocabulary", "Grammar", "Mixed"],
  "Chemistry": ["Concepts", "Equations & Formulas", "Mixed"],
  "French": ["Vocabulary", "Grammar", "Mixed"],
  "Physics": ["Concepts", "Laws & Problems", "Mixed"],
  "Biology": ["Definitions", "Processes", "Mixed"],
  "Math": ["Concepts", "Equations & Problems", "Mixed"],
  "Mechanics": ["Concepts", "Laws & Problems", "Mixed"]
};

function populateFocusDropdown(subject, selectedFocus = "Mixed") {
  const focusSelect = document.getElementById("modal-focus-select");
  if (!focusSelect) return;

  const labels = {
    "Vocabulary": "Vocabulary",
    "Grammar": "Grammar",
    "Concepts": "Concepts",
    "Laws & Problems": "Laws & Problems",
    "Definitions": "Definitions",
    "Processes": "Processes",
    "Equations & Formulas": "Equations & Formulas",
    "Equations & Problems": "Equations & Problems",
    "Mixed": "Mixed"
  };

  const options = subjectFocusOptions[subject] || [];
  focusSelect.innerHTML = options.map(opt => {
    const isSelected = opt.toLowerCase() === selectedFocus.toLowerCase() ? "selected" : "";
    return `<option value="${opt}" ${isSelected}>${labels[opt] || opt}</option>`;
  }).join("");
  focusSelect.disabled = false;
}

function updateModalLabelsAndVisibility() {
  const subject = dom.modalSubjectSelect ? dom.modalSubjectSelect.value : "";
  const isLanguage = ["English", "German", "French"].includes(subject);

  if (dom.modalCountModePerWordLabel) {
    dom.modalCountModePerWordLabel.textContent = isLanguage ? "Per Word" : "Per Concept";
  }
  if (dom.modalPerWordCountLabel) {
    dom.modalPerWordCountLabel.textContent = isLanguage ? "Questions per Vocabulary Word" : "Questions per Concept";
  }

  const includeQuiz = document.getElementById("modal-include-quiz")?.checked;

  if (!includeQuiz) {
    if (dom.modalQuestionCountGroup) dom.modalQuestionCountGroup.classList.add("hidden");
    if (dom.modalPerWordControl) {
      dom.modalPerWordControl.classList.add("hidden");
      dom.modalPerWordControl.style.display = "none";
    }
    if (dom.modalTotalControl) {
      dom.modalTotalControl.classList.add("hidden");
      dom.modalTotalControl.style.display = "none";
    }
  } else {
    if (dom.modalQuestionCountGroup) dom.modalQuestionCountGroup.classList.remove("hidden");

    const mode = document.querySelector('input[name="modal-question-count-mode"]:checked')?.value || "per-word";
    if (mode === "per-word") {
      if (dom.modalPerWordControl) {
        dom.modalPerWordControl.classList.remove("hidden");
        dom.modalPerWordControl.style.display = "flex";
      }
      if (dom.modalTotalControl) {
        dom.modalTotalControl.classList.add("hidden");
        dom.modalTotalControl.style.display = "none";
      }
    } else {
      if (dom.modalPerWordControl) {
        dom.modalPerWordControl.classList.add("hidden");
        dom.modalPerWordControl.style.display = "none";
      }
      if (dom.modalTotalControl) {
        dom.modalTotalControl.classList.remove("hidden");
        dom.modalTotalControl.style.display = "flex";
      }
    }
  }
}

export function init() {
  registerRenderAll(renderAll);
  cacheDom();
  bindEvents();
  registerCallbacks();
  loadSavedApiKey();
  applyTheme();
  applySidebarsVisibility();
  checkAndUpdateStreak(false);
  initChat();
  initAuth();
  renderAll();
}

function cacheDom() {
  for (const element of document.querySelectorAll("[id]")) {
    dom[toCamel(element.id)] = element;
  }
  dom.tabs = [...document.querySelectorAll(".tab")];
  dom.views = [...document.querySelectorAll(".view")];
}

function bindEvents() {
  // Navigation Tabs
  dom.tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      switchView(view);
      if (view === "summary") {
        renderSummary();
      }
    });
  });

  // Theme Toggle
  if (dom.themeToggle) {
    dom.themeToggle.addEventListener("click", () => {
      appState.state.settings.theme = appState.state.settings.theme === "dark" ? "light" : "dark";
      persist();
      applyTheme();
    });
  }

  // Sidebar Toggles & Close Buttons
  // Stats Sidebar Toggle & Close
  if (dom.toggleStatsBtn) {
    dom.toggleStatsBtn.addEventListener("click", () => {
      appState.state.settings.hideStats = !appState.state.settings.hideStats;
      persist();
      applySidebarsVisibility();
    });
  }
  if (dom.closeStatsBtn) {
    dom.closeStatsBtn.addEventListener("click", () => {
      appState.state.settings.hideStats = true;
      persist();
      applySidebarsVisibility();
    });
  }

  // History Sidebar Toggle & Close
  if (dom.toggleHistoryBtn) {
    dom.toggleHistoryBtn.addEventListener("click", () => {
      appState.state.settings.hideHistory = !appState.state.settings.hideHistory;
      persist();
      applySidebarsVisibility();
    });
  }
  if (dom.closeHistoryBtn) {
    dom.closeHistoryBtn.addEventListener("click", () => {
      appState.state.settings.hideHistory = true;
      persist();
      applySidebarsVisibility();
    });
  }

  // Explorer Sidebar Toggles & Close
  const explorerToggles = [dom.toggleExplorerImportBtn, dom.toggleExplorerFlashcardsBtn, dom.toggleExplorerQuizBtn];
  explorerToggles.forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        appState.state.settings.hideExplorer = !appState.state.settings.hideExplorer;
        persist();
        applySidebarsVisibility();
      });
    }
  });
  if (dom.closeExplorerBtn) {
    dom.closeExplorerBtn.addEventListener("click", () => {
      appState.state.settings.hideExplorer = true;
      persist();
      applySidebarsVisibility();
    });
  }

  // Export Buttons
  if (dom.exportButton) {
    dom.exportButton.addEventListener("click", exportSet);
  }
  if (dom.exportAnkiBtn) {
    dom.exportAnkiBtn.addEventListener("click", exportAnkiCsv);
  }

  // Study Set Actions
  if (dom.deleteAllWords) {
    dom.deleteAllWords.addEventListener("click", () => {
      const lesson = currentLesson();
      if (lesson) {
        if (confirm(`Are you sure you want to delete all words in "${lesson.name}"? This cannot be undone.`)) {
          if (lesson.terms) {
            lesson.terms.forEach(t => {
              appState.state.learned.delete(t.id);
              appState.state.mistakes.delete(t.id);
            });
            lesson.terms = [];
          }
          lesson.questions = [];
          appState.state.activeIndex = 0;
          appState.studyTerms = null; // force reload
          persist();
          notifyStateChange();
          showToast("Deleted all words in current lesson.", "info");
        }
      }
    });
  }

  if (dom.sampleButton) {
    dom.sampleButton.addEventListener("click", loadSample);
  }
  if (dom.processButton) {
    dom.processButton.addEventListener("click", processStudySet);
  }

  // File Upload Handlers
  if (dom.fileInput) {
    dom.fileInput.addEventListener("change", handleFileInput);
  }
  if (dom.styleBlueprintInput) {
    dom.styleBlueprintInput.addEventListener("change", handleBlueprintInput);
  }
  if (dom.clearBlueprint) {
    dom.clearBlueprint.addEventListener("click", clearBlueprintFile);
  }

  // Settings API key panel
  if (dom.saveKeyBtn) {
    dom.saveKeyBtn.addEventListener("click", saveApiKey);
  }
  if (dom.deleteKeyBtn) {
    dom.deleteKeyBtn.addEventListener("click", deleteApiKey);
  }
  if (dom.apiKeyInput) {
    dom.apiKeyInput.addEventListener("input", () => {
      if (dom.saveKeyBtn) {
        dom.saveKeyBtn.disabled = !dom.apiKeyInput.value.trim();
      }
    });
  }

  // Settings modal events
  if (dom.settingsBtn) {
    dom.settingsBtn.addEventListener("click", openSettingsModal);
  }
  if (dom.closeSettingsBtn) {
    dom.closeSettingsBtn.addEventListener("click", closeSettingsModal);
  }
  if (dom.settingsModal) {
    dom.settingsModal.addEventListener("click", event => {
      if (event.target === dom.settingsModal) {
        closeSettingsModal();
      }
    });
  }
  if (dom.saveSettingsBtn) {
    dom.saveSettingsBtn.addEventListener("click", saveSettings);
  }
  if (dom.resetSettingsDefaultsBtn) {
    dom.resetSettingsDefaultsBtn.addEventListener("click", resetSettingsToDefaults);
  }

  // Manual Row Actions
  if (dom.addManualRow) {
    dom.addManualRow.addEventListener("click", () => {
      appState.manualRows.push({ target: "", english: "", arabic: "", article: "" });
      renderManualRows();
    });
  }

  if (dom.manualRows) {
    dom.manualRows.addEventListener("input", event => {
      const row = event.target.closest("[data-row-index]");
      if (row) {
        const index = Number(row.dataset.rowIndex);
        const article = row.querySelector('[data-field="article"]')?.value || "";
        const target = row.querySelector('[data-field="target"]')?.value || "";
        const english = row.querySelector('[data-field="english"]')?.value || "";
        const arabic = row.querySelector('[data-field="arabic"]')?.value || "";
        appState.manualRows[index] = { target, english, arabic, article };
      }
    });

    dom.manualRows.addEventListener("click", event => {
      const removeBtn = event.target.closest("[data-remove-row]");
      if (removeBtn) {
        const row = removeBtn.closest("[data-row-index]");
        if (row) {
          const index = Number(row.dataset.rowIndex);
          appState.manualRows.splice(index, 1);
          if (appState.manualRows.length === 0) {
            appState.manualRows.push({ target: "", english: "", arabic: "", article: "" });
          }
          renderManualRows();
        }
      }
    });
  }

  // Drag and Drop files
  if (dom.fileDrop) {
    dom.fileDrop.addEventListener("dragover", event => {
      event.preventDefault();
      dom.fileDrop.classList.add("dragover");
    });
    dom.fileDrop.addEventListener("dragleave", () => {
      dom.fileDrop.classList.remove("dragover");
    });
    dom.fileDrop.addEventListener("drop", event => {
      event.preventDefault();
      dom.fileDrop.classList.remove("dragover");
      const file = event.dataTransfer.files[0];
      if (file) {
        processUploadedFile(file);
      }
    });
  }

  // Quiz events
  if (dom.startQuiz) {
    dom.startQuiz.addEventListener("click", () => triggerQuizStart("all"));
  }
  if (dom.retryMistakes) {
    dom.retryMistakes.addEventListener("click", () => triggerQuizStart("mistakes"));
  }
  if (dom.quizAgain) {
    dom.quizAgain.addEventListener("click", () => triggerQuizStart("all"));
  }
  if (dom.quizMistakesOnly) {
    dom.quizMistakesOnly.addEventListener("click", () => triggerQuizStart("mistakes"));
  }
  if (dom.nextQuestion) {
    dom.nextQuestion.addEventListener("click", advanceQuestion);
  }
  if (dom.exportPdfBtn) dom.exportPdfBtn.addEventListener("click", exportQuizToPdf);
  if (dom.exportPdfBtnSetup) dom.exportPdfBtnSetup.addEventListener("click", exportQuizToPdf);

  // Subject & Focus Selection Modal Bindings
  if (dom.modalSubjectSelect) {
    dom.modalSubjectSelect.addEventListener("change", () => {
      populateFocusDropdown(dom.modalSubjectSelect.value, "Mixed");
      updateModalLabelsAndVisibility();
      if (dom.confirmSubjectFocusBtn) {
        dom.confirmSubjectFocusBtn.disabled = !dom.modalSubjectSelect.value || !dom.modalFocusSelect.value;
      }
    });
  }

  if (dom.modalFocusSelect) {
    dom.modalFocusSelect.addEventListener("change", () => {
      if (dom.confirmSubjectFocusBtn) {
        dom.confirmSubjectFocusBtn.disabled = !dom.modalSubjectSelect.value || !dom.modalFocusSelect.value;
      }
    });
  }

  // Bind change listener to modal count mode radios
  document.querySelectorAll('input[name="modal-question-count-mode"]').forEach(radio => {
    radio.addEventListener("change", updateModalLabelsAndVisibility);
  });

  // Bind change listener to modal output type checkboxes
  const checkFlashcards = document.getElementById("modal-include-flashcards");
  const checkQuiz = document.getElementById("modal-include-quiz");
  const checkSummary = document.getElementById("modal-include-summary");

  function handleCheckboxChange(e) {
    if (checkFlashcards && checkQuiz && checkSummary) {
      if (!checkFlashcards.checked && !checkQuiz.checked && !checkSummary.checked) {
        e.target.checked = true;
        showToast("At least one option must be selected.", "warning");
      }
    }
    updateModalLabelsAndVisibility();
  }

  if (checkFlashcards) checkFlashcards.addEventListener("change", handleCheckboxChange);
  if (checkQuiz) checkQuiz.addEventListener("change", handleCheckboxChange);
  if (checkSummary) checkSummary.addEventListener("change", handleCheckboxChange);

  if (dom.regenerateSummaryBtn) {
    dom.regenerateSummaryBtn.addEventListener("click", triggerSummaryGeneration);
  }

  if (dom.confirmSubjectFocusBtn) {
    dom.confirmSubjectFocusBtn.addEventListener("click", () => {
      pendingSubject = dom.modalSubjectSelect.value;
      pendingFocusType = dom.modalFocusSelect.value;
      if (dom.subjectFocusModal) {
        dom.subjectFocusModal.classList.add("hidden");
      }
      processStudySet();
    });
  }

  if (dom.cancelSubjectFocusBtn) {
    dom.cancelSubjectFocusBtn.addEventListener("click", () => {
      pendingSubject = null;
      pendingFocusType = null;
      if (dom.subjectFocusModal) {
        dom.subjectFocusModal.classList.add("hidden");
      }
    });
  }

  // Initialize modular component event handlers
  initExplorer();
  initFlashcards();
  initSearch();
  initInsights();

  // Achievements Modal bindings
  if (dom.achievementsBtn) {
    dom.achievementsBtn.addEventListener("click", openAchievementsModal);
  }
  if (dom.closeAchievementsBtn) {
    dom.closeAchievementsBtn.addEventListener("click", closeAchievementsModal);
  }
  if (dom.closeAchievementsOkBtn) {
    dom.closeAchievementsOkBtn.addEventListener("click", closeAchievementsModal);
  }
  if (dom.achievementsModal) {
    dom.achievementsModal.addEventListener("click", event => {
      if (event.target === dom.achievementsModal) {
        closeAchievementsModal();
      }
    });
  }

  // Window event listener for XP / achievements progress
  window.addEventListener("xp-gained", handleXpGainedEvent);

  // State changes trigger complete UI re-renders
  onStateChange(() => {
    renderAll();
  });
}

function registerCallbacks() {
  registerQuizCallbacks({
    onStart: () => {
      dom.quizSetup.classList.add("hidden");
      dom.quizResults.classList.add("hidden");
      dom.quizActive.classList.remove("hidden");
      dom.nextQuestion.classList.add("hidden");
    },
    onQuestion: () => {
      const question = getCurrentQuestion();
      if (!question) return;

      dom.questionType.textContent = question.typeLabel;
      dom.questionPrompt.innerHTML = sanitizeQuestionHtml(question.prompt);
      dom.feedbackLine.textContent = "";
      dom.nextQuestion.classList.add("hidden");
      
      const currentIdx = quizSession.current;
      const totalLen = quizSession.questions.length;
      dom.quizProgressBar.style.width = `${((currentIdx + 1) / totalLen) * 100}%`;
      
      if (dom.quizCount) {
        dom.quizCount.textContent = `${currentIdx + 1} of ${totalLen}`;
      }

      dom.choiceGrid.innerHTML = question.choices
        .map(
          (choice, index) =>
            `<button type="button" class="w-full text-left px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" data-choice="${index}">${escapeHtml(choice)}</button>`
        )
        .join("");

      dom.choiceGrid.querySelectorAll("button").forEach(button => {
        button.addEventListener("click", () => answerQuestion(Number(button.dataset.choice)));
      });
    },
    onAnswer: (choiceIndex, isCorrect, question) => {
      dom.choiceGrid.querySelectorAll("button").forEach((button, index) => {
        button.disabled = true;
        button.classList.remove("hover:bg-zinc-100", "dark:hover:bg-zinc-800");
        if (index === question.answerIndex) {
          button.classList.add("bg-emerald-500/10", "border-emerald-500", "text-emerald-700", "dark:text-emerald-450", "font-medium");
        }
        if (index === choiceIndex && !isCorrect) {
          button.classList.add("bg-rose-500/10", "border-rose-500", "text-rose-700", "dark:text-rose-455");
        }
      });

      dom.feedbackLine.innerHTML = `<span class="${isCorrect ? 'text-emerald-600 dark:text-emerald-450 font-bold' : 'text-rose-600 dark:text-rose-455 font-bold'}">${isCorrect ? 'Correct!' : 'Incorrect.'}</span> ${question.explanation}`;
      dom.nextQuestion.classList.remove("hidden");
    },
    onFinish: (percent, correct, total) => {
      dom.quizActive.classList.add("hidden");
      dom.quizResults.classList.remove("hidden");
      dom.quizSetup.classList.remove("hidden");
      
      dom.scoreRing.textContent = `${percent}%`;
      dom.scoreRing.style.setProperty("--score", `${percent}%`);
      dom.scoreHeading.textContent = percent >= 80 ? "Strong result" : "Keep practicing";
      dom.scoreDetails.textContent = `${correct} correct out of ${total}. Mistakes saved for targeted retry.`;
      
      showToast(`Quiz completed with ${percent}% accuracy!`, "success");
    },
    onTimerTick: (timeStr) => {
      dom.timerDisplay.textContent = timeStr;
    }
  });
}

// API key buttons mapping

function loadSavedApiKey() {
  const savedKey = localStorage.getItem("hackclub-api-key") || 
                    localStorage.getItem("hackclub_api_key") || 
                    localStorage.getItem("gemini-api-key") || 
                    localStorage.getItem("gemini_api_key") || "";
  if (dom.apiKeyInput) {
    dom.apiKeyInput.value = savedKey;
  }
  updateApiKeyButtons(savedKey);
}

function saveApiKey() {
  const key = dom.apiKeyInput?.value.trim();
  if (key) {
    localStorage.setItem("hackclub-api-key", key);
    updateApiKeyButtons(key);
    if (dom.settingsApiKeyInput) {
      dom.settingsApiKeyInput.value = key;
    }
    showToast("API key saved successfully.", "success");
  }
}

function deleteApiKey() {
  localStorage.removeItem("hackclub-api-key");
  localStorage.removeItem("hackclub_api_key");
  localStorage.removeItem("gemini-api-key");
  localStorage.removeItem("gemini_api_key");
  if (dom.apiKeyInput) {
    dom.apiKeyInput.value = "";
  }
  if (dom.settingsApiKeyInput) {
    dom.settingsApiKeyInput.value = "";
  }
  updateApiKeyButtons("");
  showToast("API key deleted.", "info");
}

function updateApiKeyButtons(key) {
  if (dom.deleteKeyBtn) {
    dom.deleteKeyBtn.disabled = !key;
  }
  if (dom.saveKeyBtn) {
    dom.saveKeyBtn.disabled = !key;
  }
  if (dom.processingMode) {
    const isAi = (appState.state?.settings?.engineMode || "ai") === "ai";
    if (isAi && key) {
      dom.processingMode.textContent = "AI Engine Enabled";
      dom.processingMode.className = `status-pill px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400`;
    } else if (isAi) {
      dom.processingMode.textContent = "AI Engine (No Key)";
      dom.processingMode.className = `status-pill px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-955/40 dark:text-amber-405`;
    } else {
      dom.processingMode.textContent = "Local Engine Mode";
      dom.processingMode.className = `status-pill px-2 py-0.5 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400`;
    }
  }
}

// Blueprint files
function handleBlueprintInput(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  
  appState.blueprintFiles = files;
  if (dom.blueprintName) {
    dom.blueprintName.textContent = `${files.length} file(s) selected`;
  }
  if (dom.clearBlueprint) {
    dom.clearBlueprint.disabled = false;
  }
  renderBlueprintList();
  showToast(`${files.length} blueprint file(s) loaded.`, "info");
}

function clearBlueprintFile() {
  appState.blueprintFiles = [];
  if (dom.styleBlueprintInput) {
    dom.styleBlueprintInput.value = "";
  }
  if (dom.blueprintName) {
    dom.blueprintName.textContent = "Upload exam PDFs";
  }
  if (dom.clearBlueprint) {
    dom.clearBlueprint.disabled = true;
  }
  renderBlueprintList();
  showToast("Blueprint files cleared.", "info");
}

function renderBlueprintList() {
  const list = document.getElementById("blueprint-list");
  if (!list) return;

  if (!appState.blueprintFiles.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = appState.blueprintFiles.map((file, index) => {
    const sizeKb = Math.round(file.size / 1024);
    return `
      <div class="p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between text-xs">
        <span class="truncate max-w-[180px] font-medium">${escapeHtml(file.name)}</span>
        <span class="text-zinc-450 font-mono font-bold">${sizeKb} KB</span>
      </div>
    `;
  }).join("");
}

// Manual Table
function collectManualRows() {
  return appState.manualRows.filter(row => row.target.trim() && (row.english.trim() || row.arabic.trim()));
}

function renderManualRows() {
  if (!dom.manualRows) return;
  dom.manualRows.innerHTML = appState.manualRows.map((row, index) => {
    const article = row.article || "";
    return `
      <tr class="border-b border-zinc-100 dark:border-zinc-800/80" data-row-index="${index}">
        <td class="p-2 pl-0 w-16 min-w-[64px]">
          <input type="text" data-field="article" value="${escapeHtml(article)}" placeholder="Art." class="w-full text-xs bg-transparent border-0 outline-none p-1 focus:ring-1 focus:ring-brand-500 rounded font-medium text-zinc-400 dark:text-zinc-550" />
        </td>
        <td class="p-2">
          <input type="text" data-field="target" value="${escapeHtml(row.target)}" placeholder="e.g. adjacent" class="w-full text-xs bg-transparent border-0 outline-none p-1 focus:ring-1 focus:ring-brand-500 rounded" />
        </td>
        <td class="p-2">
          <input type="text" data-field="english" value="${escapeHtml(row.english)}" placeholder="e.g. next to" class="w-full text-xs bg-transparent border-0 outline-none p-1 focus:ring-1 focus:ring-brand-500 rounded" />
        </td>
        <td class="p-2">
          <input type="text" data-field="arabic" value="${escapeHtml(row.arabic)}" placeholder="e.g. translation (Arabic)" class="w-full text-xs bg-transparent border-0 outline-none p-1 focus:ring-1 focus:ring-brand-500 rounded text-right" dir="rtl" />
        </td>
        <td class="p-2 pr-0 text-center">
          <button type="button" class="text-zinc-400 hover:text-rose-500 transition-colors p-1" data-remove-row="true">
            <svg class="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// Processing
async function processStudySet() {
  const manual = collectManualRows();
  const text = (dom.textInput?.value || "").trim() || appState.selectedFileText.trim();
  const userApiKey = localStorage.getItem("hackclub-api-key") || "";

  if (text.length < 3 && !manual.length && !appState.selectedFileMedia) {
    showToast("Upload a file, paste text, or fill manual vocabulary rows first.", "error");
    return;
  }

  const isAiEngine = (appState.state.settings?.engineMode || "ai") === "ai";

  // Intercept and ask user for Subject and Focus if not already set
  if (!pendingSubject) {
    let detectedSubject = "English"; // Default pre-selection
    let isAutoDetected = false;

    // Call detect-subject if AI is enabled and we have some text
    if (isAiEngine && userApiKey && text.length >= 3) {
      showLoading("Auto-detecting Subject", "Analyzing study material subject in the background...");
      try {
        const detectRes = await detectSubject(text);
        if (detectRes && detectRes.subject) {
          detectedSubject = detectRes.subject;
          isAutoDetected = true;
        }
      } catch (err) {
        console.warn("Auto-subject detection failed:", err);
      }
      hideLoading();
    }

    // Configure and show the modal
    const subjectSelect = document.getElementById("modal-subject-select");
    const focusSelect = document.getElementById("modal-focus-select");
    const banner = document.getElementById("subject-auto-detect-banner");
    const detectedName = document.getElementById("detected-subject-name");
    const confirmBtn = document.getElementById("confirm-subject-focus-btn");
    const modal = document.getElementById("subject-focus-modal");

    if (modal && subjectSelect && focusSelect) {
      subjectSelect.value = detectedSubject;
      populateFocusDropdown(detectedSubject, "Mixed");
      updateModalLabelsAndVisibility();

      if (isAutoDetected && banner && detectedName) {
        detectedName.textContent = detectedSubject;
        banner.classList.remove("hidden");
      } else if (banner) {
        banner.classList.add("hidden");
      }

      if (confirmBtn) confirmBtn.disabled = false;
      modal.classList.remove("hidden");
    }
    return;
  }

  const chosenSubject = pendingSubject;
  const chosenFocusType = pendingFocusType;

  // Reset for next runs
  pendingSubject = null;
  pendingFocusType = null;

  showLoading("Generating Study Set", "Extracting vocabulary terms and definitions...");

  const difficulty = "all";
  const focus = document.querySelector('input[name="quiz-focus"]:checked')?.value || "mixed";
  const mode = document.querySelector('input[name="modal-question-count-mode"]:checked')?.value || "per-word";
  
  const includeFlashcards = document.getElementById("modal-include-flashcards")?.checked !== false;
  const includeQuiz = document.getElementById("modal-include-quiz")?.checked !== false;
  const includeSummary = document.getElementById("modal-include-summary")?.checked !== false;

  let outputType = "both";
  if (includeFlashcards && !includeQuiz) {
    outputType = "flashcards";
  } else if (!includeFlashcards && includeQuiz) {
    outputType = "questions";
  }
  
  let perWord = 2;
  let maxTerms = 120;
  if (mode === "per-word" && dom.modalPerWordCount) {
    perWord = clamp(Number(dom.modalPerWordCount.value || 2), 1, 50);
  } else if (mode === "total" && dom.modalTotalQuestions) {
    maxTerms = clamp(Number(dom.modalTotalQuestions.value || 30), 1, 5000);
  }

  let finalTerms = [];
  let finalQuestions = [];
  let finalSummary = null;
  let detectedLanguage = null;
  let detectedUnit = null;
  let detectedLesson = null;

  try {
    // OCR Extraction
    if (appState.selectedFileMedia && text.length < 3 && !manual.length) {
      if (!isAiEngine) {
        throw new Error("OCR extraction requires AI Engine. Please switch Generation Engine to AI in Settings.");
      }
      if (!userApiKey) {
        throw new Error("API key required for scanned document or image OCR processing.");
      }
      showLoading("Generating Study Set", "Performing OCR and extracting vocabulary terms via AI...");
      const ocrResult = await extractWordsFromImageWithGemini(appState.selectedFileMedia);
      const extractedTerms = ocrResult.terms || [];
      if (!extractedTerms.length) {
         throw new Error("No vocabulary terms could be extracted from this image.");
      }
      detectedLanguage = ocrResult.detectedLanguage || detectedLanguage;
      detectedUnit = ocrResult.detectedUnit || detectedUnit;
      detectedLesson = ocrResult.detectedLesson || detectedLesson;
      finalTerms = buildTermsFromRows(extractedTerms, { maxTerms });
    } else {
      if (manual.length > 0) {
        finalTerms = buildTermsFromRows(manual, { maxTerms });
      } else {
        showLoading("Generating Study Set", "Analyzing input text locally...");
        const result = await processVocabulary({ 
          text, 
          maxTerms, 
          difficulty, 
          perWord, 
          quizFocus: focus, 
          subject: chosenSubject, 
          focusType: chosenFocusType,
          contentType: outputType
        });
        finalTerms = buildTermsFromRows(result.terms || [], { maxTerms });
        detectedLanguage = result.detectedLanguage || detectedLanguage;
        detectedUnit = result.detectedUnit || detectedUnit;
        detectedLesson = result.detectedLesson || detectedLesson;
        finalSummary = result.summary || finalSummary;
      }
    }

    // AI Question & Flashcard Enrichment
    if (isAiEngine && userApiKey && (manual.length > 0 || text.length >= 3 || appState.selectedFileMedia)) {
      showLoading("Enriching Study Set", "Gemini is generating quizzes & translating terms...");
      
      let blueprintExamText = "";
      let blueprintImage = null;
      if (appState.blueprintFiles.length > 0) {
        const file = appState.blueprintFiles[0];
        if (file.type === "application/pdf") {
          const base64 = await fileToBase64(file);
          const extRes = await extractPdfFile({ fileName: file.name, mimeType: file.type, data: base64 });
          blueprintExamText = extRes.text || "";
        } else if (file.type.startsWith("image/")) {
          const base64 = await fileToBase64(file);
          blueprintImage = { mimeType: file.type, data: base64 };
        }
      }

      const aiResponse = await generateWithGemini({
        examText: blueprintExamText,
        terms: finalTerms,
        quizFocus: focus,
        subject: chosenSubject,
        focusType: chosenFocusType,
        perWord,
        media: appState.selectedFileMedia,
        blueprintMedia: blueprintImage,
        contentType: outputType
      });

      if (aiResponse.terms && aiResponse.terms.length > 0) {
        finalTerms = aiResponse.terms;
      }
      finalQuestions = aiResponse.questions || [];
      detectedLanguage = aiResponse.detectedLanguage || detectedLanguage;
      detectedUnit = aiResponse.detectedUnit || detectedUnit;
      detectedLesson = aiResponse.detectedLesson || detectedLesson;
      finalSummary = aiResponse.summary || finalSummary;
    } else {
      // Local fallback
      showLoading("Generating Local Set", "Building standard questions locally...");
      const fallbackResult = await regenerateQuiz(finalTerms, perWord, focus, "");
      finalQuestions = fallbackResult.questions || [];
      finalSummary = `Local extraction: generated ${finalTerms.length} flashcards from the provided material.`;
    }

    // Folder structural save
    const lesson = getOrCreateFolderStructure(detectedLanguage, detectedUnit, detectedLesson);
    lesson.terms = finalTerms;
    lesson.questions = finalQuestions;
    lesson.summary = finalSummary || lesson.summary || null;
    
    appState.state.activeIndex = 0;
    appState.cardFlipped = false;
    appState.studyTerms = null; // force reload studyTerms
    
    // Clear Inputs
    if (dom.textInput) dom.textInput.value = "";
    appState.manualRows = createEmptyManualRows();
    renderManualRows();
    appState.selectedFileText = "";
    appState.selectedFileMedia = null;
    appState.selectedFileName = "";
    if (dom.fileName) dom.fileName.textContent = "Choose a file";
    if (dom.fileInput) dom.fileInput.value = "";

    persist();
    notifyStateChange();
    hideLoading();
    
    if (includeSummary) {
      switchView("summary");
      renderSummary();
    } else if (includeQuiz) {
      switchView("quiz");
    } else {
      switchView("flashcards");
    }
    
    showToast(`Study Set "${lesson.name}" generated successfully.`, "success");
  } catch (error) {
    console.error("Generation error:", error);
    hideLoading();
    showToast(error.message, "error");
  }
}

// Upload Actions
function handleFileInput(event) {
  const file = event.target.files[0];
  if (file) {
    processUploadedFile(file);
  }
}

async function processUploadedFile(file) {
  showLoading("Reading File", `Extracting text from "${file.name}"...`);
  appState.selectedFileName = file.name;
  if (dom.fileName) {
    dom.fileName.textContent = file.name;
  }

  try {
    if (file.type === "application/pdf") {
      const base64 = await fileToBase64(file);
      let extRes = { text: "" };
      try {
        extRes = await extractPdfFile({ fileName: file.name, mimeType: file.type, data: base64 });
      } catch (err) {
        console.warn("Local PDF text extraction failed. OCR fallback will be used if needed.", err);
      }
      appState.selectedFileText = extRes.text || "";
      if (appState.selectedFileText.trim().length < 3) {
        appState.selectedFileMedia = { mimeType: file.type, data: base64, filename: file.name };
      } else {
        appState.selectedFileMedia = null;
      }
    } else if (file.type.startsWith("image/")) {
      const base64 = await fileToBase64(file);
      appState.selectedFileMedia = { mimeType: file.type, data: base64 };
      appState.selectedFileText = "";
    } else {
      // Plain text or CSV
      const content = await extractFileContent(file);
      const textVal = (typeof content === "string" ? content : content?.text) || "";
      appState.selectedFileText = textVal;
      
      // Preserve media if the file reader returned it (e.g. image with wrong extension)
      if (content?.media) {
        appState.selectedFileMedia = content.media;
      } else {
        appState.selectedFileMedia = null;
      }
      
      if (content?.rows && content.rows.length > 0) {
        appState.manualRows = content.rows.map(normalizeRow);
        renderManualRows();
        showToast(`Extracted ${content.rows.length} table rows from DOCX.`, "success");
      } else {
        // Parse CSV/TSV table directly if applicable
        const parsed = parseDelimitedRows(textVal);
        if (parsed.length > 0) {
          appState.manualRows = parsed.map(normalizeRow);
          renderManualRows();
          showToast("Delimited text parsed into manual vocabulary table.", "success");
        }
      }
    }
    hideLoading();
    showToast(`File "${file.name}" loaded successfully.`, "success");
  } catch (error) {
    console.error(error);
    hideLoading();
    showToast(error.message, "error");
    appState.selectedFileName = "";
    if (dom.fileName) dom.fileName.textContent = "Choose a file";
  }
}

function loadSample() {
  const sampleText = `Topic: Essential Academic Vocabulary
Unit: Unit 1 - Introduction to Science
Lesson: Lesson 1.1 - The Scientific Method

empirical (adjective): based on, concerned with, or verifiable by observation or experience rather than theory or pure logic.
Example: The scientist provided empirical evidence to support her hypothesis.
Arabic: تجريبي

hypothesis (noun): a supposition or proposed explanation made on the basis of limited evidence as a starting point for further investigation.
Example: The research team formulated a new hypothesis to explain the results.
Arabic: فرضية

corroborate (verb): confirm or give support to (a statement, theory, or finding).
Example: Multiple witnesses came forward to corroborate the suspect's alibi.
Arabic: يؤكد / يعزز

transient (adjective): lasting only for a short time; impermanent.
Example: The doctor explained that the side effects of the drug were transient.
Arabic: عابر / زائل

aesthetic (adjective): concerned with beauty or the appreciation of beauty.
Example: The building design combines practical utility with aesthetic appeal.
Arabic: جمالي`;

  if (dom.textInput) {
    dom.textInput.value = sampleText;
  }
  showToast("Sample vocabulary text loaded.", "info");
}

// Quiz actions
function triggerQuizStart(mode) {
  const checked = checkedLessonIds;
  const focus = document.querySelector('input[name="quiz-focus"]:checked')?.value || "mixed";
  
  let quizPromise;
  if (checked.length > 0) {
    quizPromise = startMixedQuiz(checked, mode, { quizFocus: focus });
  } else {
    quizPromise = startQuiz(mode, { quizFocus: focus });
  }

  quizPromise
    .then(() => {
      switchView("quiz");
    })
    .catch(err => {
      showToast(err.message, "error");
    });
}

// Exports
function exportSet() {
  const lesson = currentLesson();
  if (!lesson) {
    showToast("No study set active.", "error");
    return;
  }
  downloadJson(`${lesson.name.replace(/\s+/g, "_")}_study_set.json`, lesson);
}

function exportAnkiCsv() {
  const lesson = currentLesson();
  if (!lesson || !lesson.terms || !lesson.terms.length) {
    showToast("No vocabulary cards available to export.", "error");
    return;
  }
  
  let csvContent = "";
  lesson.terms.forEach(t => {
    const word = (t.word || "").replace(/"/g, '""');
    
    let backSide = `<div><b>[${escapeHtml(t.partOfSpeech || "n/a")}]</b></div>`;
    backSide += `<div style='margin-top:5px;'>${escapeHtml(t.definition || "")}</div>`;
    if (t.arabic) {
      backSide += `<div style='margin-top:5px; color:#4f46e5; direction:rtl;'><b>${escapeHtml(t.arabic)}</b></div>`;
    }
    if (t.example) {
      backSide += `<div style='margin-top:8px; font-style:italic; color:#4b5563;'>Example: ${escapeHtml(t.example)}</div>`;
    }
    
    csvContent += `"${word}","${backSide.replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${lesson.name.replace(/\s+/g, "_")}_anki_deck.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Anki CSV deck generated successfully.", "success");
}

function exportQuizToPdf() {
  const questions = (quizSession && quizSession.questions) || (currentLesson() && currentLesson().questions) || [];
  if (!questions.length) {
    showToast("No questions available to export.", "error");
    return;
  }

  const container = document.createElement("div");
  container.style.padding = "40px";
  container.style.fontFamily = "system-ui, -apple-system, sans-serif";
  container.style.color = "#000";
  container.style.background = "#fff";

  let html = `
    <div style="font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.6; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 1px;">Official Examination</h1>
        <h2 style="margin: 5px 0; font-size: 18px; font-weight: normal;">Subject: ${appState.state.sourceName}</h2>
      </div>
      
      <table style="width: 100%; margin-bottom: 30px; font-size: 16px; border-collapse: collapse;">
        <tr>
          <td style="width: 45%;"><strong>Student Name:</strong> ___________________________</td>
          <td style="width: 30%;"><strong>Date:</strong> _______________</td>
          <td style="width: 25%; text-align: right;"><strong>Score:</strong> _______ / ${questions.length}</td>
        </tr>
      </table>

      <div style="font-size: 16px; font-weight: bold; margin-bottom: 25px;">
        Instructions: Read each question carefully and select the correct option.
      </div>
  `;

  questions.forEach((q, idx) => {
    let questionText = q.prompt || "";
    html += `
      <div style="margin-bottom: 25px; page-break-inside: avoid;">
        <div style="font-size: 16px; margin-bottom: 10px;">
          <strong>${idx + 1}.</strong> ${questionText}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-left: 20px; font-size: 15px;">
          ${q.choices.map((c, cIdx) => `<div><strong>${String.fromCharCode(65 + cIdx)})</strong> ${c}</div>`).join("")}
        </div>
      </div>
    `;
  });

  html += `
      <div style="margin-top: 50px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px; font-size: 14px; color: #666;">
        End of Examination. Generated by Smart Flashcards & Quiz Engine.
      </div>
    </div>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  const opt = {
    margin: 15,
    filename: `quiz_examination_${Date.now()}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  window.html2pdf().from(container).set(opt).save().then(() => {
    document.body.removeChild(container); // Cleanup
  }).catch((err) => {
    console.error("PDF generation failed:", err);
    showToast("Failed to generate PDF booklet.", "error");
    document.body.removeChild(container); // Cleanup
  });
}

function renderMarkdown(text) {
  if (!text) return "";
  
  if (window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(text);
  }
  
  let html = escapeHtml(text);
  
  // Replace bold markers **text** with <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Replace italic markers *text* with <em>text</em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Handle headings
  html = html.replace(/### (.*?)(?:\n|$)/g, '<h4 class="text-sm font-bold mt-2">$1</h4>')
             .replace(/## (.*?)(?:\n|$)/g, '<h3 class="text-base font-bold mt-3">$1</h3>');

  // Handle lists. Split by lines and process.
  const lines = html.split('\n');
  let inList = false;
  const processedLines = [];
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        processedLines.push('<ul class="list-disc pl-5 my-1.5 space-y-1">');
        inList = true;
      }
      const itemContent = trimmed.substring(2);
      processedLines.push(`<li>${itemContent}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  if (inList) {
    processedLines.push('</ul>');
  }
  
  return processedLines.join('<br>');
}

export function renderSummary() {
  const lesson = currentLesson();
  if (!dom.summaryContent) return;

  if (!lesson) {
    dom.summaryContent.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-zinc-400">
        <span class="text-4xl mb-3">📄</span>
        <p class="text-sm">No study material loaded. Generate a study set or select a lesson to view its summary.</p>
      </div>
    `;
    if (dom.regenerateSummaryBtn) dom.regenerateSummaryBtn.classList.add("hidden");
    return;
  }

  if (lesson.summary) {
    let htmlContent = renderMarkdown(lesson.summary);
    dom.summaryContent.innerHTML = `
      <div class="prose dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
        ${htmlContent}
      </div>
    `;
    if (dom.regenerateSummaryBtn) {
      dom.regenerateSummaryBtn.classList.remove("hidden");
      dom.regenerateSummaryBtn.textContent = "Regenerate Summary";
    }
  } else {
    dom.summaryContent.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-zinc-400 gap-4">
        <span class="text-4xl mb-1">📝</span>
        <p class="text-sm text-center">No summary is generated for this lesson yet.</p>
        <button id="generate-summary-btn-inline" class="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all shadow-md shadow-brand-500/25 text-xs">
          Generate AI Summary
        </button>
      </div>
    `;
    if (dom.regenerateSummaryBtn) dom.regenerateSummaryBtn.classList.add("hidden");

    const btn = document.getElementById("generate-summary-btn-inline");
    if (btn) {
      btn.addEventListener("click", triggerSummaryGeneration);
    }
  }
}

async function triggerSummaryGeneration() {
  const lesson = currentLesson();
  if (!lesson || !lesson.terms.length) {
    showToast("No vocabulary terms available to summarize.", "error");
    return;
  }

  const isAiEngine = (appState.state.settings?.engineMode || "ai") === "ai";
  if (!isAiEngine) {
    showToast("AI summary generation requires AI Engine. Switch to AI Engine in Settings.", "error");
    return;
  }

  const key = localStorage.getItem("hackclub-api-key") || 
              localStorage.getItem("hackclub_api_key") || 
              localStorage.getItem("gemini-api-key") || 
              localStorage.getItem("gemini_api_key");
  if (!key) {
    showToast("API key required to generate summary.", "error");
    return;
  }

  showLoading("Generating Summary", "Analyzing lesson content and creating overview...");
  try {
    const subject = dom.modalSubjectSelect?.value || "English";
    const focusType = dom.modalFocusSelect?.value || "Mixed";

    const response = await fetch("/api/summarize-lesson", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "x-engine-mode": "ai"
      },
      body: JSON.stringify({
        terms: lesson.terms,
        subject,
        focusType
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to generate summary.");
    }

    lesson.summary = data.summary;
    persist();
    renderSummary();
    showToast("AI Summary generated successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  } finally {
    hideLoading();
  }
}

// General RenderAll
export function renderAll() {
  renderHeader();
  renderHome();
  renderImport();
  renderFlashcard();
  renderSummary();
  renderQuizHome();
  renderHistory();
  renderInsights();
  renderBreadcrumbs();
  renderExplorer();
}

function renderHeader() {
  const lesson = currentLesson();
  const terms = lesson ? (lesson.terms || []) : [];
  if (dom.setName) {
    dom.setName.textContent = terms.length
      ? `${lesson.name} - ${terms.length} words`
      : "No study set loaded";
  }
  renderStreakDisplay();

  // Update XP and Level display
  const xp = appState.state.settings?.totalXP || 0;
  const level = Math.floor(xp / 500) + 1;
  
  if (dom.xpDisplay) dom.xpDisplay.textContent = `${xp} XP`;
  if (dom.levelDisplay) dom.levelDisplay.textContent = `Lvl ${level}`;
}

function renderImport() {
  if (dom.textInput) {
    const lesson = currentLesson();
    const terms = lesson ? (lesson.terms || []) : [];
    if (!terms.length && !dom.textInput.value) {
      dom.textInput.value = "";
    }
  }

  if (dom.fileName) {
    dom.fileName.textContent = appState.selectedFileName || "Choose a file";
  }

  renderManualRows();
  renderBlueprintList();

  if (dom.clearBlueprint) {
    dom.clearBlueprint.disabled = !appState.blueprintFiles.length;
  }
}

async function renderQuizHome() {
  // Don't overwrite quiz counter during an active quiz session
  if (quizSession && quizSession.questions && quizSession.questions.length > 0) {
    return;
  }
  const lesson = currentLesson();
  const questions = (lesson && lesson.questions) || [];
  if (dom.quizCount) dom.quizCount.textContent = `${questions.length} questions`;
  if (dom.timerToggle) dom.timerToggle.checked = appState.state.settings.timerMode;
  
  const hasQuestions = questions.length > 0;
  if (dom.exportPdfBtn) dom.exportPdfBtn.disabled = !hasQuestions;
  if (dom.exportPdfBtnSetup) dom.exportPdfBtnSetup.disabled = !hasQuestions;
  
  renderHistory();
}

// Settings Modal functions
function openSettingsModal() {
  const settings = appState.state.settings || {};
  const savedKey = localStorage.getItem("hackclub-api-key") || 
                    localStorage.getItem("hackclub_api_key") || 
                    localStorage.getItem("gemini-api-key") || 
                    localStorage.getItem("gemini_api_key") || "";

  if (dom.settingsApiKeyInput) dom.settingsApiKeyInput.value = savedKey;
  if (dom.settingsDailyGoal) dom.settingsDailyGoal.value = settings.dailyGoal ?? 12;
  if (dom.settingsSrsStartingEase) dom.settingsSrsStartingEase.value = settings.srsStartingEase ?? 2.4;
  if (dom.settingsSrsLeechThreshold) dom.settingsSrsLeechThreshold.value = settings.srsLeechThreshold ?? 5;
  if (dom.settingsSrsAgainPenalty) dom.settingsSrsAgainPenalty.value = settings.srsAgainPenalty ?? 0.22;
  if (dom.settingsSrsAgainInterval) dom.settingsSrsAgainInterval.value = settings.srsAgainIntervalHours ?? 20;
  if (dom.settingsSrsGoodBonus) dom.settingsSrsGoodBonus.value = settings.srsGoodBonus ?? 0.08;
  if (dom.settingsSrsEasyBonus) dom.settingsSrsEasyBonus.value = settings.srsEasyBonus ?? 0.15;
  if (dom.settingsSrsEasyMultiplier) dom.settingsSrsEasyMultiplier.value = settings.srsEasyMultiplier ?? 2.0;

  // Set Engine Mode radio
  const modeVal = settings.engineMode || "ai";
  const radios = document.getElementsByName("settings-engine-mode");
  radios.forEach(radio => {
    radio.checked = (radio.value === modeVal);
  });

  // Set API Base URL and Default Model
  if (dom.settingsApiBaseUrl) dom.settingsApiBaseUrl.value = settings.apiBaseUrl || "https://ai.hackclub.com/proxy/v1";
  if (dom.settingsApiModel) dom.settingsApiModel.value = settings.apiModel || "openai/gpt-5.5";

  if (dom.settingsModal) {
    dom.settingsModal.classList.remove("hidden");
  }
}

function closeSettingsModal() {
  if (dom.settingsModal) {
    dom.settingsModal.classList.add("hidden");
  }
}

function resetSettingsToDefaults() {
  if (dom.settingsDailyGoal) dom.settingsDailyGoal.value = 12;
  if (dom.settingsSrsStartingEase) dom.settingsSrsStartingEase.value = 2.4;
  if (dom.settingsSrsLeechThreshold) dom.settingsSrsLeechThreshold.value = 5;
  if (dom.settingsSrsAgainPenalty) dom.settingsSrsAgainPenalty.value = 0.22;
  if (dom.settingsSrsAgainInterval) dom.settingsSrsAgainInterval.value = 20;
  if (dom.settingsSrsGoodBonus) dom.settingsSrsGoodBonus.value = 0.08;
  if (dom.settingsSrsEasyBonus) dom.settingsSrsEasyBonus.value = 0.15;
  if (dom.settingsSrsEasyMultiplier) dom.settingsSrsEasyMultiplier.value = 2.0;

  const radios = document.getElementsByName("settings-engine-mode");
  radios.forEach(radio => {
    radio.checked = (radio.value === "ai");
  });

  if (dom.settingsApiBaseUrl) dom.settingsApiBaseUrl.value = "https://ai.hackclub.com/proxy/v1";
  if (dom.settingsApiModel) dom.settingsApiModel.value = "openai/gpt-5.5";

  showToast("Form fields reset to defaults (click Save to apply).", "info");
}

function saveSettings() {
  const apiKey = dom.settingsApiKeyInput?.value.trim() || "";
  const dailyGoal = clamp(Number(dom.settingsDailyGoal?.value || 12), 1, 1000);
  const startingEase = clamp(Number(dom.settingsSrsStartingEase?.value || 2.4), 1.3, 5.0);
  const leechThreshold = clamp(Number(dom.settingsSrsLeechThreshold?.value || 5), 2, 50);
  const againPenalty = clamp(Number(dom.settingsSrsAgainPenalty?.value || 0.22), 0.0, 2.0);
  const againInterval = clamp(Number(dom.settingsSrsAgainInterval?.value || 20), 1, 168);
  const goodBonus = clamp(Number(dom.settingsSrsGoodBonus?.value || 0.08), 0.0, 1.0);
  const easyBonus = clamp(Number(dom.settingsSrsEasyBonus?.value || 0.15), 0.0, 2.0);
  const easyMultiplier = clamp(Number(dom.settingsSrsEasyMultiplier?.value || 2.0), 1.0, 10.0);

  const selectedEngine = document.querySelector('input[name="settings-engine-mode"]:checked')?.value || "ai";
  const apiBaseUrl = dom.settingsApiBaseUrl?.value.trim() || "https://ai.hackclub.com/proxy/v1";
  const apiModel = dom.settingsApiModel?.value.trim() || "openai/gpt-5.5";

  appState.state.settings.dailyGoal = dailyGoal;
  appState.state.settings.srsStartingEase = startingEase;
  appState.state.settings.srsLeechThreshold = leechThreshold;
  appState.state.settings.srsAgainPenalty = againPenalty;
  appState.state.settings.srsAgainIntervalHours = againInterval;
  appState.state.settings.srsGoodBonus = goodBonus;
  appState.state.settings.srsEasyBonus = easyBonus;
  appState.state.settings.srsEasyMultiplier = easyMultiplier;

  appState.state.settings.engineMode = selectedEngine;
  appState.state.settings.apiBaseUrl = apiBaseUrl;
  appState.state.settings.apiModel = apiModel;

  if (apiKey) {
    localStorage.setItem("hackclub-api-key", apiKey);
  } else {
    localStorage.removeItem("hackclub-api-key");
    localStorage.removeItem("hackclub_api_key");
    localStorage.removeItem("gemini-api-key");
    localStorage.removeItem("gemini_api_key");
  }
  if (dom.apiKeyInput) {
    dom.apiKeyInput.value = apiKey;
  }
  updateApiKeyButtons(apiKey);

  persist();
  notifyStateChange();
  closeSettingsModal();
  showToast("Settings saved successfully.", "success");
}

// --- ACHIEVEMENTS & GAMIFICATION RENDERING ---
const ALL_BADGES = [
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Studied before 8:00 AM 🌅",
    icon: "🌅"
  },
  {
    id: "vocab_master",
    name: "Vocabulary Master",
    description: "Learned 100 or more words 📚",
    icon: "📚"
  },
  {
    id: "streak_king",
    name: "Streak King",
    description: "Reached a 7-day study streak 👑",
    icon: "👑"
  }
];

function openAchievementsModal() {
  renderAchievements();
  if (dom.achievementsModal) {
    dom.achievementsModal.classList.remove("hidden");
  }
}

function closeAchievementsModal() {
  if (dom.achievementsModal) {
    dom.achievementsModal.classList.add("hidden");
  }
}

function renderAchievements() {
  if (!dom.achievementsList) return;
  const unlockedBadges = appState.state.badges || [];
  
  dom.achievementsList.innerHTML = ALL_BADGES.map(badge => {
    const isUnlocked = unlockedBadges.includes(badge.id);
    return `
      <div class="flex items-center gap-4 p-4 border rounded-xl transition-all ${isUnlocked ? 'border-indigo-150 bg-indigo-50/10 dark:bg-indigo-950/10' : 'border-zinc-200 dark:border-zinc-800 opacity-40 grayscale'}">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-zinc-100 dark:bg-zinc-850 shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
          ${badge.icon}
        </div>
        <div class="flex-1 min-w-0 text-left">
          <h3 class="text-sm font-bold truncate">${badge.name}</h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">${badge.description}</p>
        </div>
        <div>
          ${isUnlocked 
            ? '<span class="status-pill px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">Unlocked</span>' 
            : '<span class="status-pill px-2.5 py-1 text-[11px] font-semibold rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">Locked</span>'
          }
        </div>
      </div>
    `;
  }).join("");
}

function handleXpGainedEvent(event) {
  const { amount, reason, totalXP, level, levelUp, newlyUnlocked } = event.detail;
  
  // 1. Show Toast for XP gained
  if (amount > 0) {
    let reasonText = "Activity";
    if (reason === "quiz_correct") reasonText = "Correct Answer";
    else if (reason === "quiz_complete") reasonText = "Quiz Completed";
    else if (reason === "daily_streak") reasonText = "Daily Study Streak";
    
    showToast(`+${amount} XP: ${reasonText}!`, "success");
  }
  
  // 2. Confetti and Toast for Level Up
  if (levelUp) {
    if (window.confetti) {
      window.confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
    showToast(`🎉 Level Up! You reached Level ${level}!`, "success");
  }
  
  // 3. Confetti and Toast for each newly unlocked badge
  if (newlyUnlocked && newlyUnlocked.length > 0) {
    newlyUnlocked.forEach(badgeId => {
      const badge = ALL_BADGES.find(b => b.id === badgeId);
      if (badge) {
        if (window.confetti) {
          window.confetti({
            particleCount: 100,
            spread: 60,
            colors: ["#FBBF24", "#F59E0B", "#FBBF24"], // Gold/yellow theme
            origin: { y: 0.6 }
          });
        }
        showToast(`🏆 Unlocked Badge: ${badge.name}!`, "success");
      }
    });
  }
}

function initChat() {
  if (!appState.chatSessions) {
    appState.chatSessions = {};
  }

  // Setup click handler for opening chat
  if (dom.askAiBtn) {
    dom.askAiBtn.addEventListener("click", () => {
      const lesson = currentLesson();
      if (!lesson) {
        showToast("Please open a lesson first.", "error");
        return;
      }
      openAiChat(lesson);
    });
  }

  // Close handlers
  if (dom.closeAiChatBtn) {
    dom.closeAiChatBtn.addEventListener("click", closeAiChat);
  }
  if (dom.aiChatBackdrop) {
    dom.aiChatBackdrop.addEventListener("click", closeAiChat);
  }

  // Form submit
  if (dom.aiChatForm) {
    dom.aiChatForm.addEventListener("submit", handleSendChatMessage);
  }
}

function openAiChat(lesson) {
  if (!dom.aiChatSidebar || !dom.aiChatBackdrop) return;
  
  // Show elements
  dom.aiChatSidebar.classList.remove("translate-x-full");
  dom.aiChatSidebar.classList.add("translate-x-0");
  dom.aiChatBackdrop.classList.remove("hidden");
  
  // Initialize history for the lesson if not exists
  if (!appState.chatSessions[lesson.id]) {
    appState.chatSessions[lesson.id] = [];
  }
  
  renderChatHistory(lesson);
}

function closeAiChat() {
  if (!dom.aiChatSidebar || !dom.aiChatBackdrop) return;
  dom.aiChatSidebar.classList.remove("translate-x-0");
  dom.aiChatSidebar.classList.add("translate-x-full");
  dom.aiChatBackdrop.classList.add("hidden");
}

function renderChatHistory(lesson) {
  if (!dom.aiChatMessages) return;

  const history = appState.chatSessions[lesson.id] || [];
  
  // Welcoming message as default html
  let html = `
    <div class="flex items-start gap-2.5 max-w-[85%] self-start">
      <div class="w-8 h-8 rounded-lg bg-brand-600 dark:bg-brand-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-brand-500/20">AI</div>
      <div class="bg-zinc-100 dark:bg-zinc-800 p-3.5 rounded-2xl rounded-tl-none border border-zinc-200/50 dark:border-zinc-700/60 text-xs shadow-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        <p>مرحباً بك! أنا مساعدك الذكي الخاص بهذا الدرس. يمكنك سؤالي عن معاني الكلمات، أو طلب أمثلة بسيطة عليها. كيف يمكنني مساعدتك اليوم؟</p>
      </div>
    </div>
  `;

  // Append history bubbles
  for (const msg of history) {
    const isAssistant = msg.role === "assistant";
    if (isAssistant) {
      html += `
        <div class="flex items-start gap-2.5 max-w-[85%] self-start">
          <div class="w-8 h-8 rounded-lg bg-brand-600 dark:bg-brand-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-brand-500/20">AI</div>
          <div class="bg-zinc-100 dark:bg-zinc-800 p-3.5 rounded-2xl rounded-tl-none border border-zinc-200/50 dark:border-zinc-700/60 text-xs shadow-sm leading-relaxed text-zinc-800 dark:text-zinc-200 chat-bubble-ai break-words w-full">
            ${renderMarkdown(msg.content)}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="bg-brand-600 dark:bg-brand-500 text-white p-3.5 rounded-2xl rounded-tr-none text-xs shadow-sm max-w-[85%] self-end break-words">
          ${escapeHtml(msg.content).replace(/\n/g, "<br>")}
        </div>
      `;
    }
  }

  dom.aiChatMessages.innerHTML = html;
  
  // Scroll to bottom
  setTimeout(() => {
    dom.aiChatMessages.scrollTop = dom.aiChatMessages.scrollHeight;
  }, 50);
}

async function handleSendChatMessage(e) {
  e.preventDefault();
  if (!dom.aiChatInput || !dom.aiChatMessages) return;

  const text = dom.aiChatInput.value.trim();
  if (!text) return;

  const lesson = currentLesson();
  if (!lesson) return;

  // Clear input
  dom.aiChatInput.value = "";

  // Append user bubble to UI immediately
  const history = appState.chatSessions[lesson.id] || [];
  history.push({ role: "user", content: text });
  
  // Re-render
  renderChatHistory(lesson);

  // Disable input & show thinking
  dom.aiChatInput.disabled = true;
  if (dom.sendAiChatBtn) dom.sendAiChatBtn.disabled = true;
  if (dom.aiChatThinking) dom.aiChatThinking.classList.remove("hidden");

  try {
    const terms = lesson.terms || [];
    const contextTerms = terms.map(t => ({ word: t.word, definition: t.definition, arabic: t.arabic }));
    
    const response = await askLessonAssistant({
      terms: contextTerms,
      question: text,
      history: history.slice(0, -1)
    });

    const aiText = response.content || "Sorry, I couldn't generate a response.";
    history.push({ role: "assistant", content: aiText });
  } catch (error) {
    console.error("AI Lesson Assistant Error:", error);
    history.push({ role: "assistant", content: `❌ Error: ${error.message}` });
  } finally {
    // Enable input & hide thinking
    dom.aiChatInput.disabled = false;
    if (dom.sendAiChatBtn) dom.sendAiChatBtn.disabled = false;
    if (dom.aiChatThinking) dom.aiChatThinking.classList.add("hidden");
    
    // Focus back on input
    dom.aiChatInput.focus();

    // Re-render chat
    renderChatHistory(lesson);
  }
}



function initAuth() {
  if (!appState.chatSessions) {
    appState.chatSessions = {};
  }

  // Check if there is an active session
  const activeUser = localStorage.getItem("smart-flashcards-active-user");
  if (activeUser) {
    appState.currentUser = activeUser;
    const cachedState = loadState(activeUser);
    appState.state = normalizeLoadedSets(cachedState);
    
    // Hide auth screen
    if (dom.authOverlay) dom.authOverlay.classList.add("hidden");
    renderHeader();
  } else {
    // Show auth screen
    if (dom.authOverlay) dom.authOverlay.classList.remove("hidden");
  }

  // Sign out button
  if (dom.signOutBtn) {
    dom.signOutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to sign out? Your progress is backed up on the server.")) {
        handleSignOut();
      }
    });
  }

  // Settings sign out button
  if (dom.settingsSignOutBtn) {
    dom.settingsSignOutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to sign out? Your progress is backed up on the server.")) {
        closeSettingsModal();
        handleSignOut();
      }
    });
  }

  // Toggle auth mode
  if (dom.authToggleBtn) {
    dom.authToggleBtn.addEventListener("click", () => {
      const isRegister = dom.authToggleBtn.textContent.trim() === "Sign In";
      if (isRegister) {
        if (dom.authTitle) dom.authTitle.textContent = "Welcome to Smart Flashcards";
        if (dom.authSubtitle) dom.authSubtitle.textContent = "Sign in to sync and study your vocabulary";
        if (dom.authSubmitBtn) dom.authSubmitBtn.textContent = "Sign In";
        if (dom.authToggleMsg) dom.authToggleMsg.textContent = "Don't have an account?";
        dom.authToggleBtn.textContent = "Create Account";
      } else {
        if (dom.authTitle) dom.authTitle.textContent = "Create New Account";
        if (dom.authSubtitle) dom.authSubtitle.textContent = "Sign up to start saving your study progress";
        if (dom.authSubmitBtn) dom.authSubmitBtn.textContent = "Create Account";
        if (dom.authToggleMsg) dom.authToggleMsg.textContent = "Already have an account?";
        dom.authToggleBtn.textContent = "Sign In";
      }
    });
  }

  // Form submit
  if (dom.authForm) {
    dom.authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!dom.authUsername || !dom.authPassword) return;

      const username = dom.authUsername.value.trim();
      const password = dom.authPassword.value;

      if (!username || password.length < 4) {
        showToast("Username and password must be at least 4 characters.", "error");
        return;
      }

      const isRegister = dom.authSubmitBtn.textContent.trim() === "Create Account";
      const endpoint = isRegister ? "/api/register" : "/api/login";

      showLoading(isRegister ? "Creating Account..." : "Signing In...", "Authenticating credentials...");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Authentication failed.");
        }

        showToast(isRegister ? "Account created successfully!" : "Signed in successfully!", "success");

        appState.currentUser = payload.username;
        localStorage.setItem("smart-flashcards-active-user", payload.username);

        let userState = payload.state;
        if (!userState || !userState.settings) {
          userState = createEmptyState();
        }

        saveState(userState, payload.username);
        appState.state = normalizeLoadedSets(userState);

        dom.authPassword.value = "";

        if (dom.authOverlay) dom.authOverlay.classList.add("hidden");

        renderAll();
        switchView("home");

      } catch (err) {
        showToast(err.message, "error");
      } finally {
        hideLoading();
      }
    });
  }

  // Home Page Badges click listener
  if (dom.homeBadgesCardBtn) {
    dom.homeBadgesCardBtn.addEventListener("click", openAchievementsModal);
  }
}

function handleSignOut() {
  localStorage.removeItem("smart-flashcards-active-user");
  appState.currentUser = null;
  appState.state = createEmptyState();
  if (dom.authOverlay) dom.authOverlay.classList.remove("hidden");
  
  if (dom.authUsername) dom.authUsername.value = "";
  if (dom.authPassword) dom.authPassword.value = "";

  renderAll();
  switchView("home");
  showToast("Signed out successfully.", "info");
}

function renderHome() {
  if (!dom.viewHome || dom.viewHome.classList.contains("hidden")) return;

  if (dom.homeUsername) {
    dom.homeUsername.textContent = appState.currentUser || "Learner";
  }

  const allTerms = (appState.state.languages || []).flatMap(l =>
    (l.units || []).flatMap(u =>
      (u.lessons || []).flatMap(ls => ls.terms || [])
    )
  );

  const learnedCount = allTerms.filter(t => appState.state.learned.has(t.id)).length;
  const now = Date.now();
  const dueCount = allTerms.filter(t => !appState.state.learned.has(t.id) || Number(t.review?.dueAt || 0) <= now).length;

  if (dom.homeDueCount) {
    dom.homeDueCount.textContent = dueCount;
  }

  const xp = appState.state.settings?.totalXP || 0;
  const level = Math.floor(xp / 500) + 1;
  const xpInCurrentLevel = xp % 500;
  const xpProgressPercent = (xpInCurrentLevel / 500) * 100;

  if (dom.homeLevelVal) dom.homeLevelVal.textContent = `Lvl ${level}`;
  if (dom.homeXpVal) dom.homeXpVal.textContent = `${xpInCurrentLevel} / 500 XP`;
  if (dom.homeXpProgressBar) dom.homeXpProgressBar.style.width = `${xpProgressPercent}%`;

  const streak = appState.state.streakCount || 0;
  if (dom.homeStreakVal) dom.homeStreakVal.textContent = `${streak} ${streak === 1 ? 'Day' : 'Days'}`;

  if (dom.homeVocabTotal) dom.homeVocabTotal.textContent = allTerms.length;
  if (dom.homeVocabMastered) dom.homeVocabMastered.textContent = `${learnedCount} mastered`;

  const badgesCount = appState.state.badges?.length || 0;
  if (dom.homeBadgesVal) dom.homeBadgesVal.textContent = `${badgesCount} / 3`;

  // Daily goal progress percentage
  const dailyGoal = appState.state.settings?.dailyGoal || 12;
  const progressPercent = Math.min(100, Math.round((learnedCount / dailyGoal) * 100));
  if (dom.homeDailyProgress) dom.homeDailyProgress.textContent = `${progressPercent}%`;

  // Render recent lessons list
  const recentListEl = document.getElementById("home-recent-lessons-list");
  if (recentListEl) {
    const lessons = [];
    (appState.state.languages || []).forEach(l => {
      (l.units || []).forEach(u => {
        (u.lessons || []).forEach(ls => {
          lessons.push({ lang: l, unit: u, lesson: ls });
        });
      });
    });

    if (lessons.length === 0) {
      recentListEl.innerHTML = `
        <div class="col-span-full text-center py-8 text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20">
          No lessons found. Go to the <button class="text-brand-600 dark:text-brand-400 font-bold hover:underline cursor-pointer" onclick="document.querySelector('[data-view=import]').click()">Import tab</button> to create one.
        </div>
      `;
    } else {
      recentListEl.innerHTML = lessons.slice(0, 3).map(item => {
        const wordCount = item.lesson.terms?.length || 0;
        return `
          <div class="p-4 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-850 rounded-2xl flex items-center justify-between hover:bg-zinc-100/60 dark:hover:bg-zinc-900 transition-all group">
            <div class="min-w-0 flex-1">
              <strong class="block text-xs font-bold truncate text-zinc-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${escapeHtml(item.lesson.name)}</strong>
              <span class="text-[10px] text-zinc-400 font-medium block mt-0.5">${escapeHtml(item.lang.name)} • ${escapeHtml(item.unit.name)} • ${wordCount} words</span>
            </div>
            <button class="px-3 py-1.5 text-[10px] font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-sm shadow-brand-500/10" data-home-nav-lesson="${item.lesson.id}" data-home-nav-unit="${item.unit.id}" data-home-nav-lang="${item.lang.id}">
              Study
            </button>
          </div>
        `;
      }).join("");

      recentListEl.querySelectorAll("[data-home-nav-lesson]").forEach(btn => {
        btn.addEventListener("click", () => {
          appState.state.currentNavigation.languageId = btn.dataset.homeNavLang;
          appState.state.currentNavigation.unitId = btn.dataset.homeNavUnit;
          appState.state.currentNavigation.lessonId = btn.dataset.homeNavLesson;
          appState.state.activeIndex = 0;
          appState.isMixedStudyMode = false;
          appState.studyTerms = null;
          persist();
          notifyStateChange();
          document.querySelector('[data-view="flashcards"]').click();
        });
      });
    }
  }
}


