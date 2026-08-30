import * as React from 'react';
import { WizardInput, WizardSelect, WizardToggle } from './WizardField';
import type { UseWizardStateReturn } from '@/hooks/useWizardState';

interface Step3FinancialsProps {
  wizard: Pick<UseWizardStateReturn, 'data' | 'setField' | 'constants' | 'errors'>;
}

export function Step3Financials({ wizard }: Step3FinancialsProps) {
  const { data, setField, constants, errors } = wizard;

  const trend = React.useMemo(() => {
    const y1 = parseFloat(data.turnoverY1) || 0;
    const y2 = parseFloat(data.turnoverY2) || 0;
    if (y1 === 0) return null;
    const pct = ((y2 - y1) / y1) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }, [data.turnoverY1, data.turnoverY2]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardSelect
          label="ITR Assessment Year 1"
          required
          value={data.itrYears[0] || ''}
          onChange={(v) => {
            const years = [...data.itrYears];
            years[0] = v;
            setField('itrYears', years);
          }}
          options={constants?.assessmentYears || []}
          error={errors.itrYears?.[0]}
        />
        <WizardSelect
          label="ITR Assessment Year 2"
          required
          value={data.itrYears[1] || ''}
          onChange={(v) => {
            const years = [...data.itrYears];
            years[1] = v;
            setField('itrYears', years);
          }}
          options={constants?.assessmentYears || []}
          error={errors.itrYears?.[1]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardToggle
          checked={data.itrFiled[0] || false}
          onChange={(v) => {
            const filed = [...data.itrFiled];
            filed[0] = v;
            setField('itrFiled', filed);
          }}
          label="ITR filed for Year 1"
        />
        <WizardToggle
          checked={data.itrFiled[1] || false}
          onChange={(v) => {
            const filed = [...data.itrFiled];
            filed[1] = v;
            setField('itrFiled', filed);
          }}
          label="ITR filed for Year 2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardInput
          label="Turnover Year 1 (₹ Cr)"
          required
          type="number"
          value={data.turnoverY1}
          onChange={(v) => setField('turnoverY1', v)}
          placeholder="e.g., 28"
          hint="Total turnover / gross receipt"
          error={errors.turnoverY1}
        />
        <WizardInput
          label="Turnover Year 2 (₹ Cr)"
          required
          type="number"
          value={data.turnoverY2}
          onChange={(v) => setField('turnoverY2', v)}
          placeholder="e.g., 32"
          error={errors.turnoverY2}
        />
        <WizardInput
          label="Profit Year 1 (₹ Cr)"
          required
          type="number"
          value={data.profitY1}
          onChange={(v) => setField('profitY1', v)}
          placeholder="e.g., 3.5"
          error={errors.profitY1}
        />
        <WizardInput
          label="Profit Year 2 (₹ Cr)"
          required
          type="number"
          value={data.profitY2}
          onChange={(v) => setField('profitY2', v)}
          placeholder="e.g., 4.1"
          error={errors.profitY2}
        />
      </div>

      {trend && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            ITR Trend: {trend}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardSelect
          label="Statement Period"
          required
          value={data.bankStatementPeriod}
          onChange={(v) => setField('bankStatementPeriod', v)}
          options={constants?.statementPeriods || []}
          error={errors.bankStatementPeriod}
        />
        <WizardInput
          label="Average Monthly Balance (₹)"
          required
          value={data.avgMonthlyBalance}
          onChange={(v) => setField('avgMonthlyBalance', v)}
          placeholder="e.g., 4,97,69,787"
          error={errors.avgMonthlyBalance}
        />
        <WizardInput
          label="Cheque Bounces (Last 6 months)"
          required
          type="number"
          min={0}
          value={String(data.chequeBounces)}
          onChange={(v) => setField('chequeBounces', parseInt(v) || 0)}
          error={errors.chequeBounces}
        />
        <WizardInput
          label="Existing Monthly EMI (₹)"
          required
          value={data.existingMonthlyEmi}
          onChange={(v) => setField('existingMonthlyEmi', v)}
          placeholder="e.g., 16,00,000"
          hint="Total EMI outflow across all loans"
          error={errors.existingMonthlyEmi}
        />
        <WizardInput
          label="Average Monthly Business Credits (₹)"
          required
          value={data.avgMonthlyCredits}
          onChange={(v) => setField('avgMonthlyCredits', v)}
          placeholder="e.g., 2,05,62,880"
          error={errors.avgMonthlyCredits}
        />
        <WizardInput
          label="Net Worth (₹ Cr)"
          required
          type="number"
          value={data.netWorth}
          onChange={(v) => setField('netWorth', v)}
          placeholder="e.g., 14"
          error={errors.netWorth}
        />
        <WizardInput
          label="Existing Debt (₹ Cr)"
          required
          type="number"
          value={data.debt}
          onChange={(v) => setField('debt', v)}
          placeholder="e.g., 9"
          hint="Total outstanding borrowings"
          error={errors.debt}
        />
      </div>
    </div>
  );
}
