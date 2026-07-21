import { useState, useRef } from "react";

export function useFloorCountConfirm(onConfirmedSubmit) {
  const [showConfirm, setShowConfirm] = useState(false);
  const pendingSubmitRef = useRef(false);

  const requestSubmit = (floorCount) => {
    if (floorCount === 0) {
      setShowConfirm(true);
      return;
    }
    onConfirmedSubmit();
  };

  const cancel = () => setShowConfirm(false);

  const confirm = () => {
    setShowConfirm(false);
    onConfirmedSubmit();
  };

  return { showConfirm, requestSubmit, cancel, confirm };
}
