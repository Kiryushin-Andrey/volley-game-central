import { createInitialState } from './state.js';
import { createBunqApiApp } from './bunqApiApp.js';
import { createControlApp } from './controlApp.js';

const API_PORT = parseInt(process.env.BUNQ_MOCK_API_PORT || '3998', 10);
const CONTROL_PORT = parseInt(process.env.BUNQ_MOCK_CONTROL_PORT || '3999', 10);
const CONTROL_TOKEN = process.env.BUNQ_MOCK_CONTROL_TOKEN;

const state = createInitialState();

createBunqApiApp(state).listen(API_PORT, () => {
  console.log(`[bunq-mock] Bunq API simulation listening on http://127.0.0.1:${API_PORT}/v1`);
});

createControlApp(state, { controlToken: CONTROL_TOKEN }).listen(CONTROL_PORT, () => {
  console.log(
    `[bunq-mock] Control API listening on http://127.0.0.1:${CONTROL_PORT}` +
      (CONTROL_TOKEN ? ' (auth token required)' : ' (no control token set)')
  );
});
