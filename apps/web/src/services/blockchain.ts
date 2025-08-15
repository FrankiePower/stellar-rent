import { apiUtils } from './api';

export interface BlockchainVerificationResult {
  isValid: boolean;
  blockchainData?: {
    id: string;
    data_hash: string;
    owner: string;
    status: 'Available' | 'Booked' | 'Maintenance' | 'Inactive';
  };
}

export interface PropertyBlockchainStatus {
  isVerified: boolean;
  blockchainHash?: string;
  lastVerified?: string;
  error?: string;
}

/**
 * Verify property data integrity with blockchain
 */
export async function verifyPropertyWithBlockchain(
  propertyId: string
): Promise<BlockchainVerificationResult> {
  try {
    const result = await apiUtils.request<{
      success: boolean;
      data: BlockchainVerificationResult;
      error?: string;
      message?: string;
    }>(`/properties/${propertyId}/verify`);

    if (result?.success && result.data) {
      return result.data;
    }

    throw new Error(result?.error || 'Verification failed');
  } catch (error) {
    console.error('Blockchain verification failed:', error);
    return {
      isValid: false,
      blockchainData: undefined,
    };
  }
}

/**
 * Get property blockchain status for UI display
 */
export async function getPropertyBlockchainStatus(
  propertyId: string
): Promise<PropertyBlockchainStatus> {
  try {
    const verificationResult = await verifyPropertyWithBlockchain(propertyId);

    return {
      isVerified: verificationResult.isValid,
      blockchainHash: verificationResult.blockchainData?.data_hash,
      lastVerified: new Date().toISOString(),
      error: verificationResult.isValid ? undefined : 'Data integrity check failed',
    };
  } catch (error) {
    return {
      isVerified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format blockchain status for display
 */
export function formatBlockchainStatus(status: PropertyBlockchainStatus): {
  text: string;
  color: 'green' | 'red' | 'yellow';
  icon: string;
} {
  if (status.error) {
    return {
      text: 'Verification Failed',
      color: 'red',
      icon: '❌',
    };
  }

  if (status.isVerified) {
    return {
      text: 'Verified on Blockchain',
      color: 'green',
      icon: '✅',
    };
  }

  return {
    text: 'Not Verified',
    color: 'yellow',
    icon: '⚠️',
  };
}

/**
 * Truncate blockchain hash for display
 */
export function truncateHash(hash: string, length = 8): string {
  if (hash.length <= length * 2) {
    return hash;
  }
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

/**
 * Copy hash to clipboard
 */
export async function copyHashToClipboard(hash: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(hash);
    return true;
  } catch (error) {
    console.error('Failed to copy hash to clipboard:', error);
    return false;
  }
}

/**
 * Generate blockchain explorer URL (placeholder for future implementation)
 */
type ExplorerResource = 'tx' | 'contract' | 'account' | 'asset';

export function getBlockchainExplorerUrl(
  resourceId: string,
  opts?: { resourceType?: ExplorerResource; network?: 'testnet' | 'public'; baseUrl?: string }
): string {
  const base = (
    opts?.baseUrl ||
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL ||
    'https://stellar.expert/explorer'
  )
    .toString()
    .replace(/\/+$/, '');
  const network = (opts?.network ||
    (process.env.NEXT_PUBLIC_STELLAR_NETWORK as 'testnet' | 'public') ||
    'testnet') as 'testnet' | 'public';
  const type: ExplorerResource = opts?.resourceType || 'tx';
  return `${base}/${network}/${type}/${resourceId}`;
}

/**
 * Check if blockchain features are enabled
 */
export function isBlockchainEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BLOCKCHAIN === 'true';
}

/**
 * Get blockchain network name
 */
export function getBlockchainNetwork(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
}
