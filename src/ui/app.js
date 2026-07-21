const PREFS_THEME = "osv:theme";
const PREFS_FONT = "osv:fontScale";
const FONT_STEPS = ["sm", "md", "lg", "xl"];
const FONT_LABELS = { sm: "S", md: "M", lg: "L", xl: "XL" };

const state = {
  changes: [],
  overview: null,
  graph: null,
  nextUp: [],
  filter: "all", // all | active | archived
  view: "next", // next | graph | timeline | board | detail
  selected: null,
  detail: null,
  tab: "tasks",
  theme: "dark",
  fontScale: "md",
  focusSpec: null, // highlight/filter graph by spec id
  live: "connecting", // connecting | live | offline
  applyingRoute: false,
  searchOpen: false,
  searchHits: [],
  searchIndex: 0,
  searchTimer: null,
  reloadTimer: null,
  selfWriteUntil: 0,
};

const $ = (sel) => document.querySelector(sel);

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode / blocked storage
  }
}

function applyTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  writePref(PREFS_THEME, state.theme);
  const btn = $("#theme-toggle");
  if (btn) {
    btn.setAttribute("aria-label", state.theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    btn.title = state.theme === "dark" ? "Modo claro" : "Modo oscuro";
  }
}

function applyFontScale(scale) {
  state.fontScale = FONT_STEPS.includes(scale) ? scale : "md";
  document.documentElement.dataset.font = state.fontScale;
  writePref(PREFS_FONT, state.fontScale);
  const label = $("#font-label");
  if (label) label.textContent = FONT_LABELS[state.fontScale];
  const dec = $("#font-dec");
  const inc = $("#font-inc");
  if (dec) dec.disabled = state.fontScale === FONT_STEPS[0];
  if (inc) inc.disabled = state.fontScale === FONT_STEPS[FONT_STEPS.length - 1];
}

function initPrefs() {
  applyTheme(readPref(PREFS_THEME, document.documentElement.dataset.theme || "dark"));
  applyFontScale(readPref(PREFS_FONT, document.documentElement.dataset.font || "md"));

  $("#theme-toggle")?.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });

  $("#font-dec")?.addEventListener("click", () => {
    const i = FONT_STEPS.indexOf(state.fontScale);
    if (i > 0) applyFontScale(FONT_STEPS[i - 1]);
  });

  $("#font-inc")?.addEventListener("click", () => {
    const i = FONT_STEPS.indexOf(state.fontScale);
    if (i < FONT_STEPS.length - 1) applyFontScale(FONT_STEPS[i + 1]);
  });
}

function toast(msg, type = "ok") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2400);
}

async function api(path, options) {
  if (options?.method === "POST" && String(path).includes("/tasks/toggle")) {
    state.selfWriteUntil = Date.now() + 1200;
  }
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function filteredChanges() {
  return state.changes.filter((c) => {
    if (state.filter === "active") return !c.archived;
    if (state.filter === "archived") return c.archived;
    return true;
  });
}

function formatDate(isoOrDay) {
  if (!isoOrDay) return "—";
  const d = isoOrDay.length === 10 ? isoOrDay : isoOrDay.slice(0, 10);
  return d;
}

/** Tiny markdown → HTML */
function mdToHtml(src) {
  if (!src) return `<p class="muted">Sin contenido.</p>`;
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  let codeLang = "";
  let listType = null;

  const flushList = () => {
    if (listType) {
      out.push(listType === "ol" ? "</ol>" : "</ul>");
      listType = null;
    }
  };

  const inline = (t) =>
    escapeHtml(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  for (const line of lines) {
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (!inCode) {
        flushList();
        inCode = true;
        codeLang = fence[1] || "";
        out.push(`<pre><code class="lang-${escapeHtml(codeLang)}">`);
      } else {
        inCode = false;
        out.push("</code></pre>");
      }
      continue;
    }
    if (inCode) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList();
      const n = h[1].length;
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushList();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  if (inCode) out.push("</code></pre>");
  return out.join("");
}

function renderStats() {
  const o = state.overview;
  if (!o) {
    $("#stats").innerHTML = "";
    return;
  }
  $("#stats").innerHTML = `
    <div class="stat"><span class="stat-n">${o.active}</span><span class="stat-l">activos</span></div>
    <div class="stat"><span class="stat-n">${o.archived}</span><span class="stat-l">archivados</span></div>
    <div class="stat"><span class="stat-n">${o.completedTasks}/${o.totalTasks}</span><span class="stat-l">tasks</span></div>
    <div class="stat"><span class="stat-n">${o.mainSpecs.length}</span><span class="stat-l">specs</span></div>
  `;

  const specs = $("#main-specs");
  if (!o.mainSpecs.length) {
    specs.innerHTML = `<span class="muted">Sin specs main aún</span>`;
  } else {
    specs.innerHTML = o.mainSpecs
      .map(
        (s) =>
          `<button type="button" class="spec-chip ${state.focusSpec === s.id ? "active" : ""}" data-spec="${escapeHtml(s.id)}" title="Ver en grafo">${escapeHtml(s.id)}</button>`,
      )
      .join("");
  }
}

function renderChangeList() {
  const root = $("#change-list");
  const items = filteredChanges();
  if (!items.length) {
    root.innerHTML = `<p class="muted">Nada con este filtro.</p>`;
    return;
  }
  root.innerHTML = items
    .map((c) => {
      const active = state.selected === c.name ? "active" : "";
      const badge = c.archived ? "archived" : c.status;
      const badgeLabel = c.archived ? "archived" : c.status;
      return `
        <button type="button" class="change-item ${active}" data-name="${escapeHtml(c.name)}">
          <div class="name">${escapeHtml(c.displayName)}</div>
          <div class="meta">
            <span class="badge ${badge}">${badgeLabel}</span>
            <span>${c.completedTasks}/${c.totalTasks || "—"}</span>
          </div>
          <div class="meta-sub muted">${c.archiveDate ? formatDate(c.archiveDate) : formatDate(c.lastModified)}</div>
        </button>`;
    })
    .join("");

  root.querySelectorAll(".change-item").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.name));
  });
}

