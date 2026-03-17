# Architecture Overview

> 15-second glance: how the system works, end to end.

## System Flow

```mermaid
graph LR
    subgraph Import ["1. Document Import"]
        DOCX["DOCX File<br/><i>17,464 words</i>"]
        MAM["Mammoth.js<br/><i>V14 style map</i>"]
        DES["deserializeHtml<br/><i>Plate.js</i>"]
        IDS["assignNodeIds<br/><i>p{n}_{nanoid}</i>"]
    end

    subgraph Editor ["2. Rich Text Editor"]
        PLATE["Plate.js v52<br/><i>Slate foundation</i>"]
        PLUGINS["Plugins<br/><i>Comment, Suggestion,<br/>Heading, Table, List</i>"]
        DECORATE["Reactive Decorations<br/><i>Highlight, Comment marks</i>"]
    end

    subgraph Anchoring ["3. Anchoring Engine"]
        CREATE["createAnchor<br/><i>paragraphId + offsets<br/>+ 64-char context</i>"]
        RESOLVE["resolveAnchor<br/><i>3-tier resolution</i>"]
        FUZZY["fuzzyFind + scoreContext<br/><i>prefix/suffix matching</i>"]
    end

    subgraph State ["4. State Management"]
        ZUSTAND["Zustand Store<br/><i>discussions, reviewItems,<br/>selectedCard, filters</i>"]
        ACTIONS["suggestion-actions<br/><i>accept / reject / resolve</i>"]
    end

    subgraph UI ["5. User Interface"]
        TOOLBAR["Toolbar<br/><i>Review Button,<br/>Suggesting Toggle</i>"]
        SIDEBAR["Sidebar Panel<br/><i>Cards, Filters,<br/>Accept/Reject</i>"]
        FLOAT["Floating Comment<br/><i>Selection → Comment</i>"]
    end

    DOCX --> MAM --> DES --> IDS --> PLATE
    PLATE --- PLUGINS
    PLATE --- DECORATE
    TOOLBAR --> PLATE
    FLOAT --> CREATE --> ZUSTAND
    SIDEBAR -->|"click card"| RESOLVE --> DECORATE
    RESOLVE --- FUZZY
    ZUSTAND --> SIDEBAR
    ZUSTAND --> DECORATE
    ACTIONS --> PLATE
    ACTIONS --> ZUSTAND
```

## Data Flow: "Get Perry's Review"

```mermaid
sequenceDiagram
    participant U as User
    participant TB as ReviewButton
    participant INJ as inject-review.ts
    participant RA as resolveAnchor
    participant ED as Plate Editor
    participant ZS as Zustand Store
    participant SB as Sidebar

    U->>TB: Click "Get Perry's Review"
    TB->>ZS: setReviewLoading(true)
    TB->>INJ: triggerReview(editor)
    Note over INJ: setTimeout 1500ms<br/>(simulate AI)

    loop For each of 10 review items
        INJ->>RA: resolveAnchor(editor, anchor)
        RA-->>INJ: TRange | null
        alt Anchor resolved
            INJ->>ED: Apply suggestion/comment marks
            INJ->>ZS: addReviewItem / addDiscussion
        else Anchor failed
            INJ->>INJ: Log skip, continue
        end
    end

    INJ-->>TB: InjectionResult
    TB->>ZS: setReviewLoading(false)
    ZS-->>SB: Re-render with 10 cards
```

## Data Flow: Card Click → Scroll + Highlight

```mermaid
sequenceDiagram
    participant U as User
    participant SB as Sidebar Card
    participant ZS as Zustand Store
    participant AN as AnchorNavigator
    participant RA as resolveAnchor
    participant ED as Plate Editor
    participant DOM as Browser DOM

    U->>SB: Click card
    SB->>ZS: setSelectedCard(id)
    ZS-->>AN: selectedCardId changed
    AN->>AN: Find annotation by ID
    AN->>RA: resolveAnchor(editor, anchor)

    alt Tier 1: Exact ID + offset
        RA-->>AN: TRange (fast path)
    else Tier 2: Fuzzy match same paragraph
        RA->>RA: fuzzyFindInText
        RA-->>AN: TRange
    else Tier 3: Full document fallback
        RA->>RA: Search all blocks + scoreContext
        RA-->>AN: TRange (best match, score > 0)
    end

    AN->>ZS: setHighlightRange(range)
    AN->>ZS: setHighlightPhase('active')
    ZS-->>ED: Decorate callback re-created
    ED->>DOM: Yellow highlight rendered
    AN->>DOM: scrollIntoView({ behavior: 'smooth' })
```

