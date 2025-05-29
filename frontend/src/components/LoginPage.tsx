import { FC } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui/button';
import { Card } from './ui/card';

export const LoginPage: FC = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-96 p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Welcome to Volley Game Central</h1>
        <p className="text-gray-600 text-center mb-8">
          Please log in with your Telegram account to continue.
        </p>
        <Button
          className="w-full"
          onClick={login}
        >
          Login with Telegram
        </Button>
      </Card>
    </div>
  );
};
