import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/workspace/ProgressStepper';
import { ReviewOverlay } from '@/components/workspace/ReviewOverlay';
import { Step1PersonalKyc } from '@/components/workspace/application-wizard/Step1PersonalKyc';
import { Step2BusinessDetails } from '@/components/workspace/application-wizard/Step2BusinessDetails';
import { Step3Financials } from '@/components/workspace/application-wizard/Step3Financials';
import { Step4LoanRequest } from '@/components/workspace/application-wizard/Step4LoanRequest';
import { useWizardState } from '@/hooks/useWizardState';
import { useToast } from '@/components/workspace/ToastProvider';

const STEPS = ['Personal & KYC', 'Business Details', 'Financials', 'Loan Request'];

export default function NewApplicationView() {
  const navigate = useNavigate();
  const toast = useToast();
  const wizard = useWizardState();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

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
      const itrErrors: string[] = [];
      if (!data.itrYears?.[0]) itrErrors.push('Assessment Year 1 is required');
      if (!data.itrYears?.[1]) itrErrors.push('Assessment Year 2 is required');
      if (itrErrors.length) errors.itrYears = itrErrors;
      if (!data.turnoverY1.trim()) errors.turnoverY1 = 'Turnover Year 1 is required';
      if (!data.turnoverY2.trim()) errors.turnoverY2 = 'Turnover Year 2 is required';
      if (!data.profitY1.trim()) errors.profitY1 = 'Profit Year 1 is required';
      if (!data.profitY2.trim()) errors.profitY2 = 'Profit Year 2 is required';
      if (!data.bankStatementPeriod) errors.bankStatementPeriod = 'Statement period is required';
      if (!data.avgMonthlyBalance.trim()) errors.avgMonthlyBalance = 'Average monthly balance is required';
      if (!data.existingMonthlyEmi.trim()) errors.existingMonthlyEmi = 'Existing monthly EMI is required';
      if (!data.avgMonthlyCredits.trim()) errors.avgMonthlyCredits = 'Average monthly credits is required';
      if (!data.netWorth.trim()) errors.netWorth = 'Net worth is required';
      if (!data.debt.trim()) errors.debt = 'Existing debt is required';
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
    switch (currentStep) {
      case 1:
        return <Step1PersonalKyc wizard={wizard} />;
      case 2:
        return <Step2BusinessDetails wizard={wizard} />;
      case 3:
        return <Step3Financials wizard={wizard} />;
      case 4:
        return <Step4LoanRequest wizard={wizard} />;
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
          <Button type="button" variant="ghost" onClick={handleSaveDraft} disabled={wizard.saving}>
            {wizard.saving ? 'Saving…' : 'Save as draft'}
          </Button>
          {currentStep < 4 ? (
            <Button type="button" onClick={handleNext}>
              Save & Continue →
            </Button>
          ) : (
            <Button type="button" onClick={handleReview}>
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
