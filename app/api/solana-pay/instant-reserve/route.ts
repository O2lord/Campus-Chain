import { NextRequest, NextResponse } from 'next/server';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { BN, Idl } from '@coral-xyz/anchor';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import IDL from './idl.json';

const PROGRAM_ID = new PublicKey(process.env.SWIFT_PAY_PROGRAM_ID!);
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl('mainnet-beta'),
  'confirmed'
);

interface IdlInstruction {
  name: string;
  discriminator?: number[];
  accounts?: unknown[];
  args?: unknown[];
}

console.log('IDL loaded:', {
  hasInstructions: !!IDL.instructions,
  instructionCount: IDL.instructions?.length,
  hasInstantReserve: (IDL.instructions as IdlInstruction[])?.some(i => i.name === 'instant_reserve'),
  instantReserveDiscriminator: (IDL.instructions as IdlInstruction[])?.find(i => i.name === 'instant_reserve')?.discriminator
});

interface SwiftPayAccount {
  maker: PublicKey;
  mint: PublicKey;
}

function parseSwiftPayAccount(data: Buffer): SwiftPayAccount {
  const maker = new PublicKey(data.slice(16, 48));
  const mint = new PublicKey(data.slice(48, 80));
  
  return {
    maker,
    mint,
  };
}

