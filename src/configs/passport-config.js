const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const bcrypt = require('bcrypt');
const Buyer = require('../Buyer/models/buyerAuthModel');
const dotenv = require('dotenv');
const { signJwt } = require('../utils/jwt');

dotenv.config();

const issueTokensForBuyer = async (buyer, tokenPayload) => {
  const accessTokenJWT = signJwt(tokenPayload, { expiresIn: '3d' });
  const refreshTokenJWT = signJwt({ id: buyer._id }, { expiresIn: '7d' });
  buyer.refreshTokenHash = await bcrypt.hash(refreshTokenJWT, 12);
  await buyer.save();

  return { accessTokenJWT, refreshTokenJWT };
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { email } = profile._json;
        const googleId = profile.id;

        let buyer = await Buyer.findOne({ email });

        if (buyer) {
          if (buyer.googleId && buyer.googleId === googleId) {
            const tokenPayload = {
              id: buyer._id,
              fullName: buyer.fullName,
              profileImage: buyer.profileImage,
            };
            const { accessTokenJWT, refreshTokenJWT } =
              await issueTokensForBuyer(buyer, tokenPayload);

            return done(null, { buyer, accessToken: accessTokenJWT, refreshToken: refreshTokenJWT });
          }

          if (!buyer.googleId) {
            buyer.googleId = googleId;
            await buyer.save();

            const tokenPayload = {
              id: buyer._id,
              fullName: buyer.fullName,
              profileImage: buyer.profileImage,
            };
            const { accessTokenJWT, refreshTokenJWT } =
              await issueTokensForBuyer(buyer, tokenPayload);

            return done(null, { buyer, accessToken: accessTokenJWT, refreshToken: refreshTokenJWT });
          }

          return done(null, false, { message: 'Email is already linked to another Google account.' });
        } else {
          buyer = new Buyer({
            googleId,
            email,
            fullName: profile.displayName || profile._json.name || profile._json.given_name,
            profileImage: profile._json.picture,
            isConfirmed: true,
          });
          await buyer.save();

          const tokenPayload = {
            id: buyer._id,
            fullName: buyer.fullName,
            profileImage: buyer.profileImage,
          };
          const { accessTokenJWT, refreshTokenJWT } =
            await issueTokensForBuyer(buyer, tokenPayload);

          return done(null, { buyer, accessToken: accessTokenJWT, refreshToken: refreshTokenJWT });
        }
      } catch (error) {
        console.error('Error in Google Strategy:', error);
        return done(error);
      }
    }
  )
);

passport.serializeUser((buyer, done) => {
  done(null, buyer.id);
});

passport.deserializeUser((id, done) => {
  Buyer.findById(id, (err, buyer) => {
    done(err, buyer);
  });
});

module.exports = passport;
