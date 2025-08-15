'use client';

import { useEffect, useState } from 'react';
import { getUSDCBalance } from '~/lib/stellar';
import {
  checkFreighterConnection,
  checkFreighterPermission,
  connectFreighter,
  getFreighterAddress,
  getFreighterNetwork,
} from '../lib/freighter-utils';

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
  networkPassphrase: string | null;
  isInstalled: boolean;
  isAllowed: boolean;
  isLoading: boolean;
  error: string | null;
  usdcBalance: string | null;
}

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    network: null,
    networkPassphrase: null,
    isInstalled: false,
    isAllowed: false,
    isLoading: true,
    error: null,
    usdcBalance: null,
  });

  useEffect(() => {
    let mounted = true;

    const initializeWallet = async () => {
      try {
        const connectionStatus = await checkFreighterConnection();
        if (!mounted) return;

        if (!connectionStatus.isInstalled) {
          setWalletState((prev) => ({
            ...prev,
            isInstalled: false,
            isLoading: false,
            error: connectionStatus.error || 'Freighter not installed',
          }));
          return;
        }

        const permissionStatus = await checkFreighterPermission();
        if (!mounted) return;

        const isAllowed = permissionStatus.isAllowed;
        const isConnected = connectionStatus.isConnected && isAllowed;

        if (isConnected) {
          const [addressResult, networkResult] = await Promise.all([
            getFreighterAddress(),
            getFreighterNetwork(),
          ]);

          if (!mounted) return;
          const publicKey = addressResult.address || null;
          let usdcBalance = null;
          if (publicKey) {
            usdcBalance = await getUSDCBalance(publicKey);
          }
          setWalletState({
            isConnected: true,
            publicKey: addressResult.address || null,
            network: networkResult.network || null,
            networkPassphrase: networkResult.networkPassphrase || null,
            isInstalled: true,
            isAllowed: true,
            isLoading: false,
            error: null,
            usdcBalance: usdcBalance,
          });
        } else {
          setWalletState((prev) => ({
            ...prev,
            isConnected: false,
            isInstalled: true,
            isAllowed,
            isLoading: false,
            error: null,
            usdcBalance: null,
          }));
        }
      } catch (error) {
        console.error('Error initializing wallet:', error);
        if (mounted) {
          setWalletState((prev) => ({
            ...prev,
            isInstalled: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            usdcBalance: null,
          }));
        }
      }
    };

    initializeWallet();

    return () => {
      mounted = false;
    };
  }, []);

  // Smart public key getter that handles connection
  const getPublicKey = async (): Promise<string> => {
    try {
      // If already connected, return existing key
      if (walletState.isConnected && walletState.publicKey) {
        return walletState.publicKey;
      }

      // Otherwise, connect and get key
      const connectResult = await connectFreighter();
      if (connectResult.error) {
        throw new Error(connectResult.error);
      }

      if (!connectResult.address) {
        throw new Error('No address returned from Freighter');
      }

      // Update state
      const networkResult = await getFreighterNetwork();
      const usdcBalance = await getUSDCBalance(connectResult.address);

      setWalletState((prev) => ({
        ...prev,
        isConnected: true,
        publicKey: connectResult.address || null,
        network: networkResult.network || null,
        networkPassphrase: networkResult.networkPassphrase || null,
        isInstalled: true,
        isAllowed: true,
        error: null,
        usdcBalance: usdcBalance,
      }));

      return connectResult.address;
    } catch (error) {
      console.error('Error getting public key:', error);
      setWalletState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to get public key',
        usdcBalance: null,
      }));
      throw error;
    }
  };

  const connect = async () => {
    try {
      setWalletState((prev) => ({ ...prev, isLoading: true, error: null }));
      await getPublicKey(); // This handles connection
    } catch (error) {
      console.error('Error connecting to Freighter:', error);
      setWalletState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }));
      throw error;
    } finally {
      setWalletState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const disconnect = async () => {
    setWalletState((prev) => ({
      ...prev,
      isConnected: false,
      publicKey: null,
      network: null,
      networkPassphrase: null,
      usdcBalance: null,
    }));
  };

  const refreshConnection = async () => {
    setWalletState((prev) => ({ ...prev, isLoading: true }));
    try {
      const [connectionStatus, addressResult, networkResult] = await Promise.all([
        checkFreighterConnection(),
        getFreighterAddress(),
        getFreighterNetwork(),
      ]);
      const publicKey = addressResult.address || null;
      let usdcBalance = null;
      if (publicKey) {
        usdcBalance = await getUSDCBalance(publicKey);
      }
      setWalletState({
        isConnected: connectionStatus.isConnected && !!addressResult.address,
        publicKey: addressResult.address || null,
        network: networkResult.network || null,
        networkPassphrase: networkResult.networkPassphrase || null,
        isInstalled: connectionStatus.isInstalled,
        isAllowed: !!addressResult.address,
        isLoading: false,
        error: null,
        usdcBalance: usdcBalance,
      });
    } catch (error) {
      setWalletState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh connection',
        usdcBalance: null,
      }));
    }
  };

  return {
    ...walletState,
    connect,
    disconnect,
    refreshConnection,
    getPublicKey,
  };
}
