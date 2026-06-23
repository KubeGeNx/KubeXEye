import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from './ResourceTable';

/** ResourceTable reads the ?search= URL param via useSearchParams, so it needs a Router. */
function renderTable(ui: ReactElement, route = '/') {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

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
    renderTable(<ResourceTable data={rows} columns={columns} getRowId={(r) => r.name} />);
    for (const row of rows) {
      expect(screen.getByText(row.name)).toBeInTheDocument();
    }
  });

  it('shows a spinner while loading instead of the table', () => {
    renderTable(<ResourceTable data={rows} columns={columns} isLoading getRowId={(r) => r.name} />);
    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
    expect(screen.queryByText('zebra-pod')).not.toBeInTheDocument();
  });

  it('shows the empty state when there is no data', () => {
    renderTable(<ResourceTable data={[]} columns={columns} emptyMessage="Nothing here." getRowId={(r) => r.name} />);
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('shows the error alert instead of the table when a query fails', () => {
    renderTable(<ResourceTable data={undefined} columns={columns} error={new Error('boom')} getRowId={(r) => r.name} />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('filters rows via the search input', async () => {
    const user = userEvent.setup();
    renderTable(<ResourceTable data={rows} columns={columns} searchPlaceholder="Find..." getRowId={(r) => r.name} />);

    await user.type(screen.getByPlaceholderText(/Find\.\.\./), 'alpha');

    expect(screen.getByText('alpha-pod')).toBeInTheDocument();
    expect(screen.queryByText('zebra-pod')).not.toBeInTheDocument();
    expect(screen.queryByText('middle-pod')).not.toBeInTheDocument();
  });

  it('seeds the filter from the ?search= URL param (GlobalSearch deep-link)', () => {
    renderTable(<ResourceTable data={rows} columns={columns} getRowId={(r) => r.name} />, '/pods?search=alpha');

    expect(screen.getByText('alpha-pod')).toBeInTheDocument();
    expect(screen.queryByText('zebra-pod')).not.toBeInTheDocument();
    expect(screen.queryByText('middle-pod')).not.toBeInTheDocument();
  });

  it('sorts rows when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    renderTable(<ResourceTable data={rows} columns={columns} getRowId={(r) => r.name} />);

    await user.click(screen.getByRole('button', { name: 'Name' }));

    const cells = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(cells).toEqual(['alpha-pod', 'middle-pod', 'zebra-pod']);
  });
});
