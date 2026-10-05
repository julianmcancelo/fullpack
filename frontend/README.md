# React + Vite — frontend de ML Pro Suite

App web de gestión de Mercado Libre: Dashboard con KPIs, Stock, Ventas, Mesa de
Empaque/Logística, Terminal de depósito, Preguntas, Calculadora y Ajustes.

## Scripts

```bash
npm run dev     # Vite en http://localhost:5173 (usa http://localhost:3001/api)
npm run build   # Build de producción a dist/
npm run preview # Previsualizar el build
npm run lint    # oxlint
```

## Estructura

```
src/
├── pages/            # Dashboard, StockManager, OrdersManager, ShipmentsManager,
│                     # MobileTerminal, QuestionsManager, FeeCalculator, Settings
├── components/       # Navbar, Sidebar, MobileBottomNav, BarcodeScannerModal,
│                     # PairDeviceModal, NewSaleNotification, CommandPalette, ...
├── context/          # AuthContext, ThemeContext
├── services/         # api.js (cliente REST), firebase.js (Google Auth)
└── utils/            # audio.js (beeps y voz en español)
```

## Sincronización en vivo

- Ventas: polling cada 15s + evento global `ml:new-orders` (ver `App.jsx`).
- Envíos: polling cada 10s + botón "Sincronizar estados" (usa
  `GET /shipments/:id/status` del backend).
- `VITE_API_BASE` (opcional): en local con puerto 5173 apunta a
  `http://localhost:3001/api`; en Vercel usa `/api`.
