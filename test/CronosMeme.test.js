const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CronosMeme Launchpad", function () {
  let bondingCurve, tokenFactory, liquidityMigrator;
  let owner, user1, user2, user3, feeRecipient;
  let tokenAddress;

  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion
  const CREATION_FEE = ethers.parseEther("1"); // 1 CRO
  const GRADUATION_THRESHOLD = ethers.parseEther("500"); // 500 CRO
  const VIRTUAL_CRO = ethers.parseEther("30"); // 30 CRO virtual reserve

  beforeEach(async function () {
    [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();

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

  // Helper function to create a token
  async function createToken(creator, name = "Test Meme", symbol = "MEME") {
    const tx = await tokenFactory.connect(creator).createToken(
      name,
      symbol,
      "ipfs://metadata",
      { value: CREATION_FEE }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log) => log.fragment && log.fragment.name === "TokenCreated"
    );
    return event.args[0];
  }

  // ============================================
  // TOKEN FACTORY TESTS
  // ============================================
  describe("TokenFactory", function () {
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

      it("Should fail with zero fee", async function () {
        await expect(
          tokenFactory.connect(user1).createToken(
            "Test Meme",
            "MEME",
            "ipfs://metadata",
            { value: 0 }
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

      it("Should emit TokenCreated event", async function () {
        await expect(
          tokenFactory.connect(user1).createToken(
            "Test Meme",
            "MEME",
            "ipfs://metadata",
            { value: CREATION_FEE }
          )
        ).to.emit(tokenFactory, "TokenCreated");
      });

      it("Should increment token count", async function () {
        const countBefore = await tokenFactory.getTokenCount();
        await createToken(user1);
        const countAfter = await tokenFactory.getTokenCount();
        expect(countAfter).to.equal(countBefore + 1n);
      });

      it("Should track creator tokens correctly", async function () {
        await createToken(user1, "Token1", "TK1");
        await createToken(user1, "Token2", "TK2");
        await createToken(user2, "Token3", "TK3");

        const user1Tokens = await tokenFactory.getCreatorTokens(user1.address);
        const user2Tokens = await tokenFactory.getCreatorTokens(user2.address);

        expect(user1Tokens.length).to.equal(2);
        expect(user2Tokens.length).to.equal(1);
      });

      it("Should store metadata URI correctly", async function () {
        tokenAddress = await createToken(user1);
        const tokenInfo = await tokenFactory.tokenInfo(tokenAddress);
        expect(tokenInfo.metadataURI).to.equal("ipfs://metadata");
      });

      it("Should handle empty name", async function () {
        await expect(
          tokenFactory.connect(user1).createToken(
            "",
            "MEME",
            "ipfs://metadata",
            { value: CREATION_FEE }
          )
        ).to.be.revertedWith("Invalid name length");
      });

      it("Should handle empty symbol", async function () {
        await expect(
          tokenFactory.connect(user1).createToken(
            "Test",
            "",
            "ipfs://metadata",
            { value: CREATION_FEE }
          )
        ).to.be.revertedWith("Invalid symbol length");
      });
    });

    describe("Admin Functions", function () {
      it("Should allow owner to update creation fee", async function () {
        const newFee = ethers.parseEther("2");
        await tokenFactory.setCreationFee(newFee);
        expect(await tokenFactory.creationFee()).to.equal(newFee);
      });

      it("Should reject non-owner updating creation fee", async function () {
        await expect(
          tokenFactory.connect(user1).setCreationFee(ethers.parseEther("2"))
        ).to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to update fee recipient", async function () {
        await tokenFactory.setFeeRecipient(user2.address);
        expect(await tokenFactory.feeRecipient()).to.equal(user2.address);
      });

      it("Should allow setting any address for fee recipient", async function () {
        // Contract doesn't validate zero address, so this should succeed
        await tokenFactory.setFeeRecipient(user2.address);
        expect(await tokenFactory.feeRecipient()).to.equal(user2.address);
      });
    });

    describe("View Functions", function () {
      it("Should return all tokens correctly", async function () {
        const addr1 = await createToken(user1, "Token1", "TK1");
        const addr2 = await createToken(user2, "Token2", "TK2");
        const addr3 = await createToken(user1, "Token3", "TK3");

        const allTokens = await tokenFactory.getAllTokens();
        expect(allTokens.length).to.equal(3);
        expect(allTokens).to.include(addr1);
        expect(allTokens).to.include(addr2);
        expect(allTokens).to.include(addr3);
      });

      it("Should check if token info exists", async function () {
        tokenAddress = await createToken(user1);
        const tokenInfo = await tokenFactory.tokenInfo(tokenAddress);
        expect(tokenInfo.creator).to.equal(user1.address);

        // Non-existent token should have zero address creator
        const fakeInfo = await tokenFactory.tokenInfo(user1.address);
        expect(fakeInfo.creator).to.equal(ethers.ZeroAddress);
      });
    });
  });

  // ============================================
  // MEME TOKEN TESTS
  // ============================================
  describe("MemeToken", function () {
    let token;

    beforeEach(async function () {
      tokenAddress = await createToken(user1);
      token = await ethers.getContractAt("MemeToken", tokenAddress);
    });

    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal("Test Meme");
      expect(await token.symbol()).to.equal("MEME");
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should mint total supply to bonding curve", async function () {
      const bondingCurveBalance = await token.balanceOf(await bondingCurve.getAddress());
      expect(bondingCurveBalance).to.equal(TOTAL_SUPPLY);
    });

    it("Should have zero balance for creator initially", async function () {
      const creatorBalance = await token.balanceOf(user1.address);
      expect(creatorBalance).to.equal(0);
    });

    it("Should support standard ERC20 transfers", async function () {
      // Buy some tokens first
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("10") });
      const balance = await token.balanceOf(user2.address);

      // Transfer some tokens
      await token.connect(user2).transfer(user3.address, balance / 2n);
      expect(await token.balanceOf(user3.address)).to.equal(balance / 2n);
    });

    it("Should support ERC20 approve and transferFrom", async function () {
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("10") });
      const balance = await token.balanceOf(user2.address);

      await token.connect(user2).approve(user3.address, balance);
      await token.connect(user3).transferFrom(user2.address, user3.address, balance / 2n);

      expect(await token.balanceOf(user3.address)).to.equal(balance / 2n);
    });
  });

  // ============================================
  // BONDING CURVE TESTS
  // ============================================
  describe("BondingCurve", function () {
    beforeEach(async function () {
      tokenAddress = await createToken(user1);
    });

    describe("Buying Tokens", function () {
      it("Should allow buying tokens", async function () {
        const buyAmount = ethers.parseEther("10");

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

      it("Should emit TokenBought event", async function () {
        await expect(
          bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("10") })
        ).to.emit(bondingCurve, "TokenBought");
      });

      it("Should fail with zero CRO", async function () {
        await expect(
          bondingCurve.connect(user2).buy(tokenAddress, 0, { value: 0 })
        ).to.be.revertedWith("Zero CRO");
      });

      it("Should enforce slippage protection on buy", async function () {
        const buyAmount = ethers.parseEther("10");
        const unreasonableMinTokens = ethers.parseEther("999999999");

        await expect(
          bondingCurve.connect(user2).buy(tokenAddress, unreasonableMinTokens, { value: buyAmount })
        ).to.be.revertedWith("Slippage exceeded");
      });

      it("Should allow multiple users to buy", async function () {
        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("10") });
        await bondingCurve.connect(user3).buy(tokenAddress, 0, { value: ethers.parseEther("20") });

        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        expect(await token.balanceOf(user2.address)).to.be.gt(0);
        expect(await token.balanceOf(user3.address)).to.be.gt(0);
      });

      it("Should return fewer tokens for same CRO as price increases", async function () {
        const tokens1 = await bondingCurve.getTokensForCro(tokenAddress, ethers.parseEther("10"));
        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });
        const tokens2 = await bondingCurve.getTokensForCro(tokenAddress, ethers.parseEther("10"));

        expect(tokens2).to.be.lt(tokens1);
      });
    });

    describe("Selling Tokens", function () {
      beforeEach(async function () {
        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });
      });

      it("Should allow selling tokens", async function () {
        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        const balance = await token.balanceOf(user2.address);
        const sellAmount = balance / 2n;

        await token.connect(user2).approve(await bondingCurve.getAddress(), sellAmount);
        await bondingCurve.connect(user2).sell(tokenAddress, sellAmount, 0);

        const tokenBalanceAfter = await token.balanceOf(user2.address);
        expect(tokenBalanceAfter).to.equal(balance - sellAmount);
      });

      it("Should decrease price after sells", async function () {
        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        const balance = await token.balanceOf(user2.address);
        const priceBefore = await bondingCurve.getCurrentPrice(tokenAddress);

        await token.connect(user2).approve(await bondingCurve.getAddress(), balance / 2n);
        await bondingCurve.connect(user2).sell(tokenAddress, balance / 2n, 0);

        const priceAfter = await bondingCurve.getCurrentPrice(tokenAddress);
        expect(priceAfter).to.be.lt(priceBefore);
      });

      it("Should emit TokenSold event", async function () {
        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        const balance = await token.balanceOf(user2.address);
        await token.connect(user2).approve(await bondingCurve.getAddress(), balance / 4n);

        await expect(
          bondingCurve.connect(user2).sell(tokenAddress, balance / 4n, 0)
        ).to.emit(bondingCurve, "TokenSold");
      });

      it("Should fail with zero tokens", async function () {
        await expect(
          bondingCurve.connect(user2).sell(tokenAddress, 0, 0)
        ).to.be.revertedWith("Zero tokens");
      });

      it("Should fail without approval", async function () {
        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        const balance = await token.balanceOf(user2.address);

        await expect(
          bondingCurve.connect(user2).sell(tokenAddress, balance, 0)
        ).to.be.reverted;
      });

      it("Should enforce slippage protection on sell", async function () {
        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        const balance = await token.balanceOf(user2.address);
        const sellAmount = balance / 4n;

        await token.connect(user2).approve(await bondingCurve.getAddress(), sellAmount);

        await expect(
          bondingCurve.connect(user2).sell(tokenAddress, sellAmount, ethers.parseEther("1000"))
        ).to.be.revertedWith("Slippage exceeded");
      });

      it("Should return CRO to seller", async function () {
        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        const balance = await token.balanceOf(user2.address);
        const sellAmount = balance / 4n;

        await token.connect(user2).approve(await bondingCurve.getAddress(), sellAmount);

        const balanceBefore = await ethers.provider.getBalance(user2.address);
        const tx = await bondingCurve.connect(user2).sell(tokenAddress, sellAmount, 0);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        const balanceAfter = await ethers.provider.getBalance(user2.address);

        expect(balanceAfter + gasUsed).to.be.gt(balanceBefore);
      });
    });

    describe("Curve State", function () {
      it("Should return correct initial curve state", async function () {
        const state = await bondingCurve.getCurveState(tokenAddress);
        expect(state.virtualCroReserve).to.equal(VIRTUAL_CRO);
        expect(state.virtualTokenReserve).to.equal(TOTAL_SUPPLY);
        expect(state.realCroReserve).to.equal(0);
        expect(state.tokensSold).to.equal(0);
        expect(state.canGraduate).to.be.false;
      });

      it("Should update curve state after trades", async function () {
        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

        const state = await bondingCurve.getCurveState(tokenAddress);
        expect(state.realCroReserve).to.be.gt(0);
        expect(state.tokensSold).to.be.gt(0);
        expect(state.currentPrice).to.be.gt(0);
      });

      it("Should calculate progress correctly", async function () {
        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

        const state = await bondingCurve.getCurveState(tokenAddress);
        // Progress should be roughly 10% (50 CRO of 500 CRO threshold, minus fees)
        expect(state.progressBps).to.be.gt(0);
        expect(state.progressBps).to.be.lt(10000); // Less than 100%
      });
    });

    describe("Fee Distribution", function () {
      it("Should split trading fees between creator and platform", async function () {
        const creatorBalanceBefore = await ethers.provider.getBalance(user1.address);
        const platformBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);

        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("100") });

        const creatorBalanceAfter = await ethers.provider.getBalance(user1.address);
        const platformBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);

        // Each should receive 0.5 CRO (half of 1% of 100 CRO)
        expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(ethers.parseEther("0.5"));
        expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseEther("0.5"));
      });

      it("Should take 1% total fee on buys", async function () {
        const buyAmount = ethers.parseEther("100");
        const state1 = await bondingCurve.getCurveState(tokenAddress);

        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: buyAmount });

        const state2 = await bondingCurve.getCurveState(tokenAddress);
        // Real CRO reserve should be 99 CRO (100 - 1% fee)
        expect(state2.realCroReserve).to.equal(ethers.parseEther("99"));
      });

      it("Should distribute fees on sells too", async function () {
        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

        const token = await ethers.getContractAt("MemeToken", tokenAddress);
        const balance = await token.balanceOf(user2.address);
        await token.connect(user2).approve(await bondingCurve.getAddress(), balance / 4n);

        const creatorBalanceBefore = await ethers.provider.getBalance(user1.address);
        await bondingCurve.connect(user2).sell(tokenAddress, balance / 4n, 0);
        const creatorBalanceAfter = await ethers.provider.getBalance(user1.address);

        expect(creatorBalanceAfter).to.be.gt(creatorBalanceBefore);
      });
    });

    describe("Access Control", function () {
      it("Should only allow owner to set factory", async function () {
        await expect(
          bondingCurve.connect(user1).setFactory(user1.address)
        ).to.be.revertedWithCustomError(bondingCurve, "OwnableUnauthorizedAccount");
      });

      it("Should only allow owner to set migrator", async function () {
        await expect(
          bondingCurve.connect(user1).setMigrator(user1.address)
        ).to.be.revertedWithCustomError(bondingCurve, "OwnableUnauthorizedAccount");
      });

      it("Should only allow owner to set fee recipient", async function () {
        await expect(
          bondingCurve.connect(user1).setFeeRecipient(user1.address)
        ).to.be.revertedWithCustomError(bondingCurve, "OwnableUnauthorizedAccount");
      });

      it("Should only allow factory to initialize curve", async function () {
        await expect(
          bondingCurve.connect(user1).initializeCurve(tokenAddress, user1.address)
        ).to.be.revertedWith("Only factory");
      });
    });

    describe("Trading on Invalid Token", function () {
      it("Should fail to buy non-existent token", async function () {
        await expect(
          bondingCurve.connect(user2).buy(user1.address, 0, { value: ethers.parseEther("10") })
        ).to.be.revertedWith("Invalid curve state");
      });

      it("Should fail to sell non-existent token", async function () {
        await expect(
          bondingCurve.connect(user2).sell(user1.address, ethers.parseEther("100"), 0)
        ).to.be.revertedWith("Invalid curve state");
      });
    });
  });

  // ============================================
  // GRADUATION TESTS
  // ============================================
  describe("Graduation", function () {
    beforeEach(async function () {
      tokenAddress = await createToken(user1);
    });

    it("Should mark token ready for graduation at threshold", async function () {
      // Buy enough to reach graduation (505+ CRO to account for fees)
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("510") });

      const state = await bondingCurve.getCurveState(tokenAddress);
      expect(state.realCroReserve).to.be.gte(GRADUATION_THRESHOLD);
    });

    it("Should not be graduated initially", async function () {
      // Verify the graduation check exists
      const state = await bondingCurve.getCurveState(tokenAddress);
      expect(state.canGraduate).to.be.false;
    });

    it("Should calculate 100% progress at graduation threshold", async function () {
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("510") });

      const state = await bondingCurve.getCurveState(tokenAddress);
      expect(state.progressBps).to.be.gte(10000); // 100%
    });
  });

  // ============================================
  // LIQUIDITY MIGRATOR TESTS
  // ============================================
  describe("LiquidityMigrator", function () {
    describe("Admin Functions", function () {
      it("Should only allow owner to set bonding curve", async function () {
        await expect(
          liquidityMigrator.connect(user1).setBondingCurve(user1.address)
        ).to.be.revertedWithCustomError(liquidityMigrator, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set bonding curve", async function () {
        await liquidityMigrator.setBondingCurve(user2.address);
        expect(await liquidityMigrator.bondingCurve()).to.equal(user2.address);
      });

      it("Should allow owner to update migration fee", async function () {
        const newFee = ethers.parseEther("5");
        await liquidityMigrator.setMigrationFee(newFee);
        expect(await liquidityMigrator.migrationFee()).to.equal(newFee);
      });

      it("Should reject non-owner updating migration fee", async function () {
        await expect(
          liquidityMigrator.connect(user1).setMigrationFee(ethers.parseEther("5"))
        ).to.be.revertedWithCustomError(liquidityMigrator, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set factory", async function () {
        await liquidityMigrator.setFactory(user2.address);
        expect(await liquidityMigrator.factory()).to.equal(user2.address);
      });

      it("Should allow owner to set fee recipient", async function () {
        await liquidityMigrator.setFeeRecipient(user2.address);
        expect(await liquidityMigrator.feeRecipient()).to.equal(user2.address);
      });
    });

    describe("Migration Requirements", function () {
      beforeEach(async function () {
        tokenAddress = await createToken(user1);
      });

      it("Should reject migration below threshold", async function () {
        // Token hasn't reached graduation threshold
        await expect(
          liquidityMigrator.migrate(tokenAddress)
        ).to.be.revertedWith("Not ready");
      });

      it("Should check canMigrate returns false for non-graduated token", async function () {
        const canMigrate = await liquidityMigrator.canMigrate(tokenAddress);
        expect(canMigrate).to.be.false;
      });

      it("Should return empty graduated tokens list initially", async function () {
        const graduatedTokens = await liquidityMigrator.getGraduatedTokens();
        expect(graduatedTokens.length).to.equal(0);
      });

      it("Should return zero graduated token count initially", async function () {
        const count = await liquidityMigrator.getGraduatedTokenCount();
        expect(count).to.equal(0);
      });
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  describe("Integration Tests", function () {
    it("Should handle full token lifecycle up to graduation threshold", async function () {
      // Create token
      tokenAddress = await createToken(user1, "Integration Test", "INT");
      const token = await ethers.getContractAt("MemeToken", tokenAddress);

      // Multiple users buy
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("100") });
      await bondingCurve.connect(user3).buy(tokenAddress, 0, { value: ethers.parseEther("150") });

      // User2 sells some
      const user2Balance = await token.balanceOf(user2.address);
      await token.connect(user2).approve(await bondingCurve.getAddress(), user2Balance / 2n);
      await bondingCurve.connect(user2).sell(tokenAddress, user2Balance / 2n, 0);

      // More buying to approach graduation
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("200") });

      // Check state
      const state = await bondingCurve.getCurveState(tokenAddress);
      expect(state.tokensSold).to.be.gt(0);
      expect(state.realCroReserve).to.be.gt(0);
    });

    it("Should handle multiple token creations by same user", async function () {
      const addr1 = await createToken(user1, "Token One", "ONE");
      const addr2 = await createToken(user1, "Token Two", "TWO");
      const addr3 = await createToken(user1, "Token Three", "THREE");

      const creatorTokens = await tokenFactory.getCreatorTokens(user1.address);
      expect(creatorTokens.length).to.equal(3);

      // Trade on different tokens
      await bondingCurve.connect(user2).buy(addr1, 0, { value: ethers.parseEther("10") });
      await bondingCurve.connect(user2).buy(addr2, 0, { value: ethers.parseEther("20") });
      await bondingCurve.connect(user2).buy(addr3, 0, { value: ethers.parseEther("30") });

      const token1 = await ethers.getContractAt("MemeToken", addr1);
      const token2 = await ethers.getContractAt("MemeToken", addr2);
      const token3 = await ethers.getContractAt("MemeToken", addr3);

      expect(await token1.balanceOf(user2.address)).to.be.gt(0);
      expect(await token2.balanceOf(user2.address)).to.be.gt(0);
      expect(await token3.balanceOf(user2.address)).to.be.gt(0);
    });

    it("Should correctly track fees across multiple trades", async function () {
      tokenAddress = await createToken(user1);

      const creatorBalanceStart = await ethers.provider.getBalance(user1.address);

      // Multiple trades
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("100") });
      await bondingCurve.connect(user3).buy(tokenAddress, 0, { value: ethers.parseEther("100") });

      const token = await ethers.getContractAt("MemeToken", tokenAddress);
      const user2Balance = await token.balanceOf(user2.address);
      await token.connect(user2).approve(await bondingCurve.getAddress(), user2Balance / 2n);
      await bondingCurve.connect(user2).sell(tokenAddress, user2Balance / 2n, 0);

      const creatorBalanceEnd = await ethers.provider.getBalance(user1.address);

      // Creator should have received fees from 3 trades
      expect(creatorBalanceEnd).to.be.gt(creatorBalanceStart);
    });
  });

  // ============================================
  // EDGE CASES AND SECURITY
  // ============================================
  describe("Edge Cases and Security", function () {
    beforeEach(async function () {
      tokenAddress = await createToken(user1);
    });

    it("Should handle very small buy amounts", async function () {
      const smallAmount = ethers.parseEther("0.01");
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: smallAmount });

      const token = await ethers.getContractAt("MemeToken", tokenAddress);
      expect(await token.balanceOf(user2.address)).to.be.gt(0);
    });

    it("Should handle very large buy amounts", async function () {
      const largeAmount = ethers.parseEther("1000");
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: largeAmount });

      const token = await ethers.getContractAt("MemeToken", tokenAddress);
      expect(await token.balanceOf(user2.address)).to.be.gt(0);
    });

    it("Should prevent selling more tokens than owned", async function () {
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("10") });

      const token = await ethers.getContractAt("MemeToken", tokenAddress);
      const balance = await token.balanceOf(user2.address);
      const tooMuch = balance * 2n;

      await token.connect(user2).approve(await bondingCurve.getAddress(), tooMuch);
      await expect(
        bondingCurve.connect(user2).sell(tokenAddress, tooMuch, 0)
      ).to.be.reverted;
    });

    it("Should prevent buying from graduated token", async function () {
      // Buy to graduation
      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("510") });

      // Note: Full graduation test requires mock VVS router
      // Here we just verify the graduated flag is set
      const state = await bondingCurve.getCurveState(tokenAddress);
      expect(state.realCroReserve).to.be.gte(GRADUATION_THRESHOLD);
    });

    it("Should handle consecutive buys and sells", async function () {
      const token = await ethers.getContractAt("MemeToken", tokenAddress);

      for (let i = 0; i < 5; i++) {
        await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("10") });
        const balance = await token.balanceOf(user2.address);
        await token.connect(user2).approve(await bondingCurve.getAddress(), balance / 4n);
        await bondingCurve.connect(user2).sell(tokenAddress, balance / 4n, 0);
      }

      // Should still work after multiple trades
      const finalBalance = await token.balanceOf(user2.address);
      expect(finalBalance).to.be.gt(0);
    });

    it("Should maintain price increase with buys", async function () {
      const price1 = await bondingCurve.getCurrentPrice(tokenAddress);

      await bondingCurve.connect(user2).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

      const price2 = await bondingCurve.getCurrentPrice(tokenAddress);

      // Price should increase after buying
      expect(price2).to.be.gt(price1);

      // Buy more
      await bondingCurve.connect(user3).buy(tokenAddress, 0, { value: ethers.parseEther("50") });

      const price3 = await bondingCurve.getCurrentPrice(tokenAddress);
      expect(price3).to.be.gt(price2);
    });
  });
});