## Component Architecture

```mermaid
graph TD
    subgraph App ["App.tsx"]
        UPLOAD["Upload Zone<br/><i>drag-drop / file picker<br/>or Load Sample</i>"]
        FETCH["loadFromArrayBuffer<br/>→ convertDocxToHtml<br/>→ resetStore"]
    end

    subgraph Layout ["AppShell (2:1 layout)"]
        subgraph Left ["Editor Panel (flex-2)"]
            PE["PlateEditor"]
            PEC["PlateEditorContent<br/><i>decorate prop</i>"]
            AN["AnchorNavigator<br/><i>headless</i>"]
            FC["FloatingCommentButton"]
        end
        subgraph Right ["Sidebar (flex-1)"]
            SH["SidebarHeader<br/><i>counts + filter tabs</i>"]
            SP["SidebarPanel<br/><i>card list</i>"]
            SC["SuggestionCard"]
            CC["CommentCard"]
        end
        subgraph Top ["Toolbar"]
            RB["ReviewButton"]
            ST["SuggestingToggle"]
        end
    end

    App --> Layout
    UPLOAD --> FETCH --> PE
    PE --> PEC
    PE --> AN
    SP --> SC
    SP --> CC

    subgraph Lib ["Business Logic (src/lib/)"]
        ANCHOR["anchoring/<br/>create, resolve,<br/>fuzzy-find,<br/>offset-to-range"]
        STORE["annotations/<br/>store.ts,<br/>suggestion-actions.ts"]
        MOCK["mock-review/<br/>review-items.ts,<br/>inject-review.ts"]
        DOCX["docx-import/<br/>import-pipeline.ts,<br/>deserialize.ts"]
    end

    PE -.->|"deserialization"| DOCX
    RB -.->|"trigger"| MOCK
    MOCK -.->|"resolve"| ANCHOR
    FC -.->|"create anchor"| ANCHOR
    AN -.->|"resolve anchor"| ANCHOR
    SC -.->|"accept/reject"| STORE
    CC -.->|"resolve"| STORE
    SP -.->|"subscribe"| STORE
```

## State Ownership

```mermaid
graph LR
    subgraph Plate ["Plate.js (Editor State)"]
        DOC["Document tree<br/><i>paragraphs, headings,<br/>tables, lists</i>"]
        MARKS["Text marks<br/><i>comment_id: true<br/>suggestion_id: {...}</i>"]
        PIDS["Paragraph IDs<br/><i>p0_abc123</i>"]
        SEL["Selection<br/><i>anchor + focus</i>"]
        UNDO["Undo/Redo<br/><i>history stack</i>"]
    end

    subgraph Zustand ["Zustand (UI State)"]
        DISC["discussions[]"]
        REV["reviewItems[]"]
        CARD["selectedCardId"]
        FILT["filterType"]
        HIGH["highlightRange<br/>highlightPhase"]
        LOAD["isReviewLoading"]
    end

    Plate ---|"marks on text nodes"| MARKS
    Zustand ---|"sidebar metadata"| DISC
    Zustand ---|"sidebar metadata"| REV

    style Plate fill:#e8f4fd,stroke:#2196F3
    style Zustand fill:#fef3e8,stroke:#FF9800
```

> **Why the split?** Plate owns data that participates in undo/redo and lives on text nodes. Zustand owns UI metadata (sidebar cards, filters, navigation state). Neither re-renders the other's domain.

## Tech Stack at a Glance

