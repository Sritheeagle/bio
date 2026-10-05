"use client";

import React from "react";
import { HealthInfo } from "../../types";
import { Settings, Server, Cloud, Shield, Cpu, Database, AlertCircle } from "lucide-react";

interface SettingsSectionProps {
  health: HealthInfo | null;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ health }) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
          SYSTEM ARCHITECTURE & PRODUCTION READINESS
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-slate-700" />
          Workbench Architecture & Configuration
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
          Review current backend adapter connections, local versus AWS cloud runtime topology, and regulatory compliance boundaries.
        </p>
      </div>

      {/* Current Runtime Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Server className="w-4 h-4 text-teal-600" /> Storage Engine
          </div>
          <div className="text-lg font-bold text-slate-900 uppercase font-mono">
            {health?.storage.type || "Local Disk"}
          </div>
          <div className="text-xs text-slate-500">
            {health?.storage.type === "s3"
              ? `Connected to AWS S3: ${health.storage.bucket}`
              : "Private local directory storage with HMAC presigned tokens."}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Cpu className="w-4 h-4 text-violet-600" /> Protein Model Backend
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">
            {health?.workers.esmfold_runtime || "Meta ESMFold v1.0"}
          </div>
          <div className="text-xs text-slate-500">
            Supports local GPU inference, benchmark references, or AWS Batch cluster workers.
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Shield className="w-4 h-4 text-indigo-600" /> Authentication Mode
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {health?.local_dev_mode ? "Local Dev JWT" : "Amazon Cognito"}
          </div>
          <div className="text-xs text-slate-500">
            {health?.local_dev_mode
              ? "Dual researcher & admin local credentials enabled."
              : "Amazon Cognito User Pool OIDC token verification."}
          </div>
        </div>
      </div>

      {/* AWS Production Deployment Reference */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Cloud className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">AWS Production Cloud Architecture</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The workbench is architected with a modular adapter boundary so local components can be swapped for managed AWS cloud services with zero modification to business logic:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Authentication</div>
            <div className="text-slate-500">Amazon Cognito User Pools with MFA, Hosted UI, and JWT authorizers.</div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">API & Web Layer</div>
            <div className="text-slate-500">Amazon API Gateway HTTP API + ECS Fargate FastAPI container.</div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Relational Store</div>
            <div className="text-slate-500">Amazon Aurora Serverless v2 PostgreSQL with encryption at rest.</div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Object Storage</div>
            <div className="text-slate-500">Private S3 bucket with AWS KMS Customer Managed Keys (SSE-KMS).</div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Asynchronous Queue</div>
            <div className="text-slate-500">Amazon SQS Dead-Letter Queues + AWS Step Functions orchestration.</div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">GPU Structure Prediction</div>
            <div className="text-slate-500">AWS Batch compute environment with EC2 g5.xlarge (NVIDIA A10G).</div>
          </div>
        </div>
      </div>

      {/* Regulatory Notice Banner */}
      <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-2">
        <div className="font-bold flex items-center gap-2 text-amber-950">
          <AlertCircle className="w-4 h-4 text-amber-700" />
          Regulatory Compliance Notice (HIPAA / FDA / GDPR)
        </div>
        <p className="leading-relaxed">
          AWS HIPAA-eligible service status alone does not establish legal or medical compliance. Prior to ingesting real patient identifiers or protected health information (PHI), organizations must execute an AWS Business Associate Addendum (BAA), establish rigorous data retention and audit logging policies, and undergo formal clinical validation. This workbench is strictly an investigational research demonstration.
        </p>
      </div>
    </div>
  );
};