async function isToken2022(mint: PublicKey): Promise<boolean> {
  try {
    const mintInfo = await connection.getAccountInfo(mint);
    if (!mintInfo || !mintInfo.owner) {
      return false;
    }
    return mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
  } catch (error) {
    console.error(`Error checking if mint ${mint.toString()} is Token2022:`, error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  console.log('=== SOLANA PAY REQUEST ===');
  console.log('Full URL:', req.url);
  console.log('Method:', req.method);
  
  try {
    const { searchParams } = new URL(req.url);
    
    const SwiftPayAddress = searchParams.get('swiftPayAddress') || searchParams.get('SwiftPayAddress');
    const tokenAmount = searchParams.get('tokenAmount');
    const fiatAmount = searchParams.get('fiatAmount');
    const currency = searchParams.get('currency');
    const payoutDetails = searchParams.get('payoutDetails');
    const account = searchParams.get('account');
    
    console.log('Parsed params:', { SwiftPayAddress, tokenAmount, fiatAmount, currency, hasPayoutDetails: !!payoutDetails, account });

    if (!account) {
      console.log('No account provided, returning metadata');
      const response = NextResponse.json({
        label: "Instant Reserve Payment",
        icon: `${new URL(req.url).origin}/icon.png`,
      }, { status: 200 });
      
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      return response;
    }
    
    console.log('Account provided, building transaction for:', account);

    if (!SwiftPayAddress || !tokenAmount || !fiatAmount || !currency) {
      return NextResponse.json({ 
        error: 'Missing required parameters: swiftPayAddress, tokenAmount, fiatAmount, currency are required' 
      }, { status: 400 });
    }

    let SwiftPayPubkey: PublicKey;
    let customerPubkey: PublicKey;
    
    try {
      SwiftPayPubkey = new PublicKey(SwiftPayAddress);
      customerPubkey = new PublicKey(account);
    } catch (error) {
      console.error('Invalid public key format:', error);
      return NextResponse.json({ 
        error: 'Invalid public key format' 
      }, { status: 400 });
    }

    const tokenAmountNum = parseFloat(tokenAmount);
    const fiatAmountNum = parseFloat(fiatAmount);
    
    if (isNaN(tokenAmountNum) || tokenAmountNum <= 0) {
      return NextResponse.json({ 
        error: 'Invalid token amount' 
      }, { status: 400 });
    }
    
    if (isNaN(fiatAmountNum) || fiatAmountNum <= 0) {
      return NextResponse.json({ 
        error: 'Invalid fiat amount' 
      }, { status: 400 });
    }

    if (currency.length !== 3) {
      return NextResponse.json({ 
        error: 'Currency must be exactly 3 characters' 
      }, { status: 400 });
    }

    let SwiftPayAccountInfo;
    try {
      SwiftPayAccountInfo = await connection.getAccountInfo(SwiftPayPubkey);
      
      if (!SwiftPayAccountInfo) {
        return NextResponse.json({ 
          error: 'SwiftPay account not found' 
        }, { status: 404 });
      }

      if (!SwiftPayAccountInfo.owner.equals(PROGRAM_ID)) {
        return NextResponse.json({ 
          error: 'Invalid SwiftPay account owner' 
        }, { status: 400 });
      }
    } catch (error) {
      console.error('Error fetching swift pay account:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch SwiftPay account' 
      }, { status: 500 });
    }

    const SwiftPayAccount = parseSwiftPayAccount(SwiftPayAccountInfo.data);
    const maker = SwiftPayAccount.maker;
    const mint = SwiftPayAccount.mint;

    const isToken2022Mint = await isToken2022(mint);
    const tokenProgram = isToken2022Mint ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

    console.log('Token program info:', {
      mint: mint.toString(),
      isToken2022: isToken2022Mint,
      tokenProgram: tokenProgram.toString()
    });

    let decimals = 9;
    try {
      const mintInfo = await connection.getAccountInfo(mint);
      if (mintInfo) {
        decimals = mintInfo.data[44];
      }
    } catch (error) {
      console.warn('Could not fetch mint decimals, using default:', error);
    }

    const takerTokenAccount = getAssociatedTokenAddressSync(
      mint,
      customerPubkey,
      false,
      tokenProgram
    );

    const swiftPayTokenAccount = getAssociatedTokenAddressSync(
      mint,
      SwiftPayPubkey,
      true,
      tokenProgram
    );

    console.log('ATA addresses:', {
      takerAta: takerTokenAccount.toString(),
      swiftPayAta: swiftPayTokenAccount.toString(),
      taker: customerPubkey.toString(),
      SwiftPay: SwiftPayPubkey.toString()
    });

    const tokenAmountBN = new BN(Math.floor(tokenAmountNum * Math.pow(10, decimals)));
    const fiatAmountBN = new BN(Math.floor(fiatAmountNum));
    const validCurrency = currency.length === 3 ? currency : currency.padEnd(3, ' ').substring(0, 3);

    const accounts = [
      { pubkey: SwiftPayPubkey, isSigner: false, isWritable: true },
      { pubkey: maker, isSigner: false, isWritable: false },
      { pubkey: customerPubkey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: takerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: swiftPayTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    // Manual instruction data encoding
    const discriminator = Buffer.from([49, 131, 230, 138, 27, 60, 108, 209]);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(tokenAmountBN.toString()));
    const fiatAmountBuffer = Buffer.alloc(8);
    fiatAmountBuffer.writeBigUInt64LE(BigInt(fiatAmountBN.toString()));
    const currencyBytes = Buffer.from(validCurrency, 'utf8');
    const currencyLengthBuffer = Buffer.alloc(4);
    currencyLengthBuffer.writeUInt32LE(currencyBytes.length);

    let payoutDetailsBuffer: Buffer;
    if (payoutDetails) {
      const payoutDetailsBytes = Buffer.from(payoutDetails, 'utf8');
      const payoutDetailsLengthBuffer = Buffer.alloc(4);
      payoutDetailsLengthBuffer.writeUInt32LE(payoutDetailsBytes.length);
      payoutDetailsBuffer = Buffer.concat([
        Buffer.from([1]),
        payoutDetailsLengthBuffer,
        payoutDetailsBytes
      ]);
    } else {
      payoutDetailsBuffer = Buffer.from([0]);
    }

    const serializedData = Buffer.concat([
      discriminator,
      amountBuffer,
      fiatAmountBuffer,
      currencyLengthBuffer,
      currencyBytes,
      payoutDetailsBuffer
    ]);

    const instantReserveInstruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: accounts,
      data: serializedData
    });

    const transaction = new Transaction();
    transaction.add(instantReserveInstruction);

    const { blockhash } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = customerPubkey;

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const response = NextResponse.json({
      transaction: serializedTransaction.toString('base64'),
      message: `Reserve ${tokenAmountNum} tokens for ${fiatAmountNum} ${currency} instant payout`,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Encoding, Accept-Encoding');

    return response;

  } catch (error) {
    console.error('Error creating SolanaPay instant reserve transaction:', error);
    return NextResponse.json({ 
      error: 'Failed to create transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const account = body.account;
    
    console.log('POST request received with body:', body);
    
    if (!account) {
      return NextResponse.json({ 
        error: 'Missing account parameter in request body' 
      }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const SwiftPayAddress = searchParams.get('swiftPayAddress') || searchParams.get('SwiftPayAddress');
    const tokenAmount = searchParams.get('tokenAmount');
    const fiatAmount = searchParams.get('fiatAmount');
    const currency = searchParams.get('currency');
    const payoutDetails = searchParams.get('payoutDetails');
    
    console.log('Building transaction for account:', account);

    if (!SwiftPayAddress || !tokenAmount || !fiatAmount || !currency) {
      return NextResponse.json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    let SwiftPayPubkey: PublicKey;
    let customerPubkey: PublicKey;
    
    try {
      SwiftPayPubkey = new PublicKey(SwiftPayAddress);
      customerPubkey = new PublicKey(account);
    } catch (error) {
      console.error('Invalid public key format:', error);
      return NextResponse.json({ 
        error: 'Invalid public key format' 
      }, { status: 400 });
    }

    const tokenAmountNum = parseFloat(tokenAmount);
    const fiatAmountNum = parseFloat(fiatAmount);
    
    if (isNaN(tokenAmountNum) || tokenAmountNum <= 0 || isNaN(fiatAmountNum) || fiatAmountNum <= 0) {
      return NextResponse.json({ 
        error: 'Invalid amounts' 
      }, { status: 400 });
    }

    const SwiftPayAccountInfo = await connection.getAccountInfo(SwiftPayPubkey);

    console.log('SwiftPay account lookup:', {
      exists: !!SwiftPayAccountInfo,
      owner: SwiftPayAccountInfo?.owner.toString(),
      expectedOwner: PROGRAM_ID.toString(),
      matches: SwiftPayAccountInfo?.owner.equals(PROGRAM_ID)
    });

    if (!SwiftPayAccountInfo) {
      console.error('SwiftPay account not found on chain');
      return NextResponse.json({ 
        error: 'SwiftPay account not found on chain',
        address: SwiftPayPubkey.toString()
      }, { status: 404 });
    }

    if (!SwiftPayAccountInfo.owner.equals(PROGRAM_ID)) {
      console.error('Owner mismatch:', {
        actual: SwiftPayAccountInfo.owner.toString(),
        expected: PROGRAM_ID.toString()
      });
      return NextResponse.json({ 
        error: 'Invalid SwiftPay account owner',
        actualOwner: SwiftPayAccountInfo.owner.toString(),
        expectedOwner: PROGRAM_ID.toString()
      }, { status: 400 });
    }

    const SwiftPayAccount = parseSwiftPayAccount(SwiftPayAccountInfo.data);
    const maker = SwiftPayAccount.maker;
    const mint = SwiftPayAccount.mint;

    const isToken2022Mint = await isToken2022(mint);
    const tokenProgram = isToken2022Mint ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

    let decimals = 9;
    const mintInfo = await connection.getAccountInfo(mint);
    if (mintInfo) {
      decimals = mintInfo.data[44];
    }

    const takerTokenAccount = getAssociatedTokenAddressSync(mint, customerPubkey, false, tokenProgram);
    const swiftPayTokenAccount = getAssociatedTokenAddressSync(mint, SwiftPayPubkey, true, tokenProgram);

    console.log('Checking if taker ATA exists...');
    const takerAtaInfo = await connection.getAccountInfo(takerTokenAccount);
    console.log('Taker ATA exists:', !!takerAtaInfo);

    if (!takerAtaInfo) {
      console.warn('⚠️ Taker ATA does not exist - transaction will fail!');
    }

    const swiftPayAtaInfo = await connection.getAccountInfo(swiftPayTokenAccount);
    console.log('SwiftPay ATA exists:', !!swiftPayAtaInfo);

    const tokenAmountBN = new BN(Math.floor(tokenAmountNum * Math.pow(10, decimals)));
    const fiatAmountBN = new BN(Math.floor(fiatAmountNum));
    const validCurrency = currency.length === 3 ? currency : currency.padEnd(3, ' ').substring(0, 3);

    // Manually build instruction data to match Rust's borsh serialization
    const discriminator = Buffer.from([49, 131, 230, 138, 27, 60, 108, 209]);

    // Amount as u64 (little endian)
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(tokenAmountBN.toString()));

    // Fiat amount as u64 (little endian)
    const fiatAmountBuffer = Buffer.alloc(8);
    fiatAmountBuffer.writeBigUInt64LE(BigInt(fiatAmountBN.toString()));

    // Currency as String (length-prefixed)
    const currencyBytes = Buffer.from(validCurrency, 'utf8');
    const currencyLengthBuffer = Buffer.alloc(4);
    currencyLengthBuffer.writeUInt32LE(currencyBytes.length);

    // Payout details as Option<String>
    let payoutDetailsBuffer: Buffer;
    if (payoutDetails) {
      const payoutDetailsBytes = Buffer.from(payoutDetails, 'utf8');
      const payoutDetailsLengthBuffer = Buffer.alloc(4);
      payoutDetailsLengthBuffer.writeUInt32LE(payoutDetailsBytes.length);
      
      // Option::Some = 1 byte with value 1, followed by the string
      payoutDetailsBuffer = Buffer.concat([
        Buffer.from([1]), // Some
        payoutDetailsLengthBuffer,
        payoutDetailsBytes
      ]);
    } else {
      // Option::None = 1 byte with value 0
      payoutDetailsBuffer = Buffer.from([0]);
    }

    // Combine all buffers
    const serializedData = Buffer.concat([
      discriminator,
      amountBuffer,
      fiatAmountBuffer,
      currencyLengthBuffer,
      currencyBytes,
      payoutDetailsBuffer
    ]);

    console.log('=== MANUAL INSTRUCTION DEBUG ===');
    console.log('Discriminator:', Array.from(discriminator));
    console.log('Amount:', tokenAmountBN.toString());
    console.log('Fiat Amount:', fiatAmountBN.toString());
    console.log('Currency:', validCurrency);
    console.log('Payout Details Length:', payoutDetails ? payoutDetails.length : 0);
    console.log('Total serialized length:', serializedData.length);
    console.log('Serialized hex:', serializedData.toString('hex'));

    const accounts = [
      { pubkey: SwiftPayPubkey, isSigner: false, isWritable: true },
      { pubkey: maker, isSigner: false, isWritable: false },
      { pubkey: customerPubkey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: takerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: swiftPayTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    console.log('Accounts array:');
    accounts.forEach((acc, idx) => {
      console.log(`  [${idx}] ${acc.pubkey.toString()}`);
      console.log(`      Signer: ${acc.isSigner}, Writable: ${acc.isWritable}`);
    });

    const instantReserveInstruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: accounts,
      data: serializedData
    });

    const transaction = new Transaction();
    transaction.add(instantReserveInstruction);

    const { blockhash } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = customerPubkey;

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const base64Transaction = serializedTransaction.toString('base64');

    console.log('Transaction serialization:', {
      transactionSize: serializedTransaction.length,
      base64Length: base64Transaction.length,
    });

    const response = NextResponse.json({
      transaction: base64Transaction,
      message: `Reserve ${tokenAmountNum} tokens for ${fiatAmountNum} ${currency} instant payout`,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
    
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json({ 
      error: 'Failed to create transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}