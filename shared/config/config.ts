import dotenv from "dotenv";
dotenv.config();

export const config = {
  PORT: process.env.PORT,
  DB_URI: process.env.DB_URI,
  EMAIL_NAME: process.env.EMAIL_NAME,
  EMAIL_PASS: process.env.EMAIL_PASS,
};
