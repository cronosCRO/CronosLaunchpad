// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MemeToken is ERC20 {
    address public immutable factory;
    string public metadataURI;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        address factory_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        factory = factory_;
        metadataURI = metadataURI_;
        _mint(factory_, totalSupply_);
    }
}
