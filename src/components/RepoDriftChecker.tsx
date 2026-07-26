import React, { useState, useEffect } from 'react';
import { 
  GitCommit, 
  GitBranch, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ExternalLink, 
  FileCode, 
  Globe, 
  Code2,
  Search,
  Terminal,
  Copy,
  Check
} from 'lucide-react';

// Import exact raw source code of key audited files using Vite's ?raw feature
import rawPackageJson from '../../package.json?raw';
import rawMetadataJson from '../../metadata.json?raw';
import rawReadme from '../../README.md?raw';
import rawAppTsx from '../App.tsx?raw';
import rawCvEngine from '../utils/cvEngine.ts?raw';
import rawOfflinePrivacyModal from './OfflinePrivacyModal.tsx?raw';

interface FileSyncStatus {
  path: string;
  localHash: string;
  remoteHash?: string;
  status: 'synced' | 'drifted' | 'remote_missing' | 'checking' | 'error';
  localSize: number;
  remoteSize?: number;
}

interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  htmlUrl: string;
}

// Map of audited file relative paths to their actual embedded raw local source content
const LOCAL_RAW_FILES: Record<string, string> = {
  'package.json': rawPackageJson,
  'metadata.json': rawMetadataJson,
  'src/App.tsx': rawAppTsx,
  'src/utils/cvEngine.ts': rawCvEngine,
  'src/components/OfflinePrivacyModal.tsx': rawOfflinePrivacyModal,
  'README.md': rawReadme
};

const FILES_TO_AUDIT = Object.keys(LOCAL_RAW_FILES);

