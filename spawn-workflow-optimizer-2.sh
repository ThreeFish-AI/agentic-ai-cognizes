#!/bin/bash

# Script to spawn workflow-optimizer-2 agent for GitHub Actions optimization Phase 2 & 3

echo "🚀 Spawning workflow-optimizer-2 agent..."
echo "========================================="
echo "Team: github-actions-optimization"
echo "Agent Type: worker"
echo "Phase: 2 & 3"
echo ""

# Check if agent configuration exists
if [ ! -f "workflow-optimizer-agent.json" ]; then
    echo "❌ Error: workflow-optimizer-agent.json not found!"
    exit 1
fi

# Check if workflow-optimizer-2 is configured
if ! jq -e '.["workflow-optimizer-2"]' workflow-optimizer-agent.json > /dev/null 2>&1; then
    echo "❌ Error: workflow-optimizer-2 not found in configuration!"
    exit 1
fi

echo "✅ Configuration found for workflow-optimizer-2"
echo ""

# Display agent details
echo "Agent Details:"
echo "--------------"
jq -r '.["workflow-optimizer-2"].description' workflow-optimizer-agent.json
echo ""

echo "Phase 2 Focus Areas:"
echo "--------------------"
echo "• Creating reusable composite actions"
echo "• Implementing smart path detection"
echo "• Advanced caching strategies"
echo "• Dynamic test matrix generation"
echo ""

echo "Phase 3 Focus Areas:"
echo "--------------------"
echo "• Comprehensive workflow documentation"
echo "• Performance monitoring and reporting"
echo "• Automated workflow health checks"
echo "• Best practices documentation"
echo ""

# Create activation command
echo "To activate workflow-optimizer-2, run:"
echo "claude --agent workflow-optimizer-2"
echo ""

echo "✅ workflow-optimizer-2 agent ready for activation!"