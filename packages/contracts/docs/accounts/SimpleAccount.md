# Solidity API

## SimpleAccount

This is a minimal smart account that can have a single owner, and execute transactions on behalf of the owner,
through a direct call or through a signature.

_Can be upgraded by the owner.

---------- Version 2 ----------
- Added version() method to allow for versioning.
- Added transferOwnership method to allow for ownership transfer of the smart account.

---------- Version 3 ----------
- Added executeBatchWithAuthorization() method, so multiple clauses can be signed at once.
- Using nonces in new executeBatchWithAuthorization() method to prevent replay attacks (executeWithAuthorization() remains without nonces for backwards compatibility).
- version() returns an integer, instead of a string._

### owner

```solidity
address owner
```

### usedNonces

```solidity
mapping(bytes32 => bool) usedNonces
```

### SimpleAccountInitialized

```solidity
event SimpleAccountInitialized(address owner)
```

### constructor

```solidity
constructor() public
```

### version

```solidity
function version() public pure returns (uint256)
```

### initialize

```solidity
function initialize(address anOwner) public virtual
```

_Initialize the account with the owner_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| anOwner | address | the owner (signer) of this account |

### _initialize

```solidity
function _initialize(address anOwner) internal virtual
```

_Internal function to initialize the account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| anOwner | address | the owner (signer) of this account |

### onlyOwner

```solidity
modifier onlyOwner()
```

_Modifier to check if the caller is the owner_

### _onlyOwner

```solidity
function _onlyOwner() internal view
```

_Internal function to check if the caller is the owner
This can be used when we want to allow both direct calls from the owner, and calls from the account or smart contract (using signatures)_

### _requireFromOwner

```solidity
function _requireFromOwner() internal view
```

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal view
```

_Authorize the upgrade of the account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | the address of the new implementation |

### execute

```solidity
function execute(address dest, uint256 value, bytes func) external
```

_Execute a transaction (called directly from owner)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dest | address | destination address to call |
| value | uint256 | the value to pass in this call |
| func | bytes | the calldata to pass in this call |

### executeBatch

```solidity
function executeBatch(address[] dest, uint256[] value, bytes[] func) external
```

_execute a sequence of transactions
to reduce gas consumption for trivial case (no value), use a zero-length array to mean zero value_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dest | address[] | an array of destination addresses |
| value | uint256[] | an array of values to pass to each call. can be zero-length for no-value calls |
| func | bytes[] | an array of calldata to pass to each call |

### executeWithAuthorization

```solidity
function executeWithAuthorization(address to, uint256 value, bytes data, uint256 validAfter, uint256 validBefore, bytes signature) external payable
```

There is an attack vector here, by replaying the same signature on the same account.

_execute a transaction (called directly from owner) authorized via signatures_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | destination address to call |
| value | uint256 | the value to pass in this call |
| data | bytes | the calldata to pass in this call |
| validAfter | uint256 | unix timestamp after which the signature will be accepted |
| validBefore | uint256 | unix timestamp until the signature will be accepted |
| signature | bytes | the signed type4 signature |

### executeBatchWithAuthorization

```solidity
function executeBatchWithAuthorization(address[] to, uint256[] value, bytes[] data, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) external payable
```

_execute multiple transactions (called directly from owner) authorized via signatures_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address[] | an array of destination addresses |
| value | uint256[] | an array of values to pass to each call |
| data | bytes[] | an array of calldata to pass to each call |
| validAfter | uint256 | an unix timestamp after which the signature will be accepted |
| validBefore | uint256 | an unix timestamp until the signature will be accepted |
| nonce | bytes32 | the nonce to use for the batch |
| signature | bytes | the signed type4 signature for the entire batch |

### transferOwnership

```solidity
function transferOwnership(address newOwner) public
```

_Transfer ownership of the account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newOwner | address | the new owner of the account |

### _validateBatchAuthorization

```solidity
function _validateBatchAuthorization(address[] to, uint256[] value, bytes[] data, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) internal view
```

The array encoding follows EIP-712 standard for arrays:
- For dynamic types (like bytes[]), each element is hashed individually first
- Arrays are encoded by first encoding their elements, then hashing the concatenation
This matches how ethers.js implements array encoding in signTypedData
See: https://eips.ethereum.org/EIPS/eip-712#definition-of-encodedata

_Validate a batch authorization_

### _validateAuthorization

```solidity
function _validateAuthorization(address to, uint256 value, bytes data, uint256 validAfter, uint256 validBefore, bytes signature) internal view
```

_Validate a single authorization_

### _call

```solidity
function _call(address target, uint256 value, bytes data) internal
```

_Internal function to call a target_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | address | the target address to call |
| value | uint256 | the value to pass in this call |
| data | bytes | the calldata to pass in this call |

### receive

```solidity
receive() external payable
```

