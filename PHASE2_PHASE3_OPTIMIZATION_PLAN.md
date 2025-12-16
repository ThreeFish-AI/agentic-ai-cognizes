# GitHub Actions Optimization - Phase 2 & 3 Plan

## Overview
This document outlines the Phase 2 and Phase 3 optimization plan for the GitHub Actions workflows, to be implemented by **workflow-optimizer-2** after Phase 1 completion by **workflow-optimizer-1**.

## Phase 2 - Advanced Optimizations

### 1. Composite Actions Creation

#### 1.1. Reusable Setup Actions
- **Action**: `setup-python-environment`
  - Purpose: Common Python environment setup for all backend jobs
  - Features:
    - Python version caching
    - uv dependency management
    - Virtual environment creation
    - Pre-commit hooks installation

- **Action**: `setup-node-environment`
  - Purpose: Common Node.js environment setup for all frontend jobs
  - Features:
    - Node.js version caching
    - npm/yarn dependency caching
    - Playwright browser setup
    - TypeScript compilation

- **Action**: `run-tests-with-coverage`
  - Purpose: Unified test execution with coverage collection
  - Features:
    - Parameterizable test suite selection
    - Coverage report generation
    - Artifact publishing
    - Test result formatting

#### 1.2. Specialized Actions
- **Action**: `docker-build-and-push`
  - Purpose: Optimized Docker builds with multi-stage caching
  - Features:
    - Multi-platform builds
    - Layer caching optimization
    - Security scanning integration
    - Tag management strategy

- **Action**: `deploy-preview`
  - Purpose: Dynamic preview deployment for PRs
  - Features:
    - Environment isolation
    - URL generation
    - Cleanup automation
    - Integration with PR comments

### 2. Smart Path Detection Implementation

#### 2.1. Path-Based Workflow Triggers
```yaml
# Example path filters
paths:
  backend:
    - 'agents/**'
    - 'papers/**'
    - 'tests/**'
    - 'pyproject.toml'
    - 'uv.lock'

  frontend:
    - 'ui/**'
    - 'package.json'
    - 'yarn.lock'
    - 'tsconfig.json'

  docs:
    - 'docs/**'
    - '*.md'

  ci:
    - '.github/workflows/**'
    - '.github/actions/**'
```

#### 2.2. Conditional Job Execution
- Run backend tests only when Python files change
- Run frontend tests only when UI files change
- Skip build jobs for documentation-only changes
- Run full CI only on merge to main branch

#### 2.3. Dynamic Test Selection
- Parse changed files to determine affected test suites
- Implement test impact analysis
- Create intelligent test subsets based on change scope

### 3. Advanced Caching Strategies

#### 3.1. Multi-Layer Cache Keys
```yaml
# Example cache key strategy
cache-keys:
  python-deps: |
    python-${{ matrix.python-version }}-
    uv-${{ hashFiles('uv.lock') }}-
    os-${{ runner.os }}-
    arch-${{ runner.arch }}

  node-deps: |
    node-${{ matrix.node-version }}-
    yarn-${{ hashFiles('yarn.lock') }}-
    os-${{ runner.os }}

  docker-layers: |
    docker-${{ matrix.service }}-
    base-${{ hashFiles('Dockerfile.base') }}-
    deps-${{ hashFiles('requirements*.txt') }}
```

#### 3.2. Cache Warming Strategy
- Primary cache: Based on exact hash matches
- Fallback cache: Based on partial matches
- Periodic cache warming for common dependencies
- Cache cleanup for old versions

#### 3.3. Test Result Caching
- Cache test results between jobs
- Implement test sharding with result aggregation
- Cache coverage data for incremental reporting

### 4. Dynamic Test Matrix Generation

#### 4.1. Change-Based Matrix
```yaml
# Example dynamic matrix
strategy:
  matrix:
    include:
      # Python changes
      - python-version: 3.11
        test-suite: backend
        condition: ${{ contains(changed_files.python, 'true') }}

      # Node.js changes
      - node-version: 18
        test-suite: frontend
        condition: ${{ contains(changed_files.frontend, 'true') }}

      # Full matrix for main branch
      - python-version: 3.11
        test-suite: full
        condition: ${{ github.ref == 'refs/heads/main' }}
```

#### 4.2. Browser Test Optimization
- Chromium for PRs (fastest)
- Full browser matrix for releases
- Parallel browser execution
- Smart browser allocation based on test type