```mermaid
graph TB
    subgraph Frontend ["Frontend (React 18 + TypeScript strict)"]
        VITE["Vite 6.0<br/><i>Build + HMR</i>"]
        REACT["React 18.3<br/><i>UI framework</i>"]
        TAIL["Tailwind 4.2<br/><i>Styling</i>"]
    end

    subgraph EditorStack ["Editor (Plate.js v52)"]
        PLATEJS["platejs 52.3<br/><i>Slate-based editor</i>"]
        COMMENT["@platejs/comment<br/><i>Inline comments</i>"]
        SUGGEST["@platejs/suggestion<br/><i>Track changes</i>"]
        NODES["@platejs/basic-nodes<br/><i>Headings, formatting</i>"]
        TABLE["@platejs/table<br/><i>Table support</i>"]
        LIST["@platejs/list<br/><i>OL/UL lists</i>"]
    end

    subgraph DataLayer ["Data Layer"]
        ZUS["Zustand 5.0<br/><i>UI state</i>"]
        MAMMOTH["Mammoth.js 1.12<br/><i>DOCX → HTML</i>"]
    end

    subgraph Testing ["Testing (282 tests)"]
        VIT["Vitest 4.1<br/><i>Test runner</i>"]
        RTL["React Testing Library 16.3<br/><i>Component tests</i>"]
    end

    Frontend --> EditorStack
    Frontend --> DataLayer
    Frontend --> Testing
```

## Anchoring: The Differentiator

```mermaid
graph TD
    subgraph Anchor ["Anchor Object"]
        PID["paragraphId: 'p42_x7k9f2'"]
        OFF["startOffset: 24<br/>endOffset: 35"]
        EX["exact: 'the Company'"]
        PRE["prefix: '...event of default, '<br/><i>64 chars</i>"]
        SUF["suffix: ' must pay damages...'<br/><i>64 chars</i>"]
    end

    subgraph Resolution ["3-Tier Resolution"]
        T1["Tier 1: Exact ID + Offset<br/><i>O(1) — paragraph found,<br/>text matches at stored offsets</i>"]
        T2["Tier 2: Fuzzy Match<br/><i>O(n) — paragraph found,<br/>text shifted, search within block</i>"]
        T3["Tier 3: Full Fallback<br/><i>O(blocks x occurrences) —<br/>paragraph deleted, search<br/>entire document by context</i>"]
    end

    Anchor --> T1
    T1 -->|"miss"| T2
    T2 -->|"miss"| T3
    T3 -->|"score > 0"| HIT["Resolved TRange"]
    T3 -->|"score = 0"| MISS["null (unresolvable)"]
    T1 -->|"hit"| HIT
    T2 -->|"hit"| HIT

    style T1 fill:#c8e6c9,stroke:#388E3C
    style T2 fill:#fff9c4,stroke:#F9A825
    style T3 fill:#ffcdd2,stroke:#D32F2F
    style HIT fill:#c8e6c9,stroke:#388E3C
    style MISS fill:#ffcdd2,stroke:#D32F2F
```

## File Map (key files only)

```
src/
├── App.tsx                              # Entry: upload UI → load DOCX → render
├── editor/
│   ├── plate-editor.tsx                 # Editor setup + reactive decorations
│   ├── editor-kit.ts                    # Plugin assembly (10 plugins)
│   ├── anchor-navigator.tsx             # Card click → resolve → scroll
│   └── plugins/                         # Custom leaf renderers
├── components/
│   ├── layout/app-shell.tsx             # 2:1 grid layout
│   ├── sidebar/sidebar-panel.tsx        # Card list + filters
│   ├── sidebar/suggestion-card.tsx      # Suggestion card UI
│   ├── sidebar/comment-card.tsx         # Comment card UI
│   ├── toolbar/review-button.tsx        # "Get Perry's Review"
│   ├── toolbar/suggesting-toggle.tsx    # Track changes toggle
│   └── toolbar/floating-comment-button  # Selection → comment
├── lib/
│   ├── anchoring/                       # THE HARD PROBLEM
│   │   ├── resolve-anchor.ts            # 3-tier resolution
│   │   ├── create-anchor.ts             # Selection → anchor
│   │   ├── fuzzy-find.ts                # Context scoring
│   │   └── offset-to-range.ts           # Offset ↔ Slate range
│   ├── annotations/
│   │   ├── store.ts                     # Zustand store
│   │   └── suggestion-actions.ts        # Accept/reject/resolve
│   ├── mock-review/
│   │   ├── review-items.ts              # 10 verified mock items
│   │   └── inject-review.ts             # Injection pipeline
│   └── docx-import/
│       ├── import-pipeline.ts           # Mammoth.js conversion
│       └── deserialize.ts               # ID assignment
└── types/annotations.ts                 # Anchor, Discussion, ReviewItem
```