function setProgress(done, total, archived) {
  const p = total ? pct(done, total) : archived ? 100 : 0;
  $("#progress-label").textContent = total ? `${done} / ${total}` : archived ? "archived" : "0 / 0";
  $("#progress-pct").textContent = `${p}%`;
  $("#progress-fill").style.width = `${p}%`;
}

function applyTasksResult(result) {
  if (!state.detail) return;
  state.detail.tasks = {
    ...(state.detail.tasks || {}),
    sections: result.sections,
    completed: result.completed,
    total: result.total,
    raw: result.raw,
  };
  state.detail.completedTasks = result.completed;
  state.detail.totalTasks = result.total;
  state.detail.status =
    result.total > 0 && result.completed >= result.total
      ? "complete"
      : result.total > 0
        ? "in-progress"
        : "empty";
  state.detail.nextTask = nextTaskFromSections(result.sections);
  const row = state.changes.find((c) => c.name === state.selected);
  if (row) {
    row.completedTasks = result.completed;
    row.totalTasks = result.total;
    row.status = state.detail.status;
    row.progress = pct(result.completed, result.total);
    row.nextTask = state.detail.nextTask;
  }
  rebuildNextUp();
  setProgress(result.completed, result.total, false);
  $("#detail-status").textContent = state.detail.status;
}

async function mutateTasks(action) {
  const result = await api(`/api/changes/${encodeURIComponent(state.selected)}/tasks/mutate`, {
    method: "POST",
    body: JSON.stringify(action),
  });
  applyTasksResult(result);
  renderTasks(state.detail);
  refreshViews();
  return result;
}

function renderTasks(detail) {
  const panel = $("#panel-tasks");
  const readonly = detail.archived;

  if (!detail.tasks) {
    panel.innerHTML = readonly
      ? `<div class="md"><p class="muted">Sin tasks.md</p></div>`
      : `<div class="tasks-empty"><p class="muted">Sin tasks.md todavía.</p>
         <button type="button" class="btn" id="tasks-init">Crear tasks.md</button></div>`;
    $("#tasks-init")?.addEventListener("click", async () => {
      try {
        await mutateTasks({
          type: "replace",
          sections: [{ title: "1. Implementation", tasks: [{ id: "1.1", text: "First task", done: false }] }],
        });
        toast("tasks.md creado");
      } catch (err) {
        toast(err.message, "error");
      }
    });
    return;
  }

  panel.innerHTML =
    (readonly ? `<p class="banner">Archivado · solo lectura</p>` : "") +
    `<div class="tasks-toolbar">${
      readonly
        ? ""
        : `<button type="button" class="btn ghost" data-act="add-section">+ Sección</button>
           <span class="muted">Edición live → tasks.md limpio</span>`
    }</div>` +
    detail.tasks.sections
      .map((sec, si) => {
        const tasksHtml = sec.tasks
          .map((t) => {
            if (readonly) {
              return `<label class="task ${t.done ? "done" : ""} readonly">
                <input type="checkbox" ${t.done ? "checked" : ""} disabled />
                <div><span class="task-id">${escapeHtml(t.id)}</span><span class="task-text">${escapeHtml(t.text)}</span></div>
              </label>`;
            }
            return `<div class="task editable ${t.done ? "done" : ""}" data-task-id="${escapeHtml(t.id)}">
              <input type="checkbox" ${t.done ? "checked" : ""} data-act="toggle" data-task-id="${escapeHtml(t.id)}" />
              <div class="task-edit-body">
                <div class="task-edit-row">
                  <input class="task-id-input" value="${escapeHtml(t.id)}" data-field="id" data-task-id="${escapeHtml(t.id)}" />
                  <input class="task-text-input" value="${escapeHtml(t.text)}" data-field="text" data-task-id="${escapeHtml(t.id)}" />
                </div>
                <div class="task-edit-actions">
                  <button type="button" class="icon-btn" data-act="up" data-task-id="${escapeHtml(t.id)}">↑</button>
                  <button type="button" class="icon-btn" data-act="down" data-task-id="${escapeHtml(t.id)}">↓</button>
                  <button type="button" class="icon-btn danger" data-act="delete" data-task-id="${escapeHtml(t.id)}">✕</button>
                </div>
              </div>
            </div>`;
          })
          .join("");

        return `<div class="section" data-si="${si}">
          <div class="section-head">
            ${
              readonly
                ? `<h3>${escapeHtml(sec.title)}</h3>`
                : `<input class="section-title-input" value="${escapeHtml(sec.title)}" data-act="rename-section" data-si="${si}" />
                   <button type="button" class="icon-btn danger" data-act="delete-section" data-si="${si}">✕</button>`
            }
          </div>
          ${tasksHtml || `<p class="muted empty-tasks">Sin tasks</p>`}
          ${
            readonly
              ? ""
              : `<div class="add-task-row">
                  <input type="text" class="add-task-input" placeholder="Nueva task…" data-si="${si}" />
                  <button type="button" class="btn" data-act="add-task" data-si="${si}">Añadir</button>
                </div>`
          }
        </div>`;
      })
      .join("");

  if (readonly) return;
  bindTasksEditor(panel);
}

