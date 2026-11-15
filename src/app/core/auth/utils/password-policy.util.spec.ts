import { describe, expect, it } from 'vitest';
import {
  DEMO_RECOVERY_CODE,
  evaluatePasswordPolicy,
  hasIncreasingNumberSequence,
} from './password-policy.util';

describe('password-policy.util', () => {
  it('exposes the beta demo recovery code', () => {
    expect(DEMO_RECOVERY_CODE).toBe('482910');
  });

  it('requires at least 9 characters', () => {
    expect(evaluatePasswordPolicy('AgroTr1!', 'AgroTr1!').minLength).toBe(false);
    expect(evaluatePasswordPolicy('AgroTra1!', 'AgroTra1!').minLength).toBe(true);
  });

  it('validates uppercase, lowercase and number requirements independently', () => {
    expect(evaluatePasswordPolicy('agrotrack951', 'agrotrack951').hasUppercase).toBe(false);
    expect(evaluatePasswordPolicy('AGROTRACK951', 'AGROTRACK951').hasLowercase).toBe(false);
    expect(evaluatePasswordPolicy('AgroTrackOne', 'AgroTrackOne').hasNumber).toBe(false);

    const valid = evaluatePasswordPolicy('AgroTrack951', 'AgroTrack951');
    expect(valid.hasUppercase).toBe(true);
    expect(valid.hasLowercase).toBe(true);
    expect(valid.hasNumber).toBe(true);
  });

  it('detects 3-digit strictly increasing numeric sequences', () => {
    expect(hasIncreasingNumberSequence('Agro12345')).toBe(true);
    expect(hasIncreasingNumberSequence('Clave4567')).toBe(true);
    expect(hasIncreasingNumberSequence('Test789Aa')).toBe(true);

    expect(evaluatePasswordPolicy('Agro12345', 'Agro12345').noIncreasingNumbers).toBe(false);
  });

  it('allows non-increasing or wrapped digit combinations', () => {
    expect(hasIncreasingNumberSequence('Agro13579')).toBe(false);
    expect(hasIncreasingNumberSequence('Agro321Aa')).toBe(false);
    expect(hasIncreasingNumberSequence('Agro901Aa')).toBe(false);

    expect(evaluatePasswordPolicy('Agro13579', 'Agro13579').noIncreasingNumbers).toBe(true);
    expect(evaluatePasswordPolicy('Agro321Aa', 'Agro321Aa').noIncreasingNumbers).toBe(true);
    expect(evaluatePasswordPolicy('Agro901Aa', 'Agro901Aa').noIncreasingNumbers).toBe(true);
  });

  it('fails passwordsMatch and isAllValid when confirmation differs', () => {
    const result = evaluatePasswordPolicy('AgroTrack951', 'AgroTrack952');
    expect(result.passwordsMatch).toBe(false);
    expect(result.isAllValid).toBe(false);
  });

  it('passes all checks for a compliant matching password', () => {
    expect(evaluatePasswordPolicy('AgroTrack951', 'AgroTrack951')).toEqual({
      minLength: true,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      noIncreasingNumbers: true,
      passwordsMatch: true,
      isAllValid: true,
    });
  });
});
