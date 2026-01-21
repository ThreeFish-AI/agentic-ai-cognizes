# Agentic AI Research Papers Collection

This directory contains the collection of Agentic AI research papers, organized into three main categories:

## Directory Structure

### `source/`
Contains original papers in their native format (PDF, HTML, etc.).

```
source/
├── LLM Agents/          # Papers about Large Language Model Agents
├── Context Engineering/ # Papers about context engineering techniques
├── Knowledge Graphs/    # Papers about knowledge graph integration
├── Multi-Agent Systems/ # Papers about multi-agent architectures
└── Survey Papers/       # Survey and review papers
```

### `translation/`
Contains Chinese translations of the papers in Markdown format.

```
translation/
├── LLM Agents/          # Translated LLM Agent papers
├── Context Engineering/ # Translated context engineering papers
├── Knowledge Graphs/    # Translated knowledge graph papers
└── ...
```

### `heartfelt/`
Contains enhanced translations with additional insights, summaries, and analysis.

```
heartfelt/
├── LLM Agents/          # Enhanced LLM Agent papers with analysis
├── Context Engineering/ # Enhanced context engineering papers
└── ...
```

### `images/`
Contains extracted images, figures, and diagrams from the papers, organized by paper title.

## Paper Processing Pipeline

1. **Ingestion**: Papers are added to `source/`
2. **Extraction**: Content is extracted and converted to Markdown
3. **Translation**: Papers are translated to Chinese
4. **Enhancement**: Additional analysis and summaries are added
5. **Publication**: Final papers are available in `heartfelt/`

## Naming Conventions

- Use kebab-case for filenames: `paper-title.md`
- Include year in directory name when relevant: `LLM Agents/2024/`
- Preserve original author information in file headers
- Include DOI or URL when available

## Metadata

Each paper should include a YAML front matter with:
```yaml
---
title: "Paper Title"
authors: ["Author 1", "Author 2"]
year: 2024
venue: "Conference/Journal Name"
doi: "10.1000/xyz123"
categories: ["LLM Agents", "Multi-Agent Systems"]
tags: ["reinforcement learning", "planning"]
source_url: "https://arxiv.org/abs/..."
translation_date: "2024-01-01"
enhancer: "Enhancer Name"
---
```

## Quality Guidelines

- Translations should maintain technical accuracy
- Preserve mathematical formulas and equations
- Ensure figures and tables are properly formatted
- Add explanatory notes for cultural or linguistic nuances
- Include translator notes for ambiguous terms