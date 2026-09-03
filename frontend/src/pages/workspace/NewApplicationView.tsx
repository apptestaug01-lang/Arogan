import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/workspace/ProgressStepper';
import { ReviewOverlay } from '@/components/workspace/ReviewOverlay';
import { DocumentAnalyzer } from '@/components/workspace/auto-fill';
import { useWizardState } from '@/hooks/useWizardState';
import { useAutoFill } from '@/hooks/useAutoFill';
import { useToast } from '@/components/workspace/ToastProvider';
import { StepView, type WizardStep } from '@/components/workspace/wizard/StepView';
import { StepTabs } from '@/components/workspace/wizard/StepTabs';
import { validateStep } from '@/components/workspace/wizard/fieldRegistry';

const STEPS = ['Personal & KYC', 'Business Details', 'Financials', 'Loan Request'];
const STEP_KEYS: WizardStep[] = ['kyc', 'business', 'financials', 'loan'];

export default function NewApplicationView() {
  const navigate = useNavigate();
  const toast = useToast();
  const wizard = useWizardState();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [initializing, setInitializing] = React.useState(false);

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
    await autoFill(currentStepKey);
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

  const goToStep = (step: WizardStep) => {
    const idx = STEP_KEYS.indexOf(step);
    if (idx >= 0) {
      setCurrentStep(idx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl animate-fade-in">
      <div className="mb-8 space-y-1">
        <p className="page-eyebrow">Loan workspace / Applications / New application</p>
        <h1 className="page-title">New Loan Application</h1>
        <p className="page-sub">
          Complete all steps to submit your business loan application
        </p>
      </div>

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

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <StepView
            step={currentStepKey}
            data={wizard.data}
            errors={wizard.errors}
            extractedFields={wizard.extractedFields}
            onChange={wizard.setField}
            onValidate={(step) => validateStep(step, wizard.data)}
          />
        </div>
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
