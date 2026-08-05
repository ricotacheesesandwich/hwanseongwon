export default function ModalRoot() {
  return (
    <div id="modalBackdrop" className="modal-backdrop is-hidden" aria-hidden="true">
      <section id="modal" className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <header className="modal__header">
          <div>
            <p id="modalEyebrow" className="eyebrow" />
            <h2 id="modalTitle" />
          </div>
          <button id="modalCloseButton" type="button" className="icon-button" aria-label="창 닫기">×</button>
        </header>
        <div id="modalBody" className="modal__body" />
        <footer id="modalFooter" className="modal__footer" />
      </section>
    </div>
  );
}