export const RepoDriftChecker: React.FC = () => {
  const [repoInput, setRepoInput] = useState<string>('TechLuddite/Cropalot');
  const [branch, setBranch] = useState<string>('main');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [latestCommit, setLatestCommit] = useState<CommitInfo | null>(null);
  const [fileStatuses, setFileStatuses] = useState<FileSyncStatus[]>([]);
  const [overallStatus, setOverallStatus] = useState<'synced' | 'drifted' | 'not_found' | 'idle' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  // Normalize line endings to LF (\n) to ensure hash consistency across OS/git line-ending conversions
  const normalizeContent = (text: string): string => {
    return text.replace(/\r\n/g, '\n');
  };

  // Helper to compute SHA-256 of text using browser Web Crypto API
  const computeSha256 = async (text: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizeContent(text));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleRunVerification = async () => {
    const cleanedRepo = repoInput.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    if (!cleanedRepo || !cleanedRepo.includes('/')) {
      setErrorMessage('Please enter a valid GitHub repository in "owner/repo" format (e.g. TechLuddite/Cropalot)');
      setOverallStatus('error');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setOverallStatus('idle');

    try {
      // 1. Fetch latest commit from GitHub REST API
      const commitRes = await fetch(`https://api.github.com/repos/${cleanedRepo}/commits/${branch}`);
      
      if (commitRes.status === 404) {
        setOverallStatus('not_found');
        setErrorMessage(`Repository "${cleanedRepo}" or branch "${branch}" was not found on GitHub. Make sure the repository is published and set to public.`);
        setIsVerifying(false);
        return;
      }

      if (!commitRes.ok) {
        throw new Error(`GitHub API error: ${commitRes.status} ${commitRes.statusText}`);
      }

      const commitData = await commitRes.json();
      const commitInfo: CommitInfo = {
        sha: commitData.sha,
        message: commitData.commit.message,
        author: commitData.commit.author?.name || commitData.commit.committer?.name || 'GitHub Contributor',
        date: new Date(commitData.commit.committer?.date || Date.now()).toLocaleString(),
        htmlUrl: commitData.html_url
      };
      setLatestCommit(commitInfo);

      // 2. Audit key files against raw GitHub contents
      const auditedFiles: FileSyncStatus[] = [];
      let totalDriftCount = 0;

      for (const filePath of FILES_TO_AUDIT) {
        const localContent = LOCAL_RAW_FILES[filePath] || '';
        const localHash = await computeSha256(localContent);

        try {
          const rawRes = await fetch(`https://raw.githubusercontent.com/${cleanedRepo}/${branch}/${filePath}`);
          if (rawRes.ok) {
            const remoteContent = await rawRes.text();
            const remoteHash = await computeSha256(remoteContent);
            const isMatch = localHash === remoteHash;

            if (!isMatch) totalDriftCount++;

            auditedFiles.push({
              path: filePath,
              localHash: localHash.slice(0, 10),
              remoteHash: remoteHash.slice(0, 10),
              status: isMatch ? 'synced' : 'drifted',
              localSize: localContent.length,
              remoteSize: remoteContent.length
            });
          } else {
            auditedFiles.push({
              path: filePath,
              localHash: localHash.slice(0, 10),
              status: 'remote_missing',
              localSize: localContent.length
            });
          }
        } catch {
          auditedFiles.push({
            path: filePath,
            localHash: localHash.slice(0, 10),
            status: 'error',
            localSize: localContent.length
          });
        }
      }

      setFileStatuses(auditedFiles);
      setOverallStatus(totalDriftCount === 0 ? 'synced' : 'drifted');
      setLastCheckTime(new Date().toLocaleTimeString());

    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'Failed to connect to GitHub API';
      setErrorMessage(errStr);
      setOverallStatus('error');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    // Run verification on mount
    handleRunVerification();
  }, []);

  const copyVerificationCommand = () => {
    const cmd = `curl -s https://api.github.com/repos/${repoInput.trim()}/commits/${branch} | grep sha`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-5 text-slate-200">
      {/* Overview Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-950 to-slate-950 border border-cyan-500/30 space-y-2">
        <div className="flex items-center gap-2.5 text-cyan-300 font-bold text-sm sm:text-base">
          <Code2 className="w-5 h-5 text-cyan-400 shrink-0" />
          <span>Source Code Synchronization & Drift Verification</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Repo Drift verification allows privacy-minded users and security auditors to confirm that the running web application matches the published GitHub source code line-for-line without unauthorized modifications, injected scripts, or uncommitted background telemetry.
        </p>
      </div>

      {/* GitHub Repo Input & Actions */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <label className="block text-xs font-bold text-slate-300">Target GitHub Repository & Branch</label>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="relative flex-1">
            <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repository (e.g. TechLuddite/Cropalot)"
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>
          <div className="relative w-full sm:w-32">
            <GitBranch className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="branch"
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleRunVerification}
            disabled={isVerifying}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0 cursor-pointer shadow-md shadow-cyan-500/10"
          >
            <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Checking...' : 'Check Drift'}</span>
          </button>
        </div>
      </div>

      {/* Verification Results Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Drift Audit Result:</span>
            {overallStatus === 'synced' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>In Sync (100% Match)</span>
              </span>
            )}
            {overallStatus === 'drifted' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Drift Detected / Local Customization</span>
              </span>
            )}
            {overallStatus === 'not_found' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Repo Not Published Yet</span>
              </span>
            )}
            {overallStatus === 'error' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Verification Error</span>
              </span>
            )}
            {overallStatus === 'idle' && isVerifying && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Querying GitHub API...</span>
              </span>
            )}
          </div>

          {lastCheckTime && (
            <span className="text-[11px] text-slate-500">
              Last checked: {lastCheckTime}
            </span>
          )}
        </div>

        {/* Error/Notice Message */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <p className="text-amber-300 font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Status Notice</span>
            </p>
            <p>{errorMessage}</p>
            {overallStatus === 'not_found' && (
              <p className="text-slate-400 pt-1 text-[11px]">
                Tip: Once you publish or connect your repository on GitHub (e.g. <code className="text-cyan-300 font-mono">https://github.com/{repoInput}</code>), re-run this check to get live SHA-256 code comparisons!
              </p>
            )}
          </div>
        )}

        {/* GitHub Commit Box */}
        {latestCommit && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-cyan-400" />
                <span>Latest Remote Commit on GitHub</span>
              </div>
              <a
                href={latestCommit.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] flex items-center gap-1 underline"
              >
                <span>{latestCommit.sha.slice(0, 7)}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-300 font-medium italic">"{latestCommit.message}"</p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
              <span>Committed by <strong className="text-slate-400">{latestCommit.author}</strong></span>
              <span>{latestCommit.date}</span>
            </div>
          </div>
        )}

        {/* File Drift Comparison Table */}
        {fileStatuses.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-slate-400" />
                <span>Key Core Files Audited ({fileStatuses.length})</span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                  <tr>
                    <th className="p-2.5">File Path</th>
                    <th className="p-2.5">Local SHA-256</th>
                    <th className="p-2.5">GitHub SHA-256</th>
                    <th className="p-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {fileStatuses.map((f) => (
                    <tr key={f.path} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-2.5 font-mono text-slate-200 text-[11px]">{f.path}</td>
                      <td className="p-2.5 font-mono text-slate-400 text-[11px]">{f.localHash}...</td>
                      <td className="p-2.5 font-mono text-slate-400 text-[11px]">
                        {f.remoteHash ? `${f.remoteHash}...` : '—'}
                      </td>
                      <td className="p-2.5 text-right">
                        {f.status === 'synced' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Synced
                          </span>
                        )}
                        {f.status === 'drifted' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> Drifted
                          </span>
                        )}
                        {f.status === 'remote_missing' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            Local Only
                          </span>
                        )}
                        {f.status === 'error' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            Check Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Terminal Verification Script Box */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-bold">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Independent Terminal Verification Command</span>
            </div>
            <button
              type="button"
              onClick={copyVerificationCommand}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
            >
              {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCmd ? 'Copied!' : 'Copy Script'}</span>
            </button>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            You can verify commit integrity independently in your terminal by comparing GitHub head commit against your local checkout:
          </p>
          <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-cyan-300 border border-slate-800/80 overflow-x-auto select-all">
            curl -s https://api.github.com/repos/{repoInput.trim()}/commits/{branch} | grep sha
          </div>
        </div>
      </div>
    </div>
  );
};
