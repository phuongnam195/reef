export interface Example {
  id: string;
  name: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'flowchart',
    name: 'Flowchart',
    code: `flowchart LR
    A([Write code]) --> B{Valid syntax?}
    B -- Yes --> C[Render preview]
    B -- No --> D[Show error]
    D --> A
    C --> E[Pick a theme]
    E --> F[/Export SVG or PNG/]

    subgraph Output
      F
    end
`,
  },
  {
    id: 'sequence',
    name: 'Sequence',
    code: `sequenceDiagram
    autonumber
    actor User
    participant Editor
    participant Renderer
    participant Exporter

    User->>Editor: Type diagram code
    Editor->>Renderer: Debounced render (300 ms)
    alt Code is valid
      Renderer-->>Editor: SVG
    else Syntax error
      Renderer-->>Editor: Error message
      Note over Editor: Last valid SVG stays visible
    end
    User->>Exporter: Export PNG @2x
    Exporter-->>User: diagram.png
`,
  },
  {
    id: 'class',
    name: 'Class',
    code: `classDiagram
    class AppTheme {
      +string id
      +string name
      +MermaidConfig mermaid
      +Canvas canvas
    }
    class Renderer {
      -number counter
      +render(code, theme) Promise~string~
    }
    class Exporter {
      +toSvg(svg, theme) string
      +toPng(svg, scale) Blob
    }
    class Canvas {
      +string background
      +number padding
    }
    AppTheme *-- Canvas
    Renderer ..> AppTheme : uses
    Exporter ..> AppTheme : uses
`,
  },
  {
    id: 'state',
    name: 'State',
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Rendering : code changed
    Rendering --> Ready : success
    Rendering --> Failed : parse error
    Failed --> Rendering : code changed
    Ready --> Exporting : export clicked
    Exporting --> Ready : file saved
    Ready --> [*]
`,
  },
  {
    id: 'er',
    name: 'Entity relationship',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    CUSTOMER {
      int id PK
      string name
      string email
    }
    ORDER {
      int id PK
      int customer_id FK
      date created_at
    }
    LINE_ITEM {
      int order_id FK
      int product_id FK
      int quantity
    }
    PRODUCT {
      int id PK
      string title
      float price
    }
`,
  },
  {
    id: 'gantt',
    name: 'Gantt',
    code: `gantt
    title Reef roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Foundation
    Project skeleton     :done,    p0, 2026-01-05, 1d
    Editor and render    :done,    p1, after p0, 2d
    section Look and feel
    Built-in themes      :active,  p2, after p1, 2d
    Preview pan and zoom :         p3, after p2, 1d
    section Output
    SVG and PNG export   :crit,    p4, after p3, 2d
    Polish and testing   :         p5, after p4, 1d
`,
  },
  {
    id: 'pie',
    name: 'Pie',
    code: `pie showData
    title Where the time goes
    "Export edge cases" : 35
    "Themes" : 25
    "Editor and render" : 20
    "Preview" : 10
    "Polish" : 10
`,
  },
];

export const DEFAULT_CODE = EXAMPLES[0].code;
