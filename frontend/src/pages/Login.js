import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mountain } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '', displayName: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 to-slate-900/70"></div>
        <div className="absolute inset-0 flex items-center justify-center text-white px-12">
          <div>
            <Mountain size={64} className="mb-6" />
            <h1 className="text-5xl font-bold heading-font mb-4">Bengaluru Trekkers</h1>
            <p className="text-xl text-blue-100">Operations Management System</p>
            <p className="text-slate-300 mt-4">Streamline trek planning, batch management, and team coordination</p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <Mountain size={48} className="mx-auto mb-4 text-blue-600" />
            <h2 className="text-3xl font-bold heading-font">Bengaluru Trekkers</h2>
          </div>

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
                      <Label htmlFor="login-password">Password</Label>
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
                      className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
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
                      className="w-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
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

          <p className="text-center text-sm text-slate-500 mt-6">
            Want to join as a Trek Lead?{' '}
            <Link to="/lead-signup" className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2">
              Apply here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
