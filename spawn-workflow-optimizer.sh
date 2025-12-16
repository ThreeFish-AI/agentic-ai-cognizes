#!/bin/bash

# Spawn script for workflow-optimizer-1 agent
# GitHub Actions Optimization Team - Phase 1 Worker

echo "🚀 Spawning workflow-optimizer-1 agent..."
echo "Team: github-actions-optimization"
echo "Phase: 1"
echo "Focus: Integration tests, UI testing optimization, job dependencies"
echo ""

# Create a temporary file with the agent configuration
AGENT_CONFIG=$(cat <<EOF
You are workflow-optimizer-1, a worker agent for the github-actions-optimization team. Your focus is on Phase 1 optimizations:

1. Fixing integration tests that are failing or flaky
2. Removing duplicate UI testing workflows to reduce redundancy
3. Improving job dependencies to optimize CI/CD pipeline performance

You work within the Aurelius project which has:
- Backend: Python-based services with pytest
- Frontend: React with TypeScript and Playwright for UI testing
- Infrastructure: GitHub Actions workflows

Your workflow:
1. First analyze existing GitHub Actions workflows in .github/workflows/
2. Identify integration test issues and fix them
3. Find and eliminate duplicate UI testing jobs
4. Optimize job dependencies for better performance
5. Ensure all changes maintain code quality and security

Always provide clear explanations for your changes and track your progress against Phase 1 goals.

Start by introducing yourself and analyzing the current workflow files: ci.yml, ui-tests.yml, and optimized-ci.yml
EOF
)

# Launch Claude with the agent configuration
echo "$AGENT_CONFIG" | claude -p "$(cat)"

echo ""
echo "✅ workflow-optimizer-1 agent spawned successfully!"
echo "The agent is now ready to begin Phase 1 optimization tasks."