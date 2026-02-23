import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, template) => {
  const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

  const mailOptions = {
    from: `"Islamic Edu" <${process.env.EMAIL_USER}>`,
    to,
    subject: subject,
    html: template
  };

  await transporter.sendMail(mailOptions);
};
 