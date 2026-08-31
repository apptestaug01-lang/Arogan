import * as React from 'react';
import type { ApplicationDraft } from '@/lib/extraction';
import { getWizardConstants, submitApplication, createApplication, updateApplication, getApplication } from '@/services/applications';
import type { WizardConstants, ApplicationSummary } from '@/services/applications';

const emptyDraft = (): ApplicationDraft => ({
  fullName: '',
  pan: '',
  aadhaar: '',
  email: '',
  mobile: '',
  address: '',
  companyName: '',
  cin: '',
  industry: '',
  groupCompany: '',
  signatory: '',
  designation: '',
  businessType: '',
  gstRegistered: false,
  gstin: '',
  companyPan: '',
  dateOfIncorporation: '',
  itrYears: [],
  itrFiled: [],
  turnoverY1: '',
  turnoverY2: '',
  profitY1: '',
  profitY2: '',
  bankStatementPeriod: '',
  avgMonthlyBalance: '',
  chequeBounces: 0,
  existingMonthlyEmi: '',
  avgMonthlyCredits: '',
  netWorth: '',
  debt: '',
  loanAmount: '',
  productType: '',
  tenor: '',
  interestRate: '',
  purpose: '',
  collateral: '',
  turnover: '',
});

interface WizardState {
  data: ApplicationDraft;
  constants: WizardConstants | null;
  loading: boolean;
  saving: boolean;
  errors: Record<string, string | string[]>;
  applicationId?: string;
}

export interface UseWizardStateReturn extends WizardState {
  setField: <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => void;
  setErrors: (errors: Record<string, string | string[]>) => void;
  clearErrors: () => void;
  saveDraft: () => Promise<ApplicationSummary | undefined>;
  submit: () => Promise<ApplicationSummary | undefined>;
  reset: () => void;
}

export function useWizardState(initialApplicationId?: string): UseWizardStateReturn {
  const [data, setData] = React.useState<ApplicationDraft>(emptyDraft);
  const [constants, setConstants] = React.useState<WizardConstants | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string | string[]>>({});
  const [applicationId, setApplicationId] = React.useState<string | undefined>(initialApplicationId);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWizardConstants()
      .then((res) => {
        if (!cancelled) setConstants(res);
      })
      .catch(() => {
        if (!cancelled) setConstants(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!applicationId) return;
    setLoading(true);
    getApplication(applicationId)
      .then((res) => {
        if (!cancelled && res.application.data) {
          setData((prev) => ({ ...prev, ...res.application.data }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const setField = <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setErrorsFn = (newErrors: Record<string, string | string[]>) => {
    setErrors(newErrors);
  };

  const clearErrors = () => {
    setErrors({});
  };

  const saveDraft = async (): Promise<ApplicationSummary | undefined> => {
    setSaving(true);
    try {
      if (applicationId) {
        const res = await updateApplication({ applicationId, data: data as unknown as Record<string, unknown> });
        return res.application;
      } else {
        const res = await createApplication({ data: data as unknown as Record<string, unknown> });
        setApplicationId(res.application.applicationId);
        return res.application;
      }
    } finally {
      setSaving(false);
    }
  };

  const submit = async (): Promise<ApplicationSummary | undefined> => {
    if (!applicationId) {
      throw new Error('No application ID. Save as draft first.');
    }
    setSaving(true);
    try {
      const res = await submitApplication(applicationId);
      return res.application;
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setData(emptyDraft());
    setErrors({});
    setApplicationId(undefined);
  };

  return {
    data,
    constants,
    loading,
    saving,
    errors,
    applicationId,
    setField,
    setErrors: setErrorsFn,
    clearErrors,
    saveDraft,
    submit,
    reset,
  };
}
