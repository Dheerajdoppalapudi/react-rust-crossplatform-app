# SSE event type string constants — avoids magic strings across routers and services.
# Mirror of client/src/constants/sseEvents.js

# Lifecycle
INIT           = "init"
META           = "meta"
DONE           = "done"
ERROR          = "error"

# Stage progress
STAGE          = "stage"
STAGE_DONE     = "stage_done"

# Research / synthesis
SOURCE         = "source"
TOKEN          = "token"
SYNTHESIS_DONE = "synthesis_done"
SEARCH_QUERY   = "search_query"

# Interactive pipeline
BLOCK          = "block"

# Video / frame pipeline
FRAME          = "frame"
BEATS_PLANNED  = "beats_planned"
BEAT_READY     = "beat_ready"
BEAT_STATUS    = "beat_status"
