import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/services/authContext';
import {
  loanProducts,
  requiredDocumentsMaster,
  type DocRequirement,
} from '@/mock/workspace';

const requirementStyles: Record<DocRequirement, string> = {
  Mandatory: 'bg-red-100 text-red-700',
  'Highly Recommended': 'bg-amber-100 text-amber-700',
  Conditional: 'bg-blue-100 text-blue-700',
  'Required for Startups': 'bg-primary-100 text-primary-700',
};

const docTabLabels: Record<string, string> = {
  kyc: 'KYC',
  registration: 'Registration',
  financial: 'Financial',
  collateral: 'Collateral',
};

export default function WelcomeView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.email ? user.email.split('@')[0] : '';

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-8 text-white">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-100">
              Welcome to LoanFlow
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Finance your next business move{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-primary-100">
              Apply for corporate lending in one clear, secure workspace. Pick a loan type and review
              the documents you'll need, then start your application.
            </p>
          </div>
          <Button
            variant="secondary"
            className="shrink-0 bg-white text-primary-700 hover:bg-primary-50"
            onClick={() => navigate('/dashboard/applications/new')}
          >
            Start new application
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <p className="page-eyebrow">Loan products</p>
          <h2 className="page-title">Choose a loan type</h2>
          <p className="page-sub">Review each facility and its required documents.</p>

          <Tabs defaultValue={loanProducts[0].id} className="mt-6">
            <TabsList className="grid w-full grid-cols-2 gap-1">
              {loanProducts.map((product) => (
                <TabsTrigger key={product.id} value={product.id}>
                  {product.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {loanProducts.map((product) => (
              <TabsContent key={product.id} value={product.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription>{product.tagline}</CardDescription>
                    <p className="pt-2 text-sm text-muted-foreground">{product.description}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col">
                    <p className="text-sm font-semibold text-foreground">Required documents</p>
                    <ul className="mt-3 space-y-2">
                      {product.requiredDocuments.map((doc) => (
                        <li
                          key={doc}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      className="mt-5"
                      onClick={() => navigate('/dashboard/applications/new')}
                    >
                      Apply for {product.name}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <section>
          <p className="page-eyebrow">Required documents</p>
          <h2 className="page-title">Master document checklist</h2>
          <p className="page-sub">Every document you may need, grouped by stage.</p>

          <Tabs defaultValue={requiredDocumentsMaster[0].id} className="mt-6">
            <TabsList className="grid w-full grid-cols-2 gap-1">
              {requiredDocumentsMaster.map((section) => (
                <TabsTrigger key={section.id} value={section.id}>
                  {docTabLabels[section.id] ?? section.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {requiredDocumentsMaster.map((section) => (
              <TabsContent key={section.id} value={section.id}>
                <div className="rounded-xl border border-border bg-card p-6 shadow">
                  <h3 className="text-lg font-semibold text-foreground">
                    {section.title}
                  </h3>
                  <ul className="mt-4 space-y-2">
                    {section.items.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background px-3 py-2"
                      >
                        <span className="flex items-center gap-2 text-sm text-foreground">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {doc.name}
                        </span>
                        <span
                          className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${requirementStyles[doc.requirement]}`}
                        >
                          {doc.requirement}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      </div>
    </div>
  );
}
