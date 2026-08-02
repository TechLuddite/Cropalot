import React, { useState } from 'react';
import {
  GitCommit,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Lock
} from 'lucide-react';

const REPO = 'TechLuddite/Cropalot';

/**
 * Shows what this build actually is, and explains honestly what an in-page
 * check can and cannot prove.
 *
 * This replaces an earlier "repo drift checker" that hashed copies of its own
 * source embedded in the bundle and compared them to GitHub. That check was
 * circular: anything able to tamper with the running code could tamper with the
 * embedded copies in the same edit, so a passing result proved nothing. It also
 * needed network access, which the app's Content-Security-Policy now forbids
 * outright.
 *
 * What replaces it is weaker-sounding and actually true: state the commit,
 * point at the enforced policy, and show the user how to verify the bundle from
 * outside the bundle.
 */
export const BuildProvenance: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);

  const shortSha = __COMMIT_SHA__ === 'unknown' ? 'unknown' : __COMMIT_SHA__.slice(0, 12);
  const buildDate =
    __BUILD_TIME__ && !Number.isNaN(Date.parse(__BUILD_TIME__))
      ? new Date(__BUILD_TIME__).toLocaleString()
      : 'unknown';

  const verifyCommand = [
    '# 1. Hash the JavaScript this page actually served you',
    "curl -s https://techluddite.github.io/Cropalot/assets/*.js | sha256sum",
    '',
    '# 2. Build the same commit yourself and hash the result',
    `git clone https://github.com/${REPO} && cd Cropalot`,
    `git checkout ${__COMMIT_SHA__ === 'unknown' ? '<commit>' : __COMMIT_SHA__}`,
    'npm ci && npm run build && sha256sum dist/assets/*.js'
  ].join('\n');

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-5 text-slate-200">
      {/* The guarantee that is actually enforced */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-500/30 space-y-2.5">
        <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm sm:text-base">
          <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>The guarantee your browser enforces</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Cropalot ships a Content-Security-Policy containing{' '}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-[11px]">
            connect-src 'none'
          </code>
          . Your browser reads that line before running any of our code and then refuses every
          outbound request the page could make &mdash; fetch, XHR, WebSocket, EventSource,
          sendBeacon. Your photos cannot be uploaded, because the runtime will not carry them.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          This is the part worth checking, and it takes about five seconds: view source on this
          page and read the <code className="text-emerald-300 font-mono text-[11px]">meta</code>{' '}
          tag in the <code className="text-emerald-300 font-mono text-[11px]">&lt;head&gt;</code>.
          One line, no JavaScript audit required, and it stays true for every future release
          unless somebody changes that line.
        </p>
      </div>

      {/* Build identity */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <GitCommit className="w-4 h-4 text-cyan-400" />
          <span>What this build is</span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <dt className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              Commit
            </dt>
            <dd className="font-mono text-slate-200 flex items-center gap-2">
              <span>{shortSha}</span>
              {__COMMIT_SHA__ !== 'unknown' && (
                <a
                  href={`https://github.com/${REPO}/commit/${__COMMIT_SHA__}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300"
                  title="View this commit on GitHub"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              Built
            </dt>
            <dd className="font-mono text-slate-200">{buildDate}</dd>
          </div>
        </dl>
      </div>

      {/* The honest caveat */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Why we do not show you a green &ldquo;verified&rdquo; badge</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Code running inside a page cannot prove its own integrity. Any tampering able to change
          what this app does could equally change whatever self-check it displays, so a
          reassuring checkmark drawn by the app itself carries no information. Earlier versions of
          Cropalot showed exactly such a badge; it has been removed because it was misleading.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Two things <strong className="text-slate-300">do</strong> carry information: the policy
          above, which your browser enforces no matter what our code wants, and an independent
          rebuild you run yourself, below.
        </p>
      </div>

      {/* Independent verification */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Verify this build from outside the browser</span>
          </div>
          <button
            type="button"
            onClick={() => copy(verifyCommand, 'verify')}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
          >
            {copied === 'verify' ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copied === 'verify' ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Rebuild this exact commit on your own machine and compare the hash of the JavaScript
          against what this site served you. Matching hashes mean the deployed bundle came from
          the published source.
        </p>
        <pre className="p-3 rounded-lg bg-slate-950 font-mono text-[10.5px] leading-relaxed text-cyan-300 border border-slate-800/80 overflow-x-auto whitespace-pre">
          {verifyCommand}
        </pre>
      </div>

      {/* Airplane mode test */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>The five-second version</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Open your browser&rsquo;s Network tab, then crop and export a sheet. You will see no
          requests, because there are none to block. Then open the Console: if anything in this
          app ever tried to phone home, the browser would log a Content-Security-Policy violation
          there instead of quietly permitting it.
        </p>
      </div>
    </div>
  );
};
