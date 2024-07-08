import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PtSolProgram } from "../../target/types/pt_sol_program";
import { toBigIntQuantity } from "../utils/token";
import { calculateK, fetchPool, fetchPoolTokenAccounts } from "../utils/swap";

/**
 *
 * Sends a transaction containing the instruction for the pt-sol-program's
 * `create_pool` instruction
 *
 * @param program The PtSol program as an `anchor.Program<PtSolProgram>`
 * @param payer The Liquidity Provider (local wallet in `Anchor.toml`)
 * @param poolAddress The address of the Liquidity Pool program-derived address account
 */
export async function createPool(
  program: anchor.Program<PtSolProgram>,
  payer: PublicKey,
  payer_secret: Uint8Array,
  poolAddress: PublicKey
) {
  let payerKeypair = Keypair.fromSecretKey(payer_secret);
  return await program.methods
    .createPool()
    .accounts({
      pool: poolAddress,
      payer: payer,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([payerKeypair])
    .rpc();
}

/**
 *
 * Sends a transaction containing the instruction for the pt-sol program's
 * `fund_pool` instruction
 *
 * @param program The pt-sol program as an `anchor.Program<PtSolProgram>`
 * @param payer The Liquidity Provider (local wallet in `Anchor.toml`)
 * @param pool The address of the Liquidity Pool program-derived address account
 * @param mint The address of the mint being funded to the Liquidity Pool
 * @param quantity The quantity to fund of the provided mint
 * @param decimals the decimals of this mint (used to calculate real quantity)
 */
export async function fundPool(
  program: anchor.Program<PtSolProgram>,
  payer: PublicKey,
  payer_secret: Uint8Array,
  pool: PublicKey,
  mint: PublicKey,
  quantity: number,
  decimals: number,
  threadAddress: PublicKey,
  threadAuthority: PublicKey
) {
  let requiredAccount = {
    pool,
    mint,
    poolTokenAccount: getAssociatedTokenAddressSync(mint, pool, true),
    payerTokenAccount: getAssociatedTokenAddressSync(mint, payer),
    payer: payer,
    systemProgram: anchor.web3.SystemProgram.programId,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    thread: threadAddress,
    threadAuthority: threadAuthority,
  };
  let payerKeypair = Keypair.fromSecretKey(payer_secret);

  await program.methods
    .fundPool(new anchor.BN(toBigIntQuantity(quantity, decimals).toString()))
    .accounts(requiredAccount)
    .signers([payerKeypair])
    .rpc();
}