## Phase 3 - Documentation & Monitoring

### 1. Comprehensive Documentation Structure

#### 1.1. Documentation Directory
```
docs/ci-workflows/
├── README.md                    # Overview and quick start
├── architecture.md             # Workflow architecture guide
├── composite-actions/          # Individual action documentation
│   ├── setup-python-env.md
│   ├── setup-node-env.md
│   ├── run-tests.md
│   └── docker-build.md
├── guides/                     # How-to guides
│   ├── adding-new-job.md
│   ├── troubleshooting.md
│   └── performance-tuning.md
├── monitoring/                 # Monitoring and metrics
│   ├── metrics-dashboard.md
│   ├── alerting.md
│   └── health-checks.md
└── examples/                   # Example workflows
    ├── simple-service.yml
    ├── full-stack-app.yml
    └── multi-repo.yml
```

#### 1.2. Documentation Content
- Architecture diagrams using Mermaid
- Performance benchmarks and metrics
- Troubleshooting common issues
- Best practices and patterns
- Migration guides from old workflows

### 2. Performance Monitoring Implementation

#### 2.1. Metrics Collection
- Workflow execution time tracking
- Job success/failure rates
- Cache hit/miss statistics
- Resource utilization metrics
- Cost analysis per workflow run

#### 2.2. Dashboard Setup
```yaml
# Example metrics job
metrics:
  runs-on: ubuntu-latest
  steps:
    - name: Collect workflow metrics
      uses: ./.github/actions/collect-metrics
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        dashboard-url: ${{ secrets.METRICS_DASHBOARD_URL }}

    - name: Update performance dashboard
      run: |
        # Update Grafana/Prometheus dashboard
        # Send metrics to data warehouse
```

#### 2.3. Alerting Configuration
- Workflow failure alerts (Slack/Teams)
- Performance degradation notifications
- Cache miss rate warnings
- Cost threshold alerts

### 3. Automated Workflow Health Checks

#### 3.1. Health Check Script
```python
# .github/scripts/workflow-health-check.py
def check_workflow_health():
    """Check overall workflow health"""
    checks = [
        check_recent_failures(),
        check_performance_regression(),
        check_cache_effectiveness(),
        check_security_scan_results(),
        check_documentation_freshness()
    ]
    return generate_health_report(checks)
```

#### 3.2. Scheduled Health Checks
- Daily workflow execution
- Weekly performance reports
- Monthly optimization reviews
- Quarterly architecture updates

### 4. Best Practices Documentation

#### 4.1. Workflow Design Patterns
- Template repository for common patterns
- Style guide for workflow organization
- Naming conventions for jobs and steps
- Security best practices

#### 4.2. Maintenance Guidelines
- Regular review schedule
- Dependency update process
- Workflow versioning strategy
- Rollback procedures

## Implementation Timeline

### Phase 2 (4-6 weeks)
- Week 1: Create core composite actions
- Week 2: Implement smart path detection
- Week 3: Deploy advanced caching strategies
- Week 4: Develop dynamic test matrix
- Week 5-6: Testing and optimization

### Phase 3 (3-4 weeks)
- Week 1: Create documentation structure
- Week 2: Implement monitoring and metrics
- Week 3: Set up health checks
- Week 4: Finalize best practices guide

## Success Metrics

### Performance Metrics
- **Additional 20-30% reduction** in execution time beyond Phase 1
- **90%+ cache hit rate** for dependencies
- **50% reduction** in unnecessary job executions through path filtering

### Maintainability Metrics
- **100% documentation coverage** for all workflows
- **Automated health monitoring** with < 5 minute alert time
- **Zero manual interventions** for routine maintenance

## Handoff from Phase 1

workflow-optimizer-2 should:
1. Review all Phase 1 changes and optimizations
2. Analyze the performance improvements achieved
3. Identify additional optimization opportunities
4. Build upon the foundation laid by workflow-optimizer-1
5. Ensure compatibility with existing workflows

## Tools and Technologies

- **Composite Actions**: Reusable workflow components
- **GitHub API**: For dynamic configuration
- **Path Filters**: Smart triggering
- **Actions Cache**: Advanced caching
- **Grafana/Prometheus**: Monitoring dashboard
- **Mermaid**: Documentation diagrams
- **Python/Node.js**: Scripting and automation