import { useState, useCallback } from "react";
import { useAuth } from "../App";

export function useJoinCodeVerification() {
  const { authAxios } = useAuth();
  const [propertyInfo, setPropertyInfo] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const verifyJoinCode = useCallback(async (code) => {
    if (!code || code.length < 6) {
      setPropertyInfo(null);
      return null;
    }
    setVerifying(true);
    try {
      const response = await authAxios.get(`/properties/by-code/${code}`);
      setPropertyInfo(response.data);
      return response.data;
    } catch (error) {
      setPropertyInfo(null);
      throw error;
    } finally {
      setVerifying(false);
    }
  }, [authAxios]);

  return { propertyInfo, verifying, verifyJoinCode, setPropertyInfo };
}