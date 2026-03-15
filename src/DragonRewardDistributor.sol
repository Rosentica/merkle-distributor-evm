// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title DragonRewardDistributor
 * @notice Distributes DRAGON token rewards to holders via Merkle-based claims.
 *         Owner deposits tokens → 20% burned, 80% held for distribution.
 *         Operator updates Merkle root after off-chain snapshot + tree generation.
 *         Users claim their cumulative allocation with a Merkle proof.
 */
contract DragonRewardDistributor {
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant BURN_PERCENTAGE = 20;

    address public owner;
    address public operator;
    address public targetToken;
    bool public paused;
    bool public initialized;

    uint256 public currentEpoch;
    bytes32 public merkleRoot;
    uint256 public lastDistributionTime;

    mapping(address => uint256) public totalClaimed;
    mapping(address => bool) public isDepositor;
    mapping(bytes32 => bool) public processedDeposits;

    event TokensDeposited(address indexed depositor, uint256 totalAmount, uint256 burned, uint256 forDistribution);
    event DepositorUpdated(address indexed depositor, bool allowed);
    event MerkleRootUpdated(uint256 indexed epoch, bytes32 merkleRoot, bytes32 depositTxHash, uint256 timestamp);
    event Claimed(address indexed user, uint256 amount, uint256 cumulativeTotal);
    event TargetTokenSet(address indexed token);
    event OperatorSet(address indexed operator);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool paused);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error ContractPaused();
    error TargetTokenNotSet();
    error InvalidMerkleProof();
    error NoClaimableTokens();
    error TransferFailed();
    error AlreadyInitialized();
    error AlreadyProcessed();

    constructor(address _operator) {
        owner = msg.sender;
        operator = _operator;
        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorSet(_operator);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /// @notice Authorized depositors deposit tokens. 20% burned, 80% held for distribution.
    function depositAndBurn(uint256 amount) external whenNotPaused {
        if (msg.sender != owner && !isDepositor[msg.sender]) revert Unauthorized();
        if (targetToken == address(0)) revert TargetTokenNotSet();
        if (amount == 0) revert InvalidAmount();

        bool pulled = IERC20(targetToken).transferFrom(msg.sender, address(this), amount);
        if (!pulled) revert TransferFailed();

        uint256 burnAmount = (amount * BURN_PERCENTAGE) / 100;
        uint256 distributeAmount = amount - burnAmount;

        bool burned = IERC20(targetToken).transfer(DEAD_ADDRESS, burnAmount);
        if (!burned) revert TransferFailed();

        emit TokensDeposited(msg.sender, amount, burnAmount, distributeAmount);
    }

    /// @notice Operator updates Merkle root after off-chain snapshot + tree generation.
    function updateMerkleRoot(bytes32 newMerkleRoot, bytes32 depositTxHash) external onlyOperator whenNotPaused {
        if (newMerkleRoot == bytes32(0)) revert InvalidAmount();
        if (processedDeposits[depositTxHash]) revert AlreadyProcessed();

        processedDeposits[depositTxHash] = true;
        merkleRoot = newMerkleRoot;
        currentEpoch++;
        lastDistributionTime = block.timestamp;

        emit MerkleRootUpdated(currentEpoch, newMerkleRoot, depositTxHash, block.timestamp);
    }

    /// @notice Claim tokens based on cumulative allocation.
    function claim(
        uint256 cumulativeTotalClaimable,
        bytes32[] calldata merkleProof
    ) external whenNotPaused {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, cumulativeTotalClaimable))));
        if (!_verifyMerkleProof(merkleProof, merkleRoot, leaf)) revert InvalidMerkleProof();

        uint256 alreadyClaimed = totalClaimed[msg.sender];
        if (cumulativeTotalClaimable <= alreadyClaimed) revert NoClaimableTokens();

        uint256 claimableNow = cumulativeTotalClaimable - alreadyClaimed;
        totalClaimed[msg.sender] = cumulativeTotalClaimable;

        bool success = IERC20(targetToken).transfer(msg.sender, claimableNow);
        if (!success) revert TransferFailed();

        emit Claimed(msg.sender, claimableNow, cumulativeTotalClaimable);
    }

    /// @notice Get claimable amount for a user.
    function getClaimableAmount(
        address user,
        uint256 cumulativeTotalClaimable
    ) external view returns (uint256) {
        uint256 alreadyClaimed = totalClaimed[user];
        if (cumulativeTotalClaimable <= alreadyClaimed) return 0;
        return cumulativeTotalClaimable - alreadyClaimed;
    }

    /// @notice One-time migration from old contract. Sets epoch, merkle root, and claimed state.
    function initializeFromV2(
        uint256 _epoch,
        bytes32 _merkleRoot,
        address[] calldata claimers,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (initialized) revert AlreadyInitialized();

        currentEpoch = _epoch;
        merkleRoot = _merkleRoot;
        lastDistributionTime = block.timestamp;

        for (uint256 i = 0; i < claimers.length; i++) {
            totalClaimed[claimers[i]] = amounts[i];
        }

        initialized = true;
    }

    function setTargetToken(address _targetToken) external onlyOwner {
        if (_targetToken == address(0)) revert InvalidAddress();
        targetToken = _targetToken;
        emit TargetTokenSet(_targetToken);
    }

    function setDepositor(address depositor, bool allowed) external onlyOwner {
        if (depositor == address(0)) revert InvalidAddress();
        isDepositor[depositor] = allowed;
        emit DepositorUpdated(depositor, allowed);
    }

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert InvalidAddress();
        operator = _operator;
        emit OperatorSet(_operator);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        bool success = IERC20(token).transfer(owner, amount);
        if (!success) revert TransferFailed();
        emit EmergencyWithdraw(token, amount);
    }

    function _verifyMerkleProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }
}
