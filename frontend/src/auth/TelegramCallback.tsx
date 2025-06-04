import { useEffect, useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 20px;
`;

const Loading = styled.div`
  text-align: center;
  padding: 20px;
`;

const Error = styled.div`
  color: #dc2626;
  max-width: 600px;
  margin: 0 auto;
  text-align: center;

  h1 {
    font-size: 24px;
    margin-bottom: 10px;
  }

  p {
    margin: 0;
  }
`;

function log(message: string) {
  console.log('[Telegram Auth]', message);
}

export function TelegramCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      log('Window loaded');
      
      const fragment = window.location.hash.substring(1);
      log('URL fragment: ' + fragment);

      const params = new URLSearchParams(fragment);
      const authResult = params.get('tgAuthResult');
      
      if (!authResult) {
        setError('No auth result found');
        return;
      }
      
      // First decode from base64
      const decodedStr = atob(authResult);
      log('Decoded string: ' + decodedStr);
      
      // Then parse as JSON
      const decodedData = JSON.parse(decodedStr);
      log('Decoded data: ' + JSON.stringify(decodedData));
      
      const data = {
        id: decodedData.id.toString(),
        username: decodedData.username,
        auth_date: decodedData.auth_date.toString(),
        hash: decodedData.hash
      };
      
      log('Extracted data: ' + JSON.stringify(data, null, 2));
      
      fetch('/auth/telegram/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(response => response.json())
      .then(data => {
        log('Response data: ' + JSON.stringify(data, null, 2));
        if (window.opener) {
          window.opener.postMessage({ type: 'TELEGRAM_AUTH_SUCCESS', data }, '*');
          window.close();
        } else {
          // If opened in same tab, redirect to home page
          window.location.href = '/';
        }
      })
      .catch((e: Error | { message?: string } | unknown) => {
        const message = typeof e === 'object' && e !== null && 'message' in e
          ? String(e.message)
          : 'Authentication failed';
        log('Error: ' + message);
        if (window.opener) {
          window.opener.postMessage({ type: 'TELEGRAM_AUTH_ERROR', error: message }, '*');
          window.close();
        } else {
          setError(message);
        }
      });
    } catch (e: Error | { message?: string } | unknown) {
      const message = typeof e === 'object' && e !== null && 'message' in e
        ? String(e.message)
        : 'Unknown error';
      log('Error: ' + message);
      if (window.opener) {
        window.opener.postMessage({ type: 'TELEGRAM_AUTH_ERROR', error: message }, '*');
        window.close();
      } else {
        setError(message);
      }
    }
  }, []);

  return (
    <Container>
      {error ? (
        <Error>
          <h1>Error</h1>
          <p>{error}</p>
        </Error>
      ) : (
        <Loading>Processing Telegram authentication...</Loading>
      )}
    </Container>
  );
}
