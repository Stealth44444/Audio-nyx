"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = void 0;
const functions = __importStar(require("firebase-functions"));
const nodemailer = __importStar(require("nodemailer"));
// 하드코딩된 Gmail 설정 (테스트용)
const gmailUser = "audionyx369@gmail.com";
const gmailPass = "jnfd alnu vdxi bpla";
// 이메일 유효성 검증 함수
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}
// 이메일 주소들을 배열로 파싱하는 함수
function parseEmailAddresses(to) {
    if (Array.isArray(to)) {
        return to.map(email => email.trim()).filter(email => email && isValidEmail(email));
    }
    // 쉼표, 세미콜론, 줄바꿈으로 구분된 이메일 주소들을 파싱
    return to
        .split(/[,;\n]/)
        .map(email => email.trim())
        .filter(email => email && isValidEmail(email));
}
exports.sendMail = functions.https.onCall(async (data, context) => {
    // 디버깅: 받은 데이터 구조 로깅
    console.log("data의 타입:", typeof data);
    console.log("data의 키들:", Object.keys(data || {}));
    // 실제 데이터는 data.data 안에 있을 수 있음
    const actualData = (data === null || data === void 0 ? void 0 : data.data) || data;
    const to = actualData === null || actualData === void 0 ? void 0 : actualData.to;
    const subject = (actualData === null || actualData === void 0 ? void 0 : actualData.subject) || "Test Subject";
    const html = (actualData === null || actualData === void 0 ? void 0 : actualData.html) || "<h1>Test HTML</h1><p>This is a test email.</p>";
    const attachmentsInput = actualData === null || actualData === void 0 ? void 0 : actualData.attachments;
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
        const mailOptions = {
            from: `"Audionyx" <${gmailUser}>`,
            to: emailAddresses.join(", "), // 쉼표로 구분하여 여러 수신자에게 발송
            subject,
            html,
            text: html.replace(/<[^>]*>/g, "") // HTML→텍스트 변환
        };
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
    }
    catch (error) {
        console.error("메일 발송 오류:", error);
        throw new functions.https.HttpsError("internal", `메일 발송 실패: ${error}`);
    }
});
//# sourceMappingURL=sendMail.js.map