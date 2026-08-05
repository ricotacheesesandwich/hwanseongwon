export default function MapPanel() {
  return (
    <section className="map-panel" aria-labelledby="mapTitle">
      <div className="map-panel__toolbar">
        <div>
          <p className="eyebrow">INTERACTIVE FLOOR MAP</p>
          <h2 id="mapTitle">융합학술동 <span id="currentFloorLabel">1F</span></h2>
        </div>

        <div id="floorTabs" className="floor-tabs" aria-label="층 선택" />

        <div className="map-toolbar-actions">
          <button id="investigateButton" type="button" className="button button--soft">현재 위치 조사</button>
        </div>
      </div>

      <div id="warmthBanner" className="warmth-banner is-hidden" role="status" />

      <div className="map-viewport">
        <div id="mapGrid" className="map-grid" role="grid" aria-label="공간 단위 지도" />
        <div id="mapToast" className="map-toast is-hidden" role="status" />
      </div>

      <div className="map-panel__footer">
        <article id="selectedCharacterSummary" className="selected-summary" />
        <div className="map-legend" aria-label="지도 범례">
          <span><i className="legend-box legend-box--visible" />현재 위치한 공간</span>
          <span><i className="legend-dot legend-dot--blue" />같은 공간 · 표시 그룹</span>
          <span><i className="legend-box legend-box--danger" />위험구역</span>
        </div>
        <p id="movementRule" className="movement-rule">빙혼자 · 공간 변경 1회 = 행동력 1</p>
      </div>
    </section>
  );
}