function bindTasksEditor(panel) {
  panel.querySelector('[data-act="add-section"]')?.addEventListener("click", async () => {
    const title = prompt("Título de sección", `${(state.detail.tasks?.sections?.length || 0) + 1}. Nueva fase`);
    if (!title) return;
    try {
      await mutateTasks({ type: "add-section", title });
    } catch (err) {
      toast(err.message, "error");
    }
  });

  panel.querySelectorAll('[data-act="add-task"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const si = Number(btn.dataset.si);
      const input = panel.querySelector(`.add-task-input[data-si="${si}"]`);
      const text = input?.value?.trim();
      if (!text) return;
      try {
        await mutateTasks({ type: "add", sectionIndex: si, text });
        toast("Task añadida");
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });

  panel.querySelectorAll(".add-task-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        panel.querySelector(`[data-act="add-task"][data-si="${input.dataset.si}"]`)?.click();
      }
    });
  });

  panel.querySelectorAll('[data-act="toggle"]').forEach((input) => {
    input.addEventListener("change", async () => {
      try {
        await mutateTasks({ type: "update", taskId: input.dataset.taskId, done: input.checked });
      } catch (err) {
        input.checked = !input.checked;
        toast(err.message, "error");
      }
    });
  });

  const commitField = async (el) => {
    const taskId = el.dataset.taskId;
    const field = el.dataset.field;
    const sections = state.detail.tasks.sections.map((s) => ({
      title: s.title,
      tasks: s.tasks.map((t) => ({ id: t.id, text: t.text, done: t.done })),
    }));
    let found = false;
    for (const s of sections) {
      const t = s.tasks.find((x) => x.id === taskId);
      if (!t) continue;
      found = true;
      if (field === "text") t.text = el.value;
      if (field === "id") {
        const newId = el.value.trim();
        if (!newId) throw new Error("id vacío");
        t.id = newId;
      }
    }
    if (!found) throw new Error("task no encontrada");
    await mutateTasks({ type: "replace", sections });
  };

  panel.querySelectorAll(".task-text-input, .task-id-input").forEach((el) => {
    el.addEventListener("change", async () => {
      try {
        await commitField(el);
      } catch (err) {
        toast(err.message, "error");
        renderTasks(state.detail);
      }
    });
  });

  panel.querySelectorAll('[data-act="up"], [data-act="down"], [data-act="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.dataset.taskId;
      try {
        if (btn.dataset.act === "delete") {
          if (!confirm(`¿Borrar task ${taskId}?`)) return;
          await mutateTasks({ type: "delete", taskId });
        } else {
          await mutateTasks({ type: "move", taskId, direction: btn.dataset.act });
        }
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });

  panel.querySelectorAll('[data-act="rename-section"]').forEach((el) => {
    el.addEventListener("change", async () => {
      try {
        await mutateTasks({
          type: "rename-section",
          sectionIndex: Number(el.dataset.si),
          title: el.value,
        });
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });

  panel.querySelectorAll('[data-act="delete-section"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar sección y sus tasks?")) return;
      try {
        await mutateTasks({ type: "delete-section", sectionIndex: Number(btn.dataset.si) });
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });
}

function mountEditor(panel, { content, artifact, readonly }) {
  if (readonly) {
    panel.innerHTML = `<div class="md">${mdToHtml(content)}</div>`;
    return;
  }
  panel.innerHTML = `
    <div class="editor" data-artifact="${artifact}">
      <div class="editor-toolbar">
        <div class="chip-row mode-row">
          <button type="button" class="chip active" data-mode="split">Split</button>
          <button type="button" class="chip" data-mode="edit">Edit</button>
          <button type="button" class="chip" data-mode="preview">Preview</button>
        </div>
        <button type="button" class="btn" data-save>Guardar</button>
      </div>
      <div class="editor-body mode-split">
        <textarea class="editor-input" spellcheck="false"></textarea>
        <div class="md editor-preview"></div>
      </div>
      <p class="muted editor-hint">${
        artifact === "notes"
          ? "Notas locales en .openspec-viewer/ (gitignored)"
          : `Escribe ${artifact}.md del change`
      }</p>
    </div>`;
  const ta = panel.querySelector(".editor-input");
  const preview = panel.querySelector(".editor-preview");
  const body = panel.querySelector(".editor-body");
  ta.value = content ?? "";
  const refresh = () => {
    preview.innerHTML = mdToHtml(ta.value);
  };
  refresh();
  ta.addEventListener("input", refresh);

  panel.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      panel.querySelectorAll("[data-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      body.className = `editor-body mode-${btn.dataset.mode}`;
    });
  });

  panel.querySelector("[data-save]")?.addEventListener("click", async () => {
    try {
      if (artifact === "notes") {
        const res = await api(`/api/changes/${encodeURIComponent(state.selected)}/notes`, {
          method: "PUT",
          body: JSON.stringify({ content: ta.value }),
        });
        state.detail.notes = res.content;
        toast("Notas guardadas (local)");
      } else {
        const res = await api(`/api/changes/${encodeURIComponent(state.selected)}/${artifact}`, {
          method: "PUT",
          body: JSON.stringify({ content: ta.value }),
        });
        state.detail[artifact] = res.content ?? ta.value;
        toast(`${artifact}.md guardado`);
      }
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

function renderMarkdownPanels(detail) {
  mountEditor($("#panel-proposal"), {
    artifact: "proposal",
    content: detail.proposal ?? "",
    readonly: detail.archived,
  });
  mountEditor($("#panel-design"), {
    artifact: "design",
    content: detail.design ?? "",
    readonly: detail.archived,
  });
  mountEditor($("#panel-notes"), {
    artifact: "notes",
    content: detail.notes ?? "",
    readonly: false,
  });

  if (!detail.specs?.length) {
    $("#panel-specs").innerHTML = `<div class="md"><p class="muted">Sin delta specs.</p></div>`;
  } else {
    $("#panel-specs").innerHTML = detail.specs
      .map(
        (s) => `
        <div class="spec-block">
          <h3>${escapeHtml(s.id)}</h3>
          <div class="md">${mdToHtml(s.content)}</div>
        </div>`,
      )
      .join("");
  }
  renderDiff(detail);
}

function renderDiff(detail) {
  const panel = $("#panel-diff");
  const diffs = detail.specDiffs || [];
  if (!diffs.length) {
    panel.innerHTML = `<div class="md"><p class="muted">Este change no trae delta specs. Nada que comparar (todavía).</p></div>`;
    return;
  }

  panel.innerHTML = diffs
    .map((d) => {
      const s = d.summary || { added: 0, modified: 0, removed: 0, other: 0 };
      const ops =
        d.operations?.length > 0
          ? d.operations
              .map(
                (op) => `
            <div class="diff-op op-${escapeHtml(op.op.toLowerCase())}">
              <div class="diff-op-head">
                <span class="diff-badge">${escapeHtml(op.op)}</span>
                <strong>${escapeHtml(op.title)}</strong>
              </div>
              ${op.preview ? `<p class="muted diff-preview">${escapeHtml(op.preview)}</p>` : ""}
            </div>`,
              )
              .join("")
          : `<p class="muted">Sin headers ADDED/MODIFIED/REMOVED detectados. Revisa el delta crudo en Specs.</p>`;

      return `
        <div class="diff-card">
          <header class="diff-card-head">
            <div>
              <h3>${escapeHtml(d.id)}</h3>
              <p class="muted">${d.mainExists ? "main existe" : "spec nueva (no está en main aún)"}</p>
            </div>
            <div class="diff-counts">
              <span class="diff-count add">+${s.added}</span>
              <span class="diff-count mod">~${s.modified}</span>
              <span class="diff-count rem">−${s.removed}</span>
            </div>
          </header>
          <div class="diff-ops">${ops}</div>
        </div>`;
    })
    .join("");
}

function showTab(tab, opts = {}) {
  const allowed = ["tasks", "diff", "proposal", "design", "specs", "notes"];
  state.tab = allowed.includes(tab) ? tab : "tasks";
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === state.tab);
  });
  allowed.forEach((name) => {
    $(`#panel-${name}`).classList.toggle("hidden", name !== state.tab);
  });
  if (!opts.silent) writeHash();
}

