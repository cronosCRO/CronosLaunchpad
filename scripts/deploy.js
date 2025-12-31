const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "CRO");

  // Fee recipient - can be changed later
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  console.log("Fee recipient:", feeRecipient);

  // 1. Deploy BondingCurve first (without factory/migrator addresses)
  console.log("\n1. Deploying BondingCurve...");
  const BondingCurve = await hre.ethers.getContractFactory("BondingCurve");
  const bondingCurve = await BondingCurve.deploy(feeRecipient);
  await bondingCurve.waitForDeployment();
  const bondingCurveAddress = await bondingCurve.getAddress();
  console.log("BondingCurve deployed to:", bondingCurveAddress);

  // 2. Deploy TokenFactory
  console.log("\n2. Deploying TokenFactory...");
  const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
  const tokenFactory = await TokenFactory.deploy(bondingCurveAddress, feeRecipient);
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log("TokenFactory deployed to:", tokenFactoryAddress);

  // 3. Deploy LiquidityMigrator
  console.log("\n3. Deploying LiquidityMigrator...");
  const LiquidityMigrator = await hre.ethers.getContractFactory("LiquidityMigrator");
  const liquidityMigrator = await LiquidityMigrator.deploy(
    bondingCurveAddress,
    tokenFactoryAddress,
    feeRecipient
  );
  await liquidityMigrator.waitForDeployment();
  const liquidityMigratorAddress = await liquidityMigrator.getAddress();
  console.log("LiquidityMigrator deployed to:", liquidityMigratorAddress);

  // 4. Configure BondingCurve with factory and migrator addresses
  console.log("\n4. Configuring BondingCurve...");
  let tx = await bondingCurve.setFactory(tokenFactoryAddress);
  await tx.wait();
  console.log("Set factory address on BondingCurve");

  tx = await bondingCurve.setMigrator(liquidityMigratorAddress);
  await tx.wait();
  console.log("Set migrator address on BondingCurve");

  // Summary
  console.log("\n========================================");
  console.log("Deployment Complete!");
  console.log("========================================");
  console.log("BondingCurve:", bondingCurveAddress);
  console.log("TokenFactory:", tokenFactoryAddress);
  console.log("LiquidityMigrator:", liquidityMigratorAddress);
  console.log("Fee Recipient:", feeRecipient);
  console.log("========================================");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    feeRecipient: feeRecipient,
    contracts: {
      BondingCurve: bondingCurveAddress,
      TokenFactory: tokenFactoryAddress,
      LiquidityMigrator: liquidityMigratorAddress,
    },
    timestamp: new Date().toISOString(),
  };

  const fs = require("fs");
  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment info saved to deployment-${hre.network.name}.json`);

  // Verify contracts if not on hardhat network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

    console.log("\nVerifying contracts on CronosScan...");

    try {
      await hre.run("verify:verify", {
        address: bondingCurveAddress,
        constructorArguments: [feeRecipient],
      });
      console.log("BondingCurve verified");
    } catch (e) {
      console.log("BondingCurve verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: tokenFactoryAddress,
        constructorArguments: [bondingCurveAddress, feeRecipient],
      });
      console.log("TokenFactory verified");
    } catch (e) {
      console.log("TokenFactory verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: liquidityMigratorAddress,
        constructorArguments: [bondingCurveAddress, tokenFactoryAddress, feeRecipient],
      });
      console.log("LiquidityMigrator verified");
    } catch (e) {
      console.log("LiquidityMigrator verification failed:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
