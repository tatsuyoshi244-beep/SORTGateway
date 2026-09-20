export interface LoginIdentifiers {
  companyId: string;
  employeeNumber: string;
}

const COMPANY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const EMPLOYEE_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,63}$/;

export function normalizeLoginIdentifiers(
  companyId: string,
  employeeNumber: string
): LoginIdentifiers {
  return {
    companyId: companyId.trim().toLowerCase(),
    employeeNumber: employeeNumber.trim().toUpperCase(),
  };
}

export function validateLoginInput(
  companyId: unknown,
  employeeNumber: unknown,
  password: unknown
): string | null {
  if (
    typeof companyId !== 'string' ||
    typeof employeeNumber !== 'string' ||
    typeof password !== 'string'
  ) {
    return '企業ID、社員番号、パスワードを入力してください。';
  }

  const normalized = normalizeLoginIdentifiers(companyId, employeeNumber);
  if (
    !COMPANY_ID_PATTERN.test(normalized.companyId) ||
    !EMPLOYEE_NUMBER_PATTERN.test(normalized.employeeNumber) ||
    password.length < 8 ||
    password.length > 256
  ) {
    return '企業ID、社員番号、またはパスワードが正しくありません。';
  }
  return null;
}
