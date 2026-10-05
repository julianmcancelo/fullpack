# Sistema de diseño — ML Pro Suite

Guía normativa para todo el frontend. **Ningún componente debe inventar colores ni
estilos fuera de este documento.** Si falta una pieza, se agrega a `src/index.css`
siguiendo la misma convención.

---

## 1. Principios

1. **Un solo tema, dos apariencias.** No se escribe `dark:` para colores. Se usan
   tokens semánticos que cambian solos cuando `<html>` tiene la clase `.dark`.
2. **Jerarquía por elevación.** `app` (fondo) → `card` (contenido) → `raised`
   (popovers, menús) y `muted` (rellenos suaves, hover, cabeceras de tabla).
3. **El amarillo es acento, no decoración.** `brand` sólo para la acción principal,
   el ítem activo y los detalles de marca. El resto es neutro + un color de estado.
4. **Densidad profesional.** Radios 12–16 px (`rounded-xl`/`rounded-2xl`), sombras
   suaves (`shadow-card`), bordes de 1 px (`border-line`).
5. **Todo se mueve igual.** Transiciones `duration-200`/`300` con `ease-spring`.

---

## 2. Tokens

| Token | Clases | Uso |
| --- | --- | --- |
| Fondo de app | `bg-app` | `<body>` y contenedor raíz de pantalla |
| Superficie | `bg-card` | Tarjetas, modales, tablas |
| Elevado | `bg-raised` | Popovers, dropdowns, tooltips |
| Relleno suave | `bg-muted` | Hover, cabeceras, chips, skeletons |
| Bordes | `border-line`, `border-line-strong` | Separadores / bordes con más contraste |
| Texto | `text-ink`, `text-ink-muted`, `text-ink-subtle` | Título / cuerpo / secundario |
| Marca | `brand`, `brand-ink`, `brand-soft`, `brand-soft-ink`, `brand-400`, `brand-600` | Acción principal y estados suaves de marca |
| Acento | `accent`, `accent-soft` | Enlaces, foco, acciones secundarias |
| Estados | `success`, `warning`, `danger`, `info` (+ `-soft`) | Semántica de negocio |

**Prohibido en código nuevo:** `slate-*`, `gray-*`, `zinc-*`, `emerald-*`, `rose-*`,
`amber-*`, `blue-*` para color de UI, y cualquier hex suelto. Existen sólo por
compatibilidad con el marcado viejo.

> **Excepción — superficies permanentemente oscuras.** El hero de la landing
> (`bg-ink-gradient`) es siempre oscuro, aunque el tema sea claro. Ahí los tokens
> temáticos se invierten y pierden contraste, así que se usan colores fijos claros
> (`text-brand-300`, `text-emerald-300`, `text-sky-300`, `border-white/10`,
> `bg-white/[0.04]`) y la rejilla `surface-grid-light`. Es la única excepción
> admitida; cualquier otra superficie debe ser temática.

Sombras: `shadow-xs`, `shadow-card`, `shadow-card-hover`, `shadow-pop`,
`shadow-modal`, `shadow-glow` (amarillo), `shadow-glow-accent` (azul).

Animaciones: `animate-rise` (entrada de página), `animate-fade-in`, `animate-pop`
(modales), `animate-slide-down` (menús), `animate-pulse-ring`, `animate-floaty`.

Degradados: `bg-brand-gradient`, `bg-accent-gradient`, `bg-ink-gradient`,
`bg-radial-brand`, `bg-radial-accent`, `surface-grid` (rejilla de fondo).

---

## 3. Clases de componente

### Estructura de página
```
<div className="page">                       // espaciado vertical + animación
  <div className="page-head">
    <div>
      <h1 className="page-title">…</h1>
      <p className="page-sub">…</p>
    </div>
    <div className="toolbar">…botones…</div>
  </div>
  …
</div>
```

### Tarjetas
`.card` `.card-hover` `.card-pad` `.card-head` `.card-title` `.card-sub`
`.card-body` `.card-foot` `.card-accent`

