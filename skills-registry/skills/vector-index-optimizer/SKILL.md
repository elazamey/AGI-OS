# Name
vector-index-optimizer

# Version
1.0.0

# Description
Optimizes vector embeddings in ChromaDB by detecting and removing duplicate, stale, or low-quality contexts to reduce context drift.

# Author
agi-os

# Category
cognitive

# Tags
- vector
- embeddings
- chromadb
- memory
- optimization
- context-drift

# Dependencies
- node

# Capabilities
- duplicate-detection
- stale-context-removal
- embedding-quality-scoring
- index-compaction
- drift-metrics

# Instructions
Use this skill to optimize vector memory stores and reduce context drift.

## Input Parameters
- `collection_name` (string, required): ChromaDB collection to optimize
- `similarity_threshold` (number, optional): Threshold for duplicate detection (default: 0.95)
- `max_age_days` (number, optional): Remove contexts older than N days (default: 30)
- `dry_run` (boolean, optional): Analyze without modifying (default: true)
- `batch_size` (number, optional): Processing batch size (default: 100)

## Workflow
1. Connect to ChromaDB collection
2. Analyze embedding statistics:
   - Total vectors count
   - Average embedding dimension
   - Collection size and distribution
3. Detect duplicates:
   - Cosine similarity above threshold
   - Keep most recent, remove older copies
   - Merge metadata from duplicates
4. Identify stale contexts:
   - Last accessed timestamp analysis
   - Usage frequency scoring
   - Remove unused beyond max_age
5. Quality scoring:
   - Embedding magnitude consistency
   - Metadata completeness
   - Relevance to collection theme
6. Compaction:
   - Rebuild index after removals
   - Optimize storage layout
   - Update collection statistics
7. Generate optimization report

## Quality Metrics
- similarity_score: cosine similarity between embeddings
- freshness_score: based on last access time
- relevance_score: semantic similarity to collection centroid
- overall_quality: weighted combination

## Output
Returns structured report with:
- vectors_before: initial count
- vectors_after: optimized count
- duplicates_removed: count
- stale_removed: count
- quality_improvement: percentage
- storage_saved: bytes

# Examples
```markdown
# Analyze without changes
vector-index-optimizer analyze --collection memories

# Remove duplicates only
vector-index-optimizer compact --collection memories --similarity-threshold 0.95

# Full optimization
vector-index-optimizer optimize --collection memories --max-age-days 14 --dry-run false
```
