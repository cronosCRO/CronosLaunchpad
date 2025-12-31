const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CronosMeme Launchpad", function () {
  let bondingCurve, tokenFactory, liquidityMigrator;
  let owner, user1, user2, feeRecipient;
  let tokenAddress;

  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion
  const CREATION_FEE = ethers.parseEther("1"); // 1 CRO
  const GRADUATION_THRESHOLD = ethers.parseEther("500"); // 500 CRO

  beforeEach(async function () {
    [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    // Deploy BondingCurve
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    bondingCurve = await BondingCurve.deploy(feeRecipient.address);
    await bondingCurve.waitForDeployment();

    // Deploy TokenFactory
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    tokenFactory = await TokenFactory.deploy(
      await bondingCurve.getAddress(),
      feeRecipient.address
    );
    await tokenFactory.waitForDeployment();

    // Deploy LiquidityMigrator
    const LiquidityMigrator = await ethers.getContractFactory("LiquidityMigrator");
    liquidityMigrator = await LiquidityMigrator.deploy(
      await bondingCurve.getAddress(),
      await tokenFactory.getAddress(),
      feeRecipient.address
    );
    await liquidityMigrator.waitForDeployment();

    // Configure BondingCurve
    await bondingCurve.setFactory(await tokenFactory.getAddress());
    await bondingCurve.setMigrator(await liquidityMigrator.getAddress());
  });

  describe("Token Creation", function () {
    it("Should create a new token with correct parameters", async function () {
      const tx = await tokenFactory.connect(user1).createToken(
        "Test Meme",
        "MEME",
        "ipfs://metadata",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "TokenCreated"
      );
      tokenAddress = event.args[0];

      const tokenInfo = await tokenFactory.tokenInfo(tokenAddress);
      expect(tokenInfo.creator).to.equal(user1.address);
      expect(tokenInfo.name).to.equal("Test Meme");
      expect(tokenInfo.symbol).to.equal("MEME");
    });

    it("Should fail with insufficient fee", async function () {
      await expect(
        tokenFactory.connect(user1).createToken(
          "Test Meme",
          "MEME",
          "ipfs://metadata",
          { value: ethers.parseEther("0.5") }
        )
      ).to.be.revertedWith("Insufficient fee");
    });

    it("Should transfer fee to recipient", async function () {
      const initialBalance = await ethers.provider.getBalance(feeRecipient.address);

      await tokenFactory.connect(user1).createToken(
        "Test Meme",
        "MEME",
        "ipfs://metadata",
        { value: CREATION_FEE }
      );

      const finalBalance = await ethers.provider.getBalance(feeRecipient.address);
      expect(finalBalance - initialBalance).to.equal(CREATION_FEE);
    });
  });

  describe("Bonding Curve Trading", function () {
    beforeEach(async function () {
      const tx = await tokenFactory.connect(user1).createToken(
        "Test Meme",
        "MEME",
        "ipfs://metadata",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "TokenCreated"
      );
      tokenAddress = event.args[0];
    });

    it("Should allow buying tokens", async function () {
      const buyAmount = ethers.parseEther("10"); // 10 CRO

      const tokensExpected = await bondingCurve.getTokensForCro(tokenAddress, buyAmount);
      expect(tokensExpected).to.be.gt(0);

      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: buyAmount });

      const token = await ethers.getContractAt("MemeToken", tokenAddress);
      const balance = await token.balanceOf(user2.address);
      expect(balance).to.be.gt(0);
    });

    it("Should increase price after buys", async function () {
      const priceBefore = await bondingCurve.getCurrentPrice(tokenAddress);

      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

      const priceAfter = await bondingCurve.getCurrentPrice(tokenAddress);
      expect(priceAfter).to.be.gt(priceBefore);
    });

    it("Should allow selling tokens", async function () {
      // First buy some tokens
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

      const token = await ethers.getContractAt("MemeToken", tokenAddress);
      const balance = await token.balanceOf(user2.address);

      // Sell half the tokens (selling all would exceed real CRO reserve due to virtual reserve)
      const sellAmount = balance / 2n;

      // Approve and sell
      await token.connect(user2).approve(await bondingCurve.getAddress(), sellAmount);

      const balanceBefore = await ethers.provider.getBalance(user2.address);
      const sellTx = await bondingCurve.connect(user2).sell(tokenAddress, sellAmount, 0);
      await sellTx.wait();
      const balanceAfter = await ethers.provider.getBalance(user2.address);

      // Verify token balance decreased
      const tokenBalanceAfter = await token.balanceOf(user2.address);
      expect(tokenBalanceAfter).to.equal(balance - sellAmount);
    });

    it("Should enforce slippage protection", async function () {
      const buyAmount = ethers.parseEther("10");
      const unreasonableMinTokens = ethers.parseEther("999999999"); // Too high

      await expect(
        bondingCurve.connect(user2).buy(tokenAddress, unreasonableMinTokens, { value: buyAmount })
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("Should return correct curve state", async function () {
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

      const state = await bondingCurve.getCurveState(tokenAddress);
      expect(state.realCroReserve).to.be.gt(0);
      expect(state.tokensSold).to.be.gt(0);
      expect(state.currentPrice).to.be.gt(0);
    });
  });

  describe("Fee Distribution", function () {
    beforeEach(async function () {
      const tx = await tokenFactory.connect(user1).createToken(
        "Test Meme",
        "MEME",
        "ipfs://metadata",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "TokenCreated"
      );
      tokenAddress = event.args[0];
    });

    it("Should split trading fees between creator and platform", async function () {
      const creatorBalanceBefore = await ethers.provider.getBalance(user1.address);
      const platformBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);

      // Buy tokens (1% fee, split 50/50)
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("100") });

      const creatorBalanceAfter = await ethers.provider.getBalance(user1.address);
      const platformBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);

      // Each should receive 0.5 CRO (half of 1% of 100 CRO)
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(ethers.parseEther("0.5"));
      expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseEther("0.5"));
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to set factory on BondingCurve", async function () {
      await expect(
        bondingCurve.connect(user1).setFactory(user1.address)
      ).to.be.revertedWithCustomError(bondingCurve, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to set migrator on BondingCurve", async function () {
      await expect(
        bondingCurve.connect(user1).setMigrator(user1.address)
      ).to.be.revertedWithCustomError(bondingCurve, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to update creation fee", async function () {
      await expect(
        tokenFactory.connect(user1).setCreationFee(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount");
    });
  });
});
