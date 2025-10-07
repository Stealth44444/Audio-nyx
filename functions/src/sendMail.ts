import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

// 하드코딩된 Gmail 설정 (테스트용)
const gmailUser = "audionyx369@gmail.com";
const gmailPass = "jnfd alnu vdxi bpla";

// 이메일 유효성 검증 함수
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export const sendMail = functions.https.onRequest(async (req, res) => {
    // CORS 헤더 수동 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Preflight OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const { to, subject, html, attachments: attachmentsInput } = req.body;

    if (!to || typeof to !== "string") {
        res.status(400).json({ success: false, error: "Recipient email address (to) must be a string." });
        return;
    }

    if (!isValidEmail(to)) {
        res.status(400).json({ success: false, error: `"${to}" is not a valid email address.` });
        return;
    }
    
    if (!subject || !html) {
        res.status(400).json({ success: false, error: "Fields 'subject' and 'html' are required." });
        return;
    }

    console.log(`Attempting to send email to:`, to);

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });

        const mailOptions: any = {
            from: `"Audionyx" <${gmailUser}>`,
            to: to,
            subject,
            html,
            text: html.replace(/<[^>]*>/g, ""),
        };

        if (attachmentsInput && Array.isArray(attachmentsInput) && attachmentsInput.length > 0) {
            mailOptions.attachments = attachmentsInput.map((att: any) => ({
                filename: att.filename,
                content: att.content,
                encoding: "base64",
                contentType: att.contentType || undefined,
            }));
        }

        await transporter.sendMail(mailOptions);

        res.status(200).json({
            success: true,
            sentTo: [to],
            count: 1
        });

    } catch (error) {
        console.error("Error sending email:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        res.status(500).json({ success: false, error: `Failed to send email: ${errorMessage}` });
    }
});
