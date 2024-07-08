
import * as anchor from "@coral-xyz/anchor";
import { BN, Wallet } from "@coral-xyz/anchor";
import { PtSolProgram } from "../../target/types/pt_sol_program";
import { Connection, PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { print_thread } from "../utils/print";
import { ClockworkProvider } from "@clockwork-xyz/sdk";

export async function stake(
    connection: Connection,
    program: anchor.Program<PtSolProgram>,
    clockworkProvider: ClockworkProvider,
    payer: Wallet,
    mintKeypair: PublicKey,
    threadAddress: PublicKey,
    threadAuthority: PublicKey,
    threadId: String,
    poolAddress: PublicKey,
    amount: BN,
) {
    // 创建user的token账户
    let userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer.payer,
        mintKeypair,
        payer.publicKey
      );
  
      // 为userTokenAccount铸造一些token
      await mintTo(
        connection,
        payer.payer,
        mintKeypair,
        userTokenAccount.address,
        payer.payer,
        1e11
      );
  
      let [stakeInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake_info"), payer.publicKey.toBuffer()],
        program.programId
      );
  
      let [stakeAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("token"), payer.publicKey.toBuffer()],
        program.programId
      );
  
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer.payer,
        mintKeypair,
        payer.publicKey
      );
  
      console.log("threadAddress: ", threadAddress);
  
      let requiredAccount = {
        stakeInfoAccount: stakeInfo,
        stakeAccount: stakeAccount,
        userTokenAccount: userTokenAccount.address,
        mint: mintKeypair,
        signer: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        pool: poolAddress,
        poolTokenAccount: getAssociatedTokenAddressSync(
          mintKeypair,
          poolAddress,
          true
        ),
        thread: threadAddress,
        threadAuthority: threadAuthority,
        clockworkThreadProgram: clockworkProvider.threadProgram.programId,
      };
  
      const tx = await program.methods
        .stake(amount, Buffer.from(threadId))
        .signers([payer.payer])
        .accounts(requiredAccount)
        .rpc();
      await print_thread(clockworkProvider, threadAddress);
  
      // await waitForThreadExec(clockworkProvider, threadAddress);
      console.log("Your transaction signature", tx);
}