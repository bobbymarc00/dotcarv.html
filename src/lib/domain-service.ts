import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
  TransactionInstruction,
} from '@solana/web3.js';
import { rpcEndpoint, treasuryWallet } from './config';
import { CARV_DOMAIN_PROGRAM_ID, getDomainPDA, DOMAIN_COST } from './idl';

export class DomainService {
  public connection: Connection;

  constructor() {
    if (!rpcEndpoint) {
      throw new Error('RPC endpoint not configured');
    }
    this.connection = new Connection(rpcEndpoint);
  }

  async checkDomainAvailability(name: string): Promise<boolean> {
    try {
      // Normalize the domain name (remove .carv suffix if present)
      const normalizedName = name.replace(/\.carv$/, '');
      console.log('🔍 Checking availability for:', name, '→ normalized:', normalizedName);
      
      // Get the domain PDA using the exact implementation from your Rust code
      const [domainPDA] = getDomainPDA(normalizedName);
      console.log('📍 Generated Domain PDA:', domainPDA.toString());
      console.log('🔗 Program ID:', CARV_DOMAIN_PROGRAM_ID.toString());
      console.log('🌐 RPC Endpoint:', rpcEndpoint);
      
      // Test connection first
      try {
        const slot = await this.connection.getSlot();
        console.log('📡 Connected to network, current slot:', slot);
      } catch (connError) {
        console.error('❌ Connection error:', connError);
        throw new Error(`Failed to connect to RPC: ${connError}`);
      }
      
      const account = await this.connection.getAccountInfo(domainPDA);
      console.log('📊 Account exists:', account !== null);
      console.log('📏 Account data length:', account?.data?.length || 0);
      
      if (account) {
        console.log('⚠️  Domain account found - this means domain is TAKEN');
        console.log('📝 Account owner:', account.owner?.toString());
        console.log('💰 Account lamports:', account.lamports);
        console.log('🔒 Account executable:', account.executable);
        console.log('🔍 Account data (first 20 bytes):', account.data?.slice(0, 20).toString('hex'));
        
        // Check if this is actually our program
        const isOurProgram = account.owner.equals(CARV_DOMAIN_PROGRAM_ID);
        console.log('🎯 Is this our program account:', isOurProgram);
        
        if (!isOurProgram) {
          console.log('⚠️  Warning: Account exists but owned by different program!');
        }
        
        return false; // Domain is taken
      } else {
        console.log('✅ No account found - this means domain is AVAILABLE');
        return true;
      }
    } catch (error) {
      console.error('❌ Error checking domain availability:', error);
      // Return false (not available) on error to be safe
      return false;
    }
  }

