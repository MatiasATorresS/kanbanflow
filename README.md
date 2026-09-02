# KanbanFlow

Gestor de tareas estilo Trello/Linear construido con **HTML, CSS y JavaScript puro** (ES Modules, sin frameworks ni dependencias externas de runtime). Organiza tareas en tableros y columnas, con Drag & Drop nativo, filtros, calendario, estadísticas e historial de actividad — todo persistido en `localStorage`.

![KanbanFlow](icons/favicon.svg)

## ✨ Características

- **Múltiples tableros**, cada uno con sus propias columnas y tareas (Pendiente → En progreso → En revisión → Completado).
- **Drag & Drop nativo** entre columnas, con animación de "levantado" y placeholder de inserción.
- **Tareas completas**: título, descripción, fecha límite, prioridad, etiquetas con color, responsable y color personalizado.
- **Filtros combinables**: por prioridad, etiqueta, rango de fecha y búsqueda de texto libre.
- **Vista de calendario** mensual con las tareas distribuidas según su fecha límite.
- **Dashboard** con métricas en vivo: total, pendientes, en progreso, terminadas y prioridad alta.
- **Notificaciones de vencimiento**: aviso visual cuando una tarea vence el día de hoy.
- **Historial de actividad**: registro de creación, edición, movimiento y eliminación de tareas.
- **Estadísticas**: tareas creadas por mes, distribución por estado, % de productividad y tiempo promedio de finalización — todo renderizado en SVG puro, sin librerías de gráficos.
- **Exportar / Importar tableros** como archivos `.json`, para respaldo o migración entre navegadores.
- **Atajos de teclado**: `N` nueva tarea, `F` buscar, `Esc` cerrar modal.
- **Tema claro / oscuro** con persistencia automática.
- **Responsive**: sidebar colapsable en desktop, menú deslizante en móvil.

## 🛠️ Stack técnico

| Tecnología | Uso |
|---|---|
| HTML5 | Estructura semántica de la app |
| CSS3 | Variables CSS, Grid, Flexbox, temas claro/oscuro |
| JavaScript (ES Modules) | Lógica de la aplicación, sin build step |
| Drag & Drop API | Reordenamiento de tareas entre columnas |
| LocalStorage API | Persistencia de tableros, tareas e historial |
| SVG | Gráficos de estadísticas renderizados a mano |

No se utiliza ningún framework, bundler ni dependencia de runtime. El proyecto corre directamente en el navegador.

## 📁 Estructura del proyecto

```
kanbanflow/
├── index.html
├── css/
│   ├── main.css         # variables, layout, sidebar, topbar, dashboard
│   ├── board.css        # columnas, tarjetas, calendario, stats, historial
│   ├── modal.css        # modales y formularios
│   ├── dark.css         # tema oscuro
│   └── responsive.css   # breakpoints tablet/móvil
├── js/
│   ├── app.js           # orquestador principal (eventos, render, estado)
│   ├── board.js         # modelo de tableros
│   ├── task.js          # modelo de tareas (CRUD)
│   ├── history.js       # registro de actividad
│   ├── dragdrop.js       # Drag & Drop API
│   ├── storage.js       # capa de persistencia (localStorage)
│   ├── modal.js          # apertura/cierre de modales
│   ├── filters.js        # lógica de filtrado
│   ├── calendar.js       # construcción de la grilla mensual
│   ├── charts.js         # gráficos SVG de estadísticas
│   └── utils.js          # fechas, formato, helpers
├── assets/
└── icons/
```

## 🚀 Cómo correrlo localmente

Como el proyecto usa ES Modules, **no funciona abriendo `index.html` directamente con `file://`** (los navegadores bloquean imports de módulos en ese contexto). Hay que servirlo con cualquier servidor estático:

```bash
# Con Python
python3 -m http.server 8080

# Con Node (npx)
npx serve .

# Con la extensión "Live Server" de VS Code
```

Luego abrir `http://localhost:8080` en el navegador.

## 🎨 Diseño

La interfaz está inspirada en Trello, Linear y Jira, con identidad propia: tipografía editorial **Fraunces** (serif) para títulos y cifras destacadas, **Manrope** para el texto, y **JetBrains Mono** para fechas y datos. Cada tarjeta de tarea usa un borde de acento por prioridad (coral / ámbar / verde salvia), el fondo luce un degradado atmosférico con textura de grano muy sutil, y el tema oscuro está calibrado con su propia paleta de contraste cálida, no solo una inversión de colores.

## 📌 Notas de implementación

- El estado vive en memoria como un único objeto `data` (tableros, tareas, etiquetas, historial) que se serializa completo a `localStorage` tras cada mutación.
- Los IDs se generan con un `uid()` simple basado en timestamp + random, suficiente para un proyecto sin backend.
- El Drag & Drop calcula la posición de inserción comparando el punto medio vertical de cada tarjeta contra la posición del cursor, sin librerías externas.
- Los gráficos de estadísticas son SVG generado dinámicamente en `charts.js`, sin Chart.js ni D3.

## Autor

Proyecto desarrollado por **Matías Torres Sandoval** como pieza de portafolio — Ingeniero Civil Informático (UNAB).
