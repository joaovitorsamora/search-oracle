import axios from "axios";
import { ethers } from "ethers";

const abi = [
  "function updateSearchVolume(uint256 newVolume) external",
  "function currentSearchVolume() view returns (uint256)",
  "function currentValuation() view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

export default async function handler(req, res) {
  try {
    const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDR, ADAPTER_URL } = process.env;

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDR, abi, wallet);

    const response = await axios.get(ADAPTER_URL);
    const avgVolume = response.data.averageEstimatedVolume;

    if (!avgVolume || avgVolume === 0) {
      return res.status(200).json({ message: "Nenhum volume válido retornado." });
    }

    const tx = await contract.updateSearchVolume(avgVolume);
    await tx.wait();

    res.status(200).json({
      message: "Atualizado com sucesso!",
      tx: tx.hash,
      avgVolume
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
