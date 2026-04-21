import { useEffect } from 'react';
import { getContent } from './content';
import { Armory } from './screens/armory';
import { Briefing } from './screens/briefing';
import { ContractBoard } from './screens/contract-board';
import { Debrief } from './screens/debrief';
import { Deploy } from './screens/deploy';
import { MainMenu } from './screens/main-menu';
import { getSimBridge } from './sim-bridge';
import { useAppState } from './stores/app-state';
import { useStockpile } from './stores/stockpile';

function useInitStockpile(): void {
  useEffect(() => {
    const bundle = getContent();
    const stockpile = useStockpile.getState();
    if (stockpile.quantities.size > 0) return;
    for (const w of bundle.weapons.values()) stockpile.add(w.id, 10);
    for (const a of bundle.armor.values()) stockpile.add(a.id, 10);
    for (const u of bundle.utility.values()) stockpile.add(u.id, 15);
  }, []);
}

function useBootPing(): void {
  useEffect(() => {
    getSimBridge()
      .ping(1)
      .then(() => undefined);
  }, []);
}

export default function App(): React.JSX.Element {
  useInitStockpile();
  useBootPing();
  const screen = useAppState((s) => s.screen);

  return (
    <div className="app-shell">
      <header>
        <h1>merc-autobattler</h1>
        <span className="subtitle">MVP vertical slice</span>
      </header>
      <main>
        {screen === 'menu' && <MainMenu />}
        {screen === 'board' && <ContractBoard />}
        {screen === 'armory' && <Armory />}
        {screen === 'briefing' && <Briefing />}
        {screen === 'deploy' && <Deploy />}
        {screen === 'debrief' && <Debrief />}
      </main>
    </div>
  );
}
