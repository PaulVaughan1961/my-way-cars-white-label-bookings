"use client";

import { useId, useState } from "react";

export default function BookingRequestFinished() {
  const [showInstructions, setShowInstructions] = useState(false);
  const instructionsId = useId();

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setShowInstructions(true)}
        aria-expanded={showInstructions}
        aria-controls={instructionsId}
        className="w-full rounded-xl border border-gray-300 bg-white py-3 font-semibold text-gray-900"
      >
        Finished
      </button>
      <div id={instructionsId} role="status" aria-live="polite">
        {showInstructions && (
          <p className="mt-3 rounded-xl bg-gray-50 p-4 text-base text-gray-700">
            Your booking request has been sent. Swipe up from the bottom of your
            screen, or press your phone’s Home button, to return home.
          </p>
        )}
      </div>
    </div>
  );
}
