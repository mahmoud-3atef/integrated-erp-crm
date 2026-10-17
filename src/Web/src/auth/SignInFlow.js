import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
/** Where each "next" step from the API takes the user. */
export const routeOf = {
    mfa_setup: '/login/mfa-setup',
    mfa: '/login/mfa',
    choose_company: '/login/company',
    done: '/',
    no_company: '/login/no-access',
};
/** The page for a step. Recovery codes are shown once, right after MFA enrollment, before entering the company. */
export const pageOf = (step) => !step ? '/login' : step.recoveryCodes?.length ? '/login/recovery-codes' : routeOf[step.next];
const SignInFlowContext = createContext(null);
export function SignInFlowProvider({ children }) {
    const [step, setStep] = useState(null);
    const navigate = useNavigate();
    const advance = useCallback((next) => {
        setStep(next);
        navigate(pageOf(next), { replace: true });
    }, [navigate]);
    const reset = useCallback(() => {
        setStep(null);
        navigate('/login', { replace: true });
    }, [navigate]);
    const value = useMemo(() => ({ step, advance, reset }), [step, advance, reset]);
    return _jsx(SignInFlowContext.Provider, { value: value, children: children });
}
export function useSignInFlow() {
    const flow = useContext(SignInFlowContext);
    if (!flow) {
        throw new Error('useSignInFlow must be used inside SignInFlowProvider');
    }
    return flow;
}
