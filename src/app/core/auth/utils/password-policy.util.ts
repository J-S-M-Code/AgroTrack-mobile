export const DEMO_RECOVERY_CODE = '482910';

export interface PasswordChecklistState {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  noIncreasingNumbers: boolean;
  passwordsMatch: boolean;
  isAllValid: boolean;
}

/**
 * Checks whether the password contains any sequence of three strictly
 * increasing consecutive ASCII digits (e.g. "123", "456", "789"),
 * matching backend Password.java validation rules.
 */
export function hasIncreasingNumberSequence(password: string): boolean {
  for (let i = 0; i <= password.length - 3; i++) {
    const c1 = password.charCodeAt(i);
    const c2 = password.charCodeAt(i + 1);
    const c3 = password.charCodeAt(i + 2);

    const areAllDigits =
      c1 >= 48 && c1 <= 57 &&
      c2 >= 48 && c2 <= 57 &&
      c3 >= 48 && c3 <= 57;

    if (areAllDigits && c2 === c1 + 1 && c3 === c2 + 1) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates password strength and confirmation match against AgroTrack
 * domain password rules.
 */
export function evaluatePasswordPolicy(
  password: string,
  confirmPassword: string
): PasswordChecklistState {
  const minLength = password.length >= 9;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const noIncreasingNumbers =
    password.length > 0 && !hasIncreasingNumberSequence(password);
  const passwordsMatch =
    password.length > 0 && password === confirmPassword;

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    noIncreasingNumbers,
    passwordsMatch,
    isAllValid:
      minLength &&
      hasUppercase &&
      hasLowercase &&
      hasNumber &&
      noIncreasingNumbers &&
      passwordsMatch,
  };
}
