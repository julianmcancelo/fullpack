import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ConnectionBanner from './components/ConnectionBanner';
import CommandPalette from './components/CommandPalette';
import MobileBottomNav from './components/MobileBottomNav';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import PairDeviceModal from './components/PairDeviceModal';
import NewSaleNotification from './components/NewSaleNotification';
import Dashboard from './pages/Dashboard';
import StockManager from './pages/StockManager';
import OrdersManager from './pages/OrdersManager';
import ShipmentsManager from './pages/ShipmentsManager';
import QuestionsManager from './pages/QuestionsManager';
import FeeCalculator from './pages/FeeCalculator';
import MobileTerminal from './pages/MobileTerminal';
import Settings from './pages/Settings';
import LoginModal from './components/LoginModal';
import UsersAdminModal from './components/UsersAdminModal';
import LandingGate from './components/LandingGate';
import { api } from './services/api';
import { useAuth } from './context/AuthContext';
import { playCashRegisterSound } from './utils/audio';
import { celebrate } from './utils/celebrate';

export default function App() {
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [connection, setConnection] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [usersAdminModalOpen, setUsersAdminModalOpen] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);
  const [shipments, setShipments] = useState([]);

  // Real-time new sale listener state
  const [newSaleAlert, setNewSaleAlert] = useState(null);
  const knownOrderIdsRef = useRef(new Set());
  const initialOrdersLoadedRef = useRef(false);
  const lastStatsAtRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success')) {
      setActiveTab('settings');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Request browser notification permission if available
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  const loadConnectionStatus = async () => {
    try {
      const status = await api.getStatus();
      setConnection(status);
    } catch (err) {
      console.error('Error fetching connection status:', err);
      setConnection({ connected: false });
    }
  };

  const loadDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const [data, shipRes] = await Promise.all([
        api.getDashboardStats().catch(() => null),
        api.getShipments().catch(() => ({ results: [] })),
      ]);
      if (data) setStats(data);
      if (shipRes?.results) setShipments(shipRes.results);
      lastStatsAtRef.current = Date.now();
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const refreshAll = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadConnectionStatus(), loadDashboardStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // Background Polling for Live New Sales (every 15 seconds)
  useEffect(() => {
    if (!connection?.connected) return;

    const checkNewOrders = async () => {
      try {
        const res = await api.getOrders({ limit: 10 });
        const orders = res.results || [];

        if (!initialOrdersLoadedRef.current) {
          // Initialize known orders set
          orders.forEach((o) => knownOrderIdsRef.current.add(String(o.id)));
          initialOrdersLoadedRef.current = true;
          return;
        }

        // Check for any newly incoming order not in known set
        const brandNewOrders = orders.filter((o) => !knownOrderIdsRef.current.has(String(o.id)));

        if (brandNewOrders.length > 0) {
          const latestOrder = brandNewOrders[0];

          // Add all to known set
          brandNewOrders.forEach((o) => knownOrderIdsRef.current.add(String(o.id)));

          // Trigger celebratory sale feedback
          playCashRegisterSound();
          if (navigator.vibrate) navigator.vibrate([150, 100, 200, 100, 300]);
          celebrate({ particleCount: 70, spread: 80, origin: { y: 0.5 } });

          // Show in-app banner
          setNewSaleAlert(latestOrder);

          // Browser Push Notification
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            const item = (latestOrder.order_items && latestOrder.order_items[0]?.item) || {};
            new Notification('🎉 ¡Nueva Venta en Mercado Libre!', {
              body: `${item.title || 'Producto'} - $${(latestOrder.total_amount || 0).toLocaleString('es-AR')} ARS (Comprador: ${latestOrder.buyer?.nickname || 'Cliente'})`,
              icon: '/favicon.svg',
            });
          }

          // Automatically reload stats and shipments
          loadDashboardStats();
          window.dispatchEvent(
            new CustomEvent('ml:new-orders', {
              detail: { count: brandNewOrders.length, latest: latestOrder },
            })
          );
        }
      } catch (e) {
        // Silent polling error
      }
    };

    // Run first check then interval
    checkNewOrders();
    const interval = setInterval(checkNewOrders, 15000);
    return () => clearInterval(interval);
  }, [connection?.connected]);

  // Refresh periódico de stats cada 60s solo si hay conexión
  useEffect(() => {
    if (!connection?.connected) return;
    const interval = setInterval(() => {
      loadDashboardStats();
    }, 60000);
    return () => clearInterval(interval);
  }, [connection?.connected]);

  // Recarga de stats al volver el foco (throttle 30s)
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastStatsAtRef.current > 30000) {
        loadDashboardStats();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // If user is not logged in, display the minimalist Landing Gate
  if (!currentUser) {
    return (
      /* Locked to the light palette: the public entry point always looks light,
         including the login modal that opens on top of it. */
      <div className="force-light">
        <LandingGate
          onOpenLogin={() => setLoginModalOpen(true)}
          onOpenRequestAccess={() => setLoginModalOpen(true)}
        />
        <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-app font-sans text-ink transition-colors selection:bg-brand selection:text-brand-ink">
      {/* Ambient brand glow behind the whole app */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-radial-brand opacity-70"
      />

      {/* Live New Sale Celebration Toast */}
      <NewSaleNotification
        sale={newSaleAlert}
        onClose={() => setNewSaleAlert(null)}
        onViewOrders={() => setActiveTab('orders')}
      />

      {/* Universal Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandOpen}
        onClose={setCommandOpen}
        onNavigate={setActiveTab}
        connection={connection}
      />

      {/* Floating Global Barcode/QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        shipments={shipments}
        onShipmentPacked={() => loadDashboardStats()}
      />

      {/* SaaS Login & Google/Token Auth Modal */}
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />

      {/* SaaS Users Admin Approval Modal */}
      <UsersAdminModal isOpen={usersAdminModalOpen} onClose={() => setUsersAdminModalOpen(false)} />

      {/* Android app pairing modal (QR link) */}
      <PairDeviceModal isOpen={pairModalOpen} onClose={() => setPairModalOpen(false)} />

      {/* Top Header */}
      <Navbar
        connection={connection}
        onRefresh={refreshAll}
        refreshing={refreshing}
        onNavigate={setActiveTab}
        onOpenCommand={setCommandOpen}
        onOpenLogin={() => setLoginModalOpen(true)}
        onOpenUsersAdmin={() => setUsersAdminModalOpen(true)}
        onOpenPairDevice={() => setPairModalOpen(true)}
      />

      {/* Main App Layout */}
      <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pb-24 sm:px-4 md:flex-row md:pb-0 lg:px-6">
        {/* Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          connection={connection}
          onOpenPairDevice={() => setPairModalOpen(true)}
        />

        {/* Dynamic Page Content */}
        <main className="min-w-0 flex-1 px-0 py-4 sm:py-5 lg:px-8 lg:py-7">
          {/* Show connection warning if not connected and not on settings page */}
          {!connection?.connected && activeTab !== 'settings' && (
            <ConnectionBanner onGoToSettings={() => setActiveTab('settings')} />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              loading={loadingStats}
              onNavigate={setActiveTab}
              onRefresh={loadDashboardStats}
              connection={connection}
            />
          )}

          {activeTab === 'stock' && (
            <StockManager connection={connection} onRefreshData={loadDashboardStats} />
          )}

          {activeTab === 'orders' && <OrdersManager connection={connection} />}

          {activeTab === 'shipments' && <ShipmentsManager connection={connection} />}

          {activeTab === 'mobile_terminal' && <MobileTerminal connection={connection} />}

          {activeTab === 'questions' && <QuestionsManager connection={connection} />}

          {activeTab === 'calculator' && <FeeCalculator />}

          {activeTab === 'settings' && (
            <Settings
              connection={connection}
              onRefreshStatus={loadConnectionStatus}
              onRefreshAllData={refreshAll}
              onOpenLogin={() => setLoginModalOpen(true)}
              onOpenUsersAdmin={() => setUsersAdminModalOpen(true)}
              onOpenPairDevice={() => setPairModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Dedicated Native-style Bottom Mobile Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setScannerOpen(true)}
      />
    </div>
  );
}
