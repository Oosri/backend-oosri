const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Buyer = require('../Buyer/models/buyerAuthModel'); 

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:4321/api/v1/auth/buyer/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let buyer = await Buyer.findOne({ googleId: profile.id });

    if (!buyer) {
      buyer = new Buyer({
        googleId: profile.id,
        fullName: profile.displayName,
        email: profile.emails[0].value,
        isConfirmed: true, 
      });
      await buyer.save();
    }

    return done(null, buyer);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const buyer = await Buyer.findById(id);
    done(null, buyer);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
