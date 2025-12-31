// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBondingCurve {
    function initializeCurve(address token, address creator) external;
    function graduate(address token) external returns (uint256 croAmount, uint256 tokenAmount);
    function curves(address token) external view returns (
        uint256 virtualCroReserve,
        uint256 virtualTokenReserve,
        uint256 realCroReserve,
        uint256 tokensSold,
        address creator,
        bool initialized,
        bool graduated
    );
}
