import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';

const mocks = vi.hoisted(() => ({
  demoMode: true,
  login: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

vi.mock('@/lib/env', () => ({
  allowsDemoAuth: () => mocks.demoMode,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    login: mocks.login,
    isLoading: false,
    isSupabaseAuth: !mocks.demoMode,
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mocks.demoMode = true;
    mocks.login.mockReset();
    mocks.login.mockResolvedValue({ ok: true });
    mocks.push.mockReset();
    mocks.replace.mockReset();
  });

  it('uses company ID, employee number, and password for demo login', async () => {
    render(<LoginPage />);

    expect(screen.getByText('公開デモ')).toBeInTheDocument();
    expect(screen.getByLabelText('企業ID')).toBeInTheDocument();
    expect(screen.getByLabelText('社員番号')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /山田 太郎/ }));
    expect(screen.getByLabelText('企業ID')).toHaveValue('demo-company');
    expect(screen.getByLabelText('社員番号')).toHaveValue('EMP-001');

    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith(
        'demo-company',
        'EMP-001',
        'SortGateway2026!'
      );
      expect(mocks.push).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('keeps the same three fields for configured authentication', () => {
    mocks.demoMode = false;

    render(<LoginPage />);

    expect(screen.getByLabelText('企業ID')).toBeInTheDocument();
    expect(screen.getByLabelText('社員番号')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.queryByText('公開デモ')).not.toBeInTheDocument();
  });
});
