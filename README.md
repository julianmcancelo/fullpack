#  Mercado Libre Pro Manager

Aplicación profesional y completa para la gestión integral de tu cuenta de **Mercado Libre**:
- **Control de Stock y Precios:** Edición en tiempo real, variantes y publicaciones pausadas/activas sincronizadas directamente con la API oficial.
- **Centro de Ventas y Facturación:** Historial de compras, compradores, cobros en Mercado Pago y cálculo de comisiones netas.
- **Logística y Envíos:** Gestión de Mercado Envíos (Flex, Colecta, Full y Correo tradicional) con **descarga e impresión directa de etiquetas oficiales (PDF y térmicas ZPL)**.
- **Conexión Oficial:** Autenticación OAuth 2.0 con auto-renovación de Access Token o ingreso manual directo de token.

---

##  Inicio Rápido

### 1. Iniciar toda la aplicación
Desde la raíz del proyecto (`d:\ML`), ejecuta:

```bash
npm run dev
```

Esto levantará automáticamente:
- **Backend API:** `http://localhost:3001`
- **Frontend App:** `http://localhost:5173`

---

##  Guía para Conectar tu Cuenta de Mercado Libre

### Opción A: Conexión Automática OAuth 2.0 (Recomendada)
1. Ingresa al [DevCenter de Mercado Libre](https://developers.mercadolibre.com.ar/devcenter) con tu cuenta de vendedor.
2. Haz clic en **Crear una aplicación**.
3. En **Redirect URI (URL de retorno)**, ingresa:
   ```
   http://localhost:3001/api/auth/callback
   ```
4. Guarda tu aplicación y copia tu **APP ID (Client ID)** y **Client Secret Key**.
5. Abre la aplicación en `http://localhost:5173`, ve a la pestaña **Credenciales & Ajustes**, pega tu App ID y Secret, selecciona tu país (Argentina, Brasil, México, Chile, Colombia, Uruguay, Perú) y haz clic en **"Conectar con Mercado Libre (OAuth 2.0)"**.
6. Autoriza la aplicación en Mercado Libre ¡y listo! La app renovará los tokens automáticamente en segundo plano.

### Opción B: Ingreso Directo de Access Token
Si ya tienes un `access_token` generado desde la consola de desarrollador o Postman:
1. Ve a **Credenciales & Ajustes** > **Método 2: Ingreso Directo**.
2. Pega tu `APP_USR-...` token y haz clic en **Vincular**.

---

##  Estructura del Proyecto

```
d:\ML/
├── api/
│   └── index.js               # Entry point serverless (Vercel): re-exporta el backend
├── backend/
│   ├── src/
│   │   ├── server.js              # App Express (rutas /api/*)
│   │   ├── middleware/device.js   # Auth de dispositivos móviles (X-Device-Token)
│   │   ├── routes/                # auth, users, items, orders, shipments,
│   │   │                         # settings, stats, questions, pair, mobile
│   │   ├── services/              # mlAuth (OAuth + refresh), mlItems, mlOrders,
│   │   │                         # mlShipments, mlQuestions, mobileTokens
│   │   └── db/                   # store.js (JSON local + seed) / neon.js (PostgreSQL)
│   └── data/store.json       # Seed inicial para el deploy (los tokens rotan por OAuth)
├── frontend/
│   ├── src/
│   │   ├── components/            # Navbar, Sidebar, Banners, PairDeviceModal, ...
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # KPIs, gráficos, órdenes y envíos urgentes
│   │   │   ├── StockManager.jsx     # Edición de stock y precio en vivo
│   │   │   ├── OrdersManager.jsx    # Ventas (auto-sync 15s + evento ml:new-orders)
│   │   │   ├── ShipmentsManager.jsx # Empaque, etiquetas PDF/ZPL, sync de estados ML
│   │   │   ├── MobileTerminal.jsx   # Terminal web de depósito (QR + despacho)
│   │   │   ├── QuestionsManager.jsx # Preguntas pre-venta
│   │   │   ├── FeeCalculator.jsx    # Calculadora de comisiones
│   │   │   └── Settings.jsx         # Conexión ML, pairing QR, ajustes
│   │   ├── services/api.js        # Cliente REST del frontend
│   │   └── App.jsx                # Polling global de ventas + notificaciones
│   └── README.md                 # Docs del frontend
├── mobile/                       # App Android nativa (Kotlin + Compose)
│   ├── CONTRACT.md                 # Fuente de verdad: API, firmas y diseño
│   └── README.md                   # Flujo de vinculación QR
├── vercel.json                   # Deploy: frontend estático + /api/* serverless
├── .vercelignore                 # Excluye mobile/, dist y logs del deploy
├── firebase.json                  # Config de Google Sign-In (redirect URIs)
└── package.json                   # Script orquestador (npm run dev)
```

> Nota: las dependencias del `package.json` raíz duplican a propósito las del
> backend: el builder `@vercel/node` de `api/index.js` resuelve desde la raíz.
> `backend/data/store.json` es el seed inicial del deploy; en producción la
> fuente de verdad es Neon PostgreSQL (`DATABASE_URL`).
```
