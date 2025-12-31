// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IVVSRouter.sol";
import "./interfaces/IBondingCurve.sol";

contract LiquidityMigrator is ReentrancyGuard, Ownable {
    // VVS Finance addresses on Cronos Mainnet
    address public constant VVS_FACTORY = 0x3B44B2a187a7b3824131F8db5a74194D0a42Fc15;
    address public constant VVS_ROUTER = 0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae;
    address public constant WCRO = 0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 public migrationFee = 3 ether; // 3 CRO platform fee

    address public bondingCurve;
    address public factory;
    address public feeRecipient;

    mapping(address => address) public tokenToVVSPair;
    address[] public graduatedTokens;

    event TokenGraduated(
        address indexed token,
        address indexed vvsPair,
        uint256 croLiquidity,
        uint256 tokenLiquidity,
        uint256 lpTokensBurned
    );
    event MigrationFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(address _bondingCurve, address _factory, address _feeRecipient) Ownable(msg.sender) {
        bondingCurve = _bondingCurve;
        factory = _factory;
        feeRecipient = _feeRecipient;
    }

    function migrate(address token) external nonReentrant {
        require(tokenToVVSPair[token] == address(0), "Already migrated");

        // Get funds from bonding curve
        (uint256 croAmount, uint256 tokenAmount) = IBondingCurve(bondingCurve).graduate(token);

        require(croAmount > migrationFee, "Insufficient CRO for migration");

        // Deduct migration fee
        uint256 croForLiquidity = croAmount - migrationFee;

        // Approve router to spend tokens
        IERC20(token).approve(VVS_ROUTER, tokenAmount);

        // Add liquidity to VVS Finance
        (uint256 amountToken, uint256 amountCro, uint256 liquidity) = IVVSRouter(VVS_ROUTER)
            .addLiquidityETH{value: croForLiquidity}(
                token,
                tokenAmount,
                0, // Accept any amount of tokens
                0, // Accept any amount of CRO
                address(this),
                block.timestamp + 300
            );

        // Get pair address
        address pair = IVVSFactory(VVS_FACTORY).getPair(token, WCRO);
        require(pair != address(0), "Pair not created");
        tokenToVVSPair[token] = pair;
        graduatedTokens.push(token);

        // Burn LP tokens permanently (send to dead address)
        IERC20(pair).transfer(DEAD_ADDRESS, liquidity);

        // Send migration fee to platform
        (bool success, ) = feeRecipient.call{value: migrationFee}("");
        require(success, "Fee transfer failed");

        // Burn any remaining tokens (rounding leftovers)
        uint256 remainingTokens = IERC20(token).balanceOf(address(this));
        if (remainingTokens > 0) {
            IERC20(token).transfer(DEAD_ADDRESS, remainingTokens);
        }

        // Refund any remaining CRO (shouldn't happen but safety)
        uint256 remainingCro = address(this).balance;
        if (remainingCro > 0) {
            (bool s, ) = feeRecipient.call{value: remainingCro}("");
            require(s, "Refund failed");
        }

        emit TokenGraduated(token, pair, amountCro, amountToken, liquidity);
    }

    function canMigrate(address token) external view returns (bool) {
        if (tokenToVVSPair[token] != address(0)) return false;
        (,, uint256 realCroReserve,,,, bool graduated) = IBondingCurve(bondingCurve).curves(token);
        return realCroReserve >= 500 ether && !graduated;
    }

    function getGraduatedTokens() external view returns (address[] memory) {
        return graduatedTokens;
    }

    function getGraduatedTokenCount() external view returns (uint256) {
        return graduatedTokens.length;
    }

    function setMigrationFee(uint256 newFee) external onlyOwner {
        emit MigrationFeeUpdated(migrationFee, newFee);
        migrationFee = newFee;
    }

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = _bondingCurve;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    receive() external payable {}
}
