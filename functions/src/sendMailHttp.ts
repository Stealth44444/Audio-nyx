import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

// 하드코딩된 Gmail 설정 (테스트용)
const gmailUser = "audionyx369@gmail.com";
const gmailPass = "jnfd alnu vdxi bpla";

export const sendMailHttp = functions.https.onRequest(async (req, res) => {
  // CORS 허용
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  try {
    const { to, subject, html } = req.body;
    
    // 기본값 설정
    const emailTo = to || "audionyx369@gmail.com";
    const emailSubject = subject || "Audionyx 테스트 메일";
    const emailHtml = html || "<h1>🎵 Audionyx 테스트</h1><p>HTTP 함수 테스트입니다!</p>";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { 
        user: gmailUser, 
        pass: gmailPass 
      }
    });

    await transporter.sendMail({
      from: `"Audionyx" <${gmailUser}>`,
      to: emailTo,
      subject: emailSubject,
      html: emailHtml,
      text: emailHtml.replace(/<[^>]*>/g, "")
    });

    res.status(200).json({ 
      success: true,
      message: "메일 발송 성공!",
      to: emailTo,
      subject: emailSubject
    });

  } catch (error) {
    console.error("메일 발송 오류:", error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류"
    });
  }
}); 