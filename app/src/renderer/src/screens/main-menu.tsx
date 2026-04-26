import { useAppState } from '../stores/app-state';

export function MainMenu(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  return (
    <div className="screen screen-center">
      <h1 className="menu-title">PAYROLL</h1>
      <div className="subtitle mono">A Private Military Sim</div>
      <div className="menu-actions">
        <button type="button" className="btn btn-primary" onClick={() => go('board')}>
          New contract
        </button>
        <button type="button" className="btn" onClick={() => go('armory')}>
          Armory
        </button>
      </div>
    </div>
  );
}
