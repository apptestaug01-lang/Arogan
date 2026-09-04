import * as React from 'react';
import type { ApplicationDraft } from '@/types/application';
import { getWizardConstants, submitApplication, createApplication, updateApplication, getApplication } from '@/services/applications';
import type { WizardConstants, ApplicationSummary } from '@/services/applications';
import type { ExtractedField } from '@/services/autoFill';

const emptyDraft = (): ApplicationDraft => ({
  fullName: '',
  pan: '',
  aadhaar: '',
  dateOfBirth: '',
  gender: '',
  father_name: '',
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
  profit: '',
  existingDebt: '',
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
  applyExtractedField: (fieldName: string, value: string | number | boolean | string[]) => void;
  applyExtractedFields: (fields: Record<string, ExtractedField>) => void;
  extractedFields: Record<string, ExtractedField>;
}

export function useWizardState(initialApplicationId?: string): UseWizardStateReturn {
  const [data, setData] = React.useState<ApplicationDraft>(emptyDraft);
  const [constants, setConstants] = React.useState<WizardConstants | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string | string[]>>({});
  const [applicationId, setApplicationId] = React.useState<string | undefined>(initialApplicationId);
  const [extractedFields, setExtractedFields] = React.useState<Record<string, ExtractedField>>({});

  // Mirror of `data` that updates synchronously inside setData-like helpers
  // (e.g. applyExtractedFields) so the next saveDraft() in the same tick
  // picks up the freshest values, even before React commits the render.
  const dataRef = React.useRef<ApplicationDraft>(data);
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

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
        const res = await updateApplication({ applicationId, data: dataRef.current as unknown as Record<string, unknown> });
        return res.application;
      } else {
        const res = await createApplication({ data: dataRef.current as unknown as Record<string, unknown> });
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
    setExtractedFields({});
  };

  const applyExtractedField = (fieldName: string, value: string | number | boolean | string[]) => {
    setData((prev) => {
      const next = { ...prev };
      (next as Record<string, unknown>)[fieldName] = value;
      return next;
    });
    setExtractedFields((prev) => ({ ...prev, [fieldName]: { value, confidence: 1, source: 'manual' } }));
  };

  const applyExtractedFields = (fields: Record<string, ExtractedField>) => {
    setData((prev) => {
      const next = { ...prev } as Record<string, unknown>;
      for (const [fieldName, field] of Object.entries(fields)) {
        next[fieldName] = field.value;
      }
      return next as unknown as ApplicationDraft;
    });
    // Mirror the new values into the ref synchronously so the next saveDraft
    // call (which runs immediately after, before React commits) sees them.
    setExtractedFields((prev) => ({ ...prev, ...fields }));
    dataRef.current = (() => {
      const next = { ...dataRef.current } as Record<string, unknown>;
      for (const [fieldName, field] of Object.entries(fields)) {
        next[fieldName] = field.value;
      }
      return next as unknown as ApplicationDraft;
    })();
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
    applyExtractedField,
    applyExtractedFields,
    extractedFields,
  };
}
