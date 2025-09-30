import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

// 하드코딩된 Gmail 설정 (테스트용)
const gmailUser = "audionyx369@gmail.com";
const gmailPass = "jnfd alnu vdxi bpla";

interface MailData {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded string
    contentType?: string;
  }>;
}

// 이메일 유효성 검증 함수
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// 이메일 주소들을 배열로 파싱하는 함수
function parseEmailAddresses(to: string | string[]): string[] {
  if (Array.isArray(to)) {
    return to.map(email => email.trim()).filter(email => email && isValidEmail(email));
  }
  
  // 쉼표, 세미콜론, 줄바꿈으로 구분된 이메일 주소들을 파싱
  return to
    .split(/[,;\n]/)
    .map(email => email.trim())
    .filter(email => email && isValidEmail(email));
}

export const sendMail = functions.https.onCall(async (data: any, context: any) => {
  // 디버깅: 받은 데이터 구조 로깅
  console.log("data의 타입:", typeof data);
  console.log("data의 키들:", Object.keys(data || {}));
  
  // 실제 데이터는 data.data 안에 있을 수 있음
  const actualData = data?.data || data;
  const to = actualData?.to;
  const subject = actualData?.subject || "Test Subject";
  const html = actualData?.html || "<h1>Test HTML</h1><p>This is a test email.</p>";
  const attachmentsInput = actualData?.attachments as MailData["attachments"] | undefined;
  
  if (!to) {
    throw new functions.https.HttpsError("invalid-argument", "받는 사람 이메일 주소가 필요합니다.");
  }

  // 이메일 주소들을 파싱하고 검증
  const emailAddresses = parseEmailAddresses(to);
  
  if (emailAddresses.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "유효한 이메일 주소가 없습니다.");
  }

  console.log(`${emailAddresses.length}개의 이메일 주소로 발송 시도:`, emailAddresses);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { 
        user: gmailUser, 
        pass: gmailPass 
      }
    });

    // 여러 이메일 주소로 동시에 발송
    const mailOptions: any = {
      from: `"Audionyx" <${gmailUser}>`,
      to: emailAddresses.join(", "), // 쉼표로 구분하여 여러 수신자에게 발송
      subject,
      html,
      // HTML이 없거나 일반 텍스트가 들어온 경우에도 줄바꿈 보존
      // 1) text: 태그 제거 + 줄바꿈 유지
      // 2) html이 태그가 없는 순수 텍스트로 보이면 <br>로 치환한 간단 HTML 생성
      text: (() => {
        const value = String(html ?? "");
        const withoutTags = value.replace(/<[^>]*>/g, "");
        return withoutTags;
      })(),
    };

    // 순수 텍스트가 들어온 경우 간단한 줄바꿈 보존 HTML 생성
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(String(html || ''));
    if (!looksLikeHtml) {
      const escaped = String(html || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
      mailOptions.html = escaped.replace(/\r\n|\r|\n/g, '<br>');
    }

    if (attachmentsInput && Array.isArray(attachmentsInput) && attachmentsInput.length > 0) {
      mailOptions.attachments = attachmentsInput.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content, "base64"),
        contentType: att.contentType || undefined,
        encoding: "base64"
      }));
    }

    await transporter.sendMail(mailOptions);

    return { 
      ok: true, 
      sentTo: emailAddresses,
      count: emailAddresses.length 
    };
  } catch (error) {
    console.error("메일 발송 오류:", error);
    throw new functions.https.HttpsError("internal", `메일 발송 실패: ${error}`);
  }
}); 