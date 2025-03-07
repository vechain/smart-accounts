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
 * - Renamed accountImplementation to accountImplementationV1 to increase clarity.
 * - Added accountImplementationV3 to store the v3 of the smart account implementation contract.
 * - Added b3tr token address, used to check if an account is legacy or not.
 * - version() returns an integer, instead of a string.
 * - Fixed: createAccountWithSalt() method was using the getAccountAddress() method instead of getAccountAddressWithSalt()
 * - Fixed: emit AccountCreated after the account is created, so the address is not 0
 * - Added helper getters: hasLegacyAccount(), upgradeRequired(), upgradeRequiredForAccount()
 * - Added createAccountWithVersion() method to create an account with a specific version (to be used for testing purposes during the upgrade).
 *
 * WARNING
 * Having a V3 of SimpleAccount means that the implementation address inside the factory changes, which causes the
 * address calculation through the "Create2" function to resolve to a different account.
 * This means that before that calling `getAccountAddress()` or `createAccount` will return
 * 2 different address before and after the upgrade.
 * To solve this an algoritm was wrote to calculate the correct address/implementation to use.
 * Rules:
 * - First we always calculate the address by using the V1 implementation address of SImpleAccount
 * - Then we check the following criteria:
 *      1) If the account is deployed we know it is legacy, so V1 implementation address is used.
 *      2) If the account is not deployed, we check if it has any balance of B3TR or VET balance, if it does,
 *      we know it is legacy so V1 implementation address is used.
 *      3) If none of the above, it means that the address generated through V1 Implementation was never
 *      used so we can use the V3 Simple Account implementation.
 * This way we can calculate the correct address/implementation to use for both legacy and new accounts.
 */
