import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';

export interface NFTData {
  mint: string;
  name: string;
  symbol?: string;
  uri?: string;
  image?: string;
  description?: string;
  collection?: string;
  verified?: boolean;
}

export interface TokenAccountInfo {
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

/**
 * NFT Service for CARV SVM Network
 * Enhanced metadata fetching with CARV SVM specific handling
 */
export class NFTService {
  public connection: Connection;
  private readonly metadataCache = new Map<string, NFTData>();

  constructor() {
    this.connection = new Connection("https://rpc.testnet.carv.io/rpc", "confirmed");
  }

  /**
   * Get wallet SOL balance
   */
  async getWalletBalance(ownerAddress: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(ownerAddress);
      return balance / 1e9;
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return 0;
    }
  }

  /**
   * Fetch metadata from Solana Explorer API
   */
  private async fetchMetadataFromExplorer(mintAddress: string): Promise<Partial<NFTData> | null> {
    // Skip explorer fetch in browser environment to avoid CORS issues
    if (typeof window !== 'undefined') {
      console.log('⏭️ Skipping explorer fetch in browser environment to avoid CORS');
      return null;
    }

    try {
      console.log(`🔍 Fetching metadata from Solana Explorer for: ${mintAddress}`);
      
      // Construct the explorer API URL
      const explorerUrl = `https://explorer.solana.com/address/${mintAddress}/metadata?cluster=custom&customUrl=${encodeURIComponent('https://rpc.testnet.carv.io/rpc')}`;
      
      console.log('📡 Fetching from explorer:', explorerUrl);
      const response = await fetch(explorerUrl);
      
      if (!response.ok) {
        throw new Error(`Explorer API returned ${response.status}: ${response.statusText}`);
      }
      
      const htmlContent = await response.text();
      console.log('📄 Received explorer response, parsing...');
      
      // Parse the HTML to extract metadata
      const metadata = this.parseExplorerMetadata(htmlContent, mintAddress);
      
      if (metadata && metadata.name) {
        console.log('✅ Successfully parsed explorer metadata:', metadata);
        return metadata;
      } else {
        console.log('⚠️ No valid metadata found in explorer response');
        return null;
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to fetch metadata from Solana Explorer:', error);
      return null;
    }
  }

  /**
   * Parse metadata from Solana Explorer HTML response
   */
  private parseExplorerMetadata(htmlContent: string, mintAddress: string): Partial<NFTData> | null {
    try {
      // Look for common metadata patterns in the HTML
      const nameMatch = htmlContent.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                       htmlContent.match(/<title>([^<]+)<\/title>/i) ||
                       htmlContent.match(/"name"\s*:\s*"([^"]+)"/i);
      
      const symbolMatch = htmlContent.match(/"symbol"\s*:\s*"([^"]+)"/i) ||
                         htmlContent.match(/<span[^>]*>Symbol:\s*([^<]+)<\/span>/i);
      
      const descriptionMatch = htmlContent.match(/<p[^>]*>([^<]+)<\/p>/i) ||
                              htmlContent.match(/"description"\s*:\s*"([^"]+)"/i);
      
