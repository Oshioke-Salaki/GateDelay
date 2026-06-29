#!/bin/bash

echo "==================================="
echo "Vote Delegation Compilation Test"
echo "==================================="
echo ""

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "❌ Forge is not installed"
    echo "Please install Foundry: curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

echo "✅ Forge is installed"
echo ""

# Try to compile
echo "Compiling VoteDelegation contract..."
forge build --contracts contracts/VoteDelegation.sol

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Compilation successful!"
    echo ""
    echo "Running tests..."
    forge test --match-contract VoteDelegationTest -vv
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ All tests passed!"
    else
        echo ""
        echo "❌ Some tests failed"
        exit 1
    fi
else
    echo ""
    echo "❌ Compilation failed"
    exit 1
fi
