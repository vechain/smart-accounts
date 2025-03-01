// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./SimpleAccountV1.sol";

/**
 * @title SimpleAccountFactory
 * @notice Factory contract for smart accounts.
 * @dev A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 *
 * ---------- Version 2 ----------
 * - Added createAccountWithSalt and getAccountAddressWithSalt methods to allow for multiple accounts per owner.
 * - Added version() method to allow for versioning.
 * - Use new SimpleAccount implementation.
 * WARNING: when we upgraded this version we did not reinitialize the factory, so the account implementation is still v1
 */
contract SimpleAccountFactoryV2 is UUPSUpgradeable, AccessControlUpgradeable {
    event AccountCreated(SimpleAccountV1 account, address owner, uint256 salt);

    SimpleAccountV1 public accountImplementation;

    // ---------- Initialization ---------- //

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        accountImplementation = new SimpleAccountV1();
    }

    // ---------- Authorizers ---------- //

    /**
     * @dev Authorize the upgrade of the account
     * @param newImplementation the address of the new implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ---------- Setters ---------- //

    /**
     * @dev Create an account, and return its address.
     * Returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address even after account creation
     *
     * Notice: the salt is calculated internally from the owner address,
     * so the same owner will always get the same address.
     */
    function createAccount(address owner) public returns (SimpleAccountV1 ret) {
        uint256 salt = uint256(uint160(owner));
        address addr = getAccountAddress(owner);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccountV1(payable(addr));
        }

        emit AccountCreated(ret, owner, salt);

        ret = SimpleAccountV1(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccountV1.initialize, (owner))
                )
            )
        );
    }

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAccountAddress(address owner) public view returns (address) {
        uint256 salt = uint256(uint160(owner));
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(SimpleAccountV1.initialize, (owner))
                        )
                    )
                )
            );
    }

    /**
     * @dev Create an account, and return its address.
     * Returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address even after account creation
     */
    function createAccountWithSalt(
        address owner,
        uint256 salt
    ) public returns (SimpleAccountV1 ret) {
        address addr = getAccountAddress(owner);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccountV1(payable(addr));
        }

        emit AccountCreated(ret, owner, salt);

        ret = SimpleAccountV1(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccountV1.initialize, (owner))
                )
            )
        );
    }

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccountWithSalt()
     */
    function getAccountAddressWithSalt(
        address owner,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(SimpleAccountV1.initialize, (owner))
                        )
                    )
                )
            );
    }

    // ---------- Getters ---------- //

    /**
     * @dev Get the version of the factory
     * @return the version of the factory
     */
    function version() public pure returns (string memory) {
        return "2";
    }
}
