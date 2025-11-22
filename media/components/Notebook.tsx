import React from 'react';
import Cell from './Cell';
import { CellData } from '../App';

interface NotebookProps {
    cells: CellData[];
    onRun: (id: string) => void;
    onRunAndAdd: (id: string) => void;
    onUpdate: (id: string, data: Partial<CellData>) => void;
    onRemove: (id: string) => void;
}

const Notebook: React.FC<NotebookProps> = ({ cells, onRun, onRunAndAdd, onUpdate, onRemove }) => {
    return (
        <div className="notebook">
            {cells.map((cell, index) => (
                <Cell
                    key={cell.id}
                    data={cell}
                    onRun={() => onRun(cell.id)}
                    onRunAndAdd={() => onRunAndAdd(cell.id)}
                    onUpdate={(updates) => onUpdate(cell.id, updates)}
                    onRemove={() => onRemove(cell.id)}
                    isLast={index === cells.length - 1}
                />
            ))}
        </div>
    );
};

export default Notebook;
