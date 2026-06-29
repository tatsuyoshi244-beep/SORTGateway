import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/ui/PageHeader';

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="テスト画面" description="説明テキスト" />);
    expect(screen.getByRole('heading', { name: 'テスト画面' })).toBeInTheDocument();
    expect(screen.getByText('説明テキスト')).toBeInTheDocument();
  });
});
