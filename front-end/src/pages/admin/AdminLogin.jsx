import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { signInWithGoogle, signInWithEmail, watchAuthState } from '@/services/auth'
import { getAuth } from 'firebase/auth'
import { canShowDevPreview, activateDevPreview } from '@/services/dev-preview-session'
import { useToast } from '../../context/ToastContext.jsx'
import FormInput from '../../components/common/FormInput.jsx'

function friendlySignInError(err) {
  const code = err?.code ?? ''
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-email'
  ) {
    return 'Invalid email or password.'
  }
  if (code === 'auth/too-many-requests' || code === 'auth/network-request-failed') {
    return 'Too many attempts. Check your connection and try again later.'
  }
  return 'Login failed. Please try again.'
}

export default function AdminLogin() {
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState(undefined)
  const [devPreviewAvailable, setDevPreviewAvailable] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Navigate to dashboard when auth state becomes signed in
  useEffect(() => {
    const unsubscribe = watchAuthState((session) => {
      if (session) {
        navigate('/admin/dashboard');
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session) {
        navigate('/admin/dashboard');
      } else {
        showToast('Your account is not authorized for admin access.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDevPreview = () => {
    const ok = activateDevPreview()
    if (ok) {
      showToast('Dev preview session active', 'success')
      navigate('/admin/dashboard')
    }
  }

  const handleEmailSignIn = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    if (!email.trim()) {
      setEmailError('Email is required')
      return
    }
    if (!password) {
      setEmailError('Password is required')
      return
    }
    setEmailError(undefined)
    setEmailLoading(true)
    try {
      const session = await signInWithEmail(email.trim(), password)
      if (session) {
        navigate('/admin/dashboard')
      } else {
        showToast('Your account is not authorized for admin access.', 'error')
      }
    } catch (err) {
      showToast(friendlySignInError(err), 'error')
    } finally {
      // Never retain the password in component state after an attempt.
      setPassword('')
      setEmailLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__glow" aria-hidden="true"></div>
      <div className="admin-login__card">
        <div className="admin-login__brand">
          <Link to="/" className="navbar__brand" style={{ justifyContent: 'center' }}>
            <img className="navbar__logo-img" src="/logo.png" alt="USSCOS logo" />
            <span className="navbar__logo">U<span className="navbar__logo-accent">S</span>SCOS</span>
            <span className="navbar__logo-sub">Combat Sports Trust</span>
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 'var(--space-3)', fontSize: '0.9rem' }}>
            Sign in to the management panel
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="btn btn-primary btn-full"
          disabled={loading || emailLoading}
          style={{ marginTop: 'var(--space-4)' }}
        >
          {loading ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}
        </button>

        <form onSubmit={handleEmailSignIn} style={{ marginTop: 'var(--space-4)' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', textAlign: 'center', marginBottom: 'var(--space-3)' }}>
            Or continue with an admin email account
          </p>
          <FormInput
            label="Email"
            name="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(undefined) }}
            error={emailError}
            required
          />
          <FormInput
            label="Password"
            name="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="btn btn-secondary btn-full"
            disabled={loading || emailLoading}
            style={{ marginTop: 'var(--space-3)' }}
          >
            {emailLoading ? 'SIGNING IN...' : 'SIGN IN WITH EMAIL'}
          </button>
        </form>

        {devPreviewAvailable && (
          <button
            onClick={handleDevPreview}
            className="btn btn-full"
            style={{
              marginTop: 'var(--space-3)',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.82rem',
            }}
          >
            Dev Preview (No Firebase)
          </button>
        )}

        {devPreviewAvailable && getAuth().currentUser?.uid && (
          <div className="dev-uid" style={{ marginTop: 'var(--space-3)', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
            UID: {getAuth().currentUser?.uid}
            <button
              onClick={() => {
                const uid = getAuth().currentUser?.uid
                if (uid) navigator.clipboard.writeText(uid)
              }}
              className="btn btn-sm"
              style={{ marginLeft: '0.5rem' }}
            >
              Copy
            </button>
          </div>
        )}

        <Link to="/" className="admin-login__back">
          <ArrowLeft size={18} /> Back to website
        </Link>
      </div>
    </div>
  )
}
