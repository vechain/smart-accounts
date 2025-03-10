# Solidity API

## SimpleAccountFactory

Factory contract for smart accounts.

\_A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
The factory's createAccount returns the target account address even if it is already installed.

---------- Version 2 ----------

- Added createAccountWithSalt and getAccountAddressWithSalt methods to allow for multiple accounts per owner.
- Added version() method to allow for versioning.
- Use new SimpleAccount implementation.

WARNING: when we upgraded this version we did not reinitialize the factory, so the account implementation is still v1

---------- Version 3 ----------

- Deploy v3 of SimpleAccount implementation and reinitialize the factory.
- Added event ContractReinitialized(uint256 version) to reinitialization of the factory.
- Added currentAccountImplementationVersion() method to know current version of the account implementation.
- Renamed accountImplementation to accountImplementationV1 to increase clarity.
- Added accountImplementationV3 to store the v3 of the smart account implementation contract.
- Added b3tr token address, used to check if an account is legacy or not.
- Added isLegacyAccount() method to check if an account is legacy or not.
- version() returns an integer, instead of a string.
- Fixed: createAccountWithSalt() method was using the getAccountAddress() method instead of getAccountAddressWithSalt()
- Fixed: emit AccountCreated after the account is created, so the address is not 0

WARNING
Having a V3 of SimpleAccount means that the implementation address inside the factory changes, which causes the
address calculation through the "Create2" function to resolve to a different account.
This means that before that calling `getAccountAddress()` or `createAccount` will return
2 different address before and after the upgrade.
To solve this an algoritm was wrote to calculate the correct address/implementation to use.
Rules:

- First we always calculate the address by using the V1 implementation address of SImpleAccount
- Then we check the following criteria: 1) If the account is deployed we know it is legacy, so V1 implementation address is used. 2) If the account is not deployed, we check if it has any balance of B3TR or VET balance, if it does,
  we know it is legacy so V1 implementation address is used. 3) If none of the above, it means that the address generated through V1 Implementation was never
  used so we can use the V3 Simple Account implementation.
  This way we can calculate the correct address/implementation to use for both legacy and new accounts.\_

### AccountCreated

```solidity
event AccountCreated(contract SimpleAccount account, address owner, uint256 salt)
```

### ContractReinitialized

```solidity
event ContractReinitialized(uint256 version)
```

### accountImplementationV1

```solidity
contract SimpleAccount accountImplementationV1
```

The v1 of the simple account implementation (before any upgrade)

### accountImplementationV3

```solidity
contract SimpleAccount accountImplementationV3
```

The new version of the simple account implementation

### b3tr

```solidity
contract IERC20 b3tr
```

The B3TR token used as reward for the users in VeBetterDAO

### constructor

```solidity
constructor() public
```

### version

```solidity
function version() public pure returns (uint256)
```

_Get the version of the factory_

#### Return Values

| Name | Type    | Description                |
| ---- | ------- | -------------------------- |
| [0]  | uint256 | the version of the factory |

### initialize

```solidity
function initialize() public
```

### initializeV3

```solidity
function initializeV3(address newImplementationV3, address b3trToken) public
```

### \_authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal virtual
```

_Authorize the upgrade of the account_

#### Parameters

| Name              | Type    | Description                           |
| ----------------- | ------- | ------------------------------------- |
| newImplementation | address | the address of the new implementation |

### createAccount

```solidity
function createAccount(address owner) public returns (contract SimpleAccount createdAccount)
```

The salt is calculated internally from the owner address,
so the same owner will always get the same address.

The implementation address to use will be decided by checking if the address is legacy or not

_Create an account, and return its address.
Returns the address even if the account is already deployed.
This method returns an existing account address even after account creation_

### createAccountWithSalt

```solidity
function createAccountWithSalt(address owner, uint256 salt) public returns (contract SimpleAccount createdAccount)
```

The implementation address to use will be decided by checking if
the address is legacy or not.

_Create an account, and return its address.
Returns the address even if the account is already deployed.
This method returns an existing account address even after account creation_

### getAccountAddress

```solidity
function getAccountAddress(address owner) public view returns (address)
```

When this contract was upgraded to V3, we had to change the address of the account implementation,
so we need to check through different scenarios if the the account is legacy or not.
Rules:

- We always use the V1 implementation address to calculate the counterfactual address.
- We run a few checks though \_getImplementationToUse() to determine if the account is legacy or not, which will return the V1 implementation address if it is.

_Calculate the counterfactual address of this account as it would be returned by createAccount()_

### getAccountAddressWithSalt

```solidity
function getAccountAddressWithSalt(address owner, uint256 salt) public view returns (address)
```

\_Calculate the counterfactual address of this account as it would be returned by createAccountWithSalt()

- Rules:

* We always use the V1 implementation address to calculate the counterfactual address.
* We run a few checks though _getImplementationToUse() to determine if the account is legacy or not, which will return the V1 implementation address if it is._

### \_mustUseV1Implementation

```solidity
function _mustUseV1Implementation(address accountAddressGeneratedWithV1) internal view returns (bool)
```

\_Check if an account is legacy

- If the account is deployed we know it is legacy, so V1 implementation address is returned.
- If the account is not deployed, we check if it has any balance of B3TR or VET tokens, if it does, we know it is legacy (so V1 implementation address is returned).
- Otherwise, we know it is not legacy, and we can use the V3 implementation address to calculate the counterfactual address.\_

#### Parameters

| Name                          | Type    | Description          |
| ----------------------------- | ------- | -------------------- |
| accountAddressGeneratedWithV1 | address | The address to check |

#### Return Values

| Name | Type | Description                                    |
| ---- | ---- | ---------------------------------------------- |
| [0]  | bool | True if the account is legacy, false otherwise |

### currentAccountImplementationVersion

```solidity
function currentAccountImplementationVersion() public view returns (uint256)
```

_Get the current version of the account implementation_

#### Return Values

| Name | Type    | Description                                       |
| ---- | ------- | ------------------------------------------------- |
| [0]  | uint256 | The current version of the account implementation |

### currentAccountImplementationAddress

```solidity
function currentAccountImplementationAddress() public view returns (address)
```

_Get the current version of the account implementation_

#### Return Values

| Name | Type    | Description                                       |
| ---- | ------- | ------------------------------------------------- |
| [0]  | address | The current version of the account implementation |

### upgradeRequiredForAccount

```solidity
function upgradeRequiredForAccount(address accountAddress, uint256 targetVersion) public view returns (bool)
```

_Check if an account needs to be upgraded to a specific version_

#### Parameters

| Name           | Type    | Description                  |
| -------------- | ------- | ---------------------------- |
| accountAddress | address | The address to check         |
| targetVersion  | uint256 | The version to check against |

#### Return Values

| Name | Type | Description                                                                     |
| ---- | ---- | ------------------------------------------------------------------------------- |
| [0]  | bool | True if the account needs to be upgraded to the target version, false otherwise |
