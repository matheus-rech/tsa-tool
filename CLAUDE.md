# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server at localhost:5173
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build at localhost:4173
npm test             # Run all tests with Vitest
npm run test:watch   # Run tests in watch mode

# Agent System (requires ANTHROPIC_API_KEY in .env)
npm run agent                        # Run orchestrator with default dataset
npm run agent -- --verbose           # Verbose output
npm run agent -- --dataset=1         # Select dataset (0=TRA, 1=Hypothermia, 2=COVID)
npm run agent:bond -- --interactive  # Agent-Bond quality checker
npm run agent:007 -- --verbose       # Agent-007 TSA analyst

# Type checking
npx tsc --noEmit    # Check without emitting files
```

## Architecture

This is a **dual-purpose application**: a React web app for TSA visualization AND a Claude Agent SDK multi-agent system for automated analysis.

### Core Statistics Library (`src/lib/statistics.ts`)

The foundation is a TypeScript implementation of Copenhagen Trial Unit methodology:

- **Mantel-Haenszel pooling** with Robins-Breslow-Greenland variance
- **Lan-DeMets O'Brien-Fleming** alpha-spending function
- **DerSimonian-Laird** heterogeneity (I², τ², Q-statistic)
- **Required Information Size (RIS)** calculation with heterogeneity correction

Key exports: `calculateTSA()`, `calculatePooledOR()`, `calculateZStatistic()`, `calculateHeterogeneity()`, `calculateRIS()`, `calculateBoundaries()`

All statistical functions are validated against Copenhagen TSA software (35 tests).

### Agent System (`src/agents/`)

Multi-agent architecture with tool-based design:

| Agent | Role | Tools |
|-------|------|-------|
| **AgentBond** | Quality & Monitoring | Data validation, methodology checks, living review |
| **Agent007** | Primary Analysis | TSA calculation, sensitivity analysis, interpretation |
| **ScreenshotReporter** | Visual Reports | Playwright-based chart capture |
| **TSAAgentOrchestrator** | Pipeline Coordinator | Runs full analysis: quality → TSA → screenshots |

### Tool System (`src/tools/`)

Agents use Zod-validated tools that wrap the statistics library:

- `dataValidation.ts` - Study data validation, outlier detection
- `methodologyCheck.ts` - Copenhagen compliance, heterogeneity assessment
- `livingReview.ts` - New study impact, reanalysis triggers
- `tsaCalculation.ts` - TSA calculation wrappers
- `sensitivityAnalysis.ts` - Leave-one-out, parameter sweep, influence

Tools export both the function AND a tool definition object for Anthropic SDK.

### Web Application

- **TSAChart** (`src/components/TSAChart.tsx`) - Canvas-based visualization of Z-curves with O'Brien-Fleming boundaries
- **App** (`src/App.tsx`) - Dataset selector, parameter display, results panel
- Uses `@/*` path alias mapping to `./src/*`

### Data Types (`src/types.ts`)

Core interfaces: `Study`, `TSAParams`, `TSAResults`, `CumulativeDataPoint`, `TSAInterpretation`

Interpretation types: `'conclusive-benefit' | 'conclusive-harm' | 'futility' | 'inconclusive'`

## Testing

Tests are in `src/lib/statistics.test.ts`. Run a single test pattern:

```bash
npm test -- --grep "pooled OR"
```

## Environment

Copy `.env.example` to `.env` and add `ANTHROPIC_API_KEY` for agent functionality.
