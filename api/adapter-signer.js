// adapter-signer.js
//----------------------------------------------
// Gerador de payload assinado para o contrato
//----------------------------------------------

import trends from "google-trends-api";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

// ========== CONFIG ==========
const KEYWORDS = process.env.KEYWORDS || "Bitcoin,Ethereum,AI";
const TIMEFRAME = process.env.TIMEFRAME || "today 12-m";
const CONTRACT_ADDR = process.env.CONTRACT_ADDR;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;

if (!CONTRACT_ADDR) throw new Error("Falta CONTRACT_ADDR no .env");
if (!ORACLE_PRIVATE_KEY) throw new Error("Falta ORACLE_PRIVATE_KEY no .env");

// ========== FUNÇÃO PRINCIPAL ==========

// Coleta o volume bruto de 1 keyword
async function getVolume(keyword) {
  const data = await trends.interestOverTime({
    keyword,
    timeframe: TIMEFRAME
  });

  const parsed = JSON.parse(data);
  const timeline = parsed?.default?.timelineData || [];

  if (timeline.length === 0)
    throw new Error(`Google Trends retornou vazio para: ${keyword}`);

  // média dos últimos 30 pontos
  const N = Math.min(30, timeline.length);
  const slice = timeline.slice(-N);
  const values = slice.map(t => t.value[0] || 0);

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // escala fixa — ajustável
  return Math.floor(avg * 1_000_000);
}

// Agregação de keywords (média)
async function aggregateKeywords() {
  const keywordsArr = KEYWORDS.split(",").map(x => x.trim());
  let sum = 0;
  let count = 0;

  for (const kw of keywordsArr) {
    try {
      const v = await getVolume(kw);
      sum += v;
      count++;
    } catch (err) {
      console.error("Falha ao coletar palavra:", kw, err.message);
    }
  }

  if (count === 0) throw new Error("Nenhuma keyword retornou dados");

  return Math.floor(sum / count);
}

export async function generateSignedPayload() {
  const newVolume = await aggregateKeywords();

  const wallet = new ethers.Wallet(ORACLE_PRIVATE_KEY);

  const nonce = Date.now(); // simples, seguro, único
  const timestamp = Math.floor(Date.now() / 1000);

  // mesma packing do Solidity
  const msgHash = ethers.utils.solidityKeccak256(
    ["address", "uint256", "uint256", "uint256"],
    [CONTRACT_ADDR, newVolume, nonce, timestamp]
  );

  const signature = await wallet.signMessage(
    ethers.utils.arrayify(msgHash)
  );

  return {
    newVolume,
    nonce,
    timestamp,
    signature
  };
}

// se rodar esse arquivo diretamente via node:
if (process.argv[1].includes("adapter-signer.js")) {
  (async () => {
    const result = await generateSignedPayload();
    console.log("Payload assinado gerado:\n", result);
  })();
}
