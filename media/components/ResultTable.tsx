import React, { useEffect, useRef } from 'react';

interface ResultTableProps {
    columns: string[];
    rows: any[];
}

const ResultTable: React.FC<ResultTableProps> = ({ columns, rows }) => {
    const tableRef = useRef<HTMLTableElement>(null);

    useEffect(() => {
        const table = tableRef.current;
        if (!table) return;

        const headers = table.querySelectorAll('th');
        headers.forEach((th, index) => {
            // Clean up old listeners if any (though React handles DOM mostly)
            // We'll attach fresh listeners

            let startX: number;
            let startWidth: number;

            const onMouseMove = (e: MouseEvent) => {
                const width = startWidth + (e.clientX - startX);
                th.style.width = Math.max(50, width) + 'px';

                // We don't strictly need to update cells if table-layout is fixed
                // but for auto layout it helps.
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };

            const onMouseDown = (e: MouseEvent) => {
                const rect = th.getBoundingClientRect();
                if (e.clientX > rect.right - 10) {
                    startX = e.clientX;
                    startWidth = th.offsetWidth;
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    e.preventDefault();
                }
            };

            th.addEventListener('mousedown', onMouseDown);

            // Cursor hover effect
            const onHover = (e: MouseEvent) => {
                const rect = th.getBoundingClientRect();
                th.style.cursor = e.clientX > rect.right - 10 ? 'col-resize' : 'default';
            };
            th.addEventListener('mousemove', onHover);

            // Cleanup closure
            (th as any)._cleanup = () => {
                th.removeEventListener('mousedown', onMouseDown);
                th.removeEventListener('mousemove', onHover);
            };
        });

        return () => {
            headers.forEach((th: any) => {
                if (th._cleanup) th._cleanup();
            });
        };
    }, [columns]); // Re-run if columns change

    if (!columns.length) {
        return <div className="muted">No results</div>;
    }

    return (
        <div className="table-container">
            <table ref={tableRef}>
                <thead>
                    <tr>
                        {columns.map((col, i) => (
                            <th key={i}>{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {columns.map((col, j) => (
                                <td key={j} title={String(row[col] ?? '')}>
                                    {String(row[col] ?? '')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ResultTable;
