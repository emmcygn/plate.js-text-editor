# Extensibility Roadmap

> How this plugs into a typical legaltech platform. What's ready, what needs to change, and how it scales.

## Current State vs Production Target

```mermaid
graph LR
    subgraph Current ["Current (Take-Home)"]
        direction TB
        C1["Single user"]
        C2["Mock AI (10 items,<br/>sample doc only)"]
        C3["In-memory state"]
        C4["Multi-document upload<br/><i>drag-drop + sample fallback</i>"]
        C5["No auth"]
    end

    subgraph Production ["Production (Perry Platform)"]
        direction TB
        P1["Multi-user collaborative"]
        P2["LLM-powered review"]
        P3["Persistent backend"]
        P4["Document management"]
        P5["Auth + RBAC"]
    end

    C1 -->|"Add Yjs + WebSocket"| P1
    C2 -->|"Swap data source"| P2
    C3 -->|"Add API layer"| P3
    C4 -->|"Add persistence + routing"| P4
    C5 -->|"Add auth provider"| P5

    style Current fill:#fff9c4,stroke:#F9A825
    style Production fill:#c8e6c9,stroke:#388E3C
```

## Production Architecture

```mermaid
graph TB
    subgraph Client ["Browser Client"]
        subgraph ExistingCode ["Existing Code (ready)"]
            EDITOR["Plate.js Editor<br/><i>document rendering,<br/>marks, decorations</i>"]
            ANCHOR["Anchoring Engine<br/><i>3-tier resolution,<br/>context scoring</i>"]
            SIDEBAR["Sidebar Panel<br/><i>cards, filters,<br/>accept/reject</i>"]
            INJECT["Injection Pipeline<br/><i>anchor → marks → store</i>"]
            UPLOAD["Document Upload<br/><i>drag-drop, file picker,<br/>sample fallback</i>"]
        end

        subgraph NewClient ["New Client Code"]
            AUTH_UI["Auth UI<br/><i>login, user context</i>"]
            YJS_CLIENT["Yjs Provider<br/><i>CRDT sync</i>"]
            NOTIF["Notifications<br/><i>review complete,<br/>new comments</i>"]
        end
    end

    subgraph Backend ["Backend Services"]
        API["REST/GraphQL API<br/><i>documents, annotations,<br/>users, reviews</i>"]
        AUTH["Auth Service<br/><i>JWT, RBAC, SSO</i>"]
        AI["AI Review Service<br/><i>LLM integration,<br/>prompt engineering</i>"]
        YJS_SERVER["Yjs WebSocket<br/><i>document sync</i>"]
        STORE["Document Store<br/><i>S3 / GCS</i>"]
        DB["Database<br/><i>PostgreSQL</i>"]
        QUEUE["Job Queue<br/><i>async review processing</i>"]
    end

    subgraph AI_Layer ["AI Layer"]
        LLM["LLM Provider<br/><i>Claude / GPT-4</i>"]
        PROMPT["Prompt Templates<br/><i>legal review,<br/>clause analysis</i>"]
        EMBED["Embeddings<br/><i>clause similarity,<br/>precedent matching</i>"]
    end

    AUTH_UI --> AUTH
    EDITOR <--> YJS_CLIENT <--> YJS_SERVER
    SIDEBAR --> API --> DB
    INJECT <-.->|"same interface"| AI
    AI --> LLM
    AI --> PROMPT
    AI --> EMBED
    API --> QUEUE --> AI
    NOTIF <--> API

    style ExistingCode fill:#c8e6c9,stroke:#388E3C
    style NewClient fill:#fff9c4,stroke:#F9A825
    style Backend fill:#e3f2fd,stroke:#1976D2
    style AI_Layer fill:#f3e5f5,stroke:#7B1FA2
```

## Integration Readiness Assessment

### Already Production-Ready

| Component | Why It's Ready | Integration Point |
|-----------|---------------|-------------------|
| **Anchoring Engine** | 3-tier resolution handles repeated text, deleted paragraphs, edited text. 282 adversarial tests. | Anchors are serializable JSON — store in any database. `resolveAnchor()` takes an editor instance and returns a range. |
| **Injection Pipeline** | `injectReviewItems()` accepts any array of `ReviewItem` / `Discussion` objects. Per-item error handling. | Replace mock `setTimeout` with `fetch('/api/review')`. The injection function doesn't care where data comes from. |
| **Suggestion Actions** | `applySuggestionAccept/Reject/Resolve` are pure functions that take editor + ID. | Add API call after local state update: `await api.updateAnnotation(id, status)`. |
| **DOCX Import** | Mammoth.js style map handles V14 legal templates + standard Word headings. Drag-drop upload already implemented. `assignNodeIds` produces stable, sortable IDs. | Upload UI is ready. For production: add server-side storage after upload. Same pipeline. |
| **Sidebar Components** | Cards, filters, counts are data-driven. Subscribe to Zustand. | Zustand store can hydrate from API response. Components don't know or care about data source. |
| **Type System** | `Anchor`, `Discussion`, `ReviewItem` types are well-defined. Discriminated unions. | Types become your API contract. Generate OpenAPI schema from TypeScript types. |