contract SimpleAccountFactory is UUPSUpgradeable, AccessControlUpgradeable {
    event AccountCreated(SimpleAccount account, address owner, uint256 salt);

    /// @notice The v1 of the simple account implementation (before any upgrade)
    SimpleAccount public accountImplementationV1;

    /// @notice The new version of the simple account implementation
    SimpleAccount public accountImplementationV3;

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
        address newImplementationV3,
        address b3trToken
    ) public reinitializer(3) {
        require(
            newImplementationV3 != address(0),
            "Invalid implementation address"
        );
        require(b3trToken != address(0), "Invalid B3TR token address");

        // Store the new implementation address
        accountImplementationV3 = SimpleAccount(payable(newImplementationV3));

        // Set the B3TR token address
        b3tr = IERC20(b3trToken);
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
     * This method returns an existing account address even after account creation
     *
     * @notice The salt is calculated internally from the owner address,
     * so the same owner will always get the same address.
     *
     * @notice The implementation address to use will be decided by checking if the address is legacy or not
     */
    function createAccount(
        address owner
    ) public returns (SimpleAccount createdAccount) {
        uint256 salt = uint256(uint160(owner));

        // Calculate address with V1 implementation first (same as getAccountAddress)
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

        // We also calculate the address with the V3 implementation (in case the account is V3)
        address addressGeneratedWithV3 = Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementationV3),
                        abi.encodeCall(SimpleAccount.initialize, (owner))
                    )
                )
            )
        );

        // We check if the account is legacy or not
        bool mustUseV1 = _mustUseV1Implementation(addressGeneratedWithV1);

        // Let's check if the account is already deployed (and we use V1 address or V3 address based on the legacy check)
        address simpleAccountAddress = mustUseV1
            ? address(addressGeneratedWithV1)
            : address(addressGeneratedWithV3);

        // Check if account already exists
        if (simpleAccountAddress.code.length > 0) {
            return SimpleAccount(payable(simpleAccountAddress));
        }

        // If the account is legacy, we use the V1 implementation address, otherwise we use the V3 implementation address
        address implementationToUse = mustUseV1
            ? address(accountImplementationV1)
            : address(accountImplementationV3);

        createdAccount = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    implementationToUse,
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );

        emit AccountCreated(createdAccount, owner, salt);
    }

    /**
     * @dev Create an account, and return its address.
     * Returns the address even if the account is already deployed.
     * This method returns an existing account address even after account creation
     *
     * @notice The implementation address to use will be decided by checking if
     * the address is legacy or not.
     */
    function createAccountWithSalt(
        address owner,
        uint256 salt
    ) public returns (SimpleAccount createdAccount) {
        // Calculate address with V1 implementation first (same as getAccountAddressWithSalt)
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

        // We also calculate the address with the V3 implementation (in case the account is V3)
        address addressGeneratedWithV3 = Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementationV3),
                        abi.encodeCall(SimpleAccount.initialize, (owner))
                    )
                )
            )
        );

        // We check if the account is legacy or not
        bool mustUseV1 = _mustUseV1Implementation(addressGeneratedWithV1);

        // Let's check if the account is already deployed (and we use V1 address or V3 address based on the legacy check)
        address simpleAccountAddress = mustUseV1
            ? address(addressGeneratedWithV1)
            : address(addressGeneratedWithV3);

        // Check if account already exists
        if (simpleAccountAddress.code.length > 0) {
            return SimpleAccount(payable(simpleAccountAddress));
        }

        // For legacy accounts, deploy with V1 implementation
        address implementationToUse = mustUseV1
            ? address(accountImplementationV1)
            : address(accountImplementationV3);

        createdAccount = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    implementationToUse,
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );

        emit AccountCreated(createdAccount, owner, salt);
    }

    /**
     * @dev Create an account with a specific implementation version, and return its address.
     * Returns the address even if the account is already deployed.
     *
     * @notice Warning: use this only for testing purposes.
     *
     * @param owner The owner of the account
     * @param _version The implementation version to use (1 or 3)
     * @return createdAccount The created account
     */
    function createAccountWithVersion(
        address owner,
        uint256 _version
    ) public returns (SimpleAccount createdAccount) {
        require(
            _version == 1 || _version == 3,
            "Only versions 1 and 3 are supported"
        );

        uint256 salt = uint256(uint160(owner));

        // Calculate address with the specified implementation
        address implementation = _version == 1
            ? address(accountImplementationV1)
            : address(accountImplementationV3);

        address accountAddress = Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        implementation,
                        abi.encodeCall(SimpleAccount.initialize, (owner))
                    )
                )
            )
        );

        // Check if account already exists
        if (accountAddress.code.length > 0) {
            return SimpleAccount(payable(accountAddress));
        }

        // Deploy with specified implementation
        createdAccount = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    implementation,
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );

        emit AccountCreated(createdAccount, owner, salt);
    }

    // ---------- Getters ---------- //

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccount()
     *
     * @notice When this contract was upgraded to V3, we had to change the address of the account implementation,
     * so we need to check through different scenarios if the the account is legacy or not.
     * Rules:
     * - We always use the V1 implementation address to calculate the counterfactual address.
     * - We run a few checks though _getImplementationToUse() to determine if the account is legacy or not, which will return the V1 implementation address if it is.
     */
    function getAccountAddress(address owner) public view returns (address) {
        uint256 salt = uint256(uint160(owner));

        // Always calculate with V1 implementation first
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

        // If it's a legacy account, return the V1 address
        if (_mustUseV1Implementation(addressGeneratedWithV1)) {
            return addressGeneratedWithV1;
        }

        // For new accounts, calculate with V3 implementation
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementationV3),
                            abi.encodeCall(SimpleAccount.initialize, (owner))
                        )
                    )
                )
            );
    }

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccountWithSalt()
     * * Rules:
     * - We always use the V1 implementation address to calculate the counterfactual address.
     * - We run a few checks though _getImplementationToUse() to determine if the account is legacy or not, which will return the V1 implementation address if it is.
     */
    function getAccountAddressWithSalt(
        address owner,
        uint256 salt
    ) public view returns (address) {
        // Always calculate with V1 implementation first
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

        // If it's a legacy account, return the V1 address
        if (_mustUseV1Implementation(addressGeneratedWithV1)) {
            return addressGeneratedWithV1;
        }

        // For new accounts, calculate with V3 implementation
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementationV3),
                            abi.encodeCall(SimpleAccount.initialize, (owner))
                        )
                    )
                )
            );
    }

    /**
     * @dev Check if an owner has a legacy account
     * @param owner The address of the owner
     * @return True if the account is legacy, false otherwise
     */
    function hasLegacyAccount(address owner) public view returns (bool) {
        uint256 salt = uint256(uint160(owner));
        address accountAddressGeneratedWithV1 = Create2.computeAddress(
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
        return _mustUseV1Implementation(accountAddressGeneratedWithV1);
    }

    /**
     * @dev Check if an account is legacy
     * - If the account is deployed we know it is legacy, so V1 implementation address is returned.
     * - If the account is not deployed, we check if it has any balance of B3TR or VET tokens, if it does, we know it is legacy (so V1 implementation address is returned).
     * - Otherwise, we know it is not legacy, and we can use the V3 implementation address to calculate the counterfactual address.
     * @param accountAddressGeneratedWithV1 The address to check
     * @return True if the account is legacy, false otherwise
     */
    function _mustUseV1Implementation(
        address accountAddressGeneratedWithV1
    ) internal view returns (bool) {
        if (accountAddressGeneratedWithV1.code.length > 0) {
            return true;
        }

        // If not deployed but has B3TR or ETH tokens, consider it legacy
        return
            b3tr.balanceOf(accountAddressGeneratedWithV1) > 0 ||
            address(accountAddressGeneratedWithV1).balance > 0;
    }

    /**
     * @dev A helper function that calculates the version of an account (even if it is not deployed yet)
     * @notice Since it is needed to mantain backwards compatibility with V1 accounts, this should
     * be used to know what version an account is when it is not deployed yet.
     * @notice This function is intended for accounts generated without custom salt.
     *
     * @param account The address of the account
     * @param owner The owner of the account
     * @return accountVersion The version of the account
     * @return isDeployed True if the account is deployed, false otherwise
     */
    function getAccountVersion(
        address account,
        address owner
    ) public view returns (uint256 accountVersion, bool isDeployed) {
        address calculatedAddress = getAccountAddress(owner);
        require(
            calculatedAddress == account,
            "Account address does not match calculated address of owner"
        );

        // check if the account is deployed
        isDeployed = account.code.length > 0;

        // if it is not deployed, check if it is legacy
        if (!isDeployed) {
            bool isLegacy = hasLegacyAccount(owner);

            if (isLegacy) {
                accountVersion = 1;
            } else {
                accountVersion = currentAccountImplementationVersion();
            }
            return (accountVersion, isDeployed);
        }

        // if it is deployed, let's call the version() method of the account
        try SimpleAccount(payable(account)).version() returns (
            uint256 _accountVersion
        ) {
            accountVersion = _accountVersion;
        } catch {
            // if it reverts, it means it is a V1 account, because V1 accounts do not have the version() method
            accountVersion = 1;
        }
        return (accountVersion, isDeployed);
    }

    /**
     * @dev Get the current version of the account implementation
     * @return The current version of the account implementation
     */
    function currentAccountImplementationVersion()
        public
        view
        returns (uint256)
    {
        return
            SimpleAccount(payable(address(accountImplementationV3))).version();
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
        return address(accountImplementationV3);
    }

    /**
     * @dev Check if an account needs to be upgraded to a specific version. Similar to
     * @notice Only works for already deployed accounts
     * @notice Does not work for accounts generated through custom salt
     *
     * @param accountAddress The address to check
     * @param targetVersion The version to check against
     * @return True if the account needs to be upgraded to the target version, false otherwise
     */
    function upgradeRequiredForAccount(
        address accountAddress,
        uint256 targetVersion
    ) public view returns (bool) {
        if (targetVersion == 0) {
            targetVersion = currentAccountImplementationVersion();
        } else {
            require(
                targetVersion <= currentAccountImplementationVersion(),
                "Target version must be less than or equal to the current version"
            );
        }

        if (accountAddress.code.length == 0) {
            return false; // Not deployed yet, no upgrade needed
        }

        // Check the version of the deployed account
        try SimpleAccount(payable(accountAddress)).version() returns (
            uint256 accountVersion
        ) {
            if (accountVersion == targetVersion) {
                return false; // Already at target version, no upgrade needed
            }

            if (accountVersion < targetVersion) {
                return true; // Needs upgrade to target version
            }

            return false; // Already at a higher version, no upgrade needed
        } catch {
            return true; // V1 accounts will fail version check, so they need upgrade
        }
    }

    /**
     * @dev A helper to check if an account needs to be upgraded to a specific version
     * @notice This function is NOT intended to be used for accounts generated with custom salt.
     * @notice This function will return TRUE for not deployed accounts, use
     *
     * @param account The address of the account
     * @param owner The owner of the account
     * @param targetVersion The version to check against, if 0 then it will check against the latest version
     * @return True if the account needs to be upgraded to the target version, false otherwise
     */
    function upgradeRequired(
        address account,
        address owner,
        uint256 targetVersion
    ) public view returns (bool) {
        if (targetVersion == 0) {
            targetVersion = currentAccountImplementationVersion();
        } else {
            require(
                targetVersion <= currentAccountImplementationVersion(),
                "Target version must be less than or equal to the current version"
            );
        }

        address calculatedAddress = getAccountAddress(owner);
        require(
            calculatedAddress == account,
            "Account address does not match calculated address of owner"
        );

        // If the account is not deployed
        if (account.code.length == 0) {
            // legacy accounts need to be upgraded
            return hasLegacyAccount(owner);
        }

        return upgradeRequiredForAccount(account, targetVersion);
    }
}