  // Get all domains owned by a specific wallet
  async getDomainsByOwner(owner: PublicKey): Promise<any[]> {
    try {
      console.log('🔍 Getting domains for owner:', owner.toString());
      
      // Query all program accounts owned by the domain program
      const accounts = await this.connection.getProgramAccounts(CARV_DOMAIN_PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 8, // Skip the 8-byte discriminant
              bytes: owner.toBase58(),
            },
          },
        ],
      });

      console.log(`📊 Found ${accounts.length} domain accounts for owner`);

      const domains = [];
      for (const account of accounts) {
        try {
          const domainInfo = this.parseDomainAccount(account.pubkey, account.account.data);
          if (domainInfo && domainInfo.owner.equals(owner)) {
            domains.push({
              address: account.pubkey.toString(),
              ...domainInfo,
            });
          }
        } catch (error) {
          console.error('Error parsing domain account:', error);
        }
      }

      console.log('✅ Successfully parsed', domains.length, 'domains');
      return domains;
    } catch (error) {
      console.error('Error getting domains by owner:', error);
      return [];
    }
  }

  // Create register domain transaction with proper blockhash handling
  async createRegisterTransaction(
    name: string,
    owner: PublicKey,
    treasuryWalletParam?: string
  ): Promise<Transaction> {
    const [domainPDA, bump] = getDomainPDA(name);
    const treasury = treasuryWalletParam ? new PublicKey(treasuryWalletParam) : new PublicKey(treasuryWallet);

    // Using the correct 8-byte discriminator from working HTML
    const discriminator = new Uint8Array([211, 124, 67, 15, 211, 194, 178, 240]);
     
    // Encode: [discriminator (8 bytes) + length (4 bytes) + name data]
    const nameBytes = Buffer.from(name, 'utf8');
    const nameLen = Buffer.alloc(4);
    nameLen.writeUInt32LE(nameBytes.length, 0);
     
    // Complete instruction data format
    const data = Buffer.concat([Buffer.from(discriminator), nameLen, nameBytes]);
     
    console.log('📝 Register transaction created:', {
      name,
      discriminator: Buffer.from(discriminator).toString('hex'),
      dataLength: data.length,
      domainPDA: domainPDA.toString(),
      owner: owner.toString(),
      treasury: treasury.toString(),
    });

    // Create the transaction with proper instruction
    const transaction = new Transaction();
    transaction.feePayer = owner;
     
    // Instruction with correct discriminator format
    const registerInstruction = new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data,
    });
     
    transaction.add(registerInstruction);
    
    // Set fresh blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
     
    return transaction;
  }

  // Legacy method for backward compatibility
  async createRegisterInstruction(
    name: string,
    owner: PublicKey,
    treasuryWalletParam?: string
  ): Promise<TransactionInstruction> {
    const [domainPDA] = getDomainPDA(name);
    const treasury = treasuryWalletParam ? new PublicKey(treasuryWalletParam) : new PublicKey(treasuryWallet);

    const nameBytes = Buffer.from(name, 'utf8');
    const nameLen = Buffer.alloc(4);
    nameLen.writeUInt32LE(nameBytes.length, 0);
    
    // Use the correct discriminator for backward compatibility
    const discriminator = new Uint8Array([211, 124, 67, 15, 211, 194, 178, 240]);
    const data = Buffer.concat([Buffer.from(discriminator), nameLen, nameBytes]);

    return new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data,
    });
  }

  // Create renew domain transaction with proper blockhash handling
  async createRenewTransaction(
    name: string,
    owner: PublicKey,
    treasuryWalletParam?: string
  ): Promise<Transaction> {
    const [domainPDA] = getDomainPDA(name);
    const treasury = treasuryWalletParam ? new PublicKey(treasuryWalletParam) : new PublicKey(treasuryWallet);

    // Using the correct discriminator for renew from working HTML
    const discriminator = new Uint8Array([43, 239, 15, 46, 27, 7, 163, 73]);

    console.log('📝 Renew transaction created:', {
      name,
      discriminator: Buffer.from(discriminator).toString('hex'),
      domainPDA: domainPDA.toString(),
      owner: owner.toString(),
      treasury: treasury.toString(),
    });

    const transaction = new Transaction();
    transaction.feePayer = owner;

    const renewInstruction = new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data: Buffer.from(discriminator),
    });

    transaction.add(renewInstruction);

    // Set fresh blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    return transaction;
  }

  // Legacy method for backward compatibility
  createRenewInstruction(
    name: string,
    owner: PublicKey,
    treasuryWalletParam?: string
  ): TransactionInstruction {
    const [domainPDA] = getDomainPDA(name);
    const treasury = treasuryWalletParam ? new PublicKey(treasuryWalletParam) : new PublicKey(treasuryWallet);

    // Using the correct discriminator for renew from your working HTML
    const discriminator = new Uint8Array([43, 239, 15, 46, 27, 7, 163, 73]);

    return new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data: Buffer.from(discriminator),
    });
  }

  // Create transfer domain transaction with proper blockhash handling
  async createTransferTransaction(
    name: string,
    owner: PublicKey,
    newOwner: PublicKey
  ): Promise<Transaction> {
    const [domainPDA] = getDomainPDA(name);

    // Using the correct discriminator for transfer from working HTML
    const discriminator = new Uint8Array([163, 52, 200, 231, 140, 3, 69, 186]);

    // Transfer takes a Pubkey argument after discriminator
    const data = Buffer.concat([
      Buffer.from(discriminator),
      newOwner.toBuffer()
    ]);

    console.log('📝 Transfer transaction created:', {
      name,
      discriminator: Buffer.from(discriminator).toString('hex'),
      newOwner: newOwner.toString(),
      domainPDA: domainPDA.toString(),
      owner: owner.toString(),
    });

    const transaction = new Transaction();
    transaction.feePayer = owner;

    const transferInstruction = new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data,
    });

    transaction.add(transferInstruction);

    // Set fresh blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    return transaction;
  }

  // Legacy method for backward compatibility
  createTransferInstruction(
    name: string,
    owner: PublicKey,
    newOwner: PublicKey
  ): TransactionInstruction {
    const [domainPDA] = getDomainPDA(name);

    // Using the correct discriminator for transfer from your working HTML
    const discriminator = new Uint8Array([163, 52, 200, 231, 140, 3, 69, 186]);

    // Transfer takes a Pubkey argument after discriminator
    const data = Buffer.concat([
      Buffer.from(discriminator),
      newOwner.toBuffer()
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data,
    });
  }

  // Create set data transaction with proper blockhash handling
  async createSetDataTransaction(
    name: string,
    owner: PublicKey,
    data: string
  ): Promise<Transaction> {
    const [domainPDA] = getDomainPDA(name);

    // Using the correct discriminator for set_data from working HTML
    const discriminator = new Uint8Array([223, 114, 91, 136, 197, 78, 153, 153]);

    // SetData takes a String argument after discriminator
    const dataBytes = Buffer.from(data, 'utf8');
    const dataLen = Buffer.alloc(4);
    dataLen.writeUInt32LE(dataBytes.length, 0);

    const instructionData = Buffer.concat([
      Buffer.from(discriminator),
      dataLen,
      dataBytes
    ]);

    console.log('📝 Set data transaction created:', {
      name,
      discriminator: Buffer.from(discriminator).toString('hex'),
      dataLength: dataBytes.length,
      domainPDA: domainPDA.toString(),
      owner: owner.toString(),
    });

    const transaction = new Transaction();
    transaction.feePayer = owner;

    const setDataInstruction = new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data: instructionData,
    });

    transaction.add(setDataInstruction);

    // Set fresh blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    return transaction;
  }

  // Legacy method for backward compatibility
  createSetDataInstruction(
    name: string,
    owner: PublicKey,
    data: string
  ): TransactionInstruction {
    const [domainPDA] = getDomainPDA(name);

    // Using the correct discriminator for set_data from your working HTML
    const discriminator = new Uint8Array([223, 114, 91, 136, 197, 78, 153, 153]);

    // SetData takes a String argument after discriminator
    const dataBytes = Buffer.from(data, 'utf8');
    const dataLen = Buffer.alloc(4);
    dataLen.writeUInt32LE(dataBytes.length, 0);

    const instructionData = Buffer.concat([
      Buffer.from(discriminator),
      dataLen,
      dataBytes
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: domainPDA, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      programId: CARV_DOMAIN_PROGRAM_ID,
      data: instructionData,
    });
  }

  async getDomainInfo(name: string): Promise<any | null> {
    try {
      const [domainPDA] = getDomainPDA(name);
      console.log('Checking domain PDA:', domainPDA.toString(), 'for name:', name);

      const account = await this.connection.getAccountInfo(domainPDA);
      if (!account) {
        console.log('Domain account does not exist');
        return null;
      }

      console.log('Domain account exists, parsing data...');

      // Parse the domain data following the Rust struct layout
      const data = account.data;
      try {
        let offset = 8; // Skip discriminant
        const ownerBytes = data.slice(offset, offset + 32);
        const owner = new PublicKey(ownerBytes);
        offset += 32;
        
        const nameLen = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
        offset += 4;
        const nameBytes = data.slice(offset, offset + nameLen);
        const domainName = new TextDecoder().decode(nameBytes);
        offset += nameLen;
        
        const registered = Number(new DataView(data.buffer, data.byteOffset + offset, 8).getBigInt64(0, true));
        offset += 8;
        
        const expires = Number(new DataView(data.buffer, data.byteOffset + offset, 8).getBigInt64(0, true));
        offset += 8;
        
        const active = data[offset] !== 0;
        offset += 1;
        
        const dataLen = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
        offset += 4;
        const dataBytes = data.slice(offset, offset + dataLen);
        const metadata = new TextDecoder().decode(dataBytes);
        
        return {
          owner,
          name: domainName,
          registered,
          expires,
          active,
          data: metadata,
          exists: true
        };
      } catch (parseError) {
        console.error('Error parsing domain data:', parseError);
        return {
          owner: null,
          name: name,
          registered: Date.now() / 1000,
          expires: (Date.now() / 1000) + 31536000,
          active: true,
          data: '',
          exists: true,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        };
      }
    } catch (error) {
      console.error('Error getting domain info:', error);
      return null;
    }
  }

  // Parse domain account data
  private parseDomainAccount(address: PublicKey, data: Uint8Array): any {
    try {
      let offset = 8; // Skip the 8-byte discriminant
      const ownerBytes = data.slice(offset, offset + 32);
      const owner = new PublicKey(ownerBytes);
      offset += 32;
      
      const nameLen = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
      offset += 4;
      const nameBytes = data.slice(offset, offset + nameLen);
      const domainName = new TextDecoder().decode(nameBytes);
      offset += nameLen;
      
      const registered = Number(new DataView(data.buffer, data.byteOffset + offset, 8).getBigInt64(0, true));
      offset += 8;
      
      const expires = Number(new DataView(data.buffer, data.byteOffset + offset, 8).getBigInt64(0, true));
      offset += 8;
      
      const active = data[offset] !== 0;
      offset += 1;
      
      const dataLen = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
      offset += 4;
      const dataBytes = data.slice(offset, offset + dataLen);
      const metadata = new TextDecoder().decode(dataBytes);
      
      return {
        owner,
        name: domainName,
        registered,
        expires,
        active,
        data: metadata,
        exists: true
      };
    } catch (error) {
      console.error('Error parsing domain account:', error);
      return null;
    }
  }

  // Calculate rent exemption amount
  async calculateRentExemption(): Promise<number> {
    try {
      // Account size from Rust: 8 + 32 + 36 + 8 + 8 + 1 + 132 = 225 bytes
      const accountSize = 225;
      return await this.connection.getMinimumBalanceForRentExemption(accountSize);
    } catch (error) {
      console.error('Error calculating rent exemption:', error);
      // Fallback to common amount
      return 10000000; // 0.01 SOL
    }
  }

  // Check wallet balance
  async checkWalletBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      console.log('💰 Wallet balance:', balance, 'lamports (', (balance / 1000000000).toFixed(4), 'SOL)');
      return balance;
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      return 0;
    }
  }

  // Resolve a .carv domain to its owner's wallet address
  async resolveDomain(domain: string): Promise<PublicKey | null> {
    try {
      // Normalize the domain name (remove .carv suffix if present)
      const normalizedName = domain.replace(/\.carv$/, '');
      console.log('🔍 Resolving domain:', domain, '→ normalized:', normalizedName);
      
      // Get domain info
      const domainInfo = await this.getDomainInfo(normalizedName);
      
      if (!domainInfo || !domainInfo.exists) {
        console.log('❌ Domain not found:', normalizedName);
        return null;
      }
      
      if (!domainInfo.active) {
        console.log('❌ Domain is not active:', normalizedName);
        return null;
      }
      
      // Check if domain is expired
      const now = Date.now() / 1000;
      if (domainInfo.expires < now) {
        console.log('❌ Domain has expired:', normalizedName);
        return null;
      }
      
      console.log('✅ Domain resolved to owner:', domainInfo.owner.toString());
      return domainInfo.owner;
    } catch (error) {
      console.error('❌ Error resolving domain:', error);
      return null;
    }
  }
}