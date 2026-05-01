import * as fs from "fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat as hardhatChain } from "viem/chains";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTRACTS = [
  "IncidentLedger",
  "ZoneLedger",
  "AuditLedger",
  "AssignmentLedger",
  "HealthAlertLedger",
  "EvidenceLedger",
];

const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
  const account = privateKeyToAccount(DEPLOYER_KEY);

  const walletClient = createWalletClient({
    account,
    chain: hardhatChain,
    transport: http("http://127.0.0.1:8545"),
  });

  const publicClient = createPublicClient({
    chain: hardhatChain,
    transport: http("http://127.0.0.1:8545"),
  });

  const addresses: Record<string, string> = {};

  for (const name of CONTRACTS) {
    const artifactPath = join(
      __dirname,
      `../artifacts/contracts/${name}.sol/${name}.json`
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // @ts-ignore
    const hash = await walletClient.deployContract({
      abi:      artifact.abi,
      bytecode: artifact.bytecode,
      args:     [],
      chain:    hardhatChain,
      account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    addresses[name] = receipt.contractAddress as string;
    console.log(`${name} → ${receipt.contractAddress}`);
  }

  const outPath = join(__dirname, "../deployed_addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nSaved to deployed_addresses.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});