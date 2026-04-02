import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterTopbar from '../../src/renderer/components/FilterTopbar';

const columns = [
  { name: 'id', type: 'int', nullable: false, key: 'PRI', defaultValue: null, extra: '' },
  { name: 'status', type: "enum('active','inactive')", nullable: false, key: '', defaultValue: null, extra: '', enumValues: ['active', 'inactive'] },
  { name: 'name', type: 'varchar(255)', nullable: true, key: '', defaultValue: null, extra: '' },
];

describe('FilterTopbar', () => {
  it('renders with structured mode by default', () => {
    render(<FilterTopbar columns={columns} onFilterChange={() => {}} saveMode="auto" onSaveModeChange={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('+ Add Filter')).toBeTruthy();
  });

  it('switches to raw WHERE mode', () => {
    render(<FilterTopbar columns={columns} onFilterChange={() => {}} saveMode="auto" onSaveModeChange={() => {}} onRefresh={() => {}} />);
    fireEvent.click(screen.getByText('WHERE clause'));
    expect(screen.getByPlaceholderText("e.g. status = 'active' AND age > 18")).toBeTruthy();
  });

  it('toggles save mode', () => {
    const onSaveModeChange = vi.fn();
    render(<FilterTopbar columns={columns} onFilterChange={() => {}} saveMode="auto" onSaveModeChange={onSaveModeChange} onRefresh={() => {}} />);
    fireEvent.click(screen.getByText('Bulk Commit'));
    expect(onSaveModeChange).toHaveBeenCalledWith('bulk');
  });
});