      const imageMatch = htmlContent.match(/<img[^>]+src="([^"]+)"/i) ||
                        htmlContent.match(/"image"\s*:\s*"([^"]+)"/i) ||
                        htmlContent.match(/<meta[^>]+content="([^"]+\.(jpg|jpeg|png|gif|webp))"/i);

      const name = nameMatch?.[1]?.trim();
      const symbol = symbolMatch?.[1]?.trim();
      const description = descriptionMatch?.[1]?.trim();
      const image = imageMatch?.[1]?.trim();

      // Only return if we found at least a name
      if (name) {
        return {
          name: name,
          symbol: symbol || 'NFT',
          description: description || 'NFT from CARV SVM',
          image: image || this.getEnhancedImageUrl(mintAddress),
          collection: 'CARV Collection'
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Error parsing explorer metadata:', error);
      return null;
    }
  }

  /**
   * Generate fallback name based on mint address
   */
  private generateFallbackName(mintAddress: string): string {
    const addressHash = mintAddress.slice(-8);
    const nameOptions = [
      `CARV NFT #${addressHash}`,
      `SVM Token ${addressHash}`,
      `CARV Collectible ${addressHash}`,
      `Digital Asset ${addressHash}`,
      `CARV Item ${addressHash}`
    ];
    
    const hashValue = parseInt(mintAddress.slice(-2), 16);
    return nameOptions[hashValue % nameOptions.length];
  }

  /**
   * Get enhanced image URL with better fallbacks for CARV SVM
   */
  private getEnhancedImageUrl(mintAddress: string, originalImage?: string): string {
    // If there's a valid image URL, use it
    if (originalImage && this.isValidImageUrl(originalImage)) {
      return originalImage;
    }
    
    // Generate an enhanced SVG placeholder with error handling
    try {
      return this.generateCARVSVMImage(mintAddress);
    } catch (error) {
      console.warn('Error generating CARV SVM image:', error);
      // Return a simple fallback SVG
      return 'data:image/svg+xml;base64,' + btoa(`
        <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="400" fill="#8B5CF6"/>
          <text x="200" y="200" text-anchor="middle" fill="white" font-family="Arial" font-size="16">NFT Image</text>
        </svg>
      `);
    }
  }

  /**
   * Generate enhanced CARV SVM themed image
   */
  private generateCARVSVMImage(mintAddress: string): string {
    const shortAddress = mintAddress.slice(0, 8);
    const addressHash = mintAddress.slice(-8);
    
    // Create more varied and interesting colors
    const colorSets = [
      ['8B5CF6', 'F59E0B', '10B981'], // Purple, Amber, Green
      ['EF4444', '3B82F6', 'F97316'], // Red, Blue, Orange
      ['EC4899', '06B6D4', '84CC16'], // Pink, Cyan, Lime
      ['F97316', '8B5CF6', '10B981'], // Orange, Purple, Green
      ['EF4444', 'F59E0B', '3B82F6']  // Red, Amber, Blue
    ];
    
    const colorIndex = parseInt(mintAddress.slice(-4), 16) % colorSets.length;
    const colors = colorSets[colorIndex] || colorSets[0]; // Fallback to first color set
    
    const svg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#${colors[0]};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#${colors[1]};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="grad2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#${colors[2]};stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:#${colors[0]};stop-opacity:0.3" />
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#grad1)"/>
        <circle cx="100" cy="100" r="80" fill="url(#grad2)" opacity="0.6"/>
        <circle cx="300" cy="300" r="60" fill="url(#grad2)" opacity="0.4"/>
        <rect x="50" y="50" width="300" height="300" fill="none" stroke="white" stroke-width="2" opacity="0.3"/>
        <text x="200" y="140" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">CARV SVM</text>
        <text x="200" y="170" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">${this.generateFallbackName(mintAddress)}</text>
        <text x="200" y="200" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" opacity="0.8">${addressHash}</text>
        <text x="200" y="230" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" opacity="0.6">Digital Asset</text>
        <circle cx="200" cy="260" r="20" fill="white" opacity="0.2"/>
        <text x="200" y="265" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8">NFT</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Check if image URL is valid
   */
  private isValidImageUrl(url: string): boolean {
    if (!url) return false;
    
    const invalidPatterns = ['error', 'undefined', 'null', 'invalid'];
    const validPatterns = ['ipfs://', 'ar://', 'https://', 'http://'];
    
    if (invalidPatterns.some(pattern => url.toLowerCase().includes(pattern))) {
      return false;
    }
    
    if (validPatterns.some(pattern => url.toLowerCase().includes(pattern))) {
      return true;
    }
    
    return url.length > 5;
  }

  /**
   * Fetch all NFTs owned by a wallet (including unverified)
   */
  async getAllUserNFTs(ownerAddress: PublicKey): Promise<NFTData[]> {
    return this.getUserNFTs(ownerAddress, true);
  }

  /**
   * Get enhanced NFT metadata with CARV SVM specific handling
   */
  async getNFTMetadata(mintAddress: string): Promise<Partial<NFTData> | null> {
    // Check cache first
    const cacheKey = mintAddress;
    if (this.metadataCache.has(cacheKey)) {
      const cached = this.metadataCache.get(cacheKey)!;
      return {
        name: cached.name,
        symbol: cached.symbol,
        uri: cached.uri,
        image: cached.image,
        description: cached.description,
        collection: cached.collection
      };
    }

    try {
      console.log(`🔍 Fetching metadata for mint: ${mintAddress}`);
      
      if (!this.isValidPublicKey(mintAddress)) {
        const fallback = {
          name: `NFT ${mintAddress.slice(0, 8)}...`,
          symbol: 'NFT',
          description: 'Invalid mint address'
        };
        this.metadataCache.set(cacheKey, {
          mint: mintAddress,
          ...fallback,
          image: this.getEnhancedImageUrl(mintAddress),
          verified: false
        });
        return fallback;
      }

      // Skip Solana Explorer in browser to avoid CORS
      if (typeof window === 'undefined') {
        const explorerMetadata = await this.fetchMetadataFromExplorer(mintAddress);
        if (explorerMetadata) {
          console.log('✅ Explorer metadata found:', explorerMetadata);
          this.metadataCache.set(cacheKey, {
            mint: mintAddress,
            ...explorerMetadata,
            image: explorerMetadata.image || this.getEnhancedImageUrl(mintAddress),
            verified: false
          } as NFTData);
          return explorerMetadata;
        }
      }

      const mintPublicKey = new PublicKey(mintAddress);
      const mintAccount = await this.connection.getAccountInfo(mintPublicKey);
      
      if (!mintAccount) {
        const fallback = {
          name: `NFT ${mintAddress.slice(0, 8)}...`,
          symbol: 'NFT',
          description: 'Mint account not found'
        };
        this.metadataCache.set(cacheKey, {
          mint: mintAddress,
          ...fallback,
          image: this.getEnhancedImageUrl(mintAddress),
          verified: false
        });
        return fallback;
      }

      // Try CARV SVM specific metadata extraction as fallback
      const carvMetadata = await this.extractCARVSVMMetadata(mintAddress, mintAccount);
      if (carvMetadata) {
        console.log('✅ CARV SVM metadata found:', carvMetadata);
        const result = {
          ...carvMetadata,
          image: carvMetadata.image || this.getEnhancedImageUrl(mintAddress)
        };
        this.metadataCache.set(cacheKey, {
          mint: mintAddress,
          ...result,
          verified: false
        } as NFTData);
        return result;
      }

      // Return enhanced fallback
      const fallback = {
        name: this.generateFallbackName(mintAddress),
        symbol: 'CARV',
        description: 'CARV SVM Digital Asset',
        collection: 'CARV Collection'
      };
      
      this.metadataCache.set(cacheKey, {
        mint: mintAddress,
        ...fallback,
        image: this.getEnhancedImageUrl(mintAddress),
        verified: false
      });
      
      return fallback;
    } catch (error) {
      console.warn('Error in getNFTMetadata for', mintAddress, ':', error);
      const fallback = {
        name: this.generateFallbackName(mintAddress),
        symbol: 'NFT',
        description: 'Error loading metadata'
      };
      
      this.metadataCache.set(cacheKey, {
        mint: mintAddress,
        ...fallback,
        image: this.getEnhancedImageUrl(mintAddress),
        verified: false
      });
      
      return fallback;
    }
  }

  /**
   * Extract metadata specifically for CARV SVM
   */
  private async extractCARVSVMMetadata(mintAddress: string, mintAccount: any): Promise<Partial<NFTData> | null> {
    try {
      console.log('🔍 Attempting CARV SVM metadata extraction...');
      
      const mintData = mintAccount.data;
      if (!mintData || mintData.length === 0) {
        return null;
      }

      // Try to find readable strings in the mint data
      try {
        const textDecoder = new TextDecoder('utf8', { fatal: false });
        const dataString = textDecoder.decode(mintData);
        
        // Extract potential names and symbols
        const potentialNames = [];
        const potentialSymbols = [];
        
        // Look for meaningful text patterns
        const textMatches = dataString.match(/[a-zA-Z0-9\s\-_]{3,30}/g);
        
        if (textMatches) {
          for (const match of textMatches) {
            const cleanMatch = match.trim();
            if (cleanMatch.length >= 3 && cleanMatch.length <= 20) {
              if (cleanMatch.length <= 10) {
                potentialSymbols.push(cleanMatch);
              } else {
                potentialNames.push(cleanMatch);
              }
            }
          }
        }

        if (potentialNames.length > 0 || potentialSymbols.length > 0) {
          console.log('✅ Found potential CARV SVM metadata:', {
            names: potentialNames.slice(0, 3),
            symbols: potentialSymbols.slice(0, 3)
          });
          
          return {
            name: (potentialNames.length > 0 && potentialNames[0].trim()) ? potentialNames[0] : this.generateFallbackName(mintAddress),
            symbol: (potentialSymbols.length > 0 && potentialSymbols[0].trim()) ? potentialSymbols[0] : 'CARV',
            description: 'CARV SVM Metadata'
          };
        }
      } catch (textError) {
        console.warn('Text extraction failed:', textError);
      }

      return null;
    } catch (error) {
      console.warn('Error in extractCARVSVMMetadata:', error);
      return null;
    }
  }

  /**
   * Check if string is a valid Solana public key
   */
  private isValidPublicKey(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    if (address.length !== 44) return false;
    
    try {
      // More permissive base58 validation
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
      const onlyValidChars = base58Regex.test(address);
      
      // Additional check to ensure it's not all the same character
      const uniqueChars = new Set(address.split('')).size;
      
      if (!onlyValidChars || uniqueChars <= 1) {
        return false;
      }
      
      // Try to create a PublicKey to verify it's valid
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the metadata address for a mint with improved error handling
   */
  private async getMetadataAddress(mint: PublicKey): Promise<PublicKey> {
    // Valid Solana metadata program IDs
    const metadataProgramIds = [
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8btJMxPzVi', // Metaplex Token Metadata
      'mSoLzYCxSopKhhBmkYxDScN2U3iYj4qP2T4N8M3oL4c', // Token Program (sometimes used as metadata)
    ];
    
    for (const programIdStr of metadataProgramIds) {
      try {
        console.log(`Trying metadata program: ${programIdStr}`);
        
        // Skip validation for known good program IDs
        const METADATA_PROGRAM_ID = new PublicKey(programIdStr);
        console.log(`Created PublicKey successfully for: ${programIdStr}`);
        
        const [metadataAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
          METADATA_PROGRAM_ID
        );
        
        console.log(`Generated metadata address: ${metadataAddress.toString()}`);
        return metadataAddress;
      } catch (error) {
        console.warn(`Failed with program ${programIdStr}:`, error);
        continue;
      }
    }
    
    // Simplified fallback that doesn't rely on finding metadata program
    try {
      console.log('Using simplified metadata address generation');
      // Generate a deterministic but simple address
      const seeds = [
        Buffer.from('metadata'),
        mint.toBuffer(),
        Buffer.from([1]) // version/salt
      ];
      const fallbackAddress = PublicKey.findProgramAddressSync(seeds, new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8btJMxPzVi'))[0];
      return fallbackAddress;
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      // Last resort: return a generated address based on mint
      return new PublicKey(Buffer.concat([Buffer.from('metadata'), mint.toBuffer()]).subarray(0, 44) as any);
    }
  }

  /**
   * Parse metadata account data with better error handling
   */
  private parseMetadataAccount(data: Buffer): any {
    try {
      let offset = 9;
      
      const nameLength = data[offset++];
      const name = data.slice(offset, offset + nameLength).toString('utf8');
      offset += nameLength;
      
      const symbolLength = data[offset++];
      const symbol = data.slice(offset, offset + symbolLength).toString('utf8');
      offset += symbolLength;
      
      const uriLength = data[offset++];
      const uri = data.slice(offset, offset + uriLength).toString('utf8');
      
      return { name, symbol, uri };
    } catch (error) {
      console.warn('Error parsing metadata account:', error);
      return { name: '', symbol: '', uri: '' };
    }
  }

  /**
   * Fetch metadata from URI with error handling
   */
  private async fetchMetadataFromURI(uri: string): Promise<any> {
    try {
      let fetchUrl = uri;
      
      if (uri.includes('ar://')) {
        const arweaveHash = uri.replace('ar://', '');
        fetchUrl = `https://arweave.net/${arweaveHash}`;
      } else if (uri.includes('ipfs://')) {
        const ipfsHash = uri.replace('ipfs://', '');
        fetchUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      }
      
      console.log('📡 Fetching metadata from:', fetchUrl);
      const response = await fetch(fetchUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const metadata = await response.json();
      console.log('✅ Metadata fetched successfully');
      return metadata;
    } catch (error) {
      console.warn('⚠️ Failed to fetch metadata from URI:', error);
      return {};
    }
  }

  /**
   * Fetch all NFTs owned by a wallet with enhanced CARV SVM support
   */
  async getUserNFTs(ownerAddress: PublicKey, includeUnverified = false): Promise<NFTData[]> {
    try {
      console.log('🔍 Fetching NFTs for:', ownerAddress.toString(), includeUnverified ? '(including unverified)' : '');

      const accounts = await this.connection.getTokenAccountsByOwner(ownerAddress, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      });

      console.log(`📊 Found ${accounts.value.length} token accounts`);

      const nfts: NFTData[] = [];
      const processedMints = new Set<string>();

      for (const account of accounts.value) {
        try {
          const accountData = account.account.data;
          
          if (accountData.length < 80) {
            continue;
          }

          const tokenInfo = this.parseTokenAccount(accountData);
          if (!tokenInfo) {
            console.warn('Could not parse token account data');
            continue;
          }

          const mintAddress = tokenInfo.mint;
          
          if (processedMints.has(mintAddress)) {
            continue;
          }
          
          if (!this.isValidPublicKey(mintAddress)) {
            console.warn('Skipping token account with invalid mint address:', mintAddress);
            continue;
          }
          
          processedMints.add(mintAddress);

          // NFT detection criteria
          if (tokenInfo.uiAmount === 1 && tokenInfo.decimals === 0) {
            if (this.isCommonToken(mintAddress)) {
              continue;
            }

            let isVerifiedNFT = false;
            try {
              isVerifiedNFT = await this.verifyNFT(mintAddress);
            } catch (error) {
              console.warn('Error verifying NFT for mint', mintAddress, ':', error);
            }

            if (!isVerifiedNFT && !includeUnverified) {
              continue;
            }

            // Get enhanced NFT metadata with CARV SVM support
            let nftData: Partial<NFTData> | null = null;
            try {
              nftData = await this.getNFTMetadata(mintAddress);
            } catch (error) {
              console.warn('Failed to get metadata for mint', mintAddress, ':', error);
              // Provide minimal fallback data
              nftData = {
                name: this.generateFallbackName(mintAddress),
                symbol: 'NFT',
                description: 'CARV SVM NFT'
              };
            }
            
            // Ensure we have valid data before creating NFT object
            const nft: NFTData = {
              mint: mintAddress,
              name: (nftData?.name && nftData.name.trim()) || this.generateFallbackName(mintAddress),
              symbol: (nftData?.symbol && nftData.symbol.trim()) || 'NFT',
              uri: nftData?.uri,
              image: this.getEnhancedImageUrl(mintAddress, nftData?.image),
              description: (nftData?.description && nftData.description.trim()) || 'CARV SVM NFT',
              collection: (nftData?.collection && nftData.collection.trim()) || 'CARV Collection',
              verified: isVerifiedNFT
            };

            nfts.push(nft);
          }
        } catch (error) {
          console.warn('Error processing token account:', error);
        }
      }

      console.log(`✅ Found ${nfts.length} ${includeUnverified ? 'total' : 'verified'} NFTs`);
      return nfts;
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      return [];
    }
  }

  /**
   * Parse token account data with improved error handling
   */
  private parseTokenAccount(data: Buffer): TokenAccountInfo | null {
    try {
      if (data.length < 80) {
        return null;
      }

      let mint: string;
      try {
        const mintBytes = data.slice(0, 32);
        const allZeros = mintBytes.every(byte => byte === 0);
        if (allZeros) {
          return null;
        }
        
        const mintKey = new PublicKey(mintBytes);
        mint = mintKey.toString();
        
        if (!this.isValidPublicKey(mint)) {
          return null;
        }
      } catch (error) {
        return null;
      }

      let owner: string;
      try {
        const ownerBytes = data.slice(32, 64);
        const allZeros = ownerBytes.every(byte => byte === 0);
        if (allZeros) {
          return null;
        }
        
        const ownerKey = new PublicKey(ownerBytes);
        owner = ownerKey.toString();
        
        if (!this.isValidPublicKey(owner)) {
          return null;
        }
      } catch (error) {
        return null;
      }

      let amount: bigint;
      try {
        const amountBytes = data.slice(64, 72);
        amount = new DataView(amountBytes.buffer, amountBytes.byteOffset, 8).getBigInt64(0, true);
      } catch (error) {
        return null;
      }

      const decimals = data[72];

      return {
        mint,
        owner,
        amount: amount.toString(),
        decimals,
        uiAmount: Number(amount) / Math.pow(10, decimals)
      };
    } catch (error) {
      console.warn('Error parsing token account:', error);
      return null;
    }
  }

  /**
   * Verify if a token is an NFT with improved error handling
   */
  private async verifyNFT(mintAddress: string): Promise<boolean> {
    try {
      if (!this.isValidPublicKey(mintAddress)) {
        return false;
      }

      const mintPublicKey = new PublicKey(mintAddress);
      
      // Use a simpler verification that doesn't require metadata programs
      try {
        const metadataAddress = await this.getMetadataAddress(mintPublicKey);
        const metadataAccount = await this.connection.getAccountInfo(metadataAddress);
        return metadataAccount !== null;
      } catch (metadataError) {
        // Fallback verification: check if it's a valid token account
        try {
          // Use getTokenAccountsByOwner to find token accounts that hold this mint
          const programId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
          const tokenAccounts = await this.connection.getTokenAccountsByOwner(
            mintPublicKey,
            { mint: mintPublicKey, programId }
          );
          return tokenAccounts.value.length > 0;
        } catch (tokenError) {
          console.warn('Token verification failed for mint', mintAddress, ':', tokenError);
          return false;
        }
      }
    } catch (error) {
      console.warn('Error verifying NFT for mint', mintAddress, ':', error);
      return false;
    }
  }

  /**
   * Check if a token is a common token
   */
  private isCommonToken(mintAddress: string): boolean {
    const commonTokens = [
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    ];
    
    return commonTokens.includes(mintAddress);
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Transfer an NFT
   */
  async transferNFT(
    mintAddress: string,
    fromOwner: PublicKey,
    toOwner: PublicKey,
    walletProvider: any
  ): Promise<string> {
    try {
      console.log('🚀 Starting NFT transfer:', {
        mint: mintAddress,
        from: fromOwner.toString(),
        to: toOwner.toString()
      });

      const balance = await this.getWalletBalance(fromOwner);
      console.log(`💰 Wallet balance: ${balance} SOL`);
      
      if (balance < 0.01) {
        throw new Error(`Insufficient balance. Need at least 0.01 SOL, have ${balance.toFixed(4)} SOL.`);
      }

      const mint = new PublicKey(mintAddress);
      const recipient = toOwner;
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      
      const findATA = async (walletAddr: PublicKey, tokenMint: PublicKey): Promise<PublicKey> => {
        const [address] = await PublicKey.findProgramAddress(
          [walletAddr.toBytes(), TOKEN_PROGRAM_ID.toBytes(), tokenMint.toBytes()],
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        return address;
      };
      
      const senderATA = await findATA(fromOwner, mint);
      const recipientATA = await findATA(recipient, mint);
      
      console.log('📍 ATAs:', {
        sender: senderATA.toString(),
        recipient: recipientATA.toString()
      });
      
      const senderTokenAccount = await this.connection.getTokenAccountsByOwner(fromOwner, { mint: mint });
      
      if (senderTokenAccount.value.length === 0) {
        throw new Error(`You don't own any tokens from mint ${mintAddress}.`);
      }
      
      const tokenAccountInfo = senderTokenAccount.value[0];
      const accountData = tokenAccountInfo.account.data;
      const amount = new DataView(accountData.buffer, accountData.byteOffset + 64, 8).getBigInt64(0, true);
      const decimals = accountData[72];
      const uiAmount = Number(amount) / Math.pow(10, decimals);
      
      console.log('💰 Sender token balance:', uiAmount, 'tokens');
      
      if (uiAmount < 1) {
        throw new Error(`You don't have enough tokens to transfer. Balance: ${uiAmount}, need: 1`);
      }
      
      const recipientATAInfo = await this.connection.getAccountInfo(recipientATA);
      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      const transaction = new Transaction();
      
      if (!recipientATAInfo) {
        console.log('📝 Creating recipient ATA...');
        const createATAIx = new TransactionInstruction({
          keys: [
            { pubkey: fromOwner, isSigner: true, isWritable: true },
            { pubkey: recipientATA, isSigner: false, isWritable: true },
            { pubkey: recipient, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          ],
          programId: ASSOCIATED_TOKEN_PROGRAM_ID,
          data: Buffer.alloc(0)
        });
        transaction.add(createATAIx);
      }
      
      const transferData = Buffer.alloc(9);
      transferData[0] = 3;
      
      const amountBuffer = new ArrayBuffer(8);
      const amountView = new DataView(amountBuffer);
      amountView.setBigUint64(0, BigInt(1), true);
      transferData.set(new Uint8Array(amountBuffer), 1);
      
      const transferIx = new TransactionInstruction({
        keys: [
          { pubkey: senderTokenAccount.value[0].pubkey, isSigner: false, isWritable: true },
          { pubkey: recipientATA, isSigner: false, isWritable: true },
          { pubkey: fromOwner, isSigner: true, isWritable: false },
        ],
        programId: TOKEN_PROGRAM_ID,
        data: transferData
      });
      transaction.add(transferIx);
      
      transaction.feePayer = fromOwner;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      console.log('🚀 Requesting signature from wallet...');
      const signed = await walletProvider.signTransaction(transaction);

      console.log('🚀 Sending transaction...');
      const signature = await this.connection.sendRawTransaction(signed.serialize());
      
      console.log('🔍 Confirming transaction...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ NFT transfer confirmed:', signature);
      return signature;
    } catch (error) {
      console.error('NFT transfer failed:', error);
      throw error;
    }
  }

  /**
   * Get token account address for a wallet and mint
   */
  getAssociatedTokenAccountAddress(owner: PublicKey, mint: PublicKey): PublicKey {
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    
    const [ata] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    return ata;
  }
}