### Botones — siempre `.btn` + una variante
`.btn-primary` (amarillo, acción principal) · `.btn-accent` (azul) ·
`.btn-outline` · `.btn-ghost` · `.btn-soft` · `.btn-soft-accent` ·
`.btn-danger` · `.btn-danger-soft` · `.btn-success` · `.btn-dark`
Tamaños: `.btn-xs` `.btn-sm` (por defecto) `.btn-lg` `.btn-block` `.btn-icon` `.btn-icon-sm`

### Formularios
`.label` `.input` `.input-sm` `.input-search` `.select` `.textarea` `.field`
`.help` `.input-group` `.check`

### Etiquetas
`.badge` + `.badge-brand` `.badge-success` `.badge-warning` `.badge-danger`
`.badge-info` `.badge-neutral` `.badge-solid`
`.chip` `.kbd` `.segmented` `.segmented-btn` `.segmented-btn-active`

### KPIs
```
<div className="kpi">
  <div className="flex items-start justify-between gap-3">
    <span className="kpi-label">Ventas cobradas</span>
    <div className="kpi-icon kpi-icon-success"><DollarSign className="h-5 w-5" /></div>
  </div>
  <p className="kpi-value tabular">$1.234.567</p>
  <div className="kpi-foot">…</div>
  <span className="kpi-spark" aria-hidden="true" />
</div>
```
Variantes de icono: `.kpi-icon-brand` `.kpi-icon-success` `.kpi-icon-accent`
`.kpi-icon-warning` `.kpi-icon-danger`

### Tablas
```
<div className="table-wrap">
  <table className="table">
    <thead><tr><th>…</th></tr></thead>
    <tbody><tr><td className="td-strong">…</td><td>…</td></tr></tbody>
  </table>
</div>
```
`.th` y `.td` son atajos para celdas sueltas. `.td-strong` para la columna clave.

### Modales
`.overlay` (+ `.overlay-top`) · `.modal` (+ `.modal-sm` `.modal-lg` `.modal-xl`)
`.modal-head` `.modal-title` `.modal-sub` `.modal-body` `.modal-foot` `.modal-close`
Popovers: `.popover` `.menu-item` `.menu-item-danger`

### Navegación
`.nav-link` `.nav-link-active` `.nav-label` `.mobile-tab` `.mobile-tab-active` `.fab`

### Estados
`.empty` `.empty-icon` `.empty-title` `.empty-text` · `.skeleton` ·
`.progress` + `.progress-bar` · `.stat-strip` · `.link` · `.avatar` · `.glass`

---

## 4. Reglas de trabajo

- **La lógica no se toca.** Handlers, props, estado, efectos, llamadas a la API,
  keys de listas, condicionales y textos se conservan exactamente. Sólo cambia la
  presentación.
- **Los textos siguen en español** y con el mismo significado.
- **No agregar dependencias.** Los íconos salen de `lucide-react`; se mantienen las
  importaciones que ya se usan (quitar una importación rota el build si el ícono
  sigue en el JSX).
- **Números y dinero:** agregar `tabular` a precios, totales, cantidades y conteos.
- **Estados vacíos:** usar `.empty` en lugar de texto suelto centrado.
- **Cargas:** usar `.skeleton` en lugar de spinners de pantalla completa.
- **Responsive:** móvil primero. Las tablas anchas van dentro de `.table-wrap`
  (ya tiene `overflow-x-auto`), nunca provocan scroll horizontal del `<body>`.
- **Accesibilidad:** todo botón con sólo ícono lleva `title` o `aria-label`.
- **Sin comandos de shell**: el sandbox bloquea `npm`/`vite`; la verificación se
  hace releyendo el archivo.

## 5. Compatibilidad

Se mantienen funcionales por compatibilidad: `shadow-xs`, `scale-98`,
`animate-in fade-in`, `animate-in zoom-in-95`, `slide-in-from-top-4`.
El código nuevo usa `animate-rise`, `animate-pop` y `animate-slide-down`.
