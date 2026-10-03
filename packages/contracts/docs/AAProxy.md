# Solidity API

## AAProxy

Forked from OZ.

_This contract implements an upgradeable proxy.
It is upgradeable because calls are delegated to an implementation address that can be changed. This address is stored in storage
in the location specified by https://eips.ethereum.org/EIPS/eip-1967[EIP1967],
so that it doesn't conflict with the storage layout of the implementation behind the proxy._

### constructor

```solidity
constructor(address implementation, bytes _data) public payable
```

_Initializes the upgradeable proxy with an initial implementation specified by `implementation`.

If `_data` is nonempty, it's used as data in a delegate call to `implementation`. This will typically be an
encoded function call, and allows initializing the storage of the proxy like a Solidity constructor.

Requirements:

- If `_data` is empty, `msg.value` must be zero._

### _implementation

```solidity
function _implementation() internal view virtual returns (address)
```

_Returns the current implementation address.

TIP: To get this value clients can read directly from the storage slot shown below (specified by EIP1967) using
the https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`_

