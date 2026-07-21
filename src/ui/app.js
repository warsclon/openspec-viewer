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
          row.nextTask = nextTaskFromSections(result.sections);
        }
        state.detail.nextTask = nextTaskFromSections(result.sections);
        rebuildNextUp();
        setProgress(result.completed, result.total, false);
        $("#detail-status").textContent = state.detail.status;
        renderChangeList();
        renderTasks(state.detail);
        refreshViews();
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

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  ["next", "graph", "timeline", "board", "detail"].forEach((name) => {
    $(`#view-${name}`).classList.toggle("hidden", name !== view);
  });
  const hints = {
    next: "Siguiente task incompleta de cada change activo — modo ‘qué hago ahora’",
    graph: "Specs main ↔ changes (edges = deltas que tocaron esa spec)",
    timeline: "Evolución por fecha (archive date o última edición)",
    board: "Kanban: activos / en curso / hechos / archivados",
    detail: "Proposal, design, specs y tasks del change seleccionado",
  };
  $("#view-hint").textContent = hints[view];
  if (view === "graph") renderGraph();
  if (view === "next") renderNext();
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
      }
    });
  });

  $("#clear-focus")?.addEventListener("click", () => {
    state.focusSpec = null;
    renderGraph();
    renderStats();
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
  renderNext();
  renderGraph();
  renderTimeline();
  renderBoard();
}

async function init() {
  initPrefs();

  const project = await api("/api/project");
  $("#project-path").textContent = project.projectDir;

  const data = await api("/api/changes");
  state.changes = data.changes;
  state.overview = data.overview;
  state.graph = data.graph;
  state.nextUp = data.nextUp || [];
  rebuildNextUp();
  refreshViews();
  setView(state.changes.some((c) => !c.archived && c.nextTask) ? "next" : "graph");

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
}

init().catch((err) => {
  toast(err.message, "error");
  $("#project-path").textContent = err.message;
});
