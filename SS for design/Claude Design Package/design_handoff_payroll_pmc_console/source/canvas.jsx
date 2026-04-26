// chosen/canvas.jsx — canvas for the chosen NEON WIRE direction
// Round 1: Main Menu · Combat · Armory
// Round 2: Contract Board · Briefing · Debrief

const W = 1920;
const H = 1080;

function App() {
  return (
    <DesignCanvas>
      <DCSection id="r1" title="ROUND 1 · CORE SCREENS"
        subtitle="NEON WIRE · the picked direction — hex-clipped chrome, triple-accent cyan/amber/magenta.">
        <DCArtboard id="menu"   label="Main Menu · Ops Console"   width={W} height={H}><NeonwireMainMenu /></DCArtboard>
        <DCArtboard id="combat" label="Combat · Squad Selected (drill-in)" width={W} height={H}><NeonwireCombat /></DCArtboard>
        <DCArtboard id="armory" label="Armory · Operator Mechlab"  width={W} height={H}><NeonwireArmory /></DCArtboard>
      </DCSection>

      <DCSection id="r2" title="ROUND 2 · MISSION CYCLE"
        subtitle="Contract Board → Briefing → Debrief. The loop a player walks every mission.">
        <DCArtboard id="contracts" label="Contract Board · Accept Work" width={W} height={H}><NeonwireContracts /></DCArtboard>
        <DCArtboard id="briefing"  label="Briefing · Deployment Order"  width={W} height={H}><NeonwireBriefing /></DCArtboard>
        <DCArtboard id="debrief"   label="Debrief · After Action Report" width={W} height={H}><NeonwireDebrief /></DCArtboard>
      </DCSection>

      <DCSection id="r3" title="ROUND 3 · STRATEGIC LAYER"
        subtitle="Battalion-scope. Where a PMC lives between squad ops — roster, command, theater.">
        <DCArtboard id="orbat" label="Order of Battle · Roster Manager" width={W} height={H}><NeonwireOrbat /></DCArtboard>
        <DCArtboard id="command" label="Battalion Command · Live Combat (no selection)" width={W} height={H}><NeonwireCommand /></DCArtboard>
        <DCArtboard id="theater" label="Theater Map · Kantō Fringe" width={W} height={H}><NeonwireTheater /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
