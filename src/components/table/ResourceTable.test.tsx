import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from './ResourceTable';

interface Row {
  name: string;
  namespace: string;
}

const columnHelper = createColumnHelper<Row>();
const columns: ColumnDef<Row, any>[] = [
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('namespace', { header: 'Namespace' }),
];

const rows: Row[] = [
  { name: 'zebra-pod', namespace: 'default' },
  { name: 'alpha-pod', namespace: 'kube-system' },
  { name: 'middle-pod', namespace: 'default' },
];

describe('ResourceTable', () => {
  it('renders every row', () => {
    render(<ResourceTable data={rows} columns={columns} getRowId={(r) => r.name} />);
    for (const row of rows) {
      expect(screen.getByText(row.name)).toBeInTheDocument();
    }
  });

  it('shows a spinner while loading instead of the table', () => {
    render(<ResourceTable data={rows} columns={columns} isLoading getRowId={(r) => r.name} />);
    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
    expect(screen.queryByText('zebra-pod')).not.toBeInTheDocument();
  });

  it('shows the empty state when there is no data', () => {
    render(<ResourceTable data={[]} columns={columns} emptyMessage="Nothing here." getRowId={(r) => r.name} />);
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('shows the error alert instead of the table when a query fails', () => {
    render(<ResourceTable data={undefined} columns={columns} error={new Error('boom')} getRowId={(r) => r.name} />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('filters rows via the search input', async () => {
    const user = userEvent.setup();
    render(<ResourceTable data={rows} columns={columns} searchPlaceholder="Find..." getRowId={(r) => r.name} />);

    await user.type(screen.getByPlaceholderText('Find...'), 'alpha');

    expect(screen.getByText('alpha-pod')).toBeInTheDocument();
    expect(screen.queryByText('zebra-pod')).not.toBeInTheDocument();
    expect(screen.queryByText('middle-pod')).not.toBeInTheDocument();
  });

  it('sorts rows when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    render(<ResourceTable data={rows} columns={columns} getRowId={(r) => r.name} />);

    await user.click(screen.getByRole('button', { name: 'Name' }));

    const cells = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(cells).toEqual(['alpha-pod', 'middle-pod', 'zebra-pod']);
  });
});
