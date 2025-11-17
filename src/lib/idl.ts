import { PublicKey } from '@solana/web3.js';
import { programId } from './config';

// Validate program ID before creating PublicKey
if (!programId || programId.length === 0) {
  throw new Error('NEXT_PUBLIC_SOLANA_PROGRAM_ID environment variable is not set or empty');
}

let CARV_DOMAIN_PROGRAM_ID: PublicKey;
try {
  CARV_DOMAIN_PROGRAM_ID = new PublicKey(programId);
} catch (error) {
  console.error('Invalid program ID:', programId);
  throw new Error(`Invalid program ID format: ${programId}. Must be a valid base58 string.`);
}

export interface Domain {
  owner: PublicKey;
  name: string;
  registered: number;
  expires: number;
  active: boolean;
  data: string;
}

export const DOMAIN_ACCOUNT_SIZE = 8 + 32 + 36 + 8 + 8 + 1 + 132; // From the Rust code

export const DOMAIN_COST = 20000000; // 0.02 SOL in lamports
export const YEAR_SECONDS = 31536000;

// Exact implementation matching your Rust code: seeds = [b"domain", name.as_bytes()]
export const getDomainPDA = (name: string): [PublicKey, number] => {
  // Convert domain name to bytes exactly like Rust: name.as_bytes()
  const nameBytes = Buffer.from(name, 'utf8');
  
  console.log('🔍 PDA Generation Details:');
  console.log('  - Domain name:', name);
  console.log('  - Name bytes:', Array.from(nameBytes));
  console.log('  - Program ID:', CARV_DOMAIN_PROGRAM_ID.toString());
  
  const pda = PublicKey.findProgramAddressSync(
    [Buffer.from('domain'), nameBytes],
    CARV_DOMAIN_PROGRAM_ID
  );
  
  console.log('  - Generated PDA:', pda[0].toString());
  console.log('  - Bump:', pda[1]);
  
  return pda;
};

// Test function to debug domain registration issues
export const debugDomainPDA = (name: string) => {
  console.log('🔍 Debugging PDA for domain:', name);
  console.log('📝 Expected PDA (from your data): DRHgpsveuUw2W6H2p6PggjiL9wFwwRLL6tbVH97vsP58');
  
  const [pda, bump] = getDomainPDA(name);
  console.log('✅ Generated PDA:', pda.toString());
  console.log('🎯 Match:', pda.toString() === 'DRHgpsveuUw2W6H2p6PggjiL9wFwwRLL6tbVH97vsP58' ? 'YES!' : 'NO');
  
  // Test different encodings
  const encodings = [
    { name: 'utf8', fn: (n: string) => Buffer.from(n, 'utf8') },
    { name: 'ascii', fn: (n: string) => Buffer.from(n, 'ascii') },
    { name: 'latin1', fn: (n: string) => Buffer.from(n, 'latin1') },
  ];
  
  encodings.forEach(encoding => {
    try {
      const testPda = PublicKey.findProgramAddressSync(
        [Buffer.from('domain'), encoding.fn(name)],
        CARV_DOMAIN_PROGRAM_ID
      );
      console.log(`  - ${encoding.name}: ${testPda[0].toString()} (match: ${testPda[0].toString() === 'DRHgpsveuUw2W6H2p6PggjiL9wFwwRLL6tbVH97vsP58' ? 'YES!' : 'NO'})`);
    } catch (error) {
      console.log(`  - ${encoding.name}: Error - ${error}`);
    }
  });
};

export { CARV_DOMAIN_PROGRAM_ID };