// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BondingCurve is ReentrancyGuard, Ownable {
    // Constants
    uint256 public constant INITIAL_VIRTUAL_CRO = 30 ether; // 30 CRO virtual reserve
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant GRADUATION_THRESHOLD = 500 ether; // 500 CRO to graduate
    uint256 public constant TRADING_FEE_BPS = 100; // 1% fee
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Addresses
    address public factory;
    address public migrator;
    address public feeRecipient;

    // Curve state per token
    struct Curve {
        uint256 virtualCroReserve;
        uint256 virtualTokenReserve;
        uint256 realCroReserve;
        uint256 tokensSold;
        address creator;
        bool initialized;
        bool graduated;
    }

    mapping(address => Curve) public curves;

    // Events
    event CurveInitialized(address indexed token, address indexed creator);
    event TokenBought(
        address indexed token,
        address indexed buyer,
        uint256 croIn,
        uint256 tokensOut,
        uint256 newPrice
    );
    event TokenSold(
        address indexed token,
        address indexed seller,
        uint256 tokensIn,
        uint256 croOut,
        uint256 newPrice
    );
    event ReadyToGraduate(address indexed token, uint256 croCollected);
    event MigratorUpdated(address oldMigrator, address newMigrator);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyMigrator() {
        require(msg.sender == migrator, "Only migrator");
        _;
    }

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    function setMigrator(address _migrator) external onlyOwner {
        emit MigratorUpdated(migrator, _migrator);
        migrator = _migrator;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function initializeCurve(address token, address creator) external onlyFactory {
        require(!curves[token].initialized, "Already initialized");

        curves[token] = Curve({
            virtualCroReserve: INITIAL_VIRTUAL_CRO,
            virtualTokenReserve: TOTAL_SUPPLY,
            realCroReserve: 0,
            tokensSold: 0,
            creator: creator,
            initialized: true,
            graduated: false
        });

        emit CurveInitialized(token, creator);
    }

    function buy(address token, uint256 minTokensOut) external payable nonReentrant {
        Curve storage curve = curves[token];
        require(curve.initialized && !curve.graduated, "Invalid curve state");
        require(msg.value > 0, "Zero CRO");

        // Calculate fee
        uint256 fee = (msg.value * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 croIn = msg.value - fee;

        // Calculate tokens out using constant product formula
        // (x + dx) * (y - dy) = x * y
        // dy = y - (x * y) / (x + dx)
        uint256 tokensOut = curve.virtualTokenReserve -
            (curve.virtualCroReserve * curve.virtualTokenReserve) /
            (curve.virtualCroReserve + croIn);

        require(tokensOut >= minTokensOut, "Slippage exceeded");
        require(tokensOut <= IERC20(token).balanceOf(address(this)), "Insufficient tokens");

        // Update curve state
        curve.virtualCroReserve += croIn;
        curve.virtualTokenReserve -= tokensOut;
        curve.realCroReserve += croIn;
        curve.tokensSold += tokensOut;

        // Transfer tokens to buyer
        IERC20(token).transfer(msg.sender, tokensOut);

        // Split fee between platform and creator
        uint256 creatorFee = fee / 2;
        uint256 platformFee = fee - creatorFee;

        (bool s1, ) = curve.creator.call{value: creatorFee}("");
        (bool s2, ) = feeRecipient.call{value: platformFee}("");
        require(s1 && s2, "Fee transfer failed");

        // Check if ready to graduate
        if (curve.realCroReserve >= GRADUATION_THRESHOLD) {
            emit ReadyToGraduate(token, curve.realCroReserve);
        }

        emit TokenBought(token, msg.sender, msg.value, tokensOut, getCurrentPrice(token));
    }

    function sell(address token, uint256 tokenAmount, uint256 minCroOut) external nonReentrant {
        Curve storage curve = curves[token];
        require(curve.initialized && !curve.graduated, "Invalid curve state");
        require(tokenAmount > 0, "Zero tokens");

        // Calculate CRO out using constant product formula
        // (x - dx) * (y + dy) = x * y
        // dx = x - (x * y) / (y + dy)
        uint256 croOut = curve.virtualCroReserve -
            (curve.virtualCroReserve * curve.virtualTokenReserve) /
            (curve.virtualTokenReserve + tokenAmount);

        require(croOut <= curve.realCroReserve, "Insufficient CRO reserve");

        // Calculate fee
        uint256 fee = (croOut * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 croOutAfterFee = croOut - fee;

        require(croOutAfterFee >= minCroOut, "Slippage exceeded");

        // Transfer tokens from seller first
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);

        // Update curve state
        curve.virtualCroReserve -= croOut;
        curve.virtualTokenReserve += tokenAmount;
        curve.realCroReserve -= croOut;
        curve.tokensSold -= tokenAmount;

        // Send CRO to seller
        (bool success, ) = msg.sender.call{value: croOutAfterFee}("");
        require(success, "CRO transfer failed");

        // Split fee between platform and creator
        uint256 creatorFee = fee / 2;
        uint256 platformFee = fee - creatorFee;

        (bool s1, ) = curve.creator.call{value: creatorFee}("");
        (bool s2, ) = feeRecipient.call{value: platformFee}("");
        require(s1 && s2, "Fee transfer failed");

        emit TokenSold(token, msg.sender, tokenAmount, croOutAfterFee, getCurrentPrice(token));
    }

    function getCurrentPrice(address token) public view returns (uint256) {
        Curve storage curve = curves[token];
        if (!curve.initialized || curve.virtualTokenReserve == 0) return 0;
        // Price = CRO per token (scaled by 1e18)
        return (curve.virtualCroReserve * 1e18) / curve.virtualTokenReserve;
    }

    function getTokensForCro(address token, uint256 croAmount) external view returns (uint256) {
        Curve storage curve = curves[token];
        if (!curve.initialized || curve.graduated) return 0;
        uint256 fee = (croAmount * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 croIn = croAmount - fee;
        return curve.virtualTokenReserve -
            (curve.virtualCroReserve * curve.virtualTokenReserve) /
            (curve.virtualCroReserve + croIn);
    }

    function getCroForTokens(address token, uint256 tokenAmount) external view returns (uint256) {
        Curve storage curve = curves[token];
        if (!curve.initialized || curve.graduated) return 0;
        uint256 croOut = curve.virtualCroReserve -
            (curve.virtualCroReserve * curve.virtualTokenReserve) /
            (curve.virtualTokenReserve + tokenAmount);
        uint256 fee = (croOut * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        return croOut - fee;
    }

    function getCurveState(address token) external view returns (
        uint256 virtualCroReserve,
        uint256 virtualTokenReserve,
        uint256 realCroReserve,
        uint256 tokensSold,
        uint256 currentPrice,
        uint256 progressBps,
        bool canGraduate
    ) {
        Curve storage curve = curves[token];
        virtualCroReserve = curve.virtualCroReserve;
        virtualTokenReserve = curve.virtualTokenReserve;
        realCroReserve = curve.realCroReserve;
        tokensSold = curve.tokensSold;
        currentPrice = getCurrentPrice(token);
        progressBps = (curve.realCroReserve * BPS_DENOMINATOR) / GRADUATION_THRESHOLD;
        canGraduate = curve.realCroReserve >= GRADUATION_THRESHOLD && !curve.graduated;
    }

    function graduate(address token) external onlyMigrator returns (uint256 croAmount, uint256 tokenAmount) {
        Curve storage curve = curves[token];
        require(curve.initialized && !curve.graduated, "Invalid state");
        require(curve.realCroReserve >= GRADUATION_THRESHOLD, "Not ready");

        curve.graduated = true;

        croAmount = curve.realCroReserve;
        tokenAmount = IERC20(token).balanceOf(address(this));

        // Transfer to migrator
        (bool success, ) = migrator.call{value: croAmount}("");
        require(success, "CRO transfer failed");
        IERC20(token).transfer(migrator, tokenAmount);
    }

    receive() external payable {}
}
