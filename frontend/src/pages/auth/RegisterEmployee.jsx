import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { registerEmployee } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import BrandLogo from '../../components/BrandLogo';

export default function RegisterEmployee() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1><BrandLogo variant="auto" /></h1>
          <h2>Invalid Invite Link</h2>
          <p className="error-msg">This invite link is missing a token. Please request a new invitation.</p>
          <p className="auth-footer"><Link to="/login">Back to login</Link></p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data) => {
    try {
      setError('');
      const res = await registerEmployee({ token, name: data.name, password: data.password });
      const { token: authToken, user } = res.data;
      setSession(authToken, user);
      navigate('/employee');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>merQetia</h1>
        <h2>Complete Your Registration</h2>
        <p style={{ color: '#6B7280', marginBottom: '1rem', fontSize: '14px' }}>
          You've been invited to join merQetia as an employee. Set your name and password to get started.
        </p>
        {error && <p className="error-msg">{error}</p>}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              {...register('name', { required: 'Name is required' })}
              placeholder="Your name"
            />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
              placeholder="••••••••"
            />
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Complete Registration'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
