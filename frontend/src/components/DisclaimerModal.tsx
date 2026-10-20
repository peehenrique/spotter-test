import { useEffect, useState } from "react";

const STORAGE_KEY = "spotter-test-disclaimer-en";

export function DisclaimerModal() {
  const [open, setOpen] = useState(() => !alreadyAccepted());

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") accept();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private mode can block storage; closing still works for this visit.
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
        <p className="modal-kicker">Notice</p>
        <h2 id="disclaimer-title">This is not an official Spotter system</h2>
        <p>
          This is a test project for a full stack developer role. The brand is used only as a visual reference.
        </p>
        <p className="modal-credit">Developed by Pedro H T Branco</p>
        <button type="button" className="primary modal-accept" autoFocus onClick={accept}>
          Got it
        </button>
      </div>
    </div>
  );
}

function alreadyAccepted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
