import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/workspace/ProgressStepper';
import { ReviewOverlay } from '@/components/workspace/ReviewOverlay';
import { DocumentAnalyzer } from '@/components/workspace/auto-fill';
import { useWizardState } from '@/hooks/useWizardState';
import { useAutoFill } from '@/hooks/useAutoFill';
import { useToast } from '@/components/workspace/ToastProvider';
import type { ApplicationDraft } from '@/types/application';

const STEPS = ['Personal & KYC', 'Business Details', 'Financials', 'Loan Request'];
const STEP_KEYS = ['kyc', 'business', 'financials', 'loan'] as const;

function FieldInput({
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoFilled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string | string[];
  type?: string;
  autoFilled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {autoFilled && (
          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ Auto-filled
          </span>
        )}
      </label>
      <input
        className={`input mt-1 w-full ${autoFilled ? 'border-emerald-300 bg-emerald-50/50' : ''}`}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  error,
  rows = 3,
  autoFilled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string | string[];
  rows?: number;
  autoFilled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {autoFilled && (
          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ Auto-filled
          </span>
        )}
      </label>
      <textarea
        className={`input mt-1 w-full ${autoFilled ? 'border-emerald-300 bg-emerald-50/50' : ''}`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  error,
  options,
  autoFilled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string | string[];
  options: string[];
  autoFilled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {autoFilled && (
          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ Auto-filled
          </span>
        )}
      </label>
      <select
        className={`input mt-1 w-full ${autoFilled ? 'border-emerald-300 bg-emerald-50/50' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Step1PersonalKyc({
  wizard,
  extractedFields,
  onApplyField,
}: {
  wizard: Pick<ReturnType<typeof useWizardState>, 'data' | 'setField' | 'constants' | 'errors'>;
  extractedFields: Record<string, { value: string | number | boolean | string[]; confidence: number; source: string }>;
  onApplyField: (fieldName: string, value: string | number | boolean | string[]) => void;
}) {
  const { data, setField, errors } = wizard;
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Personal & KYC</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput
          label="Full Name"
          value={data.fullName}
          onChange={(val) => setField('fullName', val)}
          error={errors.fullName}
          autoFilled={!!extractedFields.fullName}
        />
        <FieldInput
          label="PAN"
          value={data.pan}
          onChange={(val) => setField('pan', val)}
          error={errors.pan}
          autoFilled={!!extractedFields.pan}
        />
        <FieldInput
          label="Aadhaar"
          value={data.aadhaar}
          onChange={(val) => setField('aadhaar', val)}
          error={errors.aadhaar}
          autoFilled={!!extractedFields.aadhaar}
        />
        <FieldInput
          label="Email"
          value={data.email}
          onChange={(val) => setField('email', val)}
          error={errors.email}
          type="email"
          autoFilled={!!extractedFields.email}
        />
        <FieldInput
          label="Mobile"
          value={data.mobile}
          onChange={(val) => setField('mobile', val)}
          error={errors.mobile}
          autoFilled={!!extractedFields.mobile}
        />
        <div className="md:col-span-2">
          <FieldTextarea
            label="Address"
            value={data.address}
            onChange={(val) => setField('address', val)}
            error={errors.address}
            autoFilled={!!extractedFields.address}
          />
        </div>
      </div>
    </div>
  );
}

function Step2BusinessDetails({
  wizard,
  extractedFields,
}: {
  wizard: Pick<ReturnType<typeof useWizardState>, 'data' | 'setField' | 'constants' | 'errors'>;
  extractedFields: Record<string, { value: string | number | boolean | string[]; confidence: number; source: string }>;
}) {
  const { data, setField, constants, errors } = wizard;
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Business Details</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput
          label="Company Name"
          value={data.companyName}
          onChange={(val) => setField('companyName', val)}
          error={errors.companyName}
          autoFilled={!!extractedFields.companyName}
        />
        <FieldInput
          label="CIN"
          value={data.cin}
          onChange={(val) => setField('cin', val)}
          error={errors.cin}
          autoFilled={!!extractedFields.cin}
        />
        <FieldSelect
          label="Business Type"
          value={data.businessType}
          onChange={(val) => setField('businessType', val)}
          error={errors.businessType}
          options={constants?.businessTypes || []}
          autoFilled={!!extractedFields.businessType}
        />
        <FieldSelect
          label="Industry"
          value={data.industry}
          onChange={(val) => setField('industry', val)}
          error={errors.industry}
          options={constants?.industries || []}
          autoFilled={!!extractedFields.industry}
        />
        <FieldInput
          label="GSTIN"
          value={data.gstin}
          onChange={(val) => setField('gstin', val)}
          error={errors.gstin}
          autoFilled={!!extractedFields.gstin}
        />
        <FieldInput
          label="Date of Incorporation"
          value={data.dateOfIncorporation}
          onChange={(val) => setField('dateOfIncorporation', val)}
          type="date"
          autoFilled={!!extractedFields.dateOfIncorporation}
        />
        <FieldInput
          label="Authorised Signatory"
          value={data.signatory}
          onChange={(val) => setField('signatory', val)}
          error={errors.signatory}
        />
        <FieldInput
          label="Designation"
          value={data.designation}
          onChange={(val) => setField('designation', val)}
          error={errors.designation}
        />
      </div>
    </div>
  );
}

function Step3Financials({
  wizard,
  extractedFields,
}: {
  wizard: Pick<ReturnType<typeof useWizardState>, 'data' | 'setField' | 'constants' | 'errors'>;
  extractedFields: Record<string, { value: string | number | boolean | string[]; confidence: number; source: string }>;
}) {
  const { data, setField, errors } = wizard;
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Financials</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput
          label="Turnover Year 1 (₹ Cr)"
          value={data.turnoverY1}
          onChange={(val) => setField('turnoverY1', val)}
          error={errors.turnoverY1}
          autoFilled={!!extractedFields.turnoverY1}
        />
        <FieldInput
          label="Turnover Year 2 (₹ Cr)"
          value={data.turnoverY2}
          onChange={(val) => setField('turnoverY2', val)}
          error={errors.turnoverY2}
          autoFilled={!!extractedFields.turnoverY2}
        />
        <FieldInput
          label="Profit Year 1 (₹ Cr)"
          value={data.profitY1}
          onChange={(val) => setField('profitY1', val)}
          error={errors.profitY1}
          autoFilled={!!extractedFields.profitY1}
        />
        <FieldInput
          label="Profit Year 2 (₹ Cr)"
          value={data.profitY2}
          onChange={(val) => setField('profitY2', val)}
          error={errors.profitY2}
          autoFilled={!!extractedFields.profitY2}
        />
        <FieldInput
          label="Average Monthly Balance"
          value={data.avgMonthlyBalance}
          onChange={(val) => setField('avgMonthlyBalance', val)}
          error={errors.avgMonthlyBalance}
          autoFilled={!!extractedFields.avgMonthlyBalance}
        />
        <FieldInput
          label="Existing Monthly EMI"
          value={data.existingMonthlyEmi}
          onChange={(val) => setField('existingMonthlyEmi', val)}
          error={errors.existingMonthlyEmi}
          autoFilled={!!extractedFields.existingMonthlyEmi}
        />
      </div>
    </div>
  );
}

function Step4LoanRequest({
  wizard,
  extractedFields,
}: {
  wizard: Pick<ReturnType<typeof useWizardState>, 'data' | 'setField' | 'constants' | 'errors'>;
  extractedFields: Record<string, { value: string | number | boolean | string[]; confidence: number; source: string }>;
}) {
  const { data, setField, errors } = wizard;
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Loan Request</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput
          label="Loan Amount (₹ Cr)"
          value={data.loanAmount}
          onChange={(val) => setField('loanAmount', val)}
          error={errors.loanAmount}
          autoFilled={!!extractedFields.loanAmount}
        />
        <FieldInput
          label="Product Type"
          value={data.productType}
          onChange={(val) => setField('productType', val)}
          error={errors.productType}
          autoFilled={!!extractedFields.productType}
        />
        <FieldInput
          label="Tenor (years)"
          value={data.tenor}
          onChange={(val) => setField('tenor', val)}
          error={errors.tenor}
          autoFilled={!!extractedFields.tenor}
        />
        <FieldInput
          label="Interest Rate (%)"
          value={data.interestRate}
          onChange={(val) => setField('interestRate', val)}
          autoFilled={!!extractedFields.interestRate}
        />
        <div className="md:col-span-2">
          <FieldTextarea
            label="Purpose"
            value={data.purpose}
            onChange={(val) => setField('purpose', val)}
            error={errors.purpose}
            autoFilled={!!extractedFields.purpose}
          />
        </div>
        <div className="md:col-span-2">
          <FieldTextarea
            label="Collateral"
            value={data.collateral}
            onChange={(val) => setField('collateral', val)}
            error={errors.collateral}
            autoFilled={!!extractedFields.collateral}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewApplicationView() {
  const navigate = useNavigate();
  const toast = useToast();
  const wizard = useWizardState();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [initializing, setInitializing] = React.useState(false);
  const [autoFilledSteps, setAutoFilledSteps] = React.useState<Set<number>>(new Set());

  const currentStepKey = STEP_KEYS[currentStep - 1];

  const { autoFill, extracting, lastResult, progress } = useAutoFill({
    applicationId: wizard.applicationId || '',
    onFieldsExtracted: (fields) => {
      wizard.applyExtractedFields(fields);
    },
  });

  React.useEffect(() => {
    let cancelled = false;
    if (wizard.applicationId || initializing) return;
    setInitializing(true);
    wizard.saveDraft()
      .then(() => {
        if (!cancelled) toast('Application created', 'success');
      })
      .catch(() => {
        if (!cancelled) toast('Failed to create application', 'error');
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => { cancelled = true; };
  }, [wizard.applicationId, initializing, wizard, toast]);

  const handleAutoFill = async () => {
    if (!wizard.applicationId) {
      toast('Please wait for application to initialize', 'info');
      return;
    }
    const result = await autoFill(currentStepKey);
    if (result) {
      setAutoFilledSteps((prev) => new Set(prev).add(currentStep));
    }
  };

  const validateStep = (step: number): boolean => {
    const { data } = wizard;
    const errors: Record<string, string | string[]> = {};

    if (step === 1) {
      if (!data.fullName.trim()) errors.fullName = 'Full name is required';
      if (!data.pan.trim()) errors.pan = 'PAN is required';
      if (!data.aadhaar.trim()) errors.aadhaar = 'Aadhaar is required';
      if (!data.email.trim()) errors.email = 'Email is required';
      if (!data.mobile.trim()) errors.mobile = 'Mobile number is required';
      if (!data.address.trim()) errors.address = 'Address is required';
    }

    if (step === 2) {
      if (!data.companyName.trim()) errors.companyName = 'Company name is required';
      if (!data.cin.trim()) errors.cin = 'CIN is required';
      if (!data.businessType) errors.businessType = 'Business type is required';
      if (!data.industry) errors.industry = 'Industry is required';
      if (!data.signatory.trim()) errors.signatory = 'Authorised signatory is required';
      if (!data.designation.trim()) errors.designation = 'Designation is required';
      if (data.gstRegistered && !data.gstin.trim()) errors.gstin = 'GSTIN is required when GST registered';
    }

    if (step === 3) {
      if (!data.turnoverY1.trim()) errors.turnoverY1 = 'Turnover Year 1 is required';
      if (!data.turnoverY2.trim()) errors.turnoverY2 = 'Turnover Year 2 is required';
      if (!data.profitY1.trim()) errors.profitY1 = 'Profit Year 1 is required';
      if (!data.profitY2.trim()) errors.profitY2 = 'Profit Year 2 is required';
      if (!data.avgMonthlyBalance.trim()) errors.avgMonthlyBalance = 'Average monthly balance is required';
      if (!data.existingMonthlyEmi.trim()) errors.existingMonthlyEmi = 'Existing monthly EMI is required';
    }

    if (step === 4) {
      if (!data.loanAmount.trim()) errors.loanAmount = 'Loan amount is required';
      if (!data.productType) errors.productType = 'Product type is required';
      if (!data.tenor.trim()) errors.tenor = 'Tenor is required';
      if (!data.purpose.trim()) errors.purpose = 'Purpose is required';
      if (data.purpose.trim().length < 20) errors.purpose = 'Purpose must be at least 20 characters';
      if (!data.collateral.trim()) errors.collateral = 'Collateral is required';
      if (data.collateral.trim().length < 20) errors.collateral = 'Collateral must be at least 20 characters';
    }

    wizard.setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) {
      toast('Please fix the errors before continuing', 'error');
      return;
    }
    if (currentStep < 4) {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveDraft = async () => {
    try {
      await wizard.saveDraft();
      toast('Application saved as a draft', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save draft', 'error');
    }
  };

  const hasAnyData = Object.values(wizard.data).some((v) =>
    typeof v === 'string' ? v.trim() !== '' : Array.isArray(v) ? v.length > 0 : Boolean(v)
  );

  const handleReview = () => {
    if (!validateStep(4)) {
      toast('Please fix the errors before reviewing', 'error');
      return;
    }
    setReviewOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true);
      await wizard.submit();
      setReviewOpen(false);
      toast('Application submitted successfully', 'success');
      navigate('/dashboard/applications');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    const props = {
      wizard,
      extractedFields: wizard.extractedFields,
    };

    switch (currentStep) {
      case 1:
        return <Step1PersonalKyc {...props} onApplyField={wizard.applyExtractedField} />;
      case 2:
        return <Step2BusinessDetails {...props} />;
      case 3:
        return <Step3Financials {...props} />;
      case 4:
        return <Step4LoanRequest {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in">
      <div className="mb-8 space-y-1">
        <p className="page-eyebrow">Loan workspace / Applications / New application</p>
        <h1 className="page-title">New Loan Application</h1>
        <p className="page-sub">
          Complete all steps to submit your business loan application
        </p>
      </div>

      <ProgressStepper currentStep={currentStep} totalSteps={4} labels={STEPS} />

      <div className="space-y-6">
        <DocumentAnalyzer
          extracting={extracting}
          extractedFields={lastResult?.extractedFields || {}}
          unmatchedDocuments={lastResult?.unmatchedDocuments || []}
          missingFields={lastResult?.missingFields || []}
          onAutoFill={handleAutoFill}
          onApplyField={wizard.applyExtractedField}
          stepLabel={STEPS[currentStep - 1]}
          progress={progress}
        />

        {renderStep()}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={handleBack}>
              ← Back
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          {wizard.applicationId && (
            <Button type="button" variant="ghost" onClick={handleSaveDraft} disabled={wizard.saving || !hasAnyData}>
              {wizard.saving ? 'Saving…' : 'Save as draft'}
            </Button>
          )}
          {currentStep < 4 ? (
            <Button type="button" onClick={handleNext}>
              Save & Continue →
            </Button>
          ) : (
            <Button type="button" onClick={handleReview} disabled={!hasAnyData}>
              Review & Submit →
            </Button>
          )}
        </div>
      </div>

      <ReviewOverlay
        open={reviewOpen}
        data={wizard.data}
        onClose={() => setReviewOpen(false)}
        onEdit={() => setReviewOpen(false)}
        onConfirm={handleConfirmSubmit}
        confirming={submitting}
      />
    </div>
  );
}