function showDialog({ title, bodyHtml, okLabel = "OK", danger = false }) {
  return new Promise((resolve) => {
    const modal = $("#dialog-modal");
    $("#dialog-title").textContent = title;
    $("#dialog-body").innerHTML = bodyHtml;
    const ok = $("#dialog-ok");
    ok.textContent = okLabel;
    ok.className = danger ? "btn danger" : "btn";
    modal.classList.remove("hidden");

    const cleanup = (value) => {
      modal.classList.add("hidden");
      ok.onclick = null;
      $("#dialog-cancel").onclick = null;
      resolve(value);
    };
    ok.onclick = () => cleanup(true);
    $("#dialog-cancel").onclick = () => cleanup(false);
  });
}

async function promptNewChange() {
  const ok = await showDialog({
    title: "Nuevo change",
    okLabel: "Crear",
    bodyHtml: `
      <label class="field">
        <span>Nombre (kebab-case)</span>
        <input id="dlg-name" placeholder="add-dark-mode" />
      </label>
      <label class="field">
        <span>Descripción (opcional)</span>
        <input id="dlg-desc" placeholder="Qué y por qué" />
      </label>
      <p class="muted">Usa <code>openspec new change</code> bajo el capó (o scaffold local si no hay CLI).</p>`,
  });
  if (!ok) return;
  const name = $("#dlg-name")?.value?.trim();
  const description = $("#dlg-desc")?.value?.trim();
  if (!name) {
    toast("Nombre requerido", "error");
    return;
  }
  try {
    const created = await api("/api/changes", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
    await loadData({ quiet: true });
    await openDetail(created.name);
    toast(`Change ${created.name} creado`);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function promptArchive() {
  if (!state.selected || state.detail?.archived) return;
  const ok = await showDialog({
    title: `Archivar ${state.detail?.displayName || state.selected}`,
    okLabel: "Archivar",
    danger: true,
    bodyHtml: `
      <p>Esto ejecuta <code>openspec archive</code> y mueve el change a <code>changes/archive/</code>.</p>
      <label class="check-field">
        <input type="checkbox" id="dlg-skip-specs" />
        <span>Skip specs (infra/docs only)</span>
      </label>
      <p class="muted">No hay Ctrl+Z. Revisa el diff antes si no quieres sorpresas en main specs.</p>`,
  });
  if (!ok) return;
  const skipSpecs = Boolean($("#dlg-skip-specs")?.checked);
  try {
    await api(`/api/changes/${encodeURIComponent(state.selected)}/archive`, {
      method: "POST",
      body: JSON.stringify({ confirm: true, skipSpecs }),
    });
    state.selected = null;
    state.detail = null;
    $("#detail").classList.add("hidden");
    $("#empty-state").classList.remove("hidden");
    $("#btn-archive").classList.add("hidden");
    await loadData({ quiet: true });
    setView("timeline");
    toast("Change archivado");
  } catch (err) {
    toast(err.message, "error");
  }
}

function nextTaskFromSections(sections) {
  if (!sections) return null;
  for (const section of sections) {
    const hit = section.tasks?.find((t) => !t.done);
    if (hit) {
      return {
        id: hit.id,
        text: hit.text,
        section: section.title === "Tasks" ? null : section.title,
      };
    }
  }
  return null;
}

function rebuildNextUp() {
  state.nextUp = state.changes
    .filter((c) => !c.archived && c.nextTask)
    .map((c) => ({ change: c, nextTask: c.nextTask }))
    .sort((a, b) => {
      if (a.change.progress !== b.change.progress) return b.change.progress - a.change.progress;
      return a.change.displayName.localeCompare(b.change.displayName);
    });
}

function setView(view, opts = {}) {
  const allowed = ["next", "graph", "timeline", "board", "detail"];
  state.view = allowed.includes(view) ? view : "next";
  document.querySelectorAll(".view-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
  });
  allowed.forEach((name) => {
    $(`#view-${name}`).classList.toggle("hidden", name !== state.view);
  });
  const hints = {
    next: "Siguiente task incompleta de cada change activo — modo ‘qué hago ahora’",
    graph: "Specs main ↔ changes (edges = deltas que tocaron esa spec)",
    timeline: "Evolución por fecha (archive date o última edición)",
    board: "Kanban: activos / en curso / hechos / archivados",
    detail: "Proposal, design, specs, diff y tasks del change seleccionado",
  };
  $("#view-hint").textContent = hints[state.view];
  if (state.view === "graph") renderGraph();
  if (state.view === "next") renderNext();
  if (!opts.silent) writeHash();
}

function writeHash() {
  if (state.applyingRoute) return;
  let hash = `#/${state.view}`;
  if (state.view === "graph" && state.focusSpec) {
    hash += `?spec=${encodeURIComponent(state.focusSpec)}`;
  }
  if (state.view === "detail" && state.selected) {
    hash = `#/change/${encodeURIComponent(state.selected)}`;
    if (state.tab && state.tab !== "tasks") hash += `/${state.tab}`;
  }
  if (location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

function parseHash() {
  const raw = (location.hash || "").replace(/^#/, "");
  if (!raw || raw === "/") return null;
  const [pathPart, queryPart] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  const params = new URLSearchParams(queryPart || "");
  if (parts[0] === "change" && parts[1]) {
    return {
      view: "detail",
      change: decodeURIComponent(parts[1]),
      tab: parts[2] || "tasks",
      focusSpec: null,
    };
  }
  const view = parts[0];
  return {
    view: ["next", "graph", "timeline", "board", "detail"].includes(view) ? view : "next",
    change: null,
    tab: "tasks",
    focusSpec: params.get("spec"),
  };
}

async function applyRoute(route) {
  if (!route) return;
  state.applyingRoute = true;
  try {
    if (route.focusSpec) state.focusSpec = route.focusSpec;
    if (route.view === "detail" && route.change) {
      await openDetail(route.change, { silent: true, tab: route.tab });
    } else {
      setView(route.view, { silent: true });
    }
  } finally {
    state.applyingRoute = false;
    writeHash();
  }
}

function cardHtml(c) {
  const badge = c.archived ? "archived" : c.status;
  const badgeLabel = c.archived ? "archived" : c.status;
  return `
    <button type="button" class="evo-card" data-name="${escapeHtml(c.name)}">
      <div class="evo-card-top">
        <span class="badge ${badge}">${badgeLabel}</span>
        <span class="muted">${c.completedTasks}/${c.totalTasks || "—"}</span>
      </div>
      <div class="evo-title">${escapeHtml(c.displayName)}</div>
      <div class="progress-bar thin"><div style="width:${c.progress || 0}%"></div></div>
      ${
        c.specIds?.length
          ? `<div class="tag-row">${c.specIds
              .slice(0, 4)
              .map((id) => `<span class="tag">${escapeHtml(id)}</span>`)
              .join("")}${c.specIds.length > 4 ? `<span class="tag">+${c.specIds.length - 4}</span>` : ""}</div>`
          : ""
      }
    </button>`;
}

function bindCards(root) {
  root.querySelectorAll(".evo-card, .timeline-item").forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.name));
  });
}

function filteredGraph() {
  const graph = state.graph;
  if (!graph) return { nodes: [], edges: [] };

  const allowedChanges = new Set(filteredChanges().map((c) => c.name));
  let edges = graph.edges.filter((e) => allowedChanges.has(e.changeName));
  if (state.focusSpec) {
    edges = edges.filter((e) => e.specId === state.focusSpec);
  }

  const used = new Set();
  for (const e of edges) {
    used.add(e.from);
    used.add(e.to);
  }

  // keep main specs even without edges when no focus, so empty projects still show specs
  const nodes = graph.nodes.filter((n) => {
    if (used.has(n.id)) return true;
    if (!state.focusSpec && n.kind === "spec" && n.main && state.filter === "all") return true;
    return false;
  });

  return { nodes, edges };
}

function renderNext() {
  const root = $("#view-next");
  const items = state.nextUp.filter((item) => {
    if (state.filter === "archived") return false;
    if (state.filter === "active") return !item.change.archived;
    return !item.change.archived;
  });

  const activeEmpty = state.changes.filter(
    (c) => !c.archived && !c.nextTask && c.status !== "complete",
  );
  const activeDone = state.changes.filter((c) => !c.archived && c.status === "complete");

  if (!items.length) {
    root.innerHTML = `
      <div class="empty">
        <h2>Nada en cola</h2>
        <p class="muted">
          ${
            state.changes.some((c) => !c.archived)
              ? activeDone.length
                ? "Todos los changes activos tienen tasks al 100%. Hora de archive (o de inventar más trabajo)."
                : "No hay next task: falta tasks.md o está vacío."
              : "No hay changes activos. Mira Timeline/Grafo para la historia archivada."
          }
        </p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="next-hero">
      <div>
        <p class="eyebrow">Ahora</p>
        <h2>${items.length} siguiente${items.length === 1 ? "" : "s"}</h2>
        <p class="muted">Una task por change activo, ordenadas por momentum (más avanzados primero).</p>
      </div>
      <div class="next-meta muted">
        ${activeDone.length ? `${activeDone.length} listo(s) p/ archive` : ""}
        ${activeEmpty.length ? ` · ${activeEmpty.length} sin next` : ""}
      </div>
    </div>
    <div class="next-list">
      ${items
        .map((item, idx) => {
          const c = item.change;
          const t = item.nextTask;
          return `
            <article class="next-card" data-name="${escapeHtml(c.name)}">
              <div class="next-rank">#${idx + 1}</div>
              <div class="next-body">
                <div class="next-head">
                  <button type="button" class="linkish" data-open="${escapeHtml(c.name)}">${escapeHtml(c.displayName)}</button>
                  <span class="muted">${c.completedTasks}/${c.totalTasks} · ${c.progress}%</span>
                </div>
                <div class="progress-bar thin"><div style="width:${c.progress || 0}%"></div></div>
                <label class="next-task">
                  <input type="checkbox" data-change="${escapeHtml(c.name)}" data-task-id="${escapeHtml(t.id)}" />
                  <div>
                    ${t.section ? `<div class="muted next-section">${escapeHtml(t.section)}</div>` : ""}
                    <div><span class="task-id">${escapeHtml(t.id)}</span><span class="task-text">${escapeHtml(t.text)}</span></div>
                  </div>
                </label>
                ${
                  c.specIds?.length
                    ? `<div class="tag-row">${c.specIds
                        .map((id) => `<button type="button" class="tag clickable" data-spec="${escapeHtml(id)}">${escapeHtml(id)}</button>`)
                        .join("")}</div>`
                    : ""
                }
              </div>
            </article>`;
        })
        .join("")}
    </div>`;

  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.open));
  });

  root.querySelectorAll(".tag.clickable").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.focusSpec = btn.dataset.spec;
      setView("graph");
      renderStats();
    });
  });

  root.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", async () => {
      const changeName = input.dataset.change;
      const taskId = input.dataset.taskId;
      input.disabled = true;
      try {
        const result = await api(`/api/changes/${encodeURIComponent(changeName)}/tasks/toggle`, {
          method: "POST",
          body: JSON.stringify({ taskId, done: true }),
        });
        const row = state.changes.find((c) => c.name === changeName);
        if (row) {
          row.completedTasks = result.completed;
          row.totalTasks = result.total;
          row.progress = pct(result.completed, result.total);
          row.status =
            result.total > 0 && result.completed >= result.total
              ? "complete"
              : result.total > 0
                ? "in-progress"
                : "empty";
          row.nextTask = nextTaskFromSections(result.sections);
        }
        rebuildNextUp();
        refreshViews();
        toast(`${taskId} done · next actualizado`);
      } catch (err) {
        input.checked = false;
        toast(err.message, "error");
      } finally {
        input.disabled = false;
      }
    });
  });
}

