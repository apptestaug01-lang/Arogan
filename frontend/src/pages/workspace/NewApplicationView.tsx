import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/workspace/ProgressStepper';
import { ReviewOverlay } from '@/components/workspace/ReviewOverlay';
import { DocumentAnalyzer, DocumentExtractionStepper } from '@/components/workspace/auto-fill';
import { useWizardState } from '@/hooks/useWizardState';
import { useAutoFill } from '@/hooks/useAutoFill';
import { useToast } from '@/components/workspace/ToastProvider';
import { StepView, type WizardStep } from '@/components/workspace/wizard/StepView';
import { StepTabs } from '@/components/workspace/wizard/StepTabs';
import { validateStep } from '@/components/workspace/wizard/fieldRegistry';
import type { ExtractedField } from '@/services/autoFill';

interface LocationState {
  applicationId?: string;
}

const STEPS = ['Personal & KYC', 'Business Details', 'Financials', 'Loan Request'];
const STEP_KEYS: WizardStep[] = ['kyc', 'business', 'financials', 'loan'];

export default function NewApplicationView() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlAppId = React.useMemo(
    () => new URLSearchParams(location.search).get('applicationId') ?? undefined,
    [location.search],
  );
  const stateAppId = (location.state as LocationState | null)?.applicationId;
  const incomingAppId = urlAppId ?? stateAppId;
  const queryEditing = React.useMemo(
    () => new URLSearchParams(location.search).get('editing') === 'true',
    [location.search],
  );
  const toast = useToast();
  const wizard = useWizardState(incomingAppId);
  const [currentStep, setCurrentStep] = React.useState(1);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [initializing, setInitializing] = React.useState(false);
  const [editing, setEditing] = React.useState(queryEditing);

  // Editing is only meaningful when there's an app loaded. Default editing=true
  // for DRAFT, false for SUBMITTED.
  React.useEffect(() => {
    if (wizard.status === 'SUBMITTED') {
      setEditing(queryEditing);
    } else if (wizard.status === 'DRAFT') {
      setEditing(true);
    }
  }, [wizard.status, queryEditing]);

  const currentStepKey = STEP_KEYS[currentStep - 1];
  const isReadOnly = wizard.status === 'SUBMITTED' && !editing;

  const { autoFill, extracting, lastResult, progress } = useAutoFill({
    applicationId: wizard.applicationId || '',
    onFieldsExtracted: (fields) => {
      if (isReadOnly) return;
      wizard.applyExtractedFields(fields);
    },
  });
  const [vaultRefreshKey, setVaultRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!extracting && lastResult) {
      setVaultRefreshKey((k) => k + 1);
    }
  }, [extracting, lastResult]);

  React.useEffect(() => {
    let cancelled = false;
    if (!wizard.applicationId || initializing) return;
    if (incomingAppId) return; // already linked to a server app, don't auto-create
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
  }, [wizard.applicationId, initializing, wizard, toast, incomingAppId]);

  const handleAutoFill = async (force = false) => {
    if (!wizard.applicationId) {
      toast('Please wait for application to initialize', 'info');
      return;
    }
    await autoFill('all', force);
  };

  const handleValidateStep = (step: WizardStep): boolean => {
    const errors = validateStep(step, wizard.data);
    wizard.setErrors(errors as Record<string, string | string[]>);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async () => {
    if (!handleValidateStep(currentStepKey)) {
      toast('Please fix the errors before continuing', 'error');
      return;
    }
    try {
      await wizard.saveDraft();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save draft', 'error');
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

  const handleReview = async () => {
    if (!handleValidateStep(currentStepKey)) {
      toast('Please fix the errors before reviewing', 'error');
      return;
    }
    try {
      await wizard.saveDraft();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save draft', 'error');
      return;
    }
    setReviewOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await wizard.submit();
      setReviewOpen(false);
      const isResubmit = res?.status === 'SUBMITTED' && wizard.version > 0;
      toast(isResubmit ? 'Application re-submitted successfully' : 'Application submitted successfully', 'success');
      navigate('/dashboard/applications');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const goToStep = (step: WizardStep) => {
    const idx = STEP_KEYS.indexOf(step);
    if (idx >= 0) {
      setCurrentStep(idx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [stepperActive, setStepperActive] = React.useState(true);

  const applyStepAndAdvance = async (step: 'kyc' | 'business' | 'financials' | 'loan', fields: Record<string, ExtractedField>) => {
    if (isReadOnly) return;
    if (Object.keys(fields).length === 0) {
      toast('No fields extracted for this document', 'info');
      return;
    }
    wizard.applyExtractedFields(fields);
    try {
      await wizard.saveDraft();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save draft', 'error');
      return;
    }
    const idx = STEP_KEYS.indexOf(step);
    const nextIdx = idx + 1;
    if (nextIdx < STEP_KEYS.length) {
      setCurrentStep(nextIdx + 1);
      toast(`Saved ${Object.keys(fields).length} ${step.toUpperCase()} field(s) — moved to ${STEPS[nextIdx]}`, 'success');
    } else {
      toast(`Saved ${Object.keys(fields).length} LOAN field(s) — ready to submit`, 'success');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const advanceToStep = (step: 'kyc' | 'business' | 'financials' | 'loan') => {
    const idx = STEP_KEYS.indexOf(step);
    if (idx >= 0) setCurrentStep(idx + 1);
  };

  const isSubmitted = wizard.status === 'SUBMITTED';
  const canEdit = isSubmitted ? editing : true;

  return (
    <div className="mx-auto w-full max-w-4xl animate-fade-in">
      <div className="mb-8 space-y-1">
        <p className="page-eyebrow">
          Loan workspace / Applications / {isSubmitted && !editing ? 'View' : 'Edit'}
        </p>
        <h1 className="page-title">
          {isSubmitted && !editing ? 'Application details' : 'New Loan Application'}
        </h1>
        <p className="page-sub">
          {isSubmitted && !editing
            ? 'Submitted application — view only. Click Edit to make changes.'
            : 'Complete all steps to submit your business loan application'}
        </p>
      </div>

      {isSubmitted && !editing && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>
            This application has been submitted. You can still view all documents and extraction data, but the form is read-only.
          </span>
          <Button
            size="sm"
            onClick={() => setEditing(true)}
            data-testid="enter-edit-mode"
          >
            Edit & re-submit
          </Button>
        </div>
      )}

      {isSubmitted && editing && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <span>
            Editing submitted application — your changes will be saved as a new version. Re-submit to lock them in.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            data-testid="exit-edit-mode"
          >
            Cancel editing
          </Button>
        </div>
      )}

      <div className="mb-4">
        <StepTabs
          data={wizard.data}
          extractedFields={wizard.extractedFields}
          currentStep={currentStepKey}
          onStepClick={goToStep}
        />
      </div>

      <ProgressStepper currentStep={currentStep} totalSteps={4} labels={STEPS} />

      <div className="space-y-6">
        {canEdit && stepperActive && wizard.applicationId && (
          <DocumentExtractionStepper
            applicationId={wizard.applicationId}
            onApplyStep={applyStepAndAdvance}
            onAdvance={advanceToStep}
            onAllDone={() => setStepperActive(false)}
          />
        )}

        <DocumentAnalyzer
          applicationId={wizard.applicationId || ''}
          extracting={extracting}
          extractedFields={wizard.extractedFields}
          unmatchedDocuments={[]}
          missingFields={[]}
          onAutoFill={handleAutoFill}
          onApplyField={wizard.applyExtractedField}
          onApplyAll={wizard.applyExtractedFields}
          stepLabel={STEPS[currentStep - 1]}
          progress={progress}
          fullResult={lastResult}
          refreshKey={vaultRefreshKey}
        />

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <StepView
            step={currentStepKey}
            data={wizard.data}
            errors={wizard.errors}
            extractedFields={wizard.extractedFields}
            onChange={wizard.setField}
            onValidate={(step) => validateStep(step, wizard.data)}
            readOnly={isReadOnly}
            constants={wizard.constants}
          />
        </div>
      </div>

      {!isReadOnly && (
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
                {isSubmitted ? 'Review & Re-submit →' : 'Review & Submit →'}
              </Button>
            )}
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="mt-8 flex items-center justify-end">
          <Button
            type="button"
            onClick={() => navigate('/dashboard/applications')}
            data-testid="back-to-applications"
          >
            ← Back to applications
          </Button>
        </div>
      )}

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
