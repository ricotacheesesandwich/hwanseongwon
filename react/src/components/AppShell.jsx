import Topbar from './Topbar.jsx';
import Workspace from './Workspace.jsx';

export default function AppShell() {
  return (
    <div id="appView" className="app-shell is-hidden">
      <Topbar />
      <Workspace />
      <section id="adminOperationsView" className="operations-page is-hidden" aria-labelledby="operationsPageTitle">
        <div id="adminOperationsContent" />
      </section>
    </div>
  );
}
