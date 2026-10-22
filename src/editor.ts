import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  highlightSpecialChars,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  StreamLanguage,
  HighlightStyle,
  syntaxHighlighting,
  bracketMatching,
  indentOnInput,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

const KEYWORDS = new Set(
  [
    'graph flowchart sequenceDiagram classDiagram stateDiagram stateDiagram-v2 erDiagram gantt pie',
    'journey gitGraph mindmap timeline quadrantChart requirementDiagram sankey-beta xychart-beta block-beta',
    'subgraph end participant actor note over loop alt else opt par and rect critical break autonumber',
    'activate deactivate section title dateFormat axisFormat excludes todayMarker class classDef style',
    'linkStyle direction click state showData accTitle accDescr',
  ]
    .join(' ')
    .split(' '),
);
const DIRECTIONS = new Set(['TB', 'TD', 'BT', 'RL', 'LR']);

// A small tokenizer: enough to make Mermaid code readable, not a full grammar.
const mermaidLanguage = StreamLanguage.define<{ inFrontMatter: boolean }>({
  name: 'mermaid',
  startState: () => ({ inFrontMatter: false }),
  token(stream, state) {
    if (stream.sol() && stream.match(/^---\s*$/)) {
      state.inFrontMatter = !state.inFrontMatter;
      return 'meta';
    }
    if (state.inFrontMatter) {
      stream.skipToEnd();
      return 'meta';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('%%')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
    if (stream.match(/^[<>ox*]?(?:-{2,}|={2,}|\.{1,}-|-\.+-?|~{3})[>ox*]?|^[-.]+>>?|^-[x)]/))
      return 'operator';
    if (stream.match(/^\|\|--|^\}o--|^o\{|^\|\{|^\}\||^\|o/)) return 'operator';
    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';
    if (stream.match(/^[A-Za-z_][\w-]*/)) {
      const word = stream.current();
      if (KEYWORDS.has(word)) return 'keyword';
      if (DIRECTIONS.has(word)) return 'atom';
      return 'variableName';
    }
    if (stream.match(/^[[\](){}]/)) return 'bracket';
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '%%' } },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: tags.atom, color: 'var(--syn-atom)' },
  { tag: tags.string, color: 'var(--syn-string)' },
  { tag: tags.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: tags.operator, color: 'var(--syn-operator)' },
  { tag: tags.number, color: 'var(--syn-number)' },
  { tag: tags.meta, color: 'var(--syn-comment)' },
  { tag: tags.bracket, color: 'var(--syn-bracket)' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'var(--editor-bg)' },
  '.cm-scroller': { fontFamily: '"JetBrains Mono", ui-monospace, monospace', lineHeight: '1.65' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text-faint)',
    border: 'none',
    paddingLeft: '6px',
  },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-muted)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection) !important',
  },
  '.cm-errorLine': { backgroundColor: 'var(--danger-soft)' },
  '&.cm-focused': { outline: 'none' },
});

const setErrorLine = StateEffect.define<number | null>();
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue;
      const line = effect.value;
      if (line == null || line < 1 || line > tr.state.doc.lines) {
        deco = Decoration.none;
      } else {
        const from = tr.state.doc.line(line).from;
        deco = Decoration.set([Decoration.line({ class: 'cm-errorLine' }).range(from)]);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface Editor {
  view: EditorView;
  getCode(): string;
  setCode(code: string): void;
  markErrorLine(line: number | null): void;
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange: (code: string) => void,
): Editor {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    mermaidLanguage,
    syntaxHighlighting(highlight),
    editorTheme,
    errorLineField,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Diagram code' }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];

  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: initial, extensions }),
  });

  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode(code) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
    },
    markErrorLine(line) {
      view.dispatch({ effects: setErrorLine.of(line) });
    },
  };
}
