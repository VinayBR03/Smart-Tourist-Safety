import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  paths: {
    artifacts: "./artifacts",
    cache:     "./cache",
    sources:   "./contracts",
  },
};

export default config;