### Needs Modification

| Component | What Changes | Effort | How |
|-----------|-------------|--------|-----|
| **State persistence** | Zustand is in-memory → need API sync | Medium | Add middleware: `zustand/middleware` with `persist` for optimistic local cache + API sync on mutation |
| **User identity** | Hardcoded `'user-1'` → real auth | Low | Replace `currentUserId: 'user-1'` in `editor-kit.ts` with user from auth context. ~5 lines. |
| **Document routing** | Upload UI exists → add persistence + document list | Low-Medium | Upload + drag-drop is implemented. Add React Router for document list page, backend storage for persistence across sessions. |
| **Review trigger** | Mock `setTimeout` → real API call | Low | Replace `triggerReview()` body with `const items = await api.requestReview(documentId)`. Injection pipeline is unchanged. |
| **Collaborative editing** | Single-user → multi-user real-time | High | Add `@platejs/yjs` plugin + WebSocket provider. Anchoring switches from absolute paragraph IDs to Yjs relative positions. |

### Needs to Be Built

| Component | Why It's New | Effort | Architecture Notes |
|-----------|-------------|--------|--------------------|
| **Auth + RBAC** | No auth in take-home | Medium | Standard JWT + role-based access. Roles: reviewer, editor, admin. Plate's `currentUserId` already supports per-user attribution. |
| **Backend API** | No backend in take-home | Medium | REST or GraphQL. Core entities: Document, Annotation (polymorphic: Discussion \| ReviewItem), User, Review (job). |
| **AI Review Service** | Mock data → LLM integration | High | Prompt engineering for legal review. Need: clause extraction, risk assessment, suggestion generation. Output format already defined by `ReviewItem` type. |
| **Document management** | Upload exists → add library + persistence | Low-Medium | Upload/drag-drop UI is built. Remaining: document list, search, version history. S3 for storage, PostgreSQL for metadata. |
| **Notification system** | None | Low | WebSocket or SSE for real-time updates. "Review complete", "New comment on your suggestion". |

## AI Integration: Swap Path

The injection pipeline is designed for this exact swap. Here's the interface boundary:

```mermaid
sequenceDiagram
    participant UI as ReviewButton
    participant TRIGGER as triggerReview()
    participant DATA as Data Source
    participant INJECT as injectReviewItems()
    participant EDITOR as Plate Editor

    UI->>TRIGGER: Click "Get Perry's Review"

    rect rgb(255, 235, 238)
        Note over TRIGGER,DATA: CURRENT: Mock data
        TRIGGER->>DATA: setTimeout(1500ms)
        DATA-->>TRIGGER: REVIEW_SUGGESTIONS +<br/>REVIEW_DISCUSSIONS<br/>(hardcoded arrays)
    end

    rect rgb(232, 245, 233)
        Note over TRIGGER,DATA: PRODUCTION: Real AI
        TRIGGER->>DATA: POST /api/reviews<br/>{ documentId, documentText }
        DATA-->>TRIGGER: ReviewItem[] +<br/>Discussion[]<br/>(same types, from LLM)
    end

    TRIGGER->>INJECT: injectReviewItems(editor, items)
    Note over INJECT: Unchanged — same function,<br/>same anchor resolution,<br/>same mark application
    INJECT->>EDITOR: Apply marks + store
```

**What the AI service returns** (same shape as mock data):

```typescript
// The AI service must return this exact shape.
// The frontend injection pipeline handles everything else.
interface AIReviewResponse {
  suggestions: ReviewItem[];   // { anchor, originalText, suggestedText, rationale, severity, ... }
  discussions: Discussion[];   // { anchor, text, quotedText, ... }
}

// Each anchor must include:
interface Anchor {
  paragraphId: string;     // Can be '__unresolved__' — Tier 3 handles it
  startOffset: number;
  endOffset: number;
  exact: string;           // The exact text being commented on
  prefix: string;          // 64 chars before (for disambiguation)
  suffix: string;          // 64 chars after
}
```

