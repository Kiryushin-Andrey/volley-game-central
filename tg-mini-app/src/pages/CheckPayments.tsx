import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamesApi } from '../services/api';
import { BackButton } from '@twa-dev/sdk/react';
import PasswordDialog from '../components/PasswordDialog';
import './CheckPayments.scss';
import WebApp from '@twa-dev/sdk';
import { AxiosError } from 'axios';

const CheckPayments = () => {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string>('');
  const navigate = useNavigate();

  // Show password dialog immediately when component mounts
  useEffect(() => {
    setShowPasswordDialog(true);
  }, []);

  const handleSubmit = async (password: string) => {
    setIsLoading(true);
    setPasswordError('');

    try {
      const result = await gamesApi.checkPayments(password);
      setShowPasswordDialog(false);
      alert(result.message || 'Payment check completed successfully');
      navigate('/');
    } catch (err: any) {
      if (err instanceof AxiosError && err.response?.data?.message == 'Invalid password') {
        setPasswordError(err.response?.data?.message);
      } else {
        setShowPasswordDialog(false);
        WebApp.showPopup({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Unknown error',
          buttons: [{ type: 'ok' }]
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowPasswordDialog(false);
    navigate('/');
  };

  return (
    <div className="check-payments">
      <BackButton onClick={handleCancel} />
      <h1>Check Payments</h1>
      <p>This will check the payment status of all unpaid games and update the database accordingly.</p>
      
      <div className="check-payments-content">
        <PasswordDialog
          isOpen={showPasswordDialog}
          title="Enter Bunq API Password"
          message="Please enter your password to check payment statuses."
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isProcessing={isLoading}
          error={passwordError}
        />
      </div>
    </div>
  );
};

export default CheckPayments;
