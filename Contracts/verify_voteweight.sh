#!/bin/bash
#
# VoteWeight verification script.
#
# `forge build` / `forge test` compile the whole tree, and roughly two dozen
# unrelated files in src/ and test/ currently have parse and type errors (see
# "Known blocker" in README.md), so a repo-wide run says nothing about this
# contract. This builds and tests VoteWeight + VotingWithVoteWeight in an
# isolated workspace instead.
#
# It runs the suite under BOTH build profiles on purpose. These tests were
# previously profile-dependent: `block.number` folds to a constant under
# `via_ir`, so cheatcode-based block manipulation read back the wrong value and
# results differed between profiles.
#
# Usage:  Contracts/verify_voteweight.sh
# Exits non-zero on the first failure.

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(mktemp -d)"
trap 'rm -rf "$WORKSPACE"' EXIT

echo "==================================="
echo "VoteWeight Verification"
echo "==================================="
echo ""

echo "1. Checking Foundry installation..."
if ! command -v forge &> /dev/null; then
    echo -e "${RED}Forge is not installed${NC}"
    echo "  curl -L https://foundry.paradigm.xyz | bash && foundryup"
    exit 1
fi
forge --version | head -1
echo -e "${GREEN}OK${NC}"
echo ""

echo "2. Checking dependencies..."
for dep in openzeppelin-contracts/contracts forge-std/src; do
    if [ ! -d "$CONTRACTS_DIR/lib/$dep" ]; then
        echo -e "${RED}Missing lib/$dep${NC}"
        echo "  git submodule update --init --recursive"
        exit 1
    fi
done
echo -e "${GREEN}OK${NC}"
echo ""

echo "3. Building isolated workspace..."
mkdir -p "$WORKSPACE/src" "$WORKSPACE/test"
cp "$CONTRACTS_DIR/src/VoteWeight.sol" "$CONTRACTS_DIR/src/VotingWithVoteWeight.sol" "$WORKSPACE/src/"
cp "$CONTRACTS_DIR/test/VoteWeight.t.sol" "$CONTRACTS_DIR/test/VotingWithVoteWeight.t.sol" "$WORKSPACE/test/"
ln -s "$CONTRACTS_DIR/lib" "$WORKSPACE/lib"
cat > "$WORKSPACE/remappings.txt" <<'REMAP'
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
REMAP
echo -e "${GREEN}OK${NC}"
echo ""

write_config () {
    cat > "$WORKSPACE/foundry.toml" <<TOML
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
solc = "0.8.28"
optimizer = $1
optimizer_runs = 200
via_ir = $2

[profile.default.fuzz]
runs = 256
TOML
}

step=4
for profile in "true true" "false false"; do
    set -- $profile
    write_config "$1" "$2"
    echo "$step. forge build + test (optimizer=$1, via_ir=$2)..."
    if ! (cd "$WORKSPACE" && forge build --force >/dev/null); then
        echo -e "${RED}Build failed (optimizer=$1, via_ir=$2)${NC}"
        exit 1
    fi
    if ! (cd "$WORKSPACE" && forge test --force); then
        echo -e "${RED}Tests failed (optimizer=$1, via_ir=$2)${NC}"
        exit 1
    fi
    echo -e "${GREEN}Passed${NC}"
    echo ""
    step=$((step + 1))
done

echo "$step. Checking for compiler/lint warnings in src/..."
write_config true true
SRC_WARNINGS=$( (cd "$WORKSPACE" && forge build --force 2>&1) | grep -A2 'warning\[' | grep -c 'src/' )
if [ "$SRC_WARNINGS" != "0" ]; then
    echo -e "${RED}$SRC_WARNINGS warning(s) in src/${NC}"
    (cd "$WORKSPACE" && forge build --force 2>&1) | grep -B1 -A4 'warning\[' | grep -A4 'src/'
    exit 1
fi
echo -e "${GREEN}No warnings in src/${NC}"
echo ""
step=$((step + 1))

echo "$step. forge fmt --check..."
if ! (cd "$CONTRACTS_DIR" && forge fmt --check \
        src/VoteWeight.sol src/VotingWithVoteWeight.sol \
        test/VoteWeight.t.sol test/VotingWithVoteWeight.t.sol >/dev/null 2>&1); then
    echo -e "${RED}Formatting check failed${NC}"
    echo "  forge fmt src/VoteWeight.sol src/VotingWithVoteWeight.sol test/VoteWeight.t.sol test/VotingWithVoteWeight.t.sol"
    exit 1
fi
echo -e "${GREEN}Formatting OK${NC}"
echo ""

echo -e "${GREEN}VoteWeight verification complete.${NC}"
