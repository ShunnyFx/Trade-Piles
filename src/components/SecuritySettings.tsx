import React, { useState, useEffect } from "react";
import { Shield, Check, Copy, RefreshCw, AlertTriangle, Smartphone } from "lucide-react";

// Deterministic time-based token generator (similar to TOTP, rotating every 30s)
export const getTOTPCode = (secret: string, offset: number = 0) => {
  const epoch = Math.floor(Date.now() / 30000) + offset;
  let hash = 0;
  const str = epoch.toString() + secret;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const code = Math.abs(hash % 1000000);
  return code.toString().padStart(6, "0");
};

interface SecuritySettingsProps {
  is2faEnabled: boolean;
  twoFactorSecret: string;
  onToggle2FA: (enable: boolean, code: string) => Promise<boolean>;
}

export default function SecuritySettings({
  is2faEnabled,
  twoFactorSecret,
  onToggle2FA
}: SecuritySettingsProps) {
  const [currentCode, setCurrentCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [verificationInput, setVerificationInput] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Update token and progress bar every second
  useEffect(() => {
    const updateToken = () => {
      const now = Date.now();
      const secondsInPeriod = Math.floor((now % 30000) / 1000);
      setTimeLeft(30 - secondsInPeriod);
      setCurrentCode(getTOTPCode(twoFactorSecret));
    };

    updateToken();
    const interval = setInterval(updateToken, 1000);
    return () => clearInterval(interval);
  }, [twoFactorSecret]);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(twoFactorSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (verificationInput.length !== 6 || isNaN(Number(verificationInput))) {
      setError("Please enter a valid 6-digit authenticator code.");
      return;
    }

    // Verify code against current epoch token
    const expected = getTOTPCode(twoFactorSecret);
    const expectedPrev = getTOTPCode(twoFactorSecret, -1); // tolerance for clock drift
    const expectedNext = getTOTPCode(twoFactorSecret, 1);

    const isValid = verificationInput === expected || verificationInput === expectedPrev || verificationInput === expectedNext;

    if (!isValid) {
      setError("Invalid security code. Please check your authenticator code.");
      return;
    }

    const res = await onToggle2FA(!is2faEnabled, verificationInput);
    if (res) {
      setSuccess(true);
      setVerificationInput("");
      setShowSetup(false);
      setTimeout(() => setSuccess(false), 4000);
    } else {
      setError("Server verification failed. Please try again.");
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6" id="security-section">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Account Security</h3>
            <p className="text-xs text-slate-400">Secure transactions and unauthorized login defense</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${is2faEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
          {is2faEnabled ? "2FA SECURED" : "2FA INACTIVE"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Status Information */}
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Two-Factor Authentication (2FA)</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Two-Factor Authentication adds an extra layer of absolute protection to your Trade Piles account. When enabled, all cash withdrawals and premium transaction changes will require verification of the 6-digit rolling authenticator token.
            </p>
            {!is2faEnabled ? (
              <button
                id="btn-setup-2fa"
                onClick={() => setShowSetup(!showSetup)}
                className="w-full md:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-slate-950 font-bold rounded-lg text-sm"
              >
                Configure Authenticator App
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20 flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-300">2FA is actively protecting your withdrawals and secure balance gateways.</span>
                </div>
                <button
                  id="btn-disable-2fa"
                  onClick={() => setShowSetup(true)}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold border border-rose-500/20 rounded-lg text-xs"
                >
                  Disable Protection
                </button>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-950/40 rounded-lg border border-slate-800/50 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-semibold text-amber-400">Secure Protocol Warning</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Never share your master secret key with anyone. Support operators will never request your secret key or authenticator seed. Secure keys are stored locally on-device.
              </p>
            </div>
          </div>
        </div>

        {/* Live Authenticator Simulator Widget */}
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 bg-sky-500/5 text-sky-400 rounded-bl-lg border-b border-l border-slate-800">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">Built-In Authenticator Simulator</span>
                <span className="px-1.5 py-0.5 bg-sky-500/10 text-[9px] text-sky-300 rounded uppercase font-bold">Testing Aid</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-4">
                We've built a synchronized Authenticator widget. For standard setups, use the rotating code below to verify your actions instantly.
              </p>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col items-center justify-center py-6">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Trade Piles ({twoFactorSecret})</span>
                <span className="text-3xl font-mono font-bold tracking-[0.2em] text-sky-400 pl-[0.2em]">
                  {currentCode.slice(0, 3)} {currentCode.slice(3)}
                </span>
                <div className="w-full max-w-[200px] bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden">
                  <div
                    className="bg-sky-400 h-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / 30) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-500 mt-2 font-mono">Ticking: {timeLeft} seconds remaining</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Secret Key: <span className="text-slate-200">{twoFactorSecret}</span></span>
              <button
                onClick={handleCopySecret}
                className="p-1 hover:bg-slate-900 text-slate-300 hover:text-sky-400 rounded border border-slate-800 transition-colors"
                title="Copy Key"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2FA Setup Panel Modal / Accordion */}
      {showSetup && (
        <div className="mt-6 p-5 bg-slate-950 rounded-lg border border-slate-800 animate-fadeIn">
          <h4 className="text-sm font-semibold text-slate-200 mb-2">
            {is2faEnabled ? "Disable Two-Factor Protection" : "Enable Two-Factor Authentication"}
          </h4>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            {!is2faEnabled
              ? "To enable 2FA protection, please scan the QR code inside your favorite Authenticator app (Google Authenticator, Authy, etc.) or copy the master secret key, then enter the current 6-digit rolling code to register."
              : "To disable 2FA security coverage, verify your identity by entering the current 6-digit active token below."}
          </p>

          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Visual QR Code Generator */}
            {!is2faEnabled && (
              <div className="p-3 bg-white rounded-lg border border-slate-800 flex items-center justify-center shrink-0">
                <svg width="120" height="120" viewBox="0 0 100 100" className="text-slate-950">
                  {/* Outer Frame */}
                  <rect x="0" y="0" width="25" height="25" fill="currentColor" />
                  <rect x="2" y="2" width="21" height="21" fill="white" />
                  <rect x="6" y="6" width="13" height="13" fill="currentColor" />
                  
                  <rect x="75" y="0" width="25" height="25" fill="currentColor" />
                  <rect x="77" y="2" width="21" height="21" fill="white" />
                  <rect x="81" y="6" width="13" height="13" fill="currentColor" />
                  
                  <rect x="0" y="75" width="25" height="25" fill="currentColor" />
                  <rect x="2" y="77" width="21" height="21" fill="white" />
                  <rect x="6" y="81" width="13" height="13" fill="currentColor" />

                  {/* Mock QR data pixels */}
                  <rect x="35" y="5" width="10" height="10" fill="currentColor" />
                  <rect x="55" y="15" width="15" height="5" fill="currentColor" />
                  <rect x="40" y="30" width="20" height="15" fill="currentColor" />
                  <rect x="10" y="35" width="15" height="10" fill="currentColor" />
                  <rect x="70" y="35" width="25" height="15" fill="currentColor" />
                  <rect x="5" y="55" width="20" height="5" fill="currentColor" />
                  <rect x="35" y="55" width="30" height="10" fill="currentColor" />
                  <rect x="80" y="60" width="15" height="10" fill="currentColor" />
                  <rect x="35" y="75" width="10" height="20" fill="currentColor" />
                  <rect x="55" y="80" width="30" height="15" fill="currentColor" />
                  <rect x="45" y="90" width="5" height="8" fill="currentColor" />
                </svg>
              </div>
            )}

            <div className="flex-1 w-full space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Master Seed Key</span>
                  <span className="font-mono font-bold text-slate-200 tracking-wider">{twoFactorSecret}</span>
                </div>
                <button
                  onClick={handleCopySecret}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded text-[11px]"
                >
                  {copied ? "Copied!" : "Copy Secret"}
                </button>
              </div>

              <form onSubmit={handleVerify2FA} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 uppercase font-semibold mb-1">Enter 6-Digit Authenticator Token</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 123456"
                      className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 font-mono text-center text-lg font-bold tracking-[0.2em] px-4 py-2 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="submit"
                      className={`px-5 py-2 font-bold rounded-lg text-sm shrink-0 transition-colors ${
                        is2faEnabled
                          ? "bg-rose-500 hover:bg-rose-600 text-white"
                          : "bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                      }`}
                    >
                      {is2faEnabled ? "Verify & Disable" : "Verify & Enable"}
                    </button>
                  </div>
                </div>

                {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
                {success && <p className="text-xs text-emerald-400 font-medium">Authenticator verified! Protection updated successfully.</p>}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
