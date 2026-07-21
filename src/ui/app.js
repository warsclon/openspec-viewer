const state = {
  changes: [],
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

/** Tiny markdown → HTML (good enough for specs/proposal). */
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

function renderChangeList() {
  const root = $("#change-list");
  if (!state.changes.length) {
    root.innerHTML = `<p class="muted">No hay changes activos.</p>`;
    return;
  }
  root.innerHTML = state.changes
    .map((c) => {
      const active = state.selected === c.name ? "active" : "";
      return `
        <button type="button" class="change-item ${active}" data-name="${escapeHtml(c.name)}">
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="meta">
            <span class="badge ${c.status}">${c.status}</span>
            <span>${c.completedTasks}/${c.totalTasks}</span>
          </div>
        </button>`;
    })
    .join("");

  root.querySelectorAll(".change-item").forEach((btn) => {
    btn.addEventListener("click", () => selectChange(btn.dataset.name));
  });
}

function setProgress(done, total) {
  const p = pct(done, total);
  $("#progress-label").textContent = `${done} / ${total}`;
  $("#progress-pct").textContent = `${p}%`;
  $("#progress-fill").style.width = `${p}%`;
}

function renderTasks(detail) {
  const panel = $("#panel-tasks");
  if (!detail.tasks || !detail.tasks.total) {
    panel.innerHTML = `<div class="md"><p class="muted">Sin tasks.md (o está vacío). El agente aún no ha hecho la lista de la compra.</p></div>`;
    return;
  }

  panel.innerHTML = detail.tasks.sections
    .map(
      (sec) => `
      <div class="section">
        <h3>${escapeHtml(sec.title)}</h3>
        ${sec.tasks
          .map(
            (t) => `
          <label class="task ${t.done ? "done" : ""}" data-id="${escapeHtml(t.id)}">
            <input type="checkbox" ${t.done ? "checked" : ""} data-task-id="${escapeHtml(t.id)}" />
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
        }
        setProgress(result.completed, result.total);
        $("#detail-status").textContent = state.detail.status;
        renderChangeList();
        renderTasks(state.detail);
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

async function selectChange(name) {
  state.selected = name;
  renderChangeList();
  const detail = await api(`/api/changes/${encodeURIComponent(name)}`);
  state.detail = detail;
  $("#empty-state").classList.add("hidden");
  $("#detail").classList.remove("hidden");
  $("#detail-title").textContent = detail.name;
  $("#detail-status").textContent = detail.status;
  setProgress(detail.completedTasks, detail.totalTasks);
  renderTasks(detail);
  renderMarkdownPanels(detail);
  showTab(state.tab);
}

async function init() {
  const project = await api("/api/project");
  $("#project-path").textContent = project.projectDir;

  const { changes } = await api("/api/changes");
  state.changes = changes;
  renderChangeList();

  if (changes[0]) await selectChange(changes[0].name);

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
