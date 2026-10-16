import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StepResponse } from '../api/auth';

/** Where each "next" step from the API takes the user. */
export const routeOf: Record<StepResponse['next'], string> = {
  mfa_setup: '/login/mfa-setup',
  mfa: '/login/mfa',
  choose_company: '/login/company',
  done: '/',
  no_company: '/login/no-access',
};

/** The page for a step. Recovery codes are shown once, right after MFA enrollment, before entering the company. */
export const pageOf = (step: StepResponse | null): string =>
  !step ? '/login' : step.recoveryCodes?.length ? '/login/recovery-codes' : routeOf[step.next];

interface SignInFlow {
  /** Last answer from the API. Kept in memory only: the MFA secret and recovery codes are never stored. */
  step: StepResponse | null;
  advance: (step: StepResponse) => void;
  reset: () => void;
}

const SignInFlowContext = createContext<SignInFlow | null>(null);

export function SignInFlowProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<StepResponse | null>(null);
  const navigate = useNavigate();

  const advance = useCallback(
    (next: StepResponse) => {
      setStep(next);
      navigate(pageOf(next), { replace: true });
    },
    [navigate],
  );

  const reset = useCallback(() => {
    setStep(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo(() => ({ step, advance, reset }), [step, advance, reset]);
  return <SignInFlowContext.Provider value={value}>{children}</SignInFlowContext.Provider>;
}

export function useSignInFlow(): SignInFlow {
  const flow = useContext(SignInFlowContext);
  if (!flow) {
    throw new Error('useSignInFlow must be used inside SignInFlowProvider');
  }

  return flow;
}
