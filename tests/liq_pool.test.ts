import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { PtSolProgram } from "../target/types/pt_sol_program";
import fs from "fs"
import assetsConfig from "./utils/assets.json";
import { createPool, fundPool } from "./instructions/liq_pool";
import { calculateK, fetchPool, fetchPoolTokenAccounts } from "./utils/swap";
import { logPool } from "./utils/token";

// Seed prefix for the Liquidity Pool from our program
const LIQUIDITY_POOL_SEED_PREFIX = "liquidity_pool";

// Util function to sleep
const sleepSeconds = async (s: number) =>
  await new Promise((f) => setTimeout(f, s * 1000));

// Util function for random number below max
function getRandomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

describe("LiquidityPool", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = anchor.workspace.PtSolProgram as anchor.Program<PtSolProgram>;

  // connection
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  const poolAddress = PublicKey.findProgramAddressSync(
    [Buffer.from(LIQUIDITY_POOL_SEED_PREFIX)],
    program.programId
  )[0];

  // const assetsConfig = JSON.parse(fs.readFileSync("./tests/utils/assets.json"))

  const assets = assetsConfig.assets.map((o) => {
    return {
        name: o.name,
        quantity: o.quantity,
        decimals: o.decimals,
        address: new PublicKey(o.address),
    }
})

  const maxAssetIndex = assetsConfig.assets.length - 1;

  // Used as a flag to only initialize the Liquidity Pool once
  let programInitialized = false;
  /**
   * 检查流动性池子pool是否存在，并设置flag
   */
  before("Check if Pool exists", async () => {
    let poolAccountInfo = await provider.connection.getAccountInfo(poolAddress);
    if (poolAccountInfo != undefined && poolAccountInfo.lamports != 0) {
      console.log("Pool already initialized!");
      console.log(`Address: ${poolAddress.toBase58()}`);
      programInitialized = true;
    }
  });

  /**
   * Initialize the Liquidity Pool if it doesn't exist already
   */
  it("CreatePool", async () => {
    if (!programInitialized) {
      const tx = await createPool(program, payer.publicKey, payer.secretKey, poolAddress);
      console.log("Your transaction signature", tx);
    }
  });

  async function getPoolData(log: boolean): Promise<bigint> {
    const pool = await fetchPool(program, poolAddress)
    const poolTokenAccounts = await fetchPoolTokenAccounts(
        connection,
        poolAddress,
        pool
    )
    const k = calculateK(poolTokenAccounts)
    if (log) {
        await logPool(
            connection,
            poolAddress,
            poolTokenAccounts,
            assets,
            k
        )
    }
    return k
}
  
});
