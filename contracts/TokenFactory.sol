// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MemeToken.sol";
import "./interfaces/IBondingCurve.sol";

contract TokenFactory is Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public creationFee = 1 ether; // 1 CRO

    address public bondingCurve;
    address public feeRecipient;
    address[] public allTokens;

    struct TokenInfo {
        address creator;
        string name;
        string symbol;
        string metadataURI;
        uint256 createdAt;
        bool graduated;
    }

    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => address[]) public creatorTokens;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI,
        uint256 timestamp
    );

    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(address _bondingCurve, address _feeRecipient) Ownable(msg.sender) {
        bondingCurve = _bondingCurve;
        feeRecipient = _feeRecipient;
    }

    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI
    ) external payable returns (address token) {
        require(msg.value >= creationFee, "Insufficient fee");
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Invalid name length");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Invalid symbol length");

        // Deploy new token
        token = address(new MemeToken(
            name,
            symbol,
            metadataURI,
            address(this),
            TOTAL_SUPPLY
        ));

        // Store info
        tokenInfo[token] = TokenInfo({
            creator: msg.sender,
            name: name,
            symbol: symbol,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            graduated: false
        });
        allTokens.push(token);
        creatorTokens[msg.sender].push(token);

        // Transfer tokens to bonding curve
        IERC20(token).transfer(bondingCurve, TOTAL_SUPPLY);

        // Initialize bonding curve for this token
        IBondingCurve(bondingCurve).initializeCurve(token, msg.sender);

        // Send fee to recipient
        (bool success, ) = feeRecipient.call{value: msg.value}("");
        require(success, "Fee transfer failed");

        emit TokenCreated(token, msg.sender, name, symbol, metadataURI, block.timestamp);
    }

    function markGraduated(address token) external {
        require(msg.sender == bondingCurve, "Only bonding curve");
        tokenInfo[token].graduated = true;
    }

    function setCreationFee(uint256 newFee) external onlyOwner {
        emit CreationFeeUpdated(creationFee, newFee);
        creationFee = newFee;
    }

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = _bondingCurve;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    function getTokensByRange(uint256 start, uint256 end) external view returns (address[] memory tokens) {
        require(start < end && end <= allTokens.length, "Invalid range");
        tokens = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            tokens[i - start] = allTokens[i];
        }
    }
}
