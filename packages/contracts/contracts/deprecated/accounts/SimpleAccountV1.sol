// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "../core/Helpers.sol";
import "../../accounts/callback/TokenCallbackHandler.sol";
import "../core/UserOperationLib.sol";

/**
 * minimal account.
 *  this is sample minimal account.
 *  has execute, eth handling methods.
 */
contract SimpleAccountV1 is
    Initializable,
    TokenCallbackHandler,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using UserOperationLib for PackedUserOperation;

    address public owner;

    event SimpleAccountInitialized(address indexed owner);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor() {
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        //directly from EOA owner, or through the account itself (which gets redirected through execute())
        require(
            msg.sender == owner || msg.sender == address(this),
            "only owner"
        );
    }

    /**
     * execute a transaction (called directly from owner)
     * @param dest destination address to call
     * @param value the value to pass in this call
     * @param func the calldata to pass in this call
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromOwner();
        _call(dest, value, func);
    }

    /**
     * @dev execute a transaction (called directly from owner) authorized via signatures
     
     * @param to destination address to call
     * @param value the value to pass in this call
     * @param data the calldata to pass in this call
     * @param validAfter unix timestamp after which the signature will be accepted
     * @param validBefore unix timestamp until the signature will be accepted
     * @param signature the signed type4 signature
     */
    function executeWithAuthorization(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 validAfter,
        uint256 validBefore,
        bytes calldata signature
    ) external payable {
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");

        /**
         * verify that the signature did sign the function call
         */
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ExecuteWithAuthorization(address to,uint256 value,bytes data,uint256 validAfter,uint256 validBefore)"
                ),
                to,
                value,
                keccak256(data),
                validAfter,
                validBefore
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        address recoveredAddress = ECDSA.recover(digest, signature);
        require(recoveredAddress == owner, "Invalid signer");

        // execute the instruction
        _call(to, value, data);
    }

    /**
     * @dev execute a sequence of transactions
     * @dev to reduce gas consumption for trivial case (no value), use a zero-length array to mean zero value
     * @param dest an array of destination addresses
     * @param value an array of values to pass to each call. can be zero-length for no-value calls
     * @param func an array of calldata to pass to each call
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external {
        _requireFromOwner();
        require(
            dest.length == func.length &&
                (value.length == 0 || value.length == func.length),
            "wrong array lengths"
        );
        if (value.length == 0) {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], 0, func[i]);
            }
        } else {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], value[i], func[i]);
            }
        }
    }

    /**
     * @param anOwner the owner (signer) of this account

     */
    function initialize(address anOwner) public virtual initializer {
        _initialize(anOwner);
        __EIP712_init("Wallet", "1");
        __UUPSUpgradeable_init();
    }

    function _initialize(address anOwner) internal virtual {
        owner = anOwner;
        emit SimpleAccountInitialized(owner);
    }

    // Require the function call went through owner
    function _requireFromOwner() internal view {
        require(msg.sender == owner, "account: not Owner or EntryPoint");
    }

    /// implement template method of BaseAccount
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual returns (uint256 validationData) {
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        if (owner != ECDSA.recover(hash, userOp.signature))
            return SIG_VALIDATION_FAILED;
        return SIG_VALIDATION_SUCCESS;
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view override {
        (newImplementation);
        _onlyOwner();
    }
}
