import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
// import { ASSETS } from "./utils/assets";
import { mintNewTokens } from "./utils/token";
import { LENGTH_SIZE } from "@solana/spl-token";

const METADATA = false;

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

describe("[Running Setup Script]: Create Assets", () => {
  const provider = anchor.AnchorProvider.env();
  const payer = (provider.wallet as anchor.Wallet).payer;
  anchor.setProvider(provider);
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  it("Creating Assets", async () => {
    let assets_conf = {
      assets: [],
    };

    for (const a of ASSETS) {
      const mintKeypair = Keypair.generate();
      await mintNewTokens(
        connection,
        payer.publicKey,
        payer.secretKey,
        mintKeypair,
        a,
        METADATA
      );
      assets_conf.assets.push({
        name: a[0],
        symbol: a[1],
        description: a[2],
        uri: a[3],
        decimals: a[4],
        quantity: a[5],
        address: mintKeypair.publicKey.toBase58(),
      });
    }

    fs.writeFileSync("./tests/utils/assets.json", JSON.stringify(assets_conf));
  });
});
