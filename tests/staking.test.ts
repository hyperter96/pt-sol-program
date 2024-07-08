import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PtSolProgram } from "../target/types/pt_sol_program";
import { createMintToken, mintExistingTokens, mintNewTokens } from "./utils/token";
import { getMintKeyPair } from "./utils/mint_keypair";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import assetsConfig from "./utils/assets.json";
import { ClockworkProvider } from "@clockwork-xyz/sdk";
import { fundPool } from "./instructions/liq_pool";
import { print_thread, waitForThreadExec } from "./utils/print";
import { initToken, mintTokens } from "./instructions/tokens";
import { ASSETS } from "./utils/assets";
import { stake } from "./instructions/staking";
import { BN } from "bn.js";

describe("test", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const METADATA = false;

  // wallet
  const payer = provider.wallet as anchor.Wallet;

  // connection
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // 铸造的keypair
  var mintKeypair = getMintKeyPair();
  // const mintKeypair = Keypair.generate();
  // console.log(mintKeypair);

  const program = anchor.workspace.PtSolProgram as Program<PtSolProgram>;

  // clockworkProvider
  const clockworkProvider = ClockworkProvider.fromAnchorProvider(provider);

  // Seed prefix for the Liquidity Pool from our program
  const LIQUIDITY_POOL_SEED_PREFIX = "liquidity_pool";

  const poolAddress = PublicKey.findProgramAddressSync(
    [Buffer.from(LIQUIDITY_POOL_SEED_PREFIX)],
    program.programId
  )[0];

  let threadId = "staking_thread_" + new Date().getTime() / 1000;

  const [threadAuthority] = PublicKey.findProgramAddressSync(
    // Make sure it matches on the prog side
    [Buffer.from("authority")],
    program.programId
  );

  const [threadAddress, threadBump] = clockworkProvider.getThreadPDA(
    threadAuthority,
    threadId
  );


  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  const ASSETS: [string, string, string, string, number, number][] = [
    [
      "Hyper Solana",
      "HYSOL",
      "Hyper coin for Solana!",
      "https://arweave.net/ArreGQ6DYdIPGs_KiwVXE7AMVclLliICTlls6Ff8DbY",
      9,
      8000,
    ],
    [
      "Pt Solana",
      "PTSOL",
      "Peter coin for Solana!",
      "https://arweave.net/ZlxqEw-BVEO7LKLWE7uKJoCxC67w-0zaO9ydX-m6y7A",
      9,
      1000,
    ],
    [
      "Love Solana",
      "LOVSOL",
      "Love coin for Solana!",
      "https://arweave.net/MvWxgCu231-0IrE3FWoaAYoFaD1MgWKOqDjCv5v6LEA",
      3,
      2000,
    ],
    [
      "Elastic Solana",
      "ELSOL",
      "Elastic coin for Solana!",
      "https://arweave.net/2wCk8mVH8KyqwbYLlxae9kBBKb4jTRPeiXVrqUTvjUE",
      9,
      5000,
    ],
    [
      "Gold Solana",
      "GSOL",
      "Gold coin for Solana!",
      "https://arweave.net/46B9y63MXlLnprZLvrRjS_50yecOydiLbxTbieAREBk",
      6,
      5000,
    ],
    [
      "Lucky Solana",
      "LUCKSOL",
      "Lucky coin for Solana!",
      "https://arweave.net/RT9sF6ENI__DQGYD74H4SdncsjLyeO1Rm3dRQ1T1Tz0",
      3,
      500,
    ],
    [
      "Gunpowder Solana",
      "GUNPSOL",
      "Gunpowder coin for Solana!",
      "https://arweave.net/eLqSxbbW7ATsQioluBZt9KG0YnU0jRoR_46g0EJU75Q",
      9,
      6000,
    ],
    [
      "Musket Solana",
      "MUSKSOL",
      "A musket coin for Solana!",
      "https://arweave.net/tKdMfImOkHEqo8xWulIv92MybdpkbnWjDJmazj3lTpU",
      3,
      600,
    ],
    [
      "Rum Solana",
      "RUMSOL",
      "Rum coin for Solana",
      "https://arweave.net/NJGvUP2EuK-LJ7QV6qRifcGC8ao2Vd9WSW2GjiGSpVw",
      6,
      1000,
    ],
    [
      "Telescope Solana",
      "TELESOL",
      "Telescope coin for Solana!",
      "https://arweave.net/NmBFKuCWk4yfAB4a6EGwXlWM92q5B9nBZMlRhpVA4y4",
      3,
      200,
    ],
    [
      "Treasure Map Solana",
      "TMAPSOL",
      "Treasure Map coin for Solana!",
      "https://arweave.net/_cM90jcVdRRYt-OA8xIV--gZCAOpe18BCLvV2TVW7Fc",
      3,
      100,
    ],
  ];


  it("Is initialized!", async () => {
    // 创建mint token
    let mint = await createMintToken(connection, payer, mintKeypair);

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
    // await stake(connection, program, clockworkProvider, payer, mintKeypair.pubkey, threadAddress, threadAuthority, threadId, poolAddress, new anchor.BN(100))
    // 创建user的token账户
    let userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      payer.publicKey
    );

    // 为userTokenAccount铸造一些token
    await mintTo(
      connection,
      payer.payer,
      mintKeypair.publicKey,
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
      mintKeypair.publicKey,
      payer.publicKey
    );

    console.log("threadAddress: ", threadAddress);

    let requiredAccount = {
      stakeInfoAccount: stakeInfo,
      stakeAccount: stakeAccount,
      userTokenAccount: userTokenAccount.address,
      mint: mintKeypair.publicKey,
      signer: payer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      pool: poolAddress,
      poolTokenAccount: getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        poolAddress,
        true
      ),
      thread: threadAddress,
      threadAuthority: threadAuthority,
      clockworkThreadProgram: clockworkProvider.threadProgram.programId,
    };

    const tx = await program.methods
      .stake(new anchor.BN(100), Buffer.from(threadId))
      .signers([payer.payer])
      .accounts(requiredAccount)
      .rpc();
    await print_thread(clockworkProvider, threadAddress);

    console.log("Verifying that Thread executes the pool-funding")
    // await waitForThreadExec(clockworkProvider, threadAddress);
    console.log("Your transaction signature", tx);
  });

  it("unstake", async () => {
    // 创建user的token账户
    let userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      payer.publicKey
    );

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
      1e21
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
      thread: threadAddress,
      threadAuthority: threadAuthority,
      clockworkThreadProgram: clockworkProvider.threadProgram.programId,
    };

    const tx = await program.methods
      .unstake()
      .signers([payer.payer])
      .accounts(requiredAccount)
      .rpc();

    console.log("Your transaction signature", tx);
  });

  for (const a of ASSETS) {
    const mintKeypair = Keypair.generate();
    it(`Fund Pool with token ${a[0]}: ${a[5]} ${a[1]}`, async () => {

      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(METADATA_SEED),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );
      let metadata = {
        name: a[0],
        symbol: a[1],
        uri: a[3],
      }
      await initToken(program, payer, mintKeypair.publicKey, mintKeypair.secretKey, metadata, metadataAddress)

      await mintTokens(program, payer, mintKeypair.publicKey, new anchor.BN(a[5]))
      await fundPool(
            program,
            payer.payer.publicKey,
            payer.payer.secretKey,
            poolAddress,
            mintKeypair.publicKey,
            a[5],
            a[4],
            threadAddress,
            threadAuthority
        )
    })
  } 

});
