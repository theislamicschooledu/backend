export const getVerificationEmailHtml = (otp, username) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Email Verification</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; margin: 40px auto; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden;">
            <tr>
              <td style="background-color: #4F46E5; padding: 20px 0; text-align: center;">
                <h1 style="color: #ffffff; margin: 0;">Verify Your Email</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px; text-align: center;">
                <p style="font-size: 18px; color: #333333;">Hello ${username},</p>
                <p style="font-size: 16px; color: #555555;">
                  Thank you for signing up! Please use the following OTP to verify your email address:
                </p>
                <div style="margin: 30px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4F46E5;">${otp}</span>
                </div>
                <p style="font-size: 14px; color: #999999;">
                  This OTP is valid for 10 minutes. If you did not request this, please ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f4f4f4; text-align: center; padding: 20px;">
                <p style="font-size: 12px; color: #999999;">
                  &copy; ${new Date().getFullYear()} Rangpur Zen-Z Online Shop. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

export const getForgetPasswordEmailHtml = (resetLink, username) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Password Reset</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; margin: 40px auto; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden;">
            
            <!-- Header -->
            <tr>
              <td style="background-color: #4F46E5; padding: 20px 0; text-align: center;">
                <h1 style="color: #ffffff; margin: 0;">Reset Your Password</h1>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding: 30px; text-align: center;">
                <p style="font-size: 18px; color: #333333;">Hello ${username},</p>
                <p style="font-size: 16px; color: #555555;">
                  We received a request to reset your password. Click the button below to reset it:
                </p>
                <div style="margin: 30px 0;">
                  <a href="${resetLink}" 
                     style="background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
                    Reset Password
                  </a>
                </div>
                <p style="font-size: 14px; color: #999999;">
                  This link will expire in 10 minutes. If you did not request a password reset, please ignore this email.
                </p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="background-color: #f4f4f4; text-align: center; padding: 20px;">
                <p style="font-size: 12px; color: #999999;">
                  &copy; ${new Date().getFullYear()} Rangpur Zen-Z Online Shop. All rights reserved.
                </p>
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};
