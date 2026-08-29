import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/db';
import { OfficialLoader } from './OfficialLoader';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderSync,
  ShieldCheck,
  ExternalLink,
  Info,
  Database,
  Image as ImageIcon,
  Check,
  UploadCloud,
  Layers,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DriveStatus {
  success: boolean;
  configured: boolean;
  folderId: string | null;
  rawFolderConfigured: boolean;
  serviceAccount: string | null;
}

export const DriveStorageSettings: React.FC = () => {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    folderName?: string;
  } | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    message: string;
    migratedAvatars?: number;
    migratedBikes?: number;
  } | null>(null);

  useModalDismiss(showConfirmModal, () => setShowConfirmModal(false));

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await authFetch('/api/drive/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch Drive status:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/drive/test-connection', { method: 'POST' });
      const data = await res.json();
      setTestResult({
        success: res.ok && data.success,
        message: data.message || (res.ok ? 'Connection verified successfully.' : 'Connection test failed.'),
        folderName: data.folderName,
      });
      fetchStatus();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Network error while testing Google Drive connection.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const executeMigration = async () => {
    setShowConfirmModal(false);
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const res = await authFetch('/api/drive/migrate-existing', { method: 'POST' });
      const data = await res.json();
      setMigrationResult({
        success: res.ok && data.success,
        message: data.message || (res.ok ? 'Migration completed.' : data.error || 'Migration failed.'),
        migratedAvatars: data.migratedAvatars,
        migratedBikes: data.migratedBikes,
      });
    } catch (err: any) {
      setMigrationResult({
        success: false,
        message: err?.message || 'Network error during Drive migration.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#e2ece2] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-[#e8f5e9] text-[#1b4332] shrink-0">
            <HardDrive className="w-6 h-6 text-[#2d6a4f]" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#1b4332] flex items-center gap-2">
              Google Shared Drive & Cloud Storage
              {status?.configured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7]">
                  <Check className="w-3 h-3 text-[#2d6a4f]" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" /> Action Required
                </span>
              )}
            </h3>
            <p className="text-xs text-[#52605d] mt-1 leading-relaxed max-w-2xl">
              Member avatars, registration IDs, and motorcycle garage photos are automatically compressed and saved to your club's Google Shared Drive. Clean direct URLs are stored in MongoDB, eliminating heavy Base64 data.
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e2ece2] border border-[#e2ece2] text-[#1b4332] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#2d6a4f] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connection & Credentials Status */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0f4f0]">
            <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#1b4332] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
              Integration Diagnostics
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2]">
              <span className="text-[#52605d] font-medium">Service Account Authentication:</span>
              <span className="font-bold text-[#1b4332] text-right truncate max-w-[220px]">
                {status?.serviceAccount || 'Not configured in environment'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2]">
              <span className="text-[#52605d] font-medium">Target Shared Drive Folder ID:</span>
              <span className="font-bold font-mono text-[#1b4332]">
                {status?.folderId || (status?.rawFolderConfigured ? 'Configured' : 'Not set (Root)')}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2]">
              <span className="text-[#52605d] font-medium">CDN Direct Delivery:</span>
              <span className="font-bold text-[#2d6a4f]">
                Active (lh3.googleusercontent.com + /api/drive/file proxy)
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !status?.configured}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#74c69d]" />
                  <span>Verifying Shared Drive Access & Permissions...</span>
                </>
              ) : (
                <>
                  <FolderSync className="w-3.5 h-3.5 text-[#74c69d]" />
                  <span>Test Connection & Write Permissions</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 border ${
                testResult.success
                  ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div>{testResult.message}</div>
                {testResult.folderName && (
                  <div className="text-[11px] font-normal opacity-90">
                    Shared Folder Name: <span className="font-semibold">{testResult.folderName}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* MongoDB Clean-Up & Migration Tool */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e2ece2] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0f4f0]">
            <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#1b4332] flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#2d6a4f]" />
              MongoDB Base64 Strip & Migration
            </span>
          </div>

          <p className="text-xs text-[#52605d] leading-relaxed">
            If you have existing members or registrations with Base64 images in MongoDB, this tool scans the entire database, uploads each avatar and motorcycle photo to your Google Shared Drive named as <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-[#1b4332]">lastname-avatar.jpg</code> and <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-[#1b4332]">lastname-bike.jpg</code>, and cleans up MongoDB.
          </p>

          <div className="pt-2">
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isMigrating || !status?.configured}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#74c69d]" />
                  <span>Migrating Photos to Google Drive...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5 text-[#74c69d]" />
                  <span>Scan & Migrate All Base64 Images to Drive</span>
                </>
              )}
            </button>
          </div>

          {migrationResult && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 border ${
                migrationResult.success
                  ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {migrationResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div>{migrationResult.message}</div>
                {typeof migrationResult.migratedAvatars === 'number' && (
                  <div className="text-[11px] font-normal opacity-90">
                    Uploaded: {migrationResult.migratedAvatars} avatar(s), {migrationResult.migratedBikes} motorcycle photo(s).
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Setup Instructions Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
        <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#1b4332] flex items-center gap-1.5">
          <Info className="w-4 h-4 text-[#2d6a4f]" />
          How Google Shared Drive Integration Works
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#52605d]">
          <div className="p-3 rounded-xl bg-white border border-[#e2ece2] space-y-1">
            <span className="font-bold text-[#1b4332] block">1. Environment Secrets</span>
            <p>
              Add <code className="font-mono text-[11px] text-[#2d6a4f]">GOOGLE_DRIVE_FOLDER_ID</code>, <code className="font-mono text-[11px] text-[#2d6a4f]">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, and <code className="font-mono text-[11px] text-[#2d6a4f]">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> (or <code className="font-mono text-[11px] text-[#2d6a4f]">GOOGLE_SERVICE_ACCOUNT_JSON</code>) in AI Studio Settings.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#e2ece2] space-y-1">
            <span className="font-bold text-[#1b4332] block">2. Shared Drive Permission</span>
            <p>
              In Google Drive, open your Shared Drive, click <strong>Manage members</strong>, and add your Service Account email as a <strong>Content Manager</strong> or <strong>Contributor</strong>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#e2ece2] space-y-1">
            <span className="font-bold text-[#1b4332] block">3. Zero-Base64 MongoDB</span>
            <p>
              When avatars or bike photos are uploaded or cropped, files are stored on Google Drive with standard naming (<code className="font-mono text-[11px] text-[#2d6a4f]">lastname-avatar.jpg</code>). MongoDB only stores the CDN link.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Base64 Scan & Migration */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#e2ece2] space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#e8f5e9] text-[#1b4332] shrink-0 border border-[#b7e4c7]">
                    <UploadCloud className="w-6 h-6 text-[#2d6a4f]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-lg text-[#1b4332]">
                      Migrate Photos to Google Drive?
                    </h3>
                    <p className="text-xs text-[#52605d] mt-0.5">
                      MongoDB Base64 Strip & Cloud Storage Sync
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="p-1.5 text-[#52605d] hover:text-[#1b4332] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Details / Explanations */}
              <div className="space-y-3 text-xs text-[#52605d]">
                <p className="leading-relaxed">
                  This action will scan all member profiles and registration records in MongoDB to find any remaining embedded Base64 avatar or motorcycle image files.
                </p>

                <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2">
                  <div className="font-bold text-[#1b4332] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    What happens during migration:
                  </div>
                  <ul className="space-y-1.5 text-[11px] list-disc list-inside">
                    <li>Uploads each Base64 image directly to your connected Google Shared Drive.</li>
                    <li>Names files cleanly as <code className="font-mono text-[#1b4332] bg-white px-1 py-0.5 rounded border border-[#e2ece2]">lastname-avatar.jpg</code> and <code className="font-mono text-[#1b4332] bg-white px-1 py-0.5 rounded border border-[#e2ece2]">lastname-bike.jpg</code>.</li>
                    <li>Replaces the heavy Base64 string in MongoDB with the fast Google Drive CDN URL.</li>
                    <li>Significantly reduces database document size and accelerates app loading times.</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-[#52605d] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeMigration}
                  className="px-5 py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-[#74c69d]" />
                  <span>Start Cloud Migration</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <OfficialLoader isLoading={isLoading} message="Loading Google Drive Status..." />
    </div>
  );
};
