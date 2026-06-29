import { appState, persist } from "./state-manager.js";

export const dom = {};
export const checkedLessonIds = [];

let renderAllCallback = null;

export function registerRenderAll(cb) {
  renderAllCallback = cb;
}

export function renderAll() {
  if (renderAllCallback) {
    renderAllCallback();
  }
}

// Toast System
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `flex items-center w-full max-w-xs p-4 mb-3 text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg transition-all duration-300 transform translate-y-4 opacity-0`;
  
  let iconHtml = "";
  if (type === "success") {
    iconHtml = `
      <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-emerald-500 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    `;
  } else if (type === "error") {
    iconHtml = `
      <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-rose-500 bg-rose-100 dark:bg-rose-950/50 rounded-lg">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    `;
  } else {
    iconHtml = `
      <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-indigo-500 bg-indigo-100 dark:bg-indigo-950/50 rounded-lg">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    `;
  }

  toast.innerHTML = `
    ${iconHtml}
    <div class="ms-3 text-sm font-normal text-zinc-800 dark:text-zinc-200">${message}</div>
    <button type="button" class="ms-auto -mx-1.5 -my-1.5 bg-transparent text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded-lg p-1.5 inline-flex items-center justify-center h-8 w-8" aria-label="Close">
      <span class="sr-only">Close</span>
      <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.remove("translate-y-4", "opacity-0");
  }, 10);

  // Close handler
  const closeBtn = toast.querySelector("button");
  const dismiss = () => {
    toast.classList.add("opacity-0", "translate-y-4");
    setTimeout(() => toast.remove(), 300);
  };
  closeBtn.addEventListener("click", dismiss);

  // Auto remove
  setTimeout(dismiss, 4000);
}

// Loading Spinner Overlays
export function showLoading(title, status = "", progressPercent = null) {
  const overlay = document.getElementById("loading-overlay");
  const loadingTitle = document.getElementById("loading-title");
  const loadingStatus = document.getElementById("loading-status");
  const progressBar = document.getElementById("loading-progress-bar");

  if (!overlay) return;

  if (loadingTitle) loadingTitle.textContent = title;
  if (loadingStatus) loadingStatus.textContent = status;
  if (progressBar) {
    if (progressPercent !== null) {
      progressBar.parentElement.classList.remove("hidden");
      progressBar.style.width = `${progressPercent}%`;
    } else {
      progressBar.parentElement.classList.add("hidden");
    }
  }

  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
}

export function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }
}

let switchViewCallback = null;

export function registerSwitchViewCallback(cb) {
  switchViewCallback = cb;
}

export function switchView(viewName) {
  appState.activeView = viewName;
  if (!dom.views || !dom.tabs) return;
  dom.views.forEach(view => {
    view.classList.toggle("hidden", view.id !== `view-${viewName}`);
  });
  dom.tabs.forEach(tab => {
    const isActive = tab.dataset.view === viewName;
    tab.classList.toggle("active", isActive);
    if (isActive) {
      tab.classList.remove("text-zinc-500");
      tab.classList.add("bg-brand-600/10", "text-brand-600", "dark:text-brand-400");
    } else {
      tab.classList.remove("bg-brand-600/10", "text-brand-600", "dark:text-brand-400");
      tab.classList.add("text-zinc-500");
    }
  });

  // Relocate Explorer Sidebar if a placeholder exists in the active view
  const activeView = document.getElementById(`view-${viewName}`);
  if (activeView) {
    const placeholder = activeView.querySelector(".explorer-sidebar-placeholder");
    const sidebar = dom.explorerSidebar || document.getElementById("explorer-sidebar");
    if (placeholder && sidebar) {
      placeholder.appendChild(sidebar);
    }
  }

  if (switchViewCallback) {
    switchViewCallback(viewName);
  }
}

export function applyTheme() {
  const theme = appState.state.settings.theme;
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  if (dom.themeIcon) {
    dom.themeIcon.textContent = isDark ? "☀️" : "🌙";
  }
}

export function applySidebarsVisibility() {
  const hideStats = Boolean(appState.state.settings?.hideStats);
  const hideExplorer = Boolean(appState.state.settings?.hideExplorer);
  const hideHistory = Boolean(appState.state.settings?.hideHistory);

  // ---- IMPORT VIEW ----
  if (dom.importGrid) {
    const mainPanel = dom.importGrid.querySelector(".main-panel-import");
    const placeholder = dom.importGrid.querySelector(".explorer-sidebar-placeholder");
    if (mainPanel && placeholder) {
      if (hideExplorer) {
        mainPanel.className = mainPanel.className.replace(/lg:col-span-\d+/, "lg:col-span-3");
        placeholder.classList.add("hidden");
      } else {
        mainPanel.className = mainPanel.className.replace(/lg:col-span-\d+/, "lg:col-span-2");
        placeholder.classList.remove("hidden");
      }
    }
  }

  // ---- FLASHCARDS VIEW ----
  if (dom.flashcardsGrid) {
    const mainPanel = dom.flashcardsGrid.querySelector(".main-panel-flashcards");
    const statsSidebar = dom.flashcardsGrid.querySelector(".sidebar-panel");
    const placeholder = dom.flashcardsGrid.querySelector(".explorer-sidebar-placeholder");
    
    if (mainPanel) {
      let visibleCols = 2; // base
      if (hideStats) {
        if (statsSidebar) statsSidebar.classList.add("hidden");
      } else {
        if (statsSidebar) statsSidebar.classList.remove("hidden");
        visibleCols += 1;
      }
      
      if (hideExplorer) {
        if (placeholder) placeholder.classList.add("hidden");
      } else {
        if (placeholder) placeholder.classList.remove("hidden");
        visibleCols += 1;
      }
      
      const targetSpan = 6 - visibleCols;
      mainPanel.className = mainPanel.className.replace(/lg:col-span-\d+/, `lg:col-span-${targetSpan}`);
    }
  }

  // ---- QUIZ VIEW ----
  if (dom.quizGrid) {
    const mainPanel = dom.quizGrid.querySelector(".main-panel-quiz");
    const historySidebar = dom.quizGrid.querySelector(".sidebar-panel");
    const placeholder = dom.quizGrid.querySelector(".explorer-sidebar-placeholder");
    
    if (mainPanel) {
      let visibleCols = 2;
      if (hideHistory) {
        if (historySidebar) historySidebar.classList.add("hidden");
      } else {
        if (historySidebar) historySidebar.classList.remove("hidden");
        visibleCols += 1;
      }
      
      if (hideExplorer) {
        if (placeholder) placeholder.classList.add("hidden");
      } else {
        if (placeholder) placeholder.classList.remove("hidden");
        visibleCols += 1;
      }
      
      const targetSpan = 6 - visibleCols;
      mainPanel.className = mainPanel.className.replace(/lg:col-span-\d+/, `lg:col-span-${targetSpan}`);
    }
  }

  // Update Toggle Buttons Styling
  updateToggleButtonsUI(hideStats, hideExplorer, hideHistory);
}

function updateToggleButtonsUI(hideStats, hideExplorer, hideHistory) {
  const statsBtn = dom.toggleStatsBtn;
  if (statsBtn) {
    statsBtn.classList.toggle("opacity-50", hideStats);
    const icon = statsBtn.querySelector(".toggle-icon-stats");
    if (icon) icon.textContent = hideStats ? "💤" : "👁️";
  }

  const historyBtn = dom.toggleHistoryBtn;
  if (historyBtn) {
    historyBtn.classList.toggle("opacity-50", hideHistory);
    const icon = historyBtn.querySelector(".toggle-icon-history");
    if (icon) icon.textContent = hideHistory ? "💤" : "👁️";
  }

  const explorerButtons = [dom.toggleExplorerImportBtn, dom.toggleExplorerFlashcardsBtn, dom.toggleExplorerQuizBtn];
  explorerButtons.forEach(btn => {
    if (btn) {
      btn.classList.toggle("opacity-50", hideExplorer);
      const icon = btn.querySelector(".toggle-icon-explorer");
      if (icon) icon.textContent = hideExplorer ? "💤" : "👁️";
    }
  });
}

// Common Utilities
export function toCamel(value) {
  return value.replace(/-([a-z])/g, g => g[1].toUpperCase());
}

export function escapeHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeQuestionHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/&lt;u&gt;/gi, "<u>")
    .replace(/&lt;\/u&gt;/gi, "</u>");
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
