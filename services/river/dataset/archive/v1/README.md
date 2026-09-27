# Retired untrained candidate

This is the preserved first local candidate, `care-circle-corpus-v1`. It was never approved for training or reported evaluation. A self-review and independent review found that records without an explicit question could retain a hidden question destination in their entity grouping key. Full template families were still disjoint, but the entity grouping claim was too strong.

The active v2 dataset at `services/river/dataset/` corrects this and independently validates grouping against observable note content. Do not train on, merge with, or evaluate using this retired snapshot. The original immutable held-out pin remains intact for audit. `generator-source.txt` is an archival source snapshot, not an executable tool.
