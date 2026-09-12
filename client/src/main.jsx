import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import GuardianView from './pages/GuardianView.jsx'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("RootErrorBoundary caught fatal render error:", error, errorInfo);
  }

  handleRecovery = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((reg) => reg.unregister());
        });
      }
    } catch {}
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#11131b',
          color: '#f4efe8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: 'rgba(224, 90, 71, 0.08)',
            border: '1px solid rgba(224, 90, 71, 0.4)',
            borderRadius: '16px',
            padding: '28px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🛡️</div>
            <h2 style={{ color: '#e05a47', margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700' }}>
              Suraksha Shadow Recovery
            </h2>
            <p style={{ fontSize: '13px', opacity: 0.85, margin: '0 0 16px 0', lineHeight: 1.5 }}>
              The application encountered a client runtime error. Tap below to refresh and clear cached data.
            </p>
            <pre style={{
              background: 'rgba(0,0,0,0.6)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              textAlign: 'left',
              overflowX: 'auto',
              color: '#f2a65a',
              marginBottom: '20px',
              maxHeight: '140px'
            }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={this.handleRecovery}
              style={{
                backgroundColor: '#e05a47',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                width: '100%'
              }}
            >
              Clear Cache & Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Automatically reload on service worker update
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/guardian/:token" element={<GuardianView />} />
        </Routes>
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
)