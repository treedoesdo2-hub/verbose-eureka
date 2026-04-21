import { useEffect } from 'react';
import { getContent } from './content';
import { useHotkeys } from './hooks/useHotkeys';
import { Armory } from './screens/armory';
import { Briefing } from './screens/briefing';
import { ContractBoard } from './screens/contract-board';
import { Debrief } from './screens/debrief';
import { Deploy } from './screens/deploy';
import { MainMenu } from './screens/main-menu';
import { getSimBridge } from './sim-bridge';
import { useAppState } from './stores/app-state';
import { useStockpile } from './stores/stockpile';
import { useUiPrefs } from './stores/ui-prefs';

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
  const theme = useUiPrefs((s) => s.theme);
  const density = useUiPrefs((s) => s.density);
  const toggleTheme = useUiPrefs((s) => s.toggleTheme);
  const setDensity = useUiPrefs((s) => s.setDensity);

  // Apply theme + density to the html element so CSS selectors can target
  // [data-theme] / [data-density] variables instead of threading props.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
  }, [theme, density]);

  useHotkeys([{ key: 't', shift: true, handler: () => toggleTheme() }]);

  return (
    <div className="app-shell">
      <header>
        <h1>merc-autobattler</h1>
        <span className="subtitle">MVP vertical slice</span>
        <div className="shell-prefs" role="group" aria-label="UI preferences">
          <select
            className="pref-select mono"
            value={density}
            onChange={(e) => setDensity(e.target.value as 'compact' | 'normal' | 'spacious')}
            title="Density"
          >
            <option value="compact">compact</option>
            <option value="normal">normal</option>
            <option value="spacious">spacious</option>
          </select>
          <button
            type="button"
            className="btn btn-small"
            onClick={toggleTheme}
            title="Toggle theme (Shift+T)"
          >
            {theme === 'dark' ? '☾ dark' : '☼ light'}
          </button>
        </div>
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
