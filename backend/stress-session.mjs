const BASE = 'https://ml-manager-pro-jade.vercel.app/api';

async function cycle(n) {
  const login = await fetch(`${BASE}/users/google-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jcancelo.dev@gmail.com', name: 'J', avatar: '', googleId: `loop${n}-${Date.now()}` }),
  });
  const { token } = await login.json();

  // Varias validaciones seguidas, como harían varios componentes a la vez.
  const results = await Promise.all([
    fetch(`${BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE}/stats/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  return results.map((r) => r.status);
}

(async () => {
  let fails = 0, total = 0;
  for (let i = 0; i < 12; i++) {
    const codes = await cycle(i);
    total += codes.length;
    const bad = codes.filter((c) => c !== 200);
    if (bad.length) {
      fails += bad.length;
      console.log(`  ciclo ${i}: ${codes.join(',')}  <-- FALLA`);
    }
  }
  console.log(`\n  ${total - fails}/${total} pedidos OK, ${fails} con 401`);
  console.log(fails === 0
    ? '  Sin inconsistencias: la sesion es consistente entre instancias.'
    : '  INCONSISTENTE: hay sesiones que no sobreviven entre instancias.');
})();