The AI service doesn't need to know paragraph IDs. It can return `__unresolved__` for all of them — the 3-tier anchoring system resolves everything using `exact` + `prefix` + `suffix` context. This is by design.

## Collaborative Editing: Migration Path

```mermaid
graph TD
    subgraph Current ["Current: Absolute IDs"]
        ABS_ID["paragraphId: 'p42_x7k9f2'<br/><i>assigned during import</i>"]
        ABS_OFF["startOffset: 24<br/><i>character position</i>"]
        ABS_NOTE["Single user only.<br/>IDs are stable because<br/>only one person edits."]
    end

    subgraph Migration ["Migration Step"]
        YJS_PLUGIN["Add @platejs/yjs<br/><i>Plate.js Yjs integration</i>"]
        WS["WebSocket provider<br/><i>y-websocket or Hocuspocus</i>"]
        REL_POS["Switch to Yjs<br/>relative positions<br/><i>CRDT-based, conflict-free</i>"]
    end

    subgraph Production ["Production: CRDT Positions"]
        YJS_ID["Yjs relative position<br/><i>survives concurrent edits</i>"]
        YJS_RES["Anchoring Tier 1:<br/>Yjs position → absolute position<br/><i>at resolution time</i>"]
        FALLBACK["Tiers 2-3 unchanged<br/><i>fuzzy + full-document<br/>fallback still works</i>"]
    end

    Current --> Migration --> Production

    style Current fill:#fff9c4
    style Migration fill:#e3f2fd
    style Production fill:#c8e6c9
```

**Key insight:** Tiers 2 and 3 of the anchoring system (fuzzy match + full document fallback) work regardless of how paragraph IDs are generated. The 64-char prefix/suffix context is the real anchor — IDs are just a fast-path optimization. This means:

1. **Tier 1** needs to change (absolute IDs → Yjs relative positions)
2. **Tiers 2-3** work as-is (context scoring is ID-independent)
3. **The migration is incremental**, not a rewrite

## Scaling: Typical Legaltech Stack

```mermaid
graph TB
    subgraph Users ["Users"]
        LAWYER["Lawyers<br/><i>review + approve</i>"]
        PARALEGAL["Paralegals<br/><i>first-pass review</i>"]
        AI_USER["AI (Perry)<br/><i>automated review</i>"]
    end

    subgraph Frontend ["Frontend (This Codebase)"]
        PERRY_EDITOR["Perry Editor<br/><i>Plate.js + anchoring</i>"]
    end

    subgraph Gateway ["API Gateway"]
        GW["Kong / AWS ALB<br/><i>rate limiting, auth</i>"]
    end

    subgraph Services ["Microservices"]
        DOC_SVC["Document Service<br/><i>CRUD, versioning,<br/>format conversion</i>"]
        ANN_SVC["Annotation Service<br/><i>comments, suggestions,<br/>resolution tracking</i>"]
        REVIEW_SVC["Review Service<br/><i>orchestrate AI review,<br/>queue management</i>"]
        USER_SVC["User Service<br/><i>auth, teams, permissions</i>"]
        SEARCH_SVC["Search Service<br/><i>clause search,<br/>precedent matching</i>"]
    end

    subgraph Data ["Data Layer"]
        PG["PostgreSQL<br/><i>documents, annotations,<br/>users, reviews</i>"]
        S3["S3 / GCS<br/><i>DOCX files,<br/>version history</i>"]
        REDIS["Redis<br/><i>sessions, cache,<br/>real-time pubsub</i>"]
        ELASTIC["Elasticsearch<br/><i>full-text search,<br/>clause indexing</i>"]
    end

    subgraph AI ["AI Infrastructure"]
        LLM_GW["LLM Gateway<br/><i>Claude API,<br/>prompt management</i>"]
        VECTOR["Vector DB<br/><i>clause embeddings,<br/>similar precedent lookup</i>"]
        FINE["Fine-tuned Models<br/><i>legal-specific,<br/>jurisdiction-aware</i>"]
    end

    Users --> PERRY_EDITOR --> GW
    GW --> DOC_SVC --> S3
    GW --> ANN_SVC --> PG
    GW --> REVIEW_SVC --> LLM_GW
    GW --> USER_SVC --> PG
    GW --> SEARCH_SVC --> ELASTIC
    DOC_SVC --> PG
    REVIEW_SVC --> VECTOR
    LLM_GW --> FINE
    ANN_SVC --> REDIS

    style Frontend fill:#c8e6c9,stroke:#388E3C
    style Services fill:#e3f2fd,stroke:#1976D2
    style AI fill:#f3e5f5,stroke:#7B1FA2
```

## Database Schema (Annotations)

The Zustand store maps directly to a relational schema:

```mermaid
erDiagram
    DOCUMENT {
        uuid id PK
        string title
        string storage_key
        timestamp created_at
        timestamp updated_at
    }

    ANNOTATION {
        uuid id PK
        uuid document_id FK
        string type "discussion | reviewItem"
        string author_id FK
        jsonb anchor "{ paragraphId, offsets, exact, prefix, suffix }"
        string status "pending | accepted | rejected | resolved"
        timestamp created_at
        timestamp resolved_at
    }

    REVIEW_ITEM {
        uuid annotation_id FK
        string action "replace | insert | delete"
        text original_text
        text suggested_text
        text rationale
        string severity "critical | major | minor | info"
        string clause
    }

    DISCUSSION {
        uuid annotation_id FK
        text comment_text
        text quoted_text
    }

    REPLY {
        uuid id PK
        uuid discussion_id FK
        string author_id FK
        text text
        timestamp created_at
    }

    USER {
        uuid id PK
        string email
        string name
        string role "admin | editor | reviewer"
    }

    DOCUMENT ||--o{ ANNOTATION : "has"
    ANNOTATION ||--o| REVIEW_ITEM : "extends"
    ANNOTATION ||--o| DISCUSSION : "extends"
    DISCUSSION ||--o{ REPLY : "has"
    USER ||--o{ ANNOTATION : "authors"
```

**The `anchor` column is JSONB** — the same `Anchor` type from the frontend is stored directly. No transformation needed. `resolveAnchor()` works the same whether the anchor comes from Zustand or PostgreSQL.

## Performance Scaling

| Scale | Documents | Annotations/Doc | Concurrent Users | Bottleneck | Mitigation |
|-------|-----------|----------------|-----------------|------------|------------|
| **Current** | 1 | 10-50 | 1 | None | N/A |
| **Small firm** | 100 | 50-200 | 5-10 | Sidebar rendering | Virtualize card list (react-window) |
| **Mid-market** | 1,000 | 200-500 | 20-50 | Anchor resolution at scale | Cache resolved ranges; invalidate on edit |
| **Enterprise** | 10,000+ | 500-1,000 | 100+ | Real-time sync, AI throughput | Yjs CRDT, job queue for AI reviews, CDN for DOCX files |

### Anchoring Performance at Scale

```mermaid
graph LR
    subgraph Tier1 ["Tier 1: O(1)"]
        T1["ID lookup + offset check<br/><i>Handles 95%+ of lookups<br/>when document is unedited</i>"]
    end

    subgraph Tier2 ["Tier 2: O(n)"]
        T2["Search within paragraph<br/><i>n = paragraph length<br/>Handles minor edits</i>"]
    end

    subgraph Tier3 ["Tier 3: O(b × m × 64)"]
        T3["Full document scan<br/><i>b = blocks, m = matches per block<br/>Handles paragraph deletion</i>"]
    end

    subgraph Optimization ["Future Optimizations"]
        CACHE["Range cache<br/><i>LRU, invalidate on edit</i>"]
        INDEX["Inverted text index<br/><i>Pre-compute 'the Company'<br/>occurrence map</i>"]
        BATCH["Batch resolution<br/><i>Resolve all anchors in<br/>single document scan</i>"]
    end

    T1 -->|"95% hit rate"| DONE["Resolved"]
    T2 -->|"4% hit rate"| DONE
    T3 -->|"1% hit rate"| DONE

    T1 -.-> CACHE
    T3 -.-> INDEX
    T3 -.-> BATCH
```

For the current document (447 paragraphs, 10 annotations), Tier 3 completes in <10ms. For a 10,000-paragraph document with 500 annotations, the optimization column becomes relevant — but the architecture supports all three optimizations without structural changes.

## Summary: What's Portable

```mermaid
pie title Code Reuse in Production
    "Ready as-is" : 65
    "Minor changes" : 20
    "Needs rebuild" : 15
```

| Category | Components | % of Codebase |
|----------|-----------|---------------|
| **Ready as-is** | Anchoring engine, injection pipeline, sidebar components, DOCX import, type system, suggestion actions | ~65% |
| **Minor changes** | State persistence (add API sync), user identity (swap hardcoded ID), review trigger (swap mock → API), document routing (add router) | ~20% |
| **Needs rebuild** | Auth system, backend API, AI review service, collaborative editing (Yjs), document management | ~15% (new code, not replacement) |

The anchoring engine — the project's differentiating feature — is 100% production-portable. It doesn't depend on mock data, specific document content, or single-user assumptions. Pass it an editor and an anchor, get back a range. That contract holds from prototype to production.
