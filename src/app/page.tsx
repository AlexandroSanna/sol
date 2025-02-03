"use client";

import React, { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Import dinamico per evitare hydration error
const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

// Tuo indirizzo dove ricevi 0,20 SOL
const FEE_RECIPIENT = new PublicKey("DmgYp2piRKfpKC1edWWCCqYGMhiSmiPy7nTVjZurre4y");

export default function HomePage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [status, setStatus] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [tokenAccountAddress, setTokenAccountAddress] = useState("");

  const handleCreateTokenWithFee = useCallback(async () => {
    if (!publicKey) {
      setStatus("Collega prima il wallet!");
      return;
    }
    try {
      setStatus("Pagamento 0,20 SOL in corso...");
      const lamports = 0.2 * 1_000_000_000;

      // 1) Transazione per pagare la fee
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const feeTx = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: FEE_RECIPIENT,
          lamports,
        })
      );
      const feeSignature = await sendTransaction(feeTx, connection);
      await connection.confirmTransaction(feeSignature, "confirmed");

      // 2) Creazione Mint
      setStatus("Creazione token SPL...");
      const mintKeypair = Keypair.generate();

      const rentExemption = await connection.getMinimumBalanceForRentExemption(82);
      const { blockhash: bh2, lastValidBlockHeight: lbh2 } =
        await connection.getLatestBlockhash();
      const createMintTx = new Transaction({
        blockhash: bh2,
        lastValidBlockHeight: lbh2,
        feePayer: publicKey,
      });

      createMintTx.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          lamports: rentExemption,
          space: 82,
          programId: TOKEN_PROGRAM_ID,
        })
      );
      const decimals = 9;
      createMintTx.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey, // mintAuthority
          null,
          TOKEN_PROGRAM_ID
        )
      );

      // Firma parziale con mintKeypair
      createMintTx.sign(mintKeypair);

      const createMintSig = await sendTransaction(createMintTx, connection, {
        signers: [mintKeypair],
      });
      await connection.confirmTransaction(createMintSig, "confirmed");
      setMintAddress(mintKeypair.publicKey.toBase58());

      // 3) Creazione dell'ATA per l'utente
      setStatus("Creazione account token associato...");
      const ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, publicKey);
      const { blockhash: bh3, lastValidBlockHeight: lbh3 } =
        await connection.getLatestBlockhash();
      const ataTx = new Transaction({ blockhash: bh3, lastValidBlockHeight: lbh3, feePayer: publicKey });
      ataTx.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          ata,
          publicKey,
          mintKeypair.publicKey
        )
      );
      const ataSig = await sendTransaction(ataTx, connection);
      await connection.confirmTransaction(ataSig, "confirmed");
      setTokenAccountAddress(ata.toBase58());

      setStatus("Token SPL creato con successo!");
    } catch (err) {
      console.error(err);
      setStatus("Errore: " + (err as Error).message);
    }
  }, [connection, publicKey, sendTransaction]);

  return (
    <main style={{ padding: "24px" }}>
      <h1>DApp SPL su Mainnet</h1>
      <WalletMultiButtonDynamic />
      <button
        onClick={handleCreateTokenWithFee}
        disabled={!publicKey}
        style={{ marginLeft: 12, padding: "6px 12px" }}
      >
        Crea Token SPL (costo 0.20 SOL)
      </button>
      {status && <p style={{ marginTop: 10 }}>{status}</p>}
      {mintAddress && <p>Mint Address: {mintAddress}</p>}
      {tokenAccountAddress && <p>Token Account Address: {tokenAccountAddress}</p>}
    </main>
  );
}
