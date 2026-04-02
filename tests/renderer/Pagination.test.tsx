import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../../src/renderer/components/Pagination';

describe('Pagination', () => {
  it('shows correct range text', () => {
    render(<Pagination page={1} pageSize={1000} totalCount={2500} onPageChange={() => {}} />);
    expect(screen.getByText('Showing 1-1,000 of 2,500 rows')).toBeTruthy();
  });

  it('shows last page partial range', () => {
    render(<Pagination page={3} pageSize={1000} totalCount={2500} onPageChange={() => {}} />);
    expect(screen.getByText('Showing 2,001-2,500 of 2,500 rows')).toBeTruthy();
  });

  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={1000} totalCount={2500} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('Next →'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables prev on first page', () => {
    const { container } = render(<Pagination page={1} pageSize={1000} totalCount={2500} onPageChange={() => {}} />);
    const prevBtn = container.querySelector('.pagination-btn');
    expect(prevBtn?.getAttribute('style')).toContain('0.3');
  });
});
