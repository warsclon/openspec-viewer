const state = {
  changes: [],
  overview: null,
  filter: "all", // all | active | archived
  view: "timeline", // timeline | board | detail
  selected: null,
  detail: null,
  tab: "tasks",
};

const $ = (sel) => document.querySelector(sel);

function toast(msg, type = "ok") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2400);
}

async function api(path, options) {
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
      .map((s) => `<span class="spec-chip" title="${escapeHtml(s.id)}">${escapeHtml(s.id)}</span>`)
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

function renderTasks(detail) {
  const panel = $("#panel-tasks");
  const readonly = detail.archived;
  if (!detail.tasks || !detail.tasks.total) {
    panel.innerHTML = `<div class="md"><p class="muted">Sin tasks.md (o está vacío).</p></div>`;
    return;
  }

  panel.innerHTML =
    (readonly ? `<p class="banner">Archivado · solo lectura</p>` : "") +
    detail.tasks.sections
      .map(
        (sec) => `
      <div class="section">
        <h3>${escapeHtml(sec.title)}</h3>
        ${sec.tasks
          .map(
            (t) => `
          <label class="task ${t.done ? "done" : ""} ${readonly ? "readonly" : ""}">
            <input type="checkbox" ${t.done ? "checked" : ""} ${readonly ? "disabled" : ""} data-task-id="${escapeHtml(t.id)}" />
            <div>
              <span class="task-id">${escapeHtml(t.id)}</span>
              <span class="task-text">${escapeHtml(t.text)}</span>
            </div>
          </label>`,
          )
          .join("")}
      </div>`,
      )
      .join("");

  if (readonly) return;

  panel.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", async () => {
      const taskId = input.dataset.taskId;
      input.disabled = true;
      try {
        const result = await api(
          `/api/changes/${encodeURIComponent(state.selected)}/tasks/toggle`,
          {
            method: "POST",
            body: JSON.stringify({ taskId, done: input.checked }),
          },
        );
        state.detail.tasks.sections = result.sections;
        state.detail.tasks.completed = result.completed;
        state.detail.tasks.total = result.total;
        state.detail.completedTasks = result.completed;
        state.detail.totalTasks = result.total;
        state.detail.status =
          result.total > 0 && result.completed >= result.total
            ? "complete"
            : result.total > 0
              ? "in-progress"
              : "empty";
        const row = state.changes.find((c) => c.name === state.selected);
        if (row) {
          row.completedTasks = result.completed;
          row.totalTasks = result.total;
          row.status = state.detail.status;
          row.progress = pct(result.completed, result.total);
        }
        setProgress(result.completed, result.total, false);
        $("#detail-status").textContent = state.detail.status;
        renderChangeList();
        renderTasks(state.detail);
        renderTimeline();
        renderBoard();
        toast(`Task ${taskId} → ${input.checked ? "done" : "todo"}`);
      } catch (err) {
        input.checked = !input.checked;
        toast(err.message, "error");
      } finally {
        input.disabled = false;
      }
    });
  });
}

function renderMarkdownPanels(detail) {
  $("#panel-proposal").innerHTML = `<div class="md">${mdToHtml(detail.proposal)}</div>`;
  $("#panel-design").innerHTML = `<div class="md">${mdToHtml(detail.design)}</div>`;
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
}

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  ["tasks", "proposal", "design", "specs"].forEach((name) => {
    $(`#panel-${name}`).classList.toggle("hidden", name !== tab);
  });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  ["timeline", "board", "detail"].forEach((name) => {
    $(`#view-${name}`).classList.toggle("hidden", name !== view);
  });
  const hints = {
    timeline: "Evolución por fecha (archive date o última edición)",
    board: "Kanban: activos / en curso / hechos / archivados",
    detail: "Proposal, design, specs y tasks del change seleccionado",
  };
  $("#view-hint").textContent = hints[view];
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

async function openDetail(name) {
  state.selected = name;
  renderChangeList();
  setView("detail");
  const detail = await api(`/api/changes/${encodeURIComponent(name)}`);
  state.detail = detail;
  $("#empty-state").classList.add("hidden");
  $("#detail").classList.remove("hidden");
  $("#detail-title").textContent = detail.displayName;
  $("#detail-status").textContent = detail.archived ? "archived" : detail.status;
  $("#detail-sub").textContent = [
    detail.archived ? `archive/${detail.folderName}` : detail.name,
    detail.archiveDate ? `· ${detail.archiveDate}` : "",
    detail.specIds?.length ? `· specs: ${detail.specIds.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  setProgress(detail.completedTasks, detail.totalTasks, detail.archived);
  renderTasks(detail);
  renderMarkdownPanels(detail);
  showTab(state.tab);
}

function refreshViews() {
  renderStats();
  renderChangeList();
  renderTimeline();
  renderBoard();
}

async function init() {
  const project = await api("/api/project");
  $("#project-path").textContent = project.projectDir;

  const data = await api("/api/changes");
  state.changes = data.changes;
  state.overview = data.overview;
  refreshViews();
  setView(state.changes.some((c) => !c.archived) ? "board" : "timeline");

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
}

init().catch((err) => {
  toast(err.message, "error");
  $("#project-path").textContent = err.message;
});
