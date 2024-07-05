import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import fs from "fs";
import { PtSolProgram } from "../target/types/pt_sol_program";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

describe("test", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // wallet
  const payer = provider.wallet as anchor.Wallet;

  // connection
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // 铸造的keypair
  var mintKeypair;
  if (fs.existsSync("./tests/utils/staking_mint_secret.json")) {
    const secret = new Uint8Array(fs.readFileSync("./tests/utils/staking_mint_secret.json"))
    mintKeypair = Keypair.fromSecretKey(secret)
  } else {
    mintKeypair = Keypair.generate();
    fs.appendFileSync("./tests/utils/staking_mint_secret.json", Buffer.from(mintKeypair.secretKey));
  }
  // const mintKeypair = Keypair.generate();
  // console.log(mintKeypair);

  const program = anchor.workspace.PtSolProgram as Program<PtSolProgram>;

  async function createMintToken() {
    const mint = await createMint(
      connection,
      payer.payer,
      payer.publicKey,
      payer.publicKey,
      9,
      mintKeypair,
    )
    console.log(mint)
    return mint
  }

  it("Is initialized!", async () => {
    // 创建mint token
    let mint = await createMintToken();

    // 创建vault账户
    let [vaultAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // 将账户存放里面
    let initAccount = {
      signer: payer.publicKey,
      tokenVaultAccount: vaultAccount,
      mint: mint.toBase58(),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    const tx = await program.methods
      .initializeStaking()
      // 对应合约里面initialize里面的字段
      .accounts(initAccount)
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("stake", async () => {

    // 创建user的token账户
    let userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      payer.publicKey,
    )

    // 为userTokenAccount铸造一些token
    await mintTo(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      userTokenAccount.address,
      payer.payer,
      1e11,
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
      mintKeypair.publicKey,
      payer.publicKey,
    );

    let requiredAccount = {
      stakeInfoAccount: stakeInfo,
      stakeAccount: stakeAccount,
      userTokenAccount: userTokenAccount.address,
      mint: mintKeypair.publicKey,
      signer: payer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }

    const tx = await program.methods
      .stake(new anchor.BN(1))
      .signers([payer.payer])
      .accounts(requiredAccount)
      .rpc();

      console.log("Your transaction signature", tx);
  });

  it("unstake", async () => {

    // 创建user的token账户
    let userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      payer.publicKey,
    )

    let [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), payer.publicKey.toBuffer()],
      program.programId
    );

    let [stakeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("token"), payer.publicKey.toBuffer()],
      program.programId
    );

    let [vaultAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // 为vaultAccount铸造一些token
    await mintTo(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      vaultAccount,
      payer.payer,
      1e21,
    );


    let requiredAccount = {
      tokenVaultAccount: vaultAccount,
      stakeInfoAccount: stakeInfo,
      userTokenAccount: userTokenAccount.address,
      stakeAccount: stakeAccount,
      signer: payer.publicKey,
      mint: mintKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }

    const tx = await program.methods
      .unstake()
      .signers([payer.payer])
      .accounts(requiredAccount)
      .rpc();

      console.log("Your transaction signature", tx);
  });
});
