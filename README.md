# KanbanFlow

Gestor de tareas visual construido con **HTML, CSS y JavaScript puro** (ES Modules, sin frameworks, sin bundler y sin dependencias de runtime). Organiza tu trabajo en tableros y columnas, con arrastrar y soltar, filtros combinables, calendario, estadísticas e historial de actividad. Todo se guarda en tu navegador.

![KanbanFlow](icons/favicon.svg)

Diseño editorial en tonos papel y tinta, con acento verde pino, tipografía **Fraunces** para títulos y **Manrope** para la interfaz. Disponible en tema claro y oscuro, y adaptado a escritorio, tablet y móvil.

## ✨ Características

- **Múltiples tableros**, cada uno con su color de identidad y cuatro columnas tipadas: Pendiente, En progreso, En revisión y Completado.
- **Arrastrar y soltar con Pointer Events**: funciona con mouse, lápiz y pantalla táctil; incluye asa de arrastre, pulsación larga, autoscroll y reordenamiento dentro de la columna.
- **Alternativa accesible con teclado**: `Alt` + flechas para mover tarjetas entre columnas o reordenarlas.
- **Tareas completas**: título, descripción, fecha límite, prioridad, etiquetas con color y responsable.
- **Añadido rápido por columna** y **completado en un clic** desde la tarjeta.
- **Filtros combinables** por prioridad, etiqueta, vencimiento y búsqueda de texto libre, con contador de resultados.
- **Vista de calendario** mensual con navegación y diálogo de detalle por día.
- **Dashboard** con progreso, pendientes, tareas en curso, vencidas y prioridad alta.
- **Estadísticas** en SVG puro: ritmo de creación, distribución por estado, productividad, tiempo medio de cierre e impulso de los últimos 7 días.
- **Historial de actividad** agrupado por día, con creación, edición, movimiento, eliminación e importación.
- **Deshacer** mediante instantáneas de estado al mover, eliminar, importar o cargar el tablero de ejemplo.
- **Importar / exportar** copias de seguridad en JSON. Acepta tanto copias completas como las exportaciones antiguas de un solo tablero (que se añaden sin tocar tus datos). La importación se valida y sanea antes de aplicarse.
- **Tema claro / oscuro** persistente, sin parpadeo al cargar.
- **Atajos de teclado** y diálogos nativos accesibles.
- **Persistencia local** con guardado diferido y volcado al ocultar la pestaña (incluido móvil).
- **PWA básica**: manifiesto, icono SVG y metadatos para instalar o añadir a la pantalla de inicio.

## 🎨 Dirección de diseño

- Paleta cálida de papel y tinta con acento **verde pino** (`#2F5B4C`) y colores de prioridad tierra: óxido para alta, ocre para media y salvia para baja.
- Tipografía editorial: **Fraunces** para títulos y cifras, **Manrope** para la interfaz y monoespaciada del sistema para fechas y datos.
- Columnas con identificador de color, tarjetas con borde de prioridad, textura de grano sutil y sombras suaves.
- Tema oscuro calibrado con su propia paleta cálida —carbón cálido, marfil suave y sombras más tenues—, no una simple inversión.
- En móvil: navegación inferior con botón flotante, cajón lateral deslizante, búsqueda expandible y diálogos tipo *bottom sheet*.

## 🛠️ Stack técnico

| Tecnología | Uso |
|---|---|
| HTML5 semántico | Estructura, diálogos nativos, landmarks y metadatos |
| CSS3 moderno | Variables, Grid, Flexbox, `color-mix`, `:has`, `dvh`, temas |
| JavaScript ES2022 | Módulos, estado centralizado, render por lotes con `requestAnimationFrame` |
| Pointer Events | Arrastrar y soltar unificado para mouse, táctil y lápiz |
| LocalStorage | Persistencia de tableros, tareas, etiquetas, historial y preferencias |
| SVG | Iconos, gráficos y anillos de progreso generados a mano |
| Web App Manifest | Instalación como aplicación y color de tema |

No hay framework, bundler ni dependencia de runtime. Las tipografías se cargan desde Google Fonts; si no están disponibles, se usan las fuentes del sistema.

## 📁 Estructura del proyecto

