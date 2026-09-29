#!/bin/bash
#
# RoleManager verification script.
#
# Why this exists: `forge build` and `forge test` compile the whole tree, and the
# tree currently has pre-existing parse/type errors in ~24 unrelated files (see
# "Known blocker" in README.md). Those make a repo-wide run useless as a signal
# for any single contract. This script builds and tests RoleManager in an
# isolated workspace containing only its own sources, so a pass means
# `src/RoleManager.sol` and `test/RoleManager.t.sol` really are green.
#
# Usage:  Contracts/verify_rolemanager.sh
# Exits non-zero on the first failure.

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(mktemp -d)"
trap 'rm -rf "$WORKSPACE"' EXIT

echo "==================================="
echo "RoleManager Verification"
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
if [ ! -d "$CONTRACTS_DIR/lib/openzeppelin-contracts/contracts" ]; then
    echo -e "${RED}OpenZeppelin not found at lib/openzeppelin-contracts${NC}"
    echo "  git submodule update --init --recursive"
    exit 1
fi
if [ ! -d "$CONTRACTS_DIR/lib/forge-std/src" ]; then
    echo -e "${RED}forge-std not found at lib/forge-std${NC}"
    echo "  git submodule update --init --recursive"
    exit 1
fi
echo -e "${GREEN}OK${NC}"
echo ""

echo "3. Building isolated workspace..."
mkdir -p "$WORKSPACE/src" "$WORKSPACE/test"
cp "$CONTRACTS_DIR/src/RoleManager.sol" "$WORKSPACE/src/"
cp "$CONTRACTS_DIR/test/RoleManager.t.sol" "$WORKSPACE/test/"
ln -s "$CONTRACTS_DIR/lib" "$WORKSPACE/lib"

cat > "$WORKSPACE/foundry.toml" <<'TOML'
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
solc = "0.8.28"
optimizer = true
optimizer_runs = 200
via_ir = true

[profile.default.fuzz]
runs = 256
TOML

cat > "$WORKSPACE/remappings.txt" <<'REMAP'
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
REMAP
echo -e "${GREEN}OK${NC}"
echo ""

echo "4. forge build..."
if ! (cd "$WORKSPACE" && forge build); then
    echo -e "${RED}Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}Build succeeded${NC}"
echo ""

echo "5. forge test..."
if ! (cd "$WORKSPACE" && forge test -vv); then
    echo -e "${RED}Tests failed${NC}"
    exit 1
fi
echo -e "${GREEN}Tests passed${NC}"
echo ""

echo "6. forge fmt --check..."
if ! (cd "$CONTRACTS_DIR" && forge fmt --check src/RoleManager.sol test/RoleManager.t.sol 2>/dev/null); then
    echo -e "${RED}Formatting check failed - run: forge fmt src/RoleManager.sol test/RoleManager.t.sol${NC}"
    exit 1
fi
echo -e "${GREEN}Formatting OK${NC}"
echo ""

echo -e "${GREEN}RoleManager verification complete.${NC}"
