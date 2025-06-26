import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

// 하드코딩된 Gmail 설정 (테스트용)
const gmailUser = "audionyx369@gmail.com";
const gmailPass = "jnfd alnu vdxi bpla";

interface MailData {
  to: string;
  subject: string;
  html: string;
}

export const sendMail = functions.https.onCall(async (data: any, context: any) => {
  // 임시로 모든 검증 비활성화 (테스트용)
  
  // 디버깅: 받은 데이터 구조 로깅 (순환 참조 방지)
  console.log("data의 타입:", typeof data);
  console.log("data의 키들:", Object.keys(data || {}));
  console.log("data.to:", data?.to);
  console.log("data.data?.to:", data?.data?.to);
  
  // data.data가 있다면 그 구조 확인
  if (data?.data) {
    console.log("data.data의 키들:", Object.keys(data.data));
    console.log("data.data.to:", data.data.to);
    console.log("data.data.subject:", data.data.subject);
  }
  
  // 실제 데이터는 data.data 안에 있음
  const actualData = data?.data || data;
  const to = actualData?.to || "test@example.com";
  const subject = actualData?.subject || "Test Subject";
  const html = actualData?.html || "<h1>Test HTML</h1><p>This is a test email.</p>";
  
  console.log("최종 추출된 값들:", { to, subject: subject.substring(0, 50) + "..." });

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { 
        user: gmailUser, 
        pass: gmailPass 
      }
    });

    await transporter.sendMail({
      from: `"Audionyx" <${gmailUser}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, "")   // 아주 간단한 HTML→텍스트 변환
    });

    return { ok: true };
  } catch (error) {
    console.error("메일 발송 오류:", error);
    throw new functions.https.HttpsError("internal", "메일 발송 실패");
  }
}); 