```
kanbanflow/
├── index.html              # Estructura, diálogos, navegación y arranque del tema
├── manifest.webmanifest    # Metadatos PWA
├── css/
│   ├── tokens.css          # Variables, temas, reset y utilidades
│   ├── layout.css          # Armazón, sidebar, topbar, dashboard y toasts
│   ├── board.css           # Columnas, tarjetas, drag & drop y añadido rápido
│   ├── views.css           # Calendario, estadísticas, historial y día
│   ├── modal.css           # Diálogos, formularios y selectores
│   └── responsive.css      # Breakpoints de escritorio, tablet y móvil
├── js/
│   ├── main.js             # Orquestador: eventos, acciones y flujos de usuario
│   ├── store.js            # Estado, persistencia, migración y saneado de datos
│   ├── model.js            # Operaciones de tableros, tareas, filtros e historial
│   ├── render.js           # Render selectivo y batcheado de la interfaz
│   ├── dragdrop.js         # Arrastrar y soltar con Pointer Events
│   ├── dialogs.js          # Diálogos nativos y confirmaciones asíncronas
│   ├── charts.js           # Cálculos y gráficos SVG
│   ├── seed.js             # Tablero de ejemplo realista
│   ├── toast.js            # Avisos efímeros con acción
│   ├── icons.js            # Set de iconos SVG en línea
│   └── utils.js            # Fechas, texto, búsqueda y helpers
├── icons/
│   └── favicon.svg
└── assets/
```

## 🚀 Cómo correrlo localmente

Al usar ES Modules, abrir `index.html` con `file://` no funciona en la mayoría de navegadores. Sirve la carpeta con cualquier servidor estático:

```bash
# Con Python
python -m http.server 8080

# Con Node
npx serve .
```

Luego abre `http://localhost:8080`.

## 💾 Datos y persistencia

El estado vive en un único objeto en memoria y se serializa a `localStorage` con un pequeño retardo para agrupar cambios. También se vuelca al cerrar u ocultar la pestaña.

| Clave | Contenido |
|---|---|
| `kanbanflow.data.v2` | Tableros, tareas, etiquetas e historial |
| `kanbanflow_data_v1` | Formato anterior; se migra automáticamente |
| `kanbanflow_theme` | Tema del formato anterior; se migra al abrir |
| `kanbanflow.prefs.v1` | Tema y estado de la barra lateral |

Esquema resumido:

```js
{
  version: 2,
  activeBoardId: 'board-…',
  boards: [{
    id, name, color, createdAt,
    columns: [{ id, name, kind, color, taskIds }]
  }],
  tasks: {
    'task-…': {
      id, boardId, title, description, dueDate, priority,
      labelIds, assignee, createdAt, updatedAt, completedAt
    }
  },
  labels: [{ id, name, color }],
  history: [{ id, action, title, detail, at, boardId }]
}
```

- `priority`: `alta | media | baja`.
- `kind` de columna: `backlog | active | review | done`; define el progreso y el estado completado.
- Al importar, los IDs se validan contra un patrón seguro, las referencias de tareas se reasignan y los colores se comprueban como hexadecimales. Así se evita inyectar atributos desde archivos externos.
- Los datos de la versión anterior se migran solos la primera vez que se abre la app.

## ⌨️ Atajos

| Atajo | Acción |
|---|---|
| `N` | Nueva tarea |
| `F` o `/` | Buscar tareas |
| `?` | Abrir la ayuda de atajos |
| `Alt` + `←` / `→` | Mover la tarjeta enfocada entre columnas |
| `Alt` + `↑` / `↓` | Reordenar dentro de la columna |
| `Ctrl` / `Cmd` + `Enter` | Guardar la tarea desde el diálogo |
| `Esc` | Cerrar diálogo, búsqueda o añadido rápido |

En pantallas táctiles, mantén pulsada el asa `⠿` de una tarjeta para arrastrarla sin bloquear el desplazamiento.

## ♿ Accesibilidad y rendimiento

- Diálogos nativos `<dialog>` con foco atrapado y cierre con `Esc`.
- Navegación completa por teclado, `aria-current` en vistas, `aria-pressed` en completados y etiquetas descriptivas.
- Región `aria-live` para anunciar movimientos, creación, borrado y filtros.
- Enlace “Saltar al contenido”, foco visible y contraste cuidado en ambos temas.
- Render por lotes con `requestAnimationFrame` y actualización selectiva de zonas (barra lateral, cabecera, dashboard, filtros o vista), conservando el scroll del tablero y de cada columna.
- Delegación de eventos y un único listener de teclado global.

## 📱 Responsive

| Ancho | Comportamiento |
|---|---|
| > 980 px | Barra lateral fija, colapsable y persistente |
| ≤ 980 px | Barra lateral como cajón deslizante con fondo oscurecido |
| ≤ 860 px | Se oculta el dashboard para dar prioridad al tablero |
| ≤ 760 px | Navegación inferior, botón flotante, búsqueda expandible |
| ≤ 640 px | Diálogos a pantalla completa tipo *bottom sheet* |

## 🧪 Verificación

Los módulos se pueden validar sin dependencias con:

```bash
node --check js/*.js
```

La app se verificó en Chrome con pruebas de humo sobre render inicial, CRUD de tareas y tableros, añadido rápido, filtros, búsqueda, vistas, calendario, historial, tema, atajos, importación/exportación, deshacer, arrastre real con puntero, diseño móvil y migración desde `v1`.

## Autor

Proyecto desarrollado por **Matías Torres Sandoval** como pieza de portafolio — Ingeniero Civil Informático (UNAB).
