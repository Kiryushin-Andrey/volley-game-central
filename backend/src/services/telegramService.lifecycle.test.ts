import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('telegramService lifecycle', () => {
  it('importing telegram helpers does not call launchBot / bot.launch', async () => {
    // Dynamic import: module-scope launchBot() would invoke bot.launch() and start polling.
    const mod = await import('./telegramService');
    assert.equal(typeof mod.launchBot, 'function');
    assert.equal(typeof mod.checkTelegramGroupMembership, 'function');
    assert.equal(typeof mod.sendLateSignoutGroupNotification, 'function');
  });
});