function renderGraph() {
  const root = $("#view-graph");
  const { nodes, edges } = filteredGraph();
  const specs = nodes.filter((n) => n.kind === "spec").sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));
  const changes = nodes
    .filter((n) => n.kind === "change")
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));

  if (!specs.length && !changes.length) {
    root.innerHTML = `<div class="empty"><h2>Grafo vacío</h2><p class="muted">No hay deltas de specs con este filtro.</p></div>`;
    return;
  }

  const width = 960;
  const leftX = 160;
  const rightX = 780;
  const top = 36;
  const rowH = 54;
  const height = Math.max(280, top * 2 + Math.max(specs.length, changes.length, 1) * rowH);

  const pos = new Map();
  specs.forEach((n, i) => {
    const total = Math.max(specs.length - 1, 1);
    const y = specs.length === 1 ? height / 2 : top + (i * (height - top * 2)) / total;
    pos.set(n.id, { x: leftX, y });
  });
  changes.forEach((n, i) => {
    const total = Math.max(changes.length - 1, 1);
    const y = changes.length === 1 ? height / 2 : top + (i * (height - top * 2)) / total;
    pos.set(n.id, { x: rightX, y });
  });

  const lines = edges
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return "";
      const mid = (a.x + b.x) / 2;
      return `<path class="g-edge" data-from="${escapeHtml(e.from)}" data-to="${escapeHtml(e.to)}" d="M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}" />`;
    })
    .join("");

  const specNodes = specs
    .map((n) => {
      const p = pos.get(n.id);
      const cls = [
        "g-node",
        "g-spec",
        n.main ? "is-main" : "is-delta-only",
        state.focusSpec === n.label ? "is-focus" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <g class="${cls}" data-id="${escapeHtml(n.id)}" data-spec="${escapeHtml(n.label)}" transform="translate(${p.x},${p.y})">
          <circle r="18"></circle>
          <text class="g-label" x="28" y="5">${escapeHtml(n.label)}</text>
          <text class="g-sub" x="28" y="20">${n.main ? "main" : "solo delta"} · ${n.degree}</text>
        </g>`;
    })
    .join("");

  const changeNodes = changes
    .map((n) => {
      const p = pos.get(n.id);
      const changeName = n.id.slice("change:".length);
      const cls = ["g-node", "g-change", n.archived ? "is-archived" : "is-active", n.status || ""]
        .filter(Boolean)
        .join(" ");
      return `
        <g class="${cls}" data-id="${escapeHtml(n.id)}" data-change="${escapeHtml(changeName)}" transform="translate(${p.x},${p.y})">
          <rect x="-18" y="-18" width="36" height="36" rx="9"></rect>
          <text class="g-label" x="-28" y="5" text-anchor="end">${escapeHtml(n.label)}</text>
          <text class="g-sub" x="-28" y="20" text-anchor="end">${n.archived ? "archived" : n.status} · ${n.completedTasks ?? 0}/${n.totalTasks ?? 0}</text>
        </g>`;
    })
    .join("");

  root.innerHTML = `
    <div class="graph-toolbar">
      <div class="chip-row">
        <span class="legend"><i class="swatch spec-main"></i> Spec main</span>
        <span class="legend"><i class="swatch spec-delta"></i> Spec solo en delta</span>
        <span class="legend"><i class="swatch change"></i> Change</span>
      </div>
      <div class="graph-actions">
        ${
          state.focusSpec
            ? `<button type="button" class="chip active" id="clear-focus">Focus: ${escapeHtml(state.focusSpec)} ✕</button>`
            : `<span class="muted">Click una spec para enfocar</span>`
        }
        <span class="muted">${edges.length} enlace${edges.length === 1 ? "" : "s"} · ${specs.length} specs · ${changes.length} changes</span>
      </div>
    </div>
    <div class="graph-wrap">
      <svg class="graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafo specs y changes">
        <text class="g-col-title" x="${leftX}" y="16">Specs</text>
        <text class="g-col-title" x="${rightX}" y="16" text-anchor="end">Changes</text>
        <g class="g-edges">${lines}</g>
        <g class="g-nodes">${specNodes}${changeNodes}</g>
      </svg>
    </div>`;

  const svg = root.querySelector(".graph-svg");
  const clearHighlight = () => {
    svg.querySelectorAll(".g-edge, .g-node").forEach((el) => el.classList.remove("is-hot", "is-dim"));
  };

  const highlight = (nodeId) => {
    const hotEdges = edges.filter((e) => e.from === nodeId || e.to === nodeId);
    const hotNodes = new Set([nodeId]);
    for (const e of hotEdges) {
      hotNodes.add(e.from);
      hotNodes.add(e.to);
    }
    svg.querySelectorAll(".g-node").forEach((el) => {
      el.classList.toggle("is-hot", hotNodes.has(el.dataset.id));
      el.classList.toggle("is-dim", !hotNodes.has(el.dataset.id));
    });
    svg.querySelectorAll(".g-edge").forEach((el) => {
      const hot = hotEdges.some((e) => e.from === el.dataset.from && e.to === el.dataset.to);
      el.classList.toggle("is-hot", hot);
      el.classList.toggle("is-dim", !hot);
    });
  };

  svg.querySelectorAll(".g-node").forEach((el) => {
    el.addEventListener("mouseenter", () => highlight(el.dataset.id));
    el.addEventListener("mouseleave", clearHighlight);
    el.addEventListener("click", () => {
      if (el.dataset.change) openDetail(el.dataset.change);
      if (el.dataset.spec) {
        state.focusSpec = state.focusSpec === el.dataset.spec ? null : el.dataset.spec;
        renderGraph();
        renderStats();
        writeHash();
      }
    });
  });

  $("#clear-focus")?.addEventListener("click", () => {
    state.focusSpec = null;
    renderGraph();
    renderStats();
    writeHash();
  });
}

function renderTimeline() {
  const root = $("#view-timeline");
  const items = filteredChanges();
  if (!items.length) {
    root.innerHTML = `<div class="empty"><h2>Sin changes</h2><p class="muted">Este filtro no encuentra historia. Prueba “Todos”.</p></div>`;
    return;
  }

  const groups = new Map();
  for (const c of items) {
    const key = c.archiveDate || (c.sortDate ? c.sortDate.slice(0, 10) : "sin-fecha");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const days = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  const maxCount = Math.max(...days.map((d) => groups.get(d).length), 1);

  root.innerHTML = `
    <div class="timeline-summary">
      ${days
        .map((d) => {
          const list = groups.get(d);
          const h = Math.max(12, Math.round((list.length / maxCount) * 64));
          return `<div class="spark" title="${escapeHtml(d)}: ${list.length}">
            <div class="spark-bar" style="height:${h}px"></div>
            <span>${escapeHtml(d.slice(5))}</span>
          </div>`;
        })
        .join("")}
    </div>
    <div class="timeline">
      ${days
        .map((day) => {
          const list = groups.get(day);
          const tasksDone = list.reduce((n, c) => n + c.completedTasks, 0);
          const tasksTotal = list.reduce((n, c) => n + c.totalTasks, 0);
          return `
            <div class="timeline-day">
              <div class="timeline-rail">
                <div class="dot"></div>
                <div class="line"></div>
              </div>
              <div class="timeline-body">
                <header class="timeline-day-head">
                  <h3>${escapeHtml(formatDate(day))}</h3>
                  <span class="muted">${list.length} change${list.length === 1 ? "" : "s"} · ${tasksDone}/${tasksTotal || "—"} tasks</span>
                </header>
                <div class="timeline-grid">
                  ${list.map((c) => cardHtml(c)).join("")}
                </div>
              </div>
            </div>`;
        })
        .join("")}
    </div>`;

  bindCards(root);
}

function renderBoard() {
  const root = $("#view-board");
  const items = filteredChanges();
  const cols = [
    {
      id: "active-wip",
      title: "Activos",
      hint: "en curso",
      items: items.filter((c) => !c.archived && c.status === "in-progress"),
    },
    {
      id: "active-empty",
      title: "Planificando",
      hint: "sin tasks o vacíos",
      items: items.filter((c) => !c.archived && c.status === "empty"),
    },
    {
      id: "active-done",
      title: "Listos p/ archive",
      hint: "tasks al 100%",
      items: items.filter((c) => !c.archived && c.status === "complete"),
    },
    {
      id: "archived",
      title: "Archivados",
      hint: "historia",
      items: items.filter((c) => c.archived),
    },
  ];

  root.innerHTML = `
    <div class="board">
      ${cols
        .map(
          (col) => `
        <div class="board-col">
          <header>
            <h3>${escapeHtml(col.title)}</h3>
            <span class="muted">${col.items.length} · ${escapeHtml(col.hint)}</span>
          </header>
          <div class="board-cards">
            ${
              col.items.length
                ? col.items.map((c) => cardHtml(c)).join("")
                : `<p class="muted empty-col">Vacío</p>`
            }
          </div>
        </div>`,
        )
        .join("")}
    </div>`;

  bindCards(root);
}

async function openDetail(name, opts = {}) {
  state.selected = name;
  renderChangeList();
  setView("detail", { silent: true });
  const detail = await api(`/api/changes/${encodeURIComponent(name)}`);
  state.detail = detail;
  $("#empty-state").classList.add("hidden");
  $("#detail").classList.remove("hidden");
  $("#detail-title").textContent = detail.displayName;
  $("#detail-status").textContent = detail.archived ? "archived" : detail.status;
  const diffSummary = (detail.specDiffs || []).reduce(
    (acc, d) => {
      acc.added += d.summary?.added || 0;
      acc.modified += d.summary?.modified || 0;
      acc.removed += d.summary?.removed || 0;
      return acc;
    },
    { added: 0, modified: 0, removed: 0 },
  );
  $("#detail-sub").textContent = [
    detail.archived ? `archive/${detail.folderName}` : detail.name,
    detail.archiveDate ? `· ${detail.archiveDate}` : "",
    detail.specIds?.length ? `· specs: ${detail.specIds.join(", ")}` : "",
    detail.specDiffs?.length
      ? `· diff +${diffSummary.added}/~${diffSummary.modified}/−${diffSummary.removed}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  setProgress(detail.completedTasks, detail.totalTasks, detail.archived);
  const archiveBtn = $("#btn-archive");
  if (archiveBtn) {
    archiveBtn.classList.toggle("hidden", Boolean(detail.archived));
  }
  renderTasks(detail);
  renderMarkdownPanels(detail);
  showTab(opts.tab || state.tab || "tasks", { silent: true });
  if (!opts.silent) writeHash();
}

function refreshViews() {
  renderStats();
  renderChangeList();
  renderNext();
  renderGraph();
  renderTimeline();
  renderBoard();
}

async function loadData({ quiet = false } = {}) {
  const data = await api("/api/changes");
  state.changes = data.changes;
  state.overview = data.overview;
  state.graph = data.graph;
  state.nextUp = data.nextUp || [];
  rebuildNextUp();
  refreshViews();
  if (state.view === "detail" && state.selected) {
    try {
      const detail = await api(`/api/changes/${encodeURIComponent(state.selected)}`);
      state.detail = detail;
      const still = state.changes.some((c) => c.name === state.selected);
      if (still) {
        $("#detail-title").textContent = detail.displayName;
        $("#detail-status").textContent = detail.archived ? "archived" : detail.status;
        setProgress(detail.completedTasks, detail.totalTasks, detail.archived);
        renderTasks(detail);
        renderMarkdownPanels(detail);
        showTab(state.tab, { silent: true });
      }
    } catch {
      // change may have disappeared
    }
  }
  if (!quiet) {
    // no toast on first load
  }
}

function setLive(status, label) {
  state.live = status;
  const dot = $("#live-dot");
  const el = $("#live-label");
  if (dot) dot.dataset.status = status;
  if (el) el.textContent = label;
}

function connectLive() {
  if (typeof EventSource === "undefined") {
    setLive("offline", "sin SSE");
    return;
  }
  const es = new EventSource("/api/events");
  es.addEventListener("hello", () => setLive("live", "live"));
  es.addEventListener("reload", (ev) => {
    let data = {};
    try {
      data = JSON.parse(ev.data);
    } catch {
      // ignore
    }
    if (Date.now() < state.selfWriteUntil && data.reason === "toggle") {
      return;
    }
    setLive("live", "sync…");
    if (state.reloadTimer) clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(async () => {
      try {
        await loadData({ quiet: true });
        setLive("live", "live · synced");
        setTimeout(() => {
          if (state.live.startsWith("live")) setLive("live", "live");
        }, 1200);
      } catch (err) {
        setLive("offline", "error sync");
        toast(err.message, "error");
      }
    }, 200);
  });
  es.onerror = () => {
    setLive("offline", "reconectando…");
  };
  es.onopen = () => setLive("live", "live");
}

/* ——— Search (⌘K) ——— */
function openSearch() {
  state.searchOpen = true;
  $("#search-modal").classList.remove("hidden");
  const input = $("#search-input");
  input.value = "";
  state.searchHits = [];
  state.searchIndex = 0;
  renderSearchResults();
  setTimeout(() => input.focus(), 0);
}

function closeSearch() {
  state.searchOpen = false;
  $("#search-modal").classList.add("hidden");
}

function renderSearchResults() {
  const root = $("#search-results");
  if (!state.searchHits.length) {
    root.innerHTML = `<p class="muted search-empty">Escribe para buscar en changes, tasks, proposal, design y specs.</p>`;
    return;
  }
  root.innerHTML = state.searchHits
    .map((h, i) => {
      const active = i === state.searchIndex ? "active" : "";
      return `
        <button type="button" class="search-hit ${active}" data-idx="${i}">
          <div class="search-hit-top">
            <span class="badge">${escapeHtml(h.kind)}</span>
            <span class="search-title">${escapeHtml(h.title)}</span>
          </div>
          <div class="muted search-sub">${escapeHtml(h.subtitle || "")}</div>
          ${h.snippet ? `<div class="search-snip">${escapeHtml(h.snippet)}</div>` : ""}
        </button>`;
    })
    .join("");

  root.querySelectorAll(".search-hit").forEach((btn) => {
    btn.addEventListener("click", () => activateSearchHit(Number(btn.dataset.idx)));
  });
}

async function runSearch(q) {
  if (!q.trim()) {
    state.searchHits = [];
    renderSearchResults();
    return;
  }
  const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
  state.searchHits = data.hits || [];
  state.searchIndex = 0;
  renderSearchResults();
}

async function activateSearchHit(idx) {
  const hit = state.searchHits[idx];
  if (!hit) return;
  closeSearch();
  if (hit.kind === "spec-main" && hit.specId) {
    state.focusSpec = hit.specId;
    setView("graph");
    renderStats();
    return;
  }
  if (hit.changeName) {
    const tab =
      hit.kind === "proposal"
        ? "proposal"
        : hit.kind === "design"
          ? "design"
          : hit.kind === "spec-delta"
            ? "diff"
            : "tasks";
    await openDetail(hit.changeName, { tab });
  }
}

function initSearch() {
  $("#search-launch")?.addEventListener("click", openSearch);
  $("#search-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "search-modal") closeSearch();
  });
  $("#search-input")?.addEventListener("input", (e) => {
    const q = e.target.value;
    if (state.searchTimer) clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      runSearch(q).catch((err) => toast(err.message, "error"));
    }, 140);
  });
  $("#search-input")?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.searchIndex = Math.min(state.searchIndex + 1, state.searchHits.length - 1);
      renderSearchResults();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.searchIndex = Math.max(state.searchIndex - 1, 0);
      renderSearchResults();
    } else if (e.key === "Enter") {
      e.preventDefault();
      activateSearchHit(state.searchIndex);
    } else if (e.key === "Escape") {
      closeSearch();
    }
  });

  window.addEventListener("keydown", (e) => {
    const isK = e.key.toLowerCase() === "k";
    if ((e.metaKey || e.ctrlKey) && isK) {
      e.preventDefault();
      if (state.searchOpen) closeSearch();
      else openSearch();
    } else if (e.key === "Escape" && state.searchOpen) {
      closeSearch();
    }
  });
}

