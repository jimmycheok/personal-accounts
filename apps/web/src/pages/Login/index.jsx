import React, { useState } from 'react';
import {
  Form,
  TextInput,
  Button,
  InlineNotification,
  Tile,
} from '@carbon/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f4f4f4' }}>
      <Tile style={{ width: 400, padding: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 300, marginBottom: '0.5rem', color: '#0f62fe' }}>Personal Accountant</h1>
        <p style={{ color: '#525252', marginBottom: '2rem', fontSize: '0.875rem' }}>Malaysia Sole Proprietor Accounting System</p>

        {error && (
          <InlineNotification
            kind="error"
            title={error}
            style={{ marginBottom: '1rem' }}
          />
        )}

        <Form onSubmit={handleSubmit}>
          <TextInput.PasswordInput
            id="password"
            labelText="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{ marginBottom: '1.5rem' }}
          />
          <Button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Form>

        <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#8d8d8d', textAlign: 'center' }}>
          Default password: changeme123
        </p>
      </Tile>
    </div>
  );
}
