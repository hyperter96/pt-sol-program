import { Keypair } from "@solana/web3.js";
import fs from "fs";

export function getMintKeyPair() {
  var mintKeypair;
  if (fs.existsSync("./tests/utils/staking_mint_secret.json")) {
    const secret = new Uint8Array(
      fs.readFileSync("./tests/utils/staking_mint_secret.json")
    );
    mintKeypair = Keypair.fromSecretKey(secret);
  } else {
    mintKeypair = Keypair.generate();
    fs.appendFileSync(
      "./tests/utils/staking_mint_secret.json",
      Buffer.from(mintKeypair.secretKey)
    );
  }
  return mintKeypair;
}
