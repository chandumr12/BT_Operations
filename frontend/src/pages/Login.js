import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mountain, ArrowLeft, Mail } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login, signup, resetPassword } = useAuth();

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '', displayName: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(loginForm.email, loginForm.password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setLoading(true);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotSent(true);
      toast.success('Password reset email sent!');
    } catch (error) {
      const msg = error.code === 'auth/user-not-found'
        ? 'No account found with this email.'
        : error.message || 'Failed to send reset email.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (signupForm.password !== signupForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (signupForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      await signup(signupForm.email, signupForm.password, signupForm.displayName);
      toast.success('Account created! Please wait for admin approval.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image */}
      <div 
        className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1644047578814-1814a382f092?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwzfHxtb3VudGFpbiUyMHRyZWtraW5nJTIwbGFuZHNjYXBlJTIwaGltYWxheWFzfGVufDB8fHx8MTc3MTk4OTE1N3ww&ixlib=rb-4.1.0&q=85')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-slate-900/60"></div>
        <div className="absolute inset-0 flex items-center justify-center text-white px-12">
          <div>
            <Mountain size={64} className="mb-6" />
            <h1 className="text-5xl font-bold heading-font mb-4">Bengaluru Trekkers</h1>
            <p className="text-xl text-white/75">Operations Management System</p>
            <p className="text-slate-300 mt-4">Streamline trek planning, batch management, and team coordination</p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <Mountain size={48} className="mx-auto mb-4 text-[#f1563f]" />
            <h2 className="text-3xl font-bold heading-font">Bengaluru Trekkers</h2>
          </div>

          {showForgot ? (
            <Card className="border-slate-200 shadow-lg">
              <CardHeader>
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
                >
                  <ArrowLeft size={14} /> Back to Login
                </button>
                <CardTitle className="heading-font">Reset Password</CardTitle>
                <CardDescription>We'll send a reset link to your email</CardDescription>
              </CardHeader>
              <CardContent>
                {forgotSent ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                      <Mail size={24} className="text-emerald-600" />
                    </div>
                    <p className="font-semibold text-slate-800">Check your inbox</p>
                    <p className="text-sm text-slate-500">
                      A password reset link has been sent to <strong>{forgotEmail}</strong>
                    </p>
                    <button
                      onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                      className="text-[#f1563f] hover:text-[#d94530] text-sm font-medium mt-2"
                    >
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <Label htmlFor="forgot-email">Email address</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="your@email.com"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required
                        className="mt-1"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#f1563f] hover:bg-[#d94530]"
                      disabled={loading}
                    >
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : (
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="login-tab">Login</TabsTrigger>
              <TabsTrigger value="signup" data-testid="signup-tab">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-slate-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="heading-font">Welcome Back</CardTitle>
                  <CardDescription>Enter your credentials to access your account</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        data-testid="login-email-input"
                        type="email"
                        placeholder="your@email.com"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <button
                          type="button"
                          onClick={() => { setShowForgot(true); setForgotEmail(loginForm.email); }}
                          className="text-xs text-[#f1563f] hover:text-[#d94530] font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        id="login-password"
                        data-testid="login-password-input"
                        type="password"
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                        required
                        className="mt-1"
                      />
                    </div>

                    <Button
                      data-testid="login-submit-button"
                      type="submit"
                      className="w-full bg-[#f1563f] hover:bg-[#d94530] shadow-lg"
                      disabled={loading}
                    >
                      {loading ? 'Logging in...' : 'Login'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="border-slate-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="heading-font">Create Account</CardTitle>
                  <CardDescription>Register for access (requires admin approval)</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        data-testid="signup-name-input"
                        type="text"
                        placeholder="John Doe"
                        value={signupForm.displayName}
                        onChange={(e) => setSignupForm({...signupForm, displayName: e.target.value})}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        data-testid="signup-email-input"
                        type="email"
                        placeholder="your@email.com"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({...signupForm, email: e.target.value})}
                        required
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        data-testid="signup-password-input"
                        type="password"
                        placeholder="••••••••"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({...signupForm, password: e.target.value})}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                      <Input
                        id="signup-confirm-password"
                        data-testid="signup-confirm-password-input"
                        type="password"
                        placeholder="••••••••"
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm({...signupForm, confirmPassword: e.target.value})}
                        required
                        className="mt-1"
                      />
                    </div>

                    <Button
                      data-testid="signup-submit-button"
                      type="submit"
                      className="w-full bg-[#f1563f] hover:bg-[#d94530] shadow-lg"
                      disabled={loading}
                    >
                      {loading ? 'Creating Account...' : 'Sign Up'}
                    </Button>

                    <p className="text-xs text-slate-500 text-center mt-2">
                      Note: If you register with admin@bengalurutrekkers.com, you'll get instant access as Super Admin
                    </p>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          )} {/* end showForgot ternary */}

          <p className="text-center text-sm text-slate-500 mt-6">
            Want to join as a Trek Lead?{' '}
            <Link to="/lead-signup" className="text-[#f1563f] hover:text-[#d94530] font-medium underline underline-offset-2">
              Apply here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
