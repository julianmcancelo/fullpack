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
├── backend/
│   ├── src/
│   │   ├── db/store.js            # Almacenamiento local seguro de credenciales y tokens
│   │   ├── services/
│   │   │   ├── mlAuth.service.js      # OAuth 2.0 & Token Auto-refresher
│   │   │   ├── mlItems.service.js     # API de ítems, precios y stock
│   │   │   ├── mlOrders.service.js    # API de ventas y compradores
│   │   │   └── mlShipments.service.js # API de logística y descarga de etiquetas
│   │   ├── routes/                # Rutas REST de Express
│   │   └── server.js              # Servidor Express
├── frontend/
│   ├── src/
│   │   ├── components/            # Navbar, Sidebar, Banners
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # KPIs, gráficos, órdenes y envíos urgentes
│   │   │   ├── StockManager.jsx     # Edición de stock y precio en vivo
│   │   │   ├── OrdersManager.jsx    # Desglose financiero y compradores
│   │   │   ├── ShipmentsManager.jsx # Envíos y etiquetas PDF/ZPL
│   │   │   └── Settings.jsx         # Asistente de conexión y credenciales
│   │   ├── services/api.js        # Cliente API frontend
│   │   └── App.jsx
└── package.json                   # Script orquestador
```
