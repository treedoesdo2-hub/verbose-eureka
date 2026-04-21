import { useEffect, useState } from 'react';
import { getSimBridge } from './sim-bridge';

export default function App(): React.JSX.Element {
  const [pongNonce, setPongNonce] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('idle');

  useEffect(() => {
    const bridge = getSimBridge();
    setStatus('pinging worker…');
    bridge.ping(1).then((nonce) => {
      setPongNonce(nonce);
      setStatus('worker online');
    });
  }, []);

  return (
    <div className="app-shell">
      <header>
        <h1>merc-autobattler</h1>
        <span className="subtitle">MVP vertical slice — scaffold</span>
      </header>
      <main>
        <section>
          <h2>Sim worker</h2>
          <dl>
            <dt>status</dt>
            <dd>{status}</dd>
            <dt>last pong nonce</dt>
            <dd>{pongNonce ?? '—'}</dd>
          </dl>
        </section>
      </main>
    </div>
  );
}
