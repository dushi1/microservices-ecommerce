import { Lock, Mail, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register(email, password, displayName);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="card p-8 sm:p-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
            <p className="mt-1 text-sm text-slate-500">Join ShopMicro — it's free and instant.</p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Display name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" required value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe" className="input-base pl-10" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="input-base pl-10" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters" className="input-base pl-10" />
              </div>
            </div>
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link to="/login" className="font-medium text-amber-700 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
