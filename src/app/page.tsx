// page.tsx
"use client";

import React, { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
} from "@solana/spl-token";

const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const FEE_RECIPIENT = new PublicKey("DmgYp2piRKfpKC1edWWCCqYGMhiSmiPy7nTVjZurre4y");

export default function HomePage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [status, setStatus] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [tokenAccountAddress, setTokenAccountAddress] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [decimals, setDecimals] = useState(9);
  const [initialSupply, setInitialSupply] = useState("");

  const handleCreateTokenWithFee = useCallback(async () => {
    if (!publicKey) {
      setStatus("Collega prima il wallet!");
      return;
    }
    if (!tokenName || !tokenSymbol || !initialSupply) {
      setStatus("Compila tutti i campi del form!");
      return;
    }

    try {
      setStatus("Pagamento 0,20 SOL in corso...");
      
      // 1. Pagamento fee
      const feeTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: FEE_RECIPIENT,
          lamports: 0.2 * 1e9,
        })
      );
      const feeSignature = await sendTransaction(feeTx, connection);
      await connection.confirmTransaction(feeSignature, "confirmed");

      // 2. Creazione Mint
      setStatus("Creazione token SPL...");
      const mintKeypair = Keypair.generate();
      const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

      const createMintTx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          publicKey
        )
      );

      // 3. Creazione ATA
      const ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, publicKey);
      const createAtaTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          ata,
          publicKey,
          mintKeypair.publicKey
        )
      );

      // 4. Minting supply iniziale
      const mintAmount = BigInt(Number(initialSupply) * 10 ** decimals);
      const mintTx = new Transaction().add(
        createMintToInstruction(
          mintKeypair.publicKey,
          ata,
          publicKey,
          mintAmount
        )
      );

      // Combina e invia tutte le transazioni
      const combinedTx = new Transaction().add(
        ...createMintTx.instructions,
        ...createAtaTx.instructions,
        ...mintTx.instructions
      );

      const signature = await sendTransaction(combinedTx, connection, {
        signers: [mintKeypair],
      });
      await connection.confirmTransaction(signature, "confirmed");

      setMintAddress(mintKeypair.publicKey.toBase58());
      setTokenAccountAddress(ata.toBase58());
      setStatus("Token creato con successo!");

    } catch (err) {
      console.error(err);
      setStatus("Errore: " + (err as Error).message);
    }
  }, [connection, publicKey, sendTransaction, decimals, initialSupply, tokenName, tokenSymbol]);

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Crea il tuo Token SPL</h1>
      <div className="mb-4">
        <WalletMultiButtonDynamic />
      </div>

      <form className="bg-gray-100 p-4 rounded-lg mb-6">
        <div className="grid gap-4 mb-4">
          <div>
            <label className="block mb-2">Nome del Token</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-2">Simbolo</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-2">Decimali</label>
            <input
              type="number"
              className="w-full p-2 border rounded"
              value={decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
              min="0"
              max="9"
            />
          </div>
          <div>
            <label className="block mb-2">Supply Iniziale</label>
            <input
              type="number"
              className="w-full p-2 border rounded"
              value={initialSupply}
              onChange={(e) => setInitialSupply(e.target.value)}
              min="1"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateTokenWithFee}
          disabled={!publicKey}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          Crea Token (0.20 SOL)
        </button>
      </form>

      {status && <div className="p-4 bg-gray-100 rounded">{status}</div>}
      
      {mintAddress && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <p className="font-semibold">Mint Address:</p>
          <p className="break-words">{mintAddress}</p>
        </div>
      )}

      {tokenAccountAddress && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <p className="font-semibold">Token Account:</p>
          <p className="break-words">{tokenAccountAddress}</p>
        </div>
      )}
    </main>
  );
}
