---
name: web-research
description: 网络研究 — 使用搜索引擎和网页抓取获取外部信息，支持多源交叉验证
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "research,web,search,researcher"
  layer: auxiliary
  agent: researcher
---

# Web Research

## Overview

Use search engines and web scraping to obtain external information; support multi-source cross-validation.

## Search Strategy

- **Query formulation**: Expand user query with synonyms, related terms; use Boolean operators when supported
- **Source selection**: Choose engines (Google, Bing, DuckDuckGo) and verticals (docs, GitHub, Stack Overflow) by topic

## Multi-Engine Search

- Execute parallel searches across engines; merge and deduplicate results
- Handle rate limits and fallbacks; respect robots.txt

## Content Extraction and Summarization

- Extract main content from pages; strip ads, nav, footers
- Summarize long articles; preserve key facts and citations
- Support structured data (JSON-LD, meta tags) when available

## Source Credibility Assessment

- Score sources by domain authority, recency, citation count
- Flag low-quality or suspicious sources for user awareness

## Result Deduplication

- Detect near-duplicate content across sources; cluster by similarity
- Present unique insights; cite multiple sources for corroboration
