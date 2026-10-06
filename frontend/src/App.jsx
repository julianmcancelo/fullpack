import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ConnectionBanner from './components/ConnectionBanner';
import CommandPalette from './components/CommandPalette';
import MobileBottomNav from './components/MobileBottomNav';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import PairDeviceModal from './components/PairDeviceModal';
import OnboardingWizard from './components/OnboardingWizard';
import NewSaleNotification from './components/NewSaleNotification';
import NewQuestionNotification from './components/NewQuestionNotification';
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
import { playCashRegisterSound, playSuccessBeep } from './utils/audio';
import { celebrate } from './utils/celebrate';

export default function App() {
  const { currentUser, isAdmin, authReady } = useAuth();
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
  // Real-time new question listener state (mirror of orders)
  const [newQuestionAlert, setNewQuestionAlert] = useState(null);
  const [highlightQuestionId, setHighlightQuestionId] = useState(null);
  const knownQuestionIdsRef = useRef(new Set());
  const initialQuestionsLoadedRef = useRef(false);
  const lastStatsAtRef = useRef(0);

  // Asistente de primera conexión (Fase 3): guía hasta vincular ML.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardVerify, setWizardVerify] = useState(false);
  const dismissWizard = () => {
    try {
      sessionStorage.setItem('mlpro:onboarding:dismissed', '1');
    } catch {}
    setWizardOpen(false);
    setWizardVerify(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success')) {
      setActiveTab('settings');
      // Vuelve de OAuth: abrir el asistente en verificación.
      try {
        sessionStorage.removeItem('mlpro:onboarding:dismissed');
      } catch {}
      setWizardVerify(true);
      setWizardOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Request browser notification permission if available
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Auto-apertura del asistente para usuarios activos sin ML vinculado.
  useEffect(() => {
    if (!currentUser || !connection || connection.connected || wizardOpen) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem('mlpro:onboarding:dismissed') === '1';
    } catch {}
    if (!dismissed) setWizardOpen(true);
  }, [currentUser, connection, wizardOpen]);

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
      // Si el backend falló por completo (error + ceros), se conservan los
      // últimos datos reales en vez de pisarlos con ceros falsos.
      if (data && !data.error) setStats(data);
      if (shipRes?.results && shipRes.connected !== false) setShipments(shipRes.results);
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

  // No se piden datos hasta que la sesión esté resuelta: evita disparar
  // consultas con un token vencido (401) en cada arranque.
  useEffect(() => {
    if (!authReady) return;
    refreshAll();
  }, [authReady]);

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

  // Background Polling for New Unanswered Questions (every 30 seconds)
  useEffect(() => {
    if (!connection?.connected) return;

    const checkNewQuestions = async () => {
      try {
        const res = await api.getQuestions('UNANSWERED');
        const questions = res.questions || [];

        if (!initialQuestionsLoadedRef.current) {
          // Initialize known questions set
          questions.forEach((q) => knownQuestionIdsRef.current.add(String(q.id)));
          initialQuestionsLoadedRef.current = true;
          return;
        }

        // Check for any newly incoming question not in known set
        const brandNewQuestions = questions.filter(
          (q) => !knownQuestionIdsRef.current.has(String(q.id))
        );

        if (brandNewQuestions.length > 0) {
          const latestQuestion = brandNewQuestions[0];

          // Add all to known set
          brandNewQuestions.forEach((q) => knownQuestionIdsRef.current.add(String(q.id)));

          // Audible feedback (different tone from sales)
          playSuccessBeep();
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

          // Show in-app banner
          setNewQuestionAlert(latestQuestion);

          // Notify the questions feed so it reloads in background
          window.dispatchEvent(
            new CustomEvent('ml:new-questions', {
              detail: { question: latestQuestion },
            })
          );

          // Browser Push Notification
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            const itemTitle =
              latestQuestion.item?.title ||
              (latestQuestion.item_id
                ? `Publicación #${latestQuestion.item_id}`
                : 'Mercado Libre');
            new Notification(`Nueva pregunta en ${itemTitle}`, {
              body: String(latestQuestion.text || 'Te hicieron una pregunta nueva.').slice(0, 140),
              icon: '/favicon.svg',
            });
          }
        }
      } catch (e) {
        // Silent polling error
      }
    };

    // Run first check then interval
    checkNewQuestions();
    const interval = setInterval(checkNewQuestions, 30000);
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

  // Jump to the questions tab focusing the new question
  const handleViewQuestions = (question) => {
    if (question?.id != null) setHighlightQuestionId(String(question.id));
    setNewQuestionAlert(null);
    setActiveTab('questions');
  };

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

      {/* Live New Question Toast */}
      <NewQuestionNotification
        question={newQuestionAlert}
        onClose={() => setNewQuestionAlert(null)}
        onViewQuestions={handleViewQuestions}
      />

      {/* Asistente de primera conexión con Mercado Libre */}
      {wizardOpen && currentUser && (
        <OnboardingWizard
          connection={connection}
          onRefreshStatus={loadConnectionStatus}
          onRefreshAllData={refreshAll}
          onClose={dismissWizard}
          startAtVerify={wizardVerify}
        />
      )}

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
          stats={stats}
          shipments={shipments}
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

          {activeTab === 'questions' && (
            <QuestionsManager connection={connection} highlightId={highlightQuestionId} />
          )}

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
