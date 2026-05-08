const path = require('path');

describe('emailService — no credential leakage', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('does not log ZEPTOMAIL_TOKEN to stdout on module load', () => {
    process.env.ZEPTOMAIL_TOKEN = 'super-secret-token-abc123';
    process.env.ZEPTOMAIL_URL = 'api.zeptomail.com/v1.1/email';

    const logCalls = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      logCalls.push(args.join(' '));
    });

    jest.isolateModules(() => {
      require('../src/utils/emailService');
    });

    const leaked = logCalls.some(msg => msg.includes('super-secret-token-abc123'));
    expect(leaked).toBe(false);
  });

  it('does not crash on load when SMTP env vars are absent', () => {
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_PORT;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;

    expect(() => {
      jest.isolateModules(() => {
        require('../src/utils/emailService');
      });
    }).not.toThrow();
  });

  it('does not log recipient email address on successful send', async () => {
    process.env.ZEPTOMAIL_TOKEN = 'token';
    process.env.EMAIL_SENDER = 'noreply@oosri.com';

    const logCalls = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      logCalls.push(args.join(' '));
    });

    let sendZeptoEmail;
    jest.isolateModules(() => {
      // Mock the zeptomail client before loading the module
      jest.mock('zeptomail', () => ({
        SendMailClient: jest.fn().mockImplementation(() => ({
          sendMail: jest.fn().mockResolvedValue({ message: 'OK' }),
        })),
      }));
      ({ sendZeptoEmail } = require('../src/utils/emailService'));
    });

    if (sendZeptoEmail) {
      await sendZeptoEmail('victim@example.com', 'Test', '<p>hi</p>', 'Test User');
      const leaked = logCalls.some(msg => msg.includes('victim@example.com'));
      expect(leaked).toBe(false);
    }
  });
});
