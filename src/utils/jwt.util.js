const JWT = require("jsonwebtoken");

const jwtSettings = {
  SECRET: process.env.ACCESS_TOKEN_SECRET,
  AUDIENCE: "aptech.io",
  ISSUER: "softech.cloud",
};

const isProduction = process.env.NODE_ENV === "production";

const createToken = (
  userId,
  firstName,
  lastName,
  position,
  expiresIn,
  secret,
) => {
  const token = JWT.sign(
    {
      position,
      fullName: `${firstName} - ${lastName}`,
    },
    secret,
    {
      expiresIn: expiresIn,
      audience: jwtSettings.AUDIENCE,
      issuer: jwtSettings.ISSUER,
      subject: userId,
      algorithm: "HS512",
    },
  );

  return token;
};

const encodeAccessToken = (...args) => {
  const expiresIn = isProduction ? "120s" : "1d";
  return createToken(...args, expiresIn, jwtSettings.SECRET);
};

const encodeRefreshToken = (userId, firstName, lastName, position) => {
  return createToken(
    userId,
    firstName,
    lastName,
    position,
    "10d",
    process.env.REFRESH_TOKEN_SECRET,
  );
};

module.exports = {
  encodeAccessToken: encodeAccessToken,
  encodeRefreshToken: encodeRefreshToken,
  jwtSettings: jwtSettings,
};
