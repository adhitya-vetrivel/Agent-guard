import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Swords, Activity } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const [email, setEmail] = useState('admin@agentguard.io')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const fillDemoCredentials = (role: 'admin' | 'demo') => {
    if (role === 'admin') { setEmail('admin@agentguard.io'); setPassword('admin123') }
    else { setEmail('demo@agentguard.io'); setPassword('demo123') }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-danger/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-lg border bg-card/80 backdrop-blur-xl p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">AgentGuard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Runtime Identity & Behavior Firewall</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@agentguard.io" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Activity className="h-4 w-4 animate-spin" /> Authenticating...</> : <><Shield className="h-4 w-4" /> Sign In</>}
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            <p className="text-center text-xs text-muted-foreground">Quick Demo Access</p>
            <div className="flex gap-2">
              <button onClick={() => fillDemoCredentials('admin')} className="flex-1 rounded-lg border bg-background/30 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                <span className="flex items-center justify-center gap-1.5"><Swords className="h-3 w-3" /> Admin Login</span>
              </button>
              <button onClick={() => fillDemoCredentials('demo')} className="flex-1 rounded-lg border bg-background/30 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                <span className="flex items-center justify-center gap-1.5"><Swords className="h-3 w-3" /> Demo Login</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
