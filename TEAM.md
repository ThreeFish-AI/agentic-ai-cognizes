# GitHub Actions Optimization Team

## Team Overview
This team is focused on optimizing the GitHub Actions workflows for the Aurelius project to improve CI/CD performance, reduce redundancy, and ensure reliable testing.

## Team Members

### workflow-optimizer-1
- **Agent Type**: Worker
- **Team**: github-actions-optimization
- **Phase**: 1
- **Focus Areas**:
  1. Fixing integration tests that are failing or flaky
  2. Removing duplicate UI testing workflows to reduce redundancy
  3. Improving job dependencies to optimize CI/CD pipeline performance

### workflow-optimizer-2
- **Agent Type**: Worker
- **Team**: github-actions-optimization
- **Phase**: 2 & 3
- **Focus Areas**:
  1. **Phase 2 - Advanced Optimizations**:
     - Creating reusable composite actions for common workflow patterns
     - Implementing smart path detection for conditional job execution
     - Advanced caching strategies with multi-layered cache keys
     - Dynamic test matrix generation based on changed files
  2. **Phase 3 - Documentation & Monitoring**:
     - Creating comprehensive documentation for optimized workflows
     - Implementing workflow performance monitoring and reporting
     - Setting up automated workflow health checks
     - Creating best practices documentation for future workflow updates

### Agent Description
workflow-optimizer-1 is a specialized worker agent for the GitHub Actions optimization team. The agent works within the Aurelius project ecosystem which includes:

- **Backend**: Python-based services with pytest
- **Frontend**: React with TypeScript and Playwright for UI testing
- **Infrastructure**: GitHub Actions workflows

### Workflow and Responsibilities

1. **Analyze existing GitHub Actions workflows**
   - Review current workflow files in `.github/workflows/`
   - Identify performance bottlenecks and redundant jobs
   - Map out job dependencies and parallelization opportunities

2. **Fix integration test issues**
   - Identify flaky or failing integration tests
   - Debug and resolve test instability issues
   - Ensure integration tests provide reliable feedback

3. **Eliminate duplicate UI testing**
   - Review UI testing workflows for redundancy
   - Consolidate similar test jobs
   - Optimize test execution without reducing coverage

4. **Optimize job dependencies**
   - Improve parallelization where possible
   - Reduce unnecessary sequential dependencies
   - Implement smarter caching strategies

5. **Maintain quality and security**
   - Ensure all optimizations maintain code quality
   - Preserve security checks and validations
   - Document all changes with clear explanations

### Phase 1 Goals

- Reduce CI/CD pipeline execution time by at least 30%
- Eliminate all duplicate UI testing jobs
- Fix all flaky integration tests
- Implement proper job dependency optimization
- Maintain or improve test coverage

### Getting Started

To activate workflow-optimizer-1 (Phase 1):
```bash
claude --agent workflow-optimizer-1
```

To activate workflow-optimizer-2 (Phase 2 & 3):
```bash
claude --agent workflow-optimizer-2
```

## Phase Overview

### Phase 1 (workflow-optimizer-1)
- Focus: Foundational optimizations
- Goal: Reduce CI/CD pipeline execution time by at least 30%
- Tasks: Fix integration tests, eliminate duplicate UI testing, optimize job dependencies

### Phase 2 (workflow-optimizer-2)
- Focus: Advanced optimizations
- Goal: Create reusable components and intelligent workflows
- Tasks: Composite actions, smart path detection, advanced caching, dynamic test matrices

### Phase 3 (workflow-optimizer-2)
- Focus: Documentation and monitoring
- Goal: Ensure long-term maintainability and visibility
- Tasks: Comprehensive documentation, performance monitoring, health checks, best practices

workflow-optimizer-1 will begin by analyzing the current workflow structure and creating a prioritized list of Phase 1 optimization tasks. After Phase 1 is complete, workflow-optimizer-2 will take over for Phase 2 and 3 implementations.