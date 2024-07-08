import { Wallet } from "@coral-xyz/anchor";
import { buildTransaction } from "./transaction";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  Account as TokenAccount,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMetadataAccountV3,
  getCreateMetadataAccountV3InstructionDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { createSignerFromKeypair } from "@metaplex-foundation/umi";

export async function createMintToken(
  connection: Connection,
  payer: Wallet,
  mintKeypair: Keypair
) {
  const mint = await createMint(
    connection,
    payer.payer,
    payer.publicKey,
    payer.publicKey,
    9,
    mintKeypair
  );
  return mint;
}

/**
 *
 * Creates and mints new SPL tokens to the local keypair
 *
 * @param connection Connection to Solana RPC
 * @param payer The Liquidity Provider (local wallet in `Anchor.toml`)
 * @param mintKeypair The generated keypair to be used for the new mint
 * @param asset The associated asset this new mint will represent
 */
export async function mintNewTokens(
  connection: Connection,
  payer: PublicKey,
  payer_secret: Uint8Array,
  mintKeypair: Keypair,
  asset: [string, string, string, string, number, number],
  metadata: boolean
) {
  const assetName = asset[0];
  const assetSymbol = asset[1];
  const assetUri = asset[3];
  const decimals = asset[4];
  const quantity = asset[5];

  const endpoint = "http://127.0.0.1:8899";
  const umi = createUmi(endpoint);
  const web3jsKeyPair = mintKeypair;

  const keypair = fromWeb3JsKeypair(web3jsKeyPair);
  const signer = createSignerFromKeypair(umi, keypair);
  umi.identity = signer;
  umi.payer = signer;

  const tokenAccount = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    payer
  );

  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: mintKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
    space: MINT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  });
  const initializeMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    decimals,
    payer,
    payer
  );

  let CreateMetadataAccountV3Args = {
    //accounts
    mint: fromWeb3JsPublicKey(mintKeypair.publicKey),
    mintAuthority: signer,
    payer: signer,
    updateAuthority: fromWeb3JsKeypair(web3jsKeyPair).publicKey,
    data: {
      name: assetName,
      symbol: assetSymbol,
      uri: assetUri,
      creators: null,
      sellerFeeBasisPoints: 0,
      uses: null,
      collection: null,
    },
    isMutable: false,
    collectionDetails: null,
  };
  const instruction = createMetadataAccountV3(umi, CreateMetadataAccountV3Args);
  const createMetadataIx: any = await instruction.getInstructions()[0];

  createMetadataIx.keys = createMetadataIx.keys.map((key) => {
    const newKey = { ...key };
    newKey.pubkey = toWeb3JsPublicKey(key.pubkey);
    return newKey;
  });

  const createAssociatedtokenAccountIx =
    createAssociatedTokenAccountInstruction(
      payer,
      tokenAccount,
      payer,
      mintKeypair.publicKey
    );
  const mintToWalletIx = createMintToInstruction(
    mintKeypair.publicKey,
    tokenAccount,
    payer,
    toBigIntQuantity(quantity, decimals)
  );
  let payerKeypair = Keypair.fromSecretKey(payer_secret);
  const tx = await buildTransaction(
    connection,
    payer,
    [payerKeypair, mintKeypair],
    metadata
      ? [
          createMintAccountIx,
          initializeMintIx,
          createMetadataIx,
          createAssociatedtokenAccountIx,
          mintToWalletIx,
        ]
      : [
          createMintAccountIx,
          initializeMintIx,
          createAssociatedtokenAccountIx,
          mintToWalletIx,
        ]
  );
  const signature = await connection.sendTransaction(tx);
  logNewMint(
    assetName.toUpperCase(),
    decimals,
    quantity,
    mintKeypair.publicKey,
    signature
  );
}

/**
 *
 * Returns the real quantity of a `quantity` parameter by
 * increasing the number using the mint's decimal places
 *
 * @param quantity The provided quantity argument
 * @param decimals The decimals of the associated mint
 * @returns The real quantity of a `quantity` parameter
 */
export function toBigIntQuantity(quantity: number, decimals: number): bigint {
  return BigInt(quantity) * BigInt(10) ** BigInt(decimals);
}

export function fromBigIntQuantity(quantity: bigint, decimals: number): string {
  return (Number(quantity) / 10 ** decimals).toFixed(6)
}


/**
 * Log a line break
 */
function lineBreak() {
  console.log("----------------------------------------------------");
}

/**
 *
 * Log information about a newly created asset mint
 *
 * @param name Asset name
 * @param decimals Asset mint decimals
 * @param quantity Quantity of asset minted
 * @param mint Asset mint address
 * @param signature Transaction signature of the minting
 */
export function logNewMint(
  name: string,
  decimals: number,
  quantity: number,
  mint: PublicKey,
  signature: string
) {
  lineBreak();
  console.log(`   Mint: ${name}`);
  console.log(`       Address:    ${mint.toBase58()}`);
  console.log(`       Decimals:   ${decimals}`);
  console.log(`       Quantity:   ${quantity}`);
  console.log(`       Transaction Signature: ${signature}`);
  lineBreak();
}

/**
 *
 * Mints an existing SPL token to the local keypair
 *
 * @param connection
 * @param payer The Liquidity Provider (local wallet in `Anchor.toml`)
 * @param mint The asset's mint address
 * @param quantity The quantity to fund of the provided mint
 * @param decimals the decimals of this mint (used to calculate real quantity)
 */
export async function mintExistingTokens(
  connection: Connection,
  payer: PublicKey,
  payer_secret: Uint8Array,
  mint: PublicKey,
  quantity: number,
  decimals: number
) {
  const tokenAccount = getAssociatedTokenAddressSync(mint, payer);

  const mintToWalletIx = createMintToInstruction(
    mint,
    tokenAccount,
    payer,
    toBigIntQuantity(quantity, decimals)
  );
  let payerKeypair = Keypair.fromSecretKey(payer_secret);
  const tx = await buildTransaction(
    connection,
    payer,
    [payerKeypair],
    [mintToWalletIx]
  );
  await connection.sendTransaction(tx);
}

/**
 *
 * Logs the Liquidity Pool's holdings (assets held in each token account)
 *
 * @param connection Connection to Solana RPC
 * @param poolAddress Address of the Liquidity Pool
 * @param tokenAccounts All token accounts owned by the Liquidity Pool
 * @param assets The assets from the configuration file
 * @param k The constant-product `K` (Constant-Product Algorithm)
 */
export async function logPool(
  connection: Connection,
  poolAddress: PublicKey,
  tokenAccounts: TokenAccount[],
  assets: {
      name: string
      quantity: number
      decimals: number
      address: PublicKey
  }[],
  k: bigint
) {
  function getHoldings(
      mint: PublicKey,
      tokenAccounts: TokenAccount[]
  ): bigint {
      const holding = tokenAccounts.find((account) =>
          account.mint.equals(mint)
      )
      return holding.amount
  }
  const padding = assets.reduce((max, a) => Math.max(max, a.name.length), 0)
  lineBreak()
  console.log('   Liquidity Pool:')
  console.log(`       Address:    ${poolAddress.toBase58()}`)
  console.log('       Holdings:')
  for (const a of assets) {
      const holding = getHoldings(a.address, tokenAccounts)
      const mint = await getMint(connection, a.address)
      const normalizedHolding = fromBigIntQuantity(holding, mint.decimals)
      console.log(
          `                   ${a.name.padEnd(
              padding,
              ' '
          )} : ${normalizedHolding.padStart(
              12,
              ' '
          )} : ${a.address.toBase58()}`
      )
  }
  logK(k)
  lineBreak()
}

/**
 *
 * Logs `K`
 *
 * @param k The constant-product `K` (Constant-Product Algorithm)
 */
export function logK(k: bigint) {
  console.log(`   ** Constant-Product (K): ${k.toString()}`)
}