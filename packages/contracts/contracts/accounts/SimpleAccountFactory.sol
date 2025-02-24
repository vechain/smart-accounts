// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./SimpleAccount.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
 *
 * WARNING: when we upgraded this version we did not reinitialize the factory, so the account implementation is still v1
 *
 * ---------- Version 3 ----------
 * - Deploy v3 of SimpleAccount implementation and reinitialize the factory.
 * - Added event ContractReinitialized(uint256 version) to reinitialization of the factory.
 * - Added currentAccountImplementationVersion() method to know current version of the account implementation.
 * - Renamed accountImplementation to accountImplementationV1 to make it clear that it is the v1 of the account implementation.
 * - Added accountImplementations array to store all versions of the account implementation.
 * - Added b3tr token address to the factory to be used to check if an account is legacy or not.
 * - Return integer in version(), instead of string.
 * - Fixed: createAccountWithSalt() method was using the getAccountAddress() method instead of getAccountAddressWithSalt() to calculate the address,
 * - Fixed: emit AccountCreated after the account is created, so the address is not 0.
 *
 * WARNING: in order to mantain legacy account addresses, we had to add new checks when calculating them:
 * since changing the implementation address also changes the address of the account, we need to make sure that all
 * previous created accounts will return the address generated with V1 of the SimpleAccount implementation.
 * Unfortunately, addresses can be calculated and used to receive assets but not created, so we cannot know
 * if an account is legacy or not until it is created. One thing we know though is that this factory was only
 * used by X2Earn Applications of VeBetterDAO until V3, which only purpose is to rewards users with B3TR tokens.
 * So we are using this information as an additional criteria to identify legacy accounts.
 */
contract SimpleAccountFactory is UUPSUpgradeable, AccessControlUpgradeable {
    event AccountCreated(SimpleAccount account, address owner, uint256 salt);
    event ContractReinitialized(uint256 version);

    /// @notice The v1 of the simple account implementation (before any upgrade)
    SimpleAccount public accountImplementationV1;

    /// @notice The new versions of the simple account implementation
    SimpleAccount[] public accountImplementations;

    /// @notice The B3TR token used as reward for the users in VeBetterDAO
    IERC20 public b3tr;

    // ---------- Initialization ---------- //

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Get the version of the factory
     * @return the version of the factory
     */
    function version() public pure returns (uint256) {
        return 3;
    }

    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        accountImplementationV1 = new SimpleAccount();
    }

    function initializeV3(
        address newImplementation,
        address b3trToken
    ) public reinitializer(3) {
        // Store the old implementation first
        accountImplementations.push(accountImplementationV1); // v1
        // Push the old implementation as v2 because we did not reinitialize the factory in SA upgrade
        accountImplementations.push(accountImplementationV1); // v2

        // Then push the new implementation as latest version
        SimpleAccount newAccountImplementation = SimpleAccount(
            payable(newImplementation)
        );
        accountImplementations.push(newAccountImplementation); // v3

        // Set the B3TR token address
        b3tr = IERC20(b3trToken);

        emit ContractReinitialized(3);
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
    function createAccount(address owner) public returns (SimpleAccount ret) {
        uint256 salt = uint256(uint160(owner));
        address addr = getAccountAddress(owner);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }

        ret = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    _getImplementationToUse(addr),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );

        emit AccountCreated(ret, owner, salt);
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
    ) public returns (SimpleAccount ret) {
        address addr = getAccountAddressWithSalt(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }

        emit AccountCreated(ret, owner, salt);

        ret = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    _getImplementationToUse(addr),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );
    }

    // ---------- Getters ---------- //

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccount()
     *
     * @notice When this contract was upgraded to V3, we had to change the address of the account implementation,
     * so we need to check through different scenarios if the the account is legacy or not.
     * Rules:
     * - We always use the V1 implementation address to calculate the counterfactual address.
     * - If the account is deployed we know it is legacy.
     * - If the account is not deployed, we check if it has any balance of B3TR tokens, if it does, we know it is legacy.
     * - Otherwise, we know it is not legacy, and we can use the V3 implementation address to calculate the counterfactual address.
     */
    function getAccountAddress(address owner) public view returns (address) {
        uint256 salt = uint256(uint160(owner));

        address addressGeneratedWithV1 = Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementationV1),
                        abi.encodeCall(SimpleAccount.initialize, (owner))
                    )
                )
            )
        );

        address actualAddress = Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        _getImplementationToUse(addressGeneratedWithV1),
                        abi.encodeCall(SimpleAccount.initialize, (owner))
                    )
                )
            )
        );
        return actualAddress;
    }

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccountWithSalt()
     */
    function getAccountAddressWithSalt(
        address owner,
        uint256 salt
    ) public view returns (address) {
        address addressGeneratedWithV1 = Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementationV1),
                        abi.encodeCall(SimpleAccount.initialize, (owner))
                    )
                )
            )
        );

        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            _getImplementationToUse(addressGeneratedWithV1),
                            abi.encodeCall(SimpleAccount.initialize, (owner))
                        )
                    )
                )
            );
    }

    /**
     * @dev Internal function to determine which implementation address to use
     * @param accountAddress The address to check
     * @return The implementation address to use
     */
    function _getImplementationToUse(
        address accountAddress
    ) internal view returns (address) {
        // If the account is deployed, it's legacy
        if (accountAddress.code.length > 0) {
            return address(accountImplementationV1);
        }

        // If it has B3TR balance, it's legacy
        if (b3tr.balanceOf(accountAddress) > 0) {
            return address(accountImplementationV1);
        }

        // Otherwise use latest implementation
        return
            address(accountImplementations[accountImplementations.length - 1]);
    }

    /// @notice Returns the current version of the account implementation
    function currentAccountImplementationVersion()
        public
        view
        returns (uint256)
    {
        return
            SimpleAccount(
                payable(
                    address(
                        accountImplementations[
                            accountImplementations.length - 1
                        ]
                    )
                )
            ).version();
    }

    /**
     * @dev Get the current version of the account implementation
     * @return The current version of the account implementation
     */
    function currentAccountImplementationAddress()
        public
        view
        returns (address)
    {
        return
            address(accountImplementations[accountImplementations.length - 1]);
    }
}
