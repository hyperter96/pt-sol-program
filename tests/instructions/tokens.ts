import * as anchor from "@coral-xyz/anchor";
import { BN, Wallet } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PtSolProgram } from "../../target/types/pt_sol_program";
import { Keypair, PublicKey } from "@solana/web3.js";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export async function initToken(
    program: anchor.Program<PtSolProgram>,
    payer: Wallet,
    mintKeypair: PublicKey,
    mint_secret: Uint8Array,
    metadata: any,
    metadataAddress: PublicKey,
) {
    let mintSign = Keypair.fromSecretKey(mint_secret)
    const transactionSignature = await program.methods
    .initToken(metadata)
    .accounts({
      metadata: metadataAddress,
      payer: payer.publicKey,
      mint: mintKeypair,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    })
    .signers([mintSign])
    .rpc();

  console.log("Success!");
  console.log(`   Mint Address: ${mintKeypair}`);
  console.log(`   Transaction Signature: ${transactionSignature}`);

}

export async function mintTokens(
    program: anchor.Program<PtSolProgram>,
    payer: Wallet,
    mintKeypair: PublicKey,
    amount: BN,
) {
    // Derive the associated token address account for the mint and payer.
    const associatedTokenAccountAddress = getAssociatedTokenAddressSync(
        mintKeypair,
        payer.publicKey
      );
  
      // Mint the tokens to the associated token account.
      const transactionSignature = await program.methods
        .mintTokens(amount)
        .accounts({
          mintAuthority: payer.publicKey,
          recipient: payer.publicKey,
          mint: mintKeypair,
          associatedTokenAccount: associatedTokenAccountAddress,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .rpc();
  
      console.log("Success!");
      console.log(
        `   Associated Token Account Address: ${associatedTokenAccountAddress}`
      );
      console.log(`   Transaction Signature: ${transactionSignature}`);
}