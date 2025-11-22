import React, { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap } from '@codemirror/commands';
import { basicSetup } from 'codemirror';

interface SqlEditorProps {
    value: string;
    onChange: (value: string) => void;
    onRun: () => void;
    onRunAndAdd: () => void;
}

const SqlEditor: React.FC<SqlEditorProps> = ({ value, onChange, onRun, onRunAndAdd }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Use refs for callbacks to avoid stale closures in the effect
    const onChangeRef = useRef(onChange);
    const onRunRef = useRef(onRun);
    const onRunAndAddRef = useRef(onRunAndAdd);

    useEffect(() => {
        onChangeRef.current = onChange;
        onRunRef.current = onRun;
        onRunAndAddRef.current = onRunAndAdd;
    }, [onChange, onRun, onRunAndAdd]);

    useEffect(() => {
        if (!editorRef.current) return;

        const state = EditorState.create({
            doc: value,
            extensions: [
                basicSetup,
                sql(),
                oneDark,
                Prec.highest(keymap.of([
                    {
                        key: "Mod-Enter",
                        run: () => {
                            onRunRef.current();
                            return true;
                        },
                        preventDefault: true
                    },
                    {
                        key: "Shift-Enter",
                        run: () => {
                            onRunAndAddRef.current();
                            return true;
                        },
                        preventDefault: true
                    }
                ])),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChangeRef.current(update.state.doc.toString());
                    }
                }),
                EditorView.theme({
                    "&": { height: "auto", minHeight: "50px" },
                    ".cm-scroller": { overflow: "hidden" }
                })
            ]
        });

        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, []); // Init once

    return <div ref={editorRef} className="sql-editor-container" />;
};

export default SqlEditor;
