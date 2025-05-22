import React, { createContext, useContext, useState, useEffect } from 'react';
import { IAMService } from '../services/IAMService';

interface AuthContextType {
  isAuthenticated: boolean;
  userEmail: string | null;
  error: string | null;
  qrCodeData: string | null;
  isLoading: boolean;
  isVerifying: boolean;
  startAuthentication: () => Promise<void>;
  logout: () => void;
  registerUser: (email: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const iamService = new IAMService();
const APP_ID = '37e6d73a-95fa-4e14-b7f1-70eb91ecc41d';
const HUB_ID = '6bf8216f-a8ff-46ef-a43f-b9c1ab831505';
const PRIVATE_KEY = 'MCwCAQAwBQYDK2VwBCARpRrBls973Ax/Er0u5or678pQRyHCSKHj+QW0Q1IaKw==';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationInterval, setVerificationInterval] = useState<number | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const clearVerificationInterval = () => {
    if (verificationInterval) {
      window.clearInterval(verificationInterval);
      setVerificationInterval(null);
    }
  };

  useEffect(() => {
    return () => clearVerificationInterval();
  }, []);

  const startAuthentication = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setIsVerifying(true);
      
      const qrResponse = await iamService.generateAuthQRCode({
        appId: APP_ID,
        hubId: HUB_ID,
        signingPrivateKey: PRIVATE_KEY,
      });

      setQrCodeData(qrResponse.qrCodeBase64);
      setTransactionId(qrResponse.transactionId);
      setIsLoading(false);

      // Start polling for verification
      const intervalId = window.setInterval(async () => {
        try {
          const verificationResponse = await iamService.checkVerification({
            applicationId: APP_ID,
            transactionId: qrResponse.transactionId,
            timeoutInMs: 5000,
          });

          if (verificationResponse.verified && 
              verificationResponse.encryptedSessionToken && 
              verificationResponse.encryptionIv) {
            clearVerificationInterval();
            setIsVerifying(false);

            const sessionResponse = await iamService.verifySession({
              encryptedSessionToken: verificationResponse.encryptedSessionToken,
              encryptionIv: verificationResponse.encryptionIv,
              applicationId: APP_ID,
            });

            setUserEmail(sessionResponse.email);
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error('Verification check failed:', error);
        }
      }, 2000);

      setVerificationInterval(intervalId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
      setIsLoading(false);
      setIsVerifying(false);
      console.error('Authentication error:', error);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserEmail(null);
    setQrCodeData(null);
    setError(null);
    setTransactionId(null);
    setIsVerifying(false);
    clearVerificationInterval();
  };

  const registerUser = (email: string) => {
    setUserEmail(email);
    // In a real app, you would send this data to a backend
    // For demo purposes, we'll just set the user as authenticated
    setIsAuthenticated(true);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      userEmail,
      error,
      qrCodeData,
      isLoading,
      isVerifying,
      startAuthentication,
      logout,
      registerUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};