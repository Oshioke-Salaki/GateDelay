#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         MarketDelegation Verification Script                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if forge is installed
echo "1. Checking Foundry installation..."
if ! command -v forge &> /dev/null; then
    echo -e "${RED}❌ Forge is not installed${NC}"
    echo ""
    echo "To install Foundry:"
    echo "  curl -L https://foundry.paradigm.xyz | bash"
    echo "  foundryup"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ Forge is installed${NC}"
echo ""

# Check OpenZeppelin
echo "2. Checking OpenZeppelin contracts..."
if [ -d "lib/openzeppelin-contracts" ]; then
    echo -e "${GREEN}✅ OpenZeppelin contracts found${NC}"
else
    echo -e "${RED}❌ OpenZeppelin contracts not found${NC}"
    echo "Installing OpenZeppelin..."
    forge install OpenZeppelin/openzeppelin-contracts --no-commit
fi
echo ""

# Check if contract exists
echo "3. Checking MarketDelegation.sol..."
if [ -f "contracts/MarketDelegation.sol" ]; then
    echo -e "${GREEN}✅ MarketDelegation.sol found${NC}"
    echo "   Location: contracts/MarketDelegation.sol"
    echo "   Size: $(wc -l < contracts/MarketDelegation.sol) lines"
else
    echo -e "${RED}❌ MarketDelegation.sol not found${NC}"
    exit 1
fi
echo ""

# Check if test exists
echo "4. Checking MarketDelegation.t.sol..."
if [ -f "../test/MarketDelegation.t.sol" ]; then
    echo -e "${GREEN}✅ MarketDelegation.t.sol found${NC}"
    echo "   Location: test/MarketDelegation.t.sol"
    echo "   Size: $(wc -l < ../test/MarketDelegation.t.sol) lines"
else
    echo -e "${RED}❌ MarketDelegation.t.sol not found${NC}"
    exit 1
fi
echo ""

# Try to compile
echo "5. Compiling MarketDelegation.sol..."
if forge build --contracts contracts/MarketDelegation.sol 2>&1 | grep -q "Compiler run successful"; then
    echo -e "${GREEN}✅ Compilation successful!${NC}"
else
    echo -e "${YELLOW}⚠️  Attempting compilation...${NC}"
    forge build --contracts contracts/MarketDelegation.sol
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Compilation successful!${NC}"
    else
        echo -e "${RED}❌ Compilation failed${NC}"
        echo "Check the error messages above"
        exit 1
    fi
fi
echo ""

# Try to compile tests
echo "6. Compiling tests..."
if forge build 2>&1 | grep -q "Compiler run successful"; then
    echo -e "${GREEN}✅ Test compilation successful!${NC}"
else
    echo -e "${YELLOW}⚠️  Attempting test compilation...${NC}"
    forge build
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Test compilation successful!${NC}"
    else
        echo -e "${RED}❌ Test compilation failed${NC}"
        echo "Check the error messages above"
        exit 1
    fi
fi
echo ""

# Run tests
echo "7. Running tests..."
echo -e "${YELLOW}Running MarketDelegation test suite...${NC}"
echo ""
forge test --match-path ../test/MarketDelegation.t.sol -vv

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              VERIFICATION SUCCESSFUL! ✅                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Summary:"
    echo "  ✅ Contract compiles successfully"
    echo "  ✅ Tests compile successfully"
    echo "  ✅ All tests pass"
    echo ""
    echo "Next steps:"
    echo "  1. Review the implementation"
    echo "  2. Run gas report: forge test --gas-report"
    echo "  3. Run coverage: forge coverage"
    echo "  4. Deploy to testnet"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    echo "Review the test output above for details"
    exit 1
fi
