import MapPanel from "./MapPanel.jsx";

export default function Workspace() {
  return (
    <main id="workspace" className="workspace">
      <aside id="leftSidebar" className="sidebar sidebar--left" />
      <MapPanel />
      <aside id="rightSidebar" className="sidebar sidebar--right" />
    </main>
  );
}
// DV 연결
