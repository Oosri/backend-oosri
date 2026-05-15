const fs = require('fs');
const path = require('path');

const read = (relPath) =>
  fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');

describe('access token lifetime — source file checks', () => {
  it('buyerAuthService issues 15m access tokens (not 3d)', () => {
    const src = read('src/Buyer/Service/buyerAuthService.js');
    expect(src).toMatch(/issueBuyerTokens[\s\S]*?expiresIn:\s*['"]15m['"]/);
    expect(src).not.toMatch(/expiresIn:\s*['"]3d['"]/);
  });

  it('adminAuthService issues 15m access tokens (not 3d)', () => {
    const src = read('src/Admin/services/adminAuthService.js');
    expect(src).not.toMatch(/expiresIn:\s*['"]3d['"]/);
    const accessTokenLines = src
      .split('\n')
      .filter(l => l.includes('accessToken') && l.includes('expiresIn'));
    expect(accessTokenLines.length).toBeGreaterThan(0);
    accessTokenLines.forEach(line => {
      expect(line).toMatch(/['"]15m['"]/);
    });
  });

  it('passport-config issues 15m access tokens (not 3d)', () => {
    const src = read('src/configs/passport-config.js');
    expect(src).toMatch(/accessTokenJWT[\s\S]{0,200}expiresIn:\s*['"]15m['"]/);
    expect(src).not.toMatch(/expiresIn:\s*['"]3d['"]/);
  });

  it('seller signup pre-OTP tokens are 15m (not 7d for these flows)', () => {
    const src = read('src/controllers/sellerAuth.controller.js');
    // Both pre-OTP signup tokens should be 15m
    const signupSection = src.match(
      /sellerAccountSignup[\s\S]*?module\.exports/
    )?.[0] || src;
    const tokenMatches = [...signupSection.matchAll(/expiresIn:\s*['"](\w+)['"]/g)]
      .map(m => m[1]);
    // Both should be 15m (the signup pre-OTP tokens)
    expect(tokenMatches.filter(v => v === '15m').length).toBeGreaterThanOrEqual(2);
  });

  it('refresh tokens remain at 7d', () => {
    const buyer = read('src/Buyer/Service/buyerAuthService.js');
    const admin = read('src/Admin/services/adminAuthService.js');
    expect(buyer).toMatch(/refreshToken[\s\S]{0,100}expiresIn:\s*['"]7d['"]/);
    expect(admin).toMatch(/refreshToken[\s\S]{0,100}expiresIn:\s*['"]7d['"]/);
  });
});
