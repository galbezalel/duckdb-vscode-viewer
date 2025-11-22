import React from 'react';
import { Play, Trash2, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CellData } from '../App';
import SqlEditor from './SqlEditor';
import ResultTable from './ResultTable';

interface CellProps {
    data: CellData;
    onRun: () => void;
    onRunAndAdd: () => void;
    onUpdate: (data: Partial<CellData>) => void;
    onRemove: () => void;
    isLast: boolean;
}

const Cell: React.FC<CellProps> = ({ data, onRun, onRunAndAdd, onUpdate, onRemove }) => {
    return (
        <div className={`cell ${data.status}`}>
            <div className="cell-header">
                <div className="cell-status">
                    {data.status === 'running' && <div className="spinner" />}
                    {data.status === 'success' && <CheckCircle2 size={14} className="text-success" />}
                    {data.status === 'error' && <AlertCircle size={14} className="text-error" />}
                    <span className="status-text">
                        {data.status === 'idle' ? 'Ready' :
                            data.status === 'running' ? 'Running...' :
                                data.status === 'success' ? `Finished in ${data.executionTime?.toFixed(2)}ms` : 'Error'}
                    </span>
                </div>
                <div className="cell-actions">
                    <button onClick={onRun} className="icon-btn run-btn" title="Run (Cmd+Enter)">
                        <Play size={14} />
                    </button>
                    <button onClick={onRemove} className="icon-btn delete-btn" title="Delete Cell">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="cell-editor">
                <SqlEditor
                    value={data.query}
                    onChange={(val) => onUpdate({ query: val })}
                    onRun={onRun}
                    onRunAndAdd={onRunAndAdd}
                />
            </div>

            {data.error && (
                <div className="cell-error">
                    <AlertCircle size={16} />
                    <pre>{data.error}</pre>
                </div>
            )}

            {data.status === 'success' && data.columns && (
                <div className="cell-results">
                    <ResultTable columns={data.columns} rows={data.rows || []} />
                </div>
            )}
        </div>
    );
};

export default Cell;