async function init() {
  initPrefs();
  initSearch();
  connectLive();

  const project = await api("/api/project");
  $("#project-path").textContent = project.projectDir;

  await loadData();

  const route = parseHash();
  if (route) {
    await applyRoute(route);
  } else {
    setView(state.changes.some((c) => !c.archived && c.nextTask) ? "next" : "graph");
  }

  window.addEventListener("hashchange", () => {
    const r = parseHash();
    if (r) applyRoute(r);
  });

  $("#filter-row").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    document.querySelectorAll("#filter-row .chip").forEach((c) => {
      c.classList.toggle("active", c === btn);
    });
    refreshViews();
  });

  $("#view-switch").addEventListener("click", (e) => {
    const btn = e.target.closest(".view-btn");
    if (!btn) return;
    setView(btn.dataset.view);
  });

  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    showTab(btn.dataset.tab);
  });

  $("#main-specs").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-spec]");
    if (!chip) return;
    state.focusSpec = state.focusSpec === chip.dataset.spec ? null : chip.dataset.spec;
    setView("graph");
    renderStats();
  });

  $("#btn-new-change")?.addEventListener("click", () => {
    promptNewChange();
  });
  $("#btn-archive")?.addEventListener("click", () => {
    promptArchive();
  });
}

init().catch((err) => {
  toast(err.message, "error");
  $("#project-path").textContent = err.message;
});
