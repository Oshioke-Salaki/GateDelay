#!/usr/bin/env bash
set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(mktemp -d)"
trap 'rm -rf "$WORKSPACE"' EXIT

mkdir -p "$WORKSPACE/src" "$WORKSPACE/test/invariant"
cp "$CONTRACTS_DIR/src/ERC20Token.sol" "$CONTRACTS_DIR/src/LMSR.sol" \
  "$CONTRACTS_DIR/src/MarketMaker.sol" "$WORKSPACE/src/"
cp "$CONTRACTS_DIR/test/invariant/MarketMakerInvariant.t.sol" \
  "$WORKSPACE/test/invariant/"
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

[invariant]
runs = 128
depth = 128
TOML

cat > "$WORKSPACE/remappings.txt" <<'REMAP'
forge-std/=lib/forge-std/src/
REMAP

cd "$WORKSPACE"
forge build --force
forge test --force --match-path test/invariant/MarketMakerInvariant.t.sol -vv