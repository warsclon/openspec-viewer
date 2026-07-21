# openspec-viewer

CLI local que levanta una UI web para **ver y gestionar** changes de [OpenSpec](https://github.com/Fission-AI/OpenSpec).

OpenSpec ya trae `openspec view` (dashboard en terminal). Esto es la versión “quiero verlo en el navegador y marcar checkboxes sin pelearme con el markdown”.

## Qué hace

- Detecta `openspec/` subiendo desde el cwd (o `--path`)
- Changes **activos + archivados**, vistas **Ahora / Grafo / Timeline / Board / Detalle**
- **Live reload** (`fs.watch` + SSE) cuando cambia `openspec/`
- **Búsqueda global** `⌘K` / `Ctrl+K` (change, task, proposal, design, spec)
- **Diff** main vs delta (ADDED / MODIFIED / REMOVED)
- **Deep links** `#/next`, `#/graph?spec=…`, `#/change/<name>/diff`
- Toggle de tasks en activos → `tasks.md` (archive = read-only)

## Requisitos

- Node.js 20+

## Uso

```bash
cd openspec-viewer
npm install
npm run build
npm link   # opcional, deja el binario global

# desde un proyecto con openspec/
openspec-viewer

# o apuntando a otro repo
openspec-viewer /ruta/al/proyecto
openspec-viewer --port 5173 --path ../mi-app
openspec-viewer --no-open
openspec-viewer --no-archive   # solo activos
```

Dev sin build:

```bash
npm run dev -- --path /ruta/al/proyecto
```

## API local

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/project` | Rutas del proyecto |
| GET | `/api/changes` | Lista + overview + graph + nextUp |
| GET | `/api/changes/:name` | Detalle + tasks + **specDiffs** |
| POST | `/api/changes/:name/tasks/toggle` | Body: `{ "taskId": "1.2", "done": true }` |
| GET | `/api/search?q=` | Búsqueda global |
| GET | `/api/events` | SSE live reload |

## Roadmap (cuando nos aburramos de solo mirar)

- [ ] Editar proposal/design en la UI
- [ ] Crear changes
- [ ] Watcher de filesystem (multi-agente / multi-pestaña)
- [ ] Filtros y búsqueda de tasks
- [ ] Dark/light (hoy es “dark mode forever”, como el alma del on-call)

## Licencia

